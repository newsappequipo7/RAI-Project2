import {
  chatResponseSchema,
  classifyIntent,
  findLocation,
  normalizeText,
  UNCERTAIN_CERTAINTIES,
  type ChatMode,
  type ChatRequest,
  type ChatResponse,
  type IndexEntry,
} from '@repo/shared';
import { isLiveMode } from '../ai/config';
import { gateway } from '../ai/gateway';
import { buildChatPrompt, CHAT_MAX_TOKENS, CHAT_PROMPT_VERSION } from '../ai/prompts/chat.v1';
import { CHAT_RATE_LIMIT_PER_HOUR, consumeRateLimit } from '../ai/rateLimit';
import type { GatewayContext, GatewayResult } from '../ai/types';
import type { Bindings } from '../env';
import { ApiError } from '../errors';
import { CHAT_CACHE_PREFIX, readIndexVersion } from '../kv';
import { CHAT_CONFIG } from './chatConfig';
import { readIndex } from './index';
import { rankEntries, type ScoredEntry } from './search';
import { parseChatOutput, validateAnswer, type ChatModelOutput } from './validate';

export const CHAT_NOTICES = {
  blocked:
    'El chat está pausado por ahora. Puedes seguir leyendo las noticias publicadas en el feed.',
  abstain: 'No encontré noticias publicadas sobre eso. Puedo contarte lo más reciente de tu zona.',
  retrievalOnly:
    'Respuesta sin IA: estas son las noticias publicadas que encontré sobre tu pregunta.',
  uncertain: 'Hay información en desarrollo o disputada: revisa la certeza de cada noticia.',
  partial: 'Las noticias publicadas responden solo una parte de tu pregunta.',
} as const;

const SCORE_DECIMALS = 3;

export interface ChatContext {
  env: Bindings;
  uid: string;
  now?: () => Date;
  /** Test seam: replaces the model providers used for generation. */
  providers?: GatewayContext['providers'];
}

interface Retrieval {
  hits: ScoredEntry[];
  topScores: number[];
  costUsd: number;
}

/** A response plus whether it may be cached (degraded fallbacks are retried next time). */
interface Outcome {
  response: ChatResponse;
  cacheable: boolean;
}

function emptyResponse(mode: ChatResponse['mode'], notice: string): ChatResponse {
  return { mode, blocks: [], sources: [], notice, generatedBy: null, cached: false, costUsd: 0 };
}

function joinNotices(...notices: (string | false | undefined)[]): string | undefined {
  const present = notices.filter((notice): notice is string => Boolean(notice));
  return present.length > 0 ? present.join(' ') : undefined;
}

