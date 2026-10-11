import {
  chatResponseSchema,
  classifyIntent,
  findLocation,
  normalizeText,
  type Certainty,
  type ChatMode,
  type ChatRequest,
  type ChatResponse,
  type IndexEntry,
} from '@repo/shared';
import { gateway } from '../ai/gateway';
import { CHAT_RATE_LIMIT_PER_HOUR, consumeRateLimit } from '../ai/rateLimit';
import type { Bindings } from '../env';
import { ApiError } from '../errors';
import { CHAT_CACHE_PREFIX, readIndexVersion } from '../kv';
import { CHAT_CONFIG } from './chatConfig';
import { readIndex } from './index';
import { rankEntries, type ScoredEntry } from './search';

export const CHAT_NOTICES = {
  blocked:
    'El chat está pausado por ahora. Puedes seguir leyendo las noticias publicadas en el feed.',
  abstain: 'No encontré noticias publicadas sobre eso. Puedo contarte lo más reciente de tu zona.',
  retrievalOnly:
    'Respuesta sin IA: estas son las noticias publicadas que encontré sobre tu pregunta.',
  uncertain: 'Hay información en desarrollo o disputada: revisa la certeza de cada noticia.',
} as const;

const UNCERTAIN: readonly Certainty[] = ['en_desarrollo', 'disputada'];
const SCORE_DECIMALS = 3;

export interface ChatContext {
  env: Bindings;
  uid: string;
  now?: () => Date;
}

interface Retrieval {
  hits: ScoredEntry[];
  topScores: number[];
  costUsd: number;
}

function emptyResponse(mode: ChatResponse['mode'], notice: string): ChatResponse {
  return { mode, blocks: [], sources: [], notice, generatedBy: null, cached: false, costUsd: 0 };
}

async function cacheKey(request: ChatRequest, indexVersion: number, chatMode: ChatMode) {
  const material = JSON.stringify([
    CHAT_CONFIG.cacheVersion,
    normalizeText(request.message),
    request.locationId,
    indexVersion,
    chatMode,
    (request.history ?? []).map(({ role, content }) => [role, normalizeText(content)]),
  ]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${CHAT_CACHE_PREFIX}${hex}`;
}

async function readCached(kv: KVNamespace, key: string): Promise<ChatResponse | null> {
  const parsed = chatResponseSchema.safeParse(await kv.get(key, 'json'));
  return parsed.success ? parsed.data : null;
}

/** Steps 3 and 5: embed the question through the gateway and rank with the intent's filters. */
async function retrieve(
  request: ChatRequest,
  ctx: ChatContext,
  countries: string[],
  intent: string,
): Promise<Retrieval> {
  const embedded = await gateway.run(
    'embed',
    { kind: 'embed', texts: [request.message] },
    { env: ctx.env, uid: ctx.uid, now: ctx.now },
  );
  const queryEmbedding =
    embedded.output.kind === 'embed' ? embedded.output.embeddings[0] : undefined;
  if (!queryEmbedding) return { hits: [], topScores: [], costUsd: embedded.costUsd };

  const ownCountry = findLocation(request.locationId)?.countryIso;
  const hits = rankEntries(await readIndex(ctx.env.KV), queryEmbedding, {
    topK: CHAT_CONFIG.topK,
    countries: intent === 'otro_pais' ? countries : undefined,
    boostCountries: intent === 'mi_region' && ownCountry ? [ownCountry] : undefined,
    boost: CHAT_CONFIG.regionBoost,
  });

  return {
    hits,
    topScores: hits.map(({ score }) => Number(score.toFixed(SCORE_DECIMALS))),
    costUsd: embedded.costUsd,
  };
}

function leadOf(entry: IndexEntry): string {
  return entry.lead.trim() || entry.excerpt.slice(0, CHAT_CONFIG.fallbackLeadLength).trim();
}

/** Step 6 of the pipeline without a model: one block per news found, with its own certainty. */
function retrievalOnlyResponse(hits: ScoredEntry[], costUsd: number): ChatResponse {
  const entries = hits.map(({ entry }) => entry);
  const uncertain = entries.some(({ certainty }) => UNCERTAIN.includes(certainty));

  return {
    mode: 'retrieval_only',
    blocks: entries.map((entry) => ({
      text: leadOf(entry),
      newsIds: [entry.id],
      certainty: entry.certainty,
    })),
    sources: entries.map((entry) => ({
      newsId: entry.id,
      title: entry.title,
      certainty: entry.certainty,
      publishedAt: entry.publishedAt,
      outlets: [...new Set(entry.sources.map(({ name }) => name))],
    })),
    notice: uncertain
      ? `${CHAT_NOTICES.retrievalOnly} ${CHAT_NOTICES.uncertain}`
      : CHAT_NOTICES.retrievalOnly,
    generatedBy: null,
    cached: false,
    costUsd,
  };
}

function isBudgetBlock(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'budget_blocked';
}

/**
 * Chat pipeline, CHAT-RAG.md §2 steps 1–7. Each step can end the response; no step here calls an
 * LLM. The digest shortcut (step 4) arrives with F4-03 and generation (steps 8–10) with F4-02;
 * until then `full` answers in `retrieval_only`.
 */
export async function runChat(request: ChatRequest, ctx: ChatContext): Promise<ChatResponse> {
  const { env, uid } = ctx;
  const now = ctx.now?.() ?? new Date();
  const withDebug = (response: ChatResponse, debug: ChatResponse['debug']): ChatResponse =>
    env.ENV === 'dev' ? { ...response, debug } : response;

  // 1. Rate limit (auth already happened in the route).
  await consumeRateLimit(env.DB, uid, CHAT_RATE_LIMIT_PER_HOUR, now);

  // 2. Flags and budget.
  const policy = await gateway.chatPolicy({ env, uid, now: () => now });
  if (policy.killSwitch) return emptyResponse('blocked', CHAT_NOTICES.blocked);

  // 3. Intent, by rules.
  const { intent, countries } = classifyIntent(request.message, request.locationId);

  // 7. Cache, checked before retrieval so a repeated question does not even pay the embedding.
  const indexVersion = await readIndexVersion(env.KV);
  const key = await cacheKey(request, indexVersion, policy.chatMode);
  const cached = await readCached(env.KV, key);
  if (cached) {
    const { debug: cachedDebug, ...rest } = cached;
    return withDebug({ ...rest, cached: true, costUsd: 0 }, cachedDebug);
  }

  // 5. Retrieval.
  let retrieval: Retrieval;
  try {
    retrieval = await retrieve(request, ctx, countries, intent);
  } catch (error) {
    if (isBudgetBlock(error)) return emptyResponse('blocked', CHAT_NOTICES.blocked);
    throw error;
  }

  const threshold = CHAT_CONFIG.abstainThreshold;
  const debug = { intent, topScores: retrieval.topScores, threshold };
  const relevant = retrieval.hits.filter(({ score }) => score >= threshold);

  // 6. Abstention below τ: no model, a zero-cost `abstained` row in the ledger.
  let response: ChatResponse;
  if (relevant.length === 0) {
    await gateway.recordAbstention('chat_answer', { env, uid, now: () => now });
    response = { ...emptyResponse('abstain', CHAT_NOTICES.abstain), costUsd: retrieval.costUsd };
  } else {
    response = retrievalOnlyResponse(relevant, retrieval.costUsd);
  }

  response = withDebug(response, debug);
  await env.KV.put(key, JSON.stringify(response), { expirationTtl: CHAT_CONFIG.cacheTtlSeconds });
  return response;
}
