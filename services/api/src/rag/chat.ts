import {
  chatResponseSchema,
  classifyIntent,
  findLocation,
  normalizeText,
  type ChatMode,
  type ChatRequest,
  type ChatResponse,
} from '@repo/shared';
import { isLiveMode } from '../ai/config';
import { gateway } from '../ai/gateway';
import { CHAT_PROMPT_VERSION } from '../ai/prompts/chat.v1';
import { CHAT_RATE_LIMIT_PER_HOUR, consumeRateLimit } from '../ai/rateLimit';
import type { GatewayContext } from '../ai/types';
import type { Bindings } from '../env';
import { ApiError } from '../errors';
import { isAdminUid } from '../middleware/admin';
import { CHAT_CACHE_PREFIX, readIndexVersion } from '../kv';
import { askModel, CHAT_NOTICES, emptyResponse, retrievalOnlyResponse } from './answer';
import { CHAT_CONFIG } from './chatConfig';
import { getDigest } from './digest';
import { readIndex } from './index';
import { rankEntries, type ScoredEntry } from './search';

export { CHAT_NOTICES } from './answer';

const SCORE_DECIMALS = 3;
const DIGEST_INTENTS = ['resumen', 'mi_region'];

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

async function cacheKey(
  env: Bindings,
  request: ChatRequest,
  indexVersion: number,
  mode: ChatMode,
): Promise<string> {
  const material = JSON.stringify([
    CHAT_CONFIG,
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

/**
 * Chat pipeline, CHAT-RAG.md §2. Each step can end the response; steps run in the order of the
 * doc except the cache, which is read before retrieval (see the F4-01 notes there).
 */
export async function runChat(request: ChatRequest, ctx: ChatContext): Promise<ChatResponse> {
  const { env, uid } = ctx;
  const now = ctx.now?.() ?? new Date();
  const threshold = CHAT_CONFIG.abstainThreshold;
  const withDebug = (response: ChatResponse, debug: ChatResponse['debug']): ChatResponse =>
    env.ENV === 'dev' ? { ...response, debug } : response;

  // 1. Rate limit (auth already happened in the route). In dev only, project admins are exempt so
  // the golden set (F4-05) can run more than 20 questions in an hour; demo limits everyone.
  if (!(env.ENV === 'dev' && isAdminUid(env.ADMIN_UIDS, uid))) {
    await consumeRateLimit(env.DB, uid, CHAT_RATE_LIMIT_PER_HOUR, now);
  }

  // 2. Flags and budget.
  const policy = await gateway.chatPolicy({ env, uid, now: () => now });
  if (policy.killSwitch) return emptyResponse('blocked', CHAT_NOTICES.blocked);

  // 3. Intent, by rules.
  const { intent, countries, generic } = classifyIntent(request.message, request.locationId);

  // 4. Digest shortcut: a generic summary or "my area" question gets the location digest. If there
  // is no digest to give (no recent news, no model allowed), the normal pipeline answers instead.
  if (DIGEST_INTENTS.includes(intent) && generic) {
    const digest = await getDigest(request.locationId, {
      env,
      uid,
      now: () => now,
      providers: ctx.providers,
    });
    if (digest.mode === 'digest') return withDebug(digest, { intent, topScores: [], threshold });
  }

  // 7. Cache, checked before retrieval so a repeated question does not even pay the embedding.
  const indexVersion = await readIndexVersion(env.KV);
  const key = await cacheKey(env, request, indexVersion, policy.chatMode);
  const cached = await readCached(env.KV, key);
  if (cached) {
    if (cached.mode === 'answer') {
      await gateway.recordCacheHit('chat_answer', { env, uid, now: () => now });
    }
    const { debug: cachedDebug, ...rest } = cached;
    return withDebug({ ...rest, cached: true, costUsd: 0 }, cachedDebug);
  }

  // 5. Retrieval.
  let retrieval: Retrieval;
  try {
    retrieval = await retrieve(request, ctx, countries, intent);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'budget_blocked') {
      return emptyResponse('blocked', CHAT_NOTICES.blocked);
    }
    throw error;
  }

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
    // 8–10. Generation and validation; the rate limit was already applied in step 1.
    const answer = await askModel(
      'chat_answer',
      { question: request.message, history: request.history ?? [], context: relevant },
      { env, uid, now: () => now, providers: ctx.providers, rateLimitApplied: true },
    );
    const costUsd = retrieval.costUsd + answer.costUsd;

    if (!answer.ok) {
      outcome = { response: retrievalOnlyResponse(relevant, costUsd), cacheable: false };
    } else if (answer.response.blocks.length === 0) {
      outcome = {
        response: { ...emptyResponse('abstain', CHAT_NOTICES.abstain), costUsd },
        cacheable: true,
      };
    } else {
      outcome = {
        response: {
          mode: 'answer',
          ...answer.response,
          generatedBy: answer.generatedBy,
          cached: false,
          costUsd,
        },
        cacheable: true,
      };
    }
  }

  const response = withDebug(outcome.response, debug);
  if (outcome.cacheable) {
    await env.KV.put(key, JSON.stringify(response), {
      expirationTtl: CHAT_CONFIG.cacheTtlSeconds,
    });
  }
  return response;
}