async function cacheKey(env: Bindings, request: ChatRequest, indexVersion: number, mode: ChatMode) {
  const material = JSON.stringify([
    CHAT_CONFIG.cacheVersion,
    CHAT_PROMPT_VERSION,
    isLiveMode(env) ? 'live' : 'mock',
    normalizeText(request.message),
    request.locationId,
    indexVersion,
    mode,
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

/** Without a model: one block per news found, with its own certainty. */
function retrievalOnlyResponse(entries: IndexEntry[], costUsd: number): ChatResponse {
  const uncertain = entries.some(({ certainty }) => UNCERTAIN_CERTAINTIES.includes(certainty));

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
    notice: joinNotices(CHAT_NOTICES.retrievalOnly, uncertain && CHAT_NOTICES.uncertain),
    generatedBy: null,
    cached: false,
    costUsd,
  };
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Steps 8–10: one model call (plus a single retry when the output is not the requested JSON),
 * then validation in code. A provider or budget failure degrades to `retrieval_only`; the ledger
 * rows are written by the gateway.
 */
async function generate(
  request: ChatRequest,
  ctx: ChatContext,
  context: IndexEntry[],
  costSoFar: number,
): Promise<Outcome> {
  const gatewayCtx: GatewayContext = {
    env: ctx.env,
    uid: ctx.uid,
    now: ctx.now,
    providers: ctx.providers,
    rateLimitApplied: true,
  };
  let costUsd = costSoFar;
  let last: GatewayResult | undefined;
  let output: ChatModelOutput | null = null;

  try {
    for (const formatReminder of [false, true]) {
      const { system, prompt } = buildChatPrompt({
        question: request.message,
        history: request.history ?? [],
        news: context,
        excerptLength: CHAT_CONFIG.contextExcerptLength,
        formatReminder,
      });
      last = await gateway.run(
        'chat_answer',
        { kind: 'text', system, prompt, maxTokens: CHAT_MAX_TOKENS },
        gatewayCtx,
      );
      costUsd += last.costUsd;
      output = last.output.kind === 'text' ? parseChatOutput(last.output.text) : null;
      if (output) break;
    }
  } catch (error) {
    if (!isApiError(error)) throw error;
    return { response: retrievalOnlyResponse(context, costUsd), cacheable: false };
  }

  if (!output || !last) {
    return { response: retrievalOnlyResponse(context, costUsd), cacheable: false };
  }

  const answer = validateAnswer(output, context);
  if (answer.blocks.length === 0) {
    return {
      response: { ...emptyResponse('abstain', CHAT_NOTICES.abstain), costUsd },
      cacheable: true,
    };
  }

  return {
    response: {
      mode: 'answer',
      blocks: answer.blocks,
      sources: answer.sources,
      notice: joinNotices(
        answer.uncertain && CHAT_NOTICES.uncertain,
        answer.partial && CHAT_NOTICES.partial,
      ),
      generatedBy: { provider: last.provider, model: last.model },
      cached: false,
      costUsd,
    },
    cacheable: true,
  };
}

/**
 * Chat pipeline, CHAT-RAG.md §2. Each step can end the response. The digest shortcut (step 4)
 * arrives with F4-03.
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
  const key = await cacheKey(env, request, indexVersion, policy.chatMode);
  const cached = await readCached(env.KV, key);
  if (cached) {
    if (cached.mode === 'answer')
      await gateway.recordCacheHit('chat_answer', { env, uid, now: () => now });
    const { debug: cachedDebug, ...rest } = cached;
    return withDebug({ ...rest, cached: true, costUsd: 0 }, cachedDebug);
  }

  // 5. Retrieval.
  let retrieval: Retrieval;
  try {
    retrieval = await retrieve(request, ctx, countries, intent);
  } catch (error) {
    if (isApiError(error) && error.code === 'budget_blocked') {
      return emptyResponse('blocked', CHAT_NOTICES.blocked);
    }
    throw error;
  }

  const threshold = CHAT_CONFIG.abstainThreshold;
  const debug = { intent, topScores: retrieval.topScores, threshold };
  const relevant = retrieval.hits
    .filter(({ score }) => score >= threshold)
    .map(({ entry }) => entry);

  let outcome: Outcome;
  if (relevant.length === 0) {
    // 6. Abstention below τ: no model, a zero-cost `abstained` row in the ledger.
    await gateway.recordAbstention('chat_answer', { env, uid, now: () => now });
    outcome = {
      response: { ...emptyResponse('abstain', CHAT_NOTICES.abstain), costUsd: retrieval.costUsd },
      cacheable: true,
    };
  } else if (policy.chatMode === 'retrieval_only') {
    outcome = { response: retrievalOnlyResponse(relevant, retrieval.costUsd), cacheable: true };
  } else {
    // 8–10. Generation and validation.
    outcome = await generate(request, ctx, relevant, retrieval.costUsd);
  }

  const response = withDebug(outcome.response, debug);
  if (outcome.cacheable) {
    await env.KV.put(key, JSON.stringify(response), {
      expirationTtl: CHAT_CONFIG.cacheTtlSeconds,
    });
  }
  return response;
}
