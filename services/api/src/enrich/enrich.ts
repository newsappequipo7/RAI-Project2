import { enrichSuggestionSchema, type EnrichRequest, type EnrichSuggestion } from '@repo/shared';
import { gateway } from '../ai/gateway';
import { isLiveMode } from '../ai/config';
import {
  buildEnrichPrompt,
  ENRICH_MAX_TOKENS,
  ENRICH_PROMPT_VERSION,
} from '../ai/prompts/enrich.v1';
import type { Bindings } from '../env';
import { providerError } from '../errors';
import { normalizeSuggestion, parseModelJson } from './normalize';

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

type Run = typeof gateway.run;

export interface EnrichDeps {
  run?: Run;
  recordCacheHit?: typeof gateway.recordCacheHit;
  now?: () => Date;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache key: prompt version, AI mode and a hash of title + lead + body. The mode keeps simulated
 * (mock) results from ever being served once the Worker runs live; the version drops old results
 * when the prompt changes.
 */
export async function enrichCacheKey(env: Bindings, request: EnrichRequest): Promise<string> {
  const hash = await sha256Hex(JSON.stringify([request.title, request.lead ?? '', request.body]));
  return `enrich:${ENRICH_PROMPT_VERSION}:${isLiveMode(env) ? 'live' : 'mock'}:${hash}`;
}

/**
 * One model call per distinct content (F2-04). A repeat with the same content is served from KV,
 * recorded in the ledger as a cached call, and costs nothing.
 */
export async function enrichNews(
  env: Bindings,
  uid: string,
  request: EnrichRequest,
  deps: EnrichDeps = {},
): Promise<EnrichSuggestion> {
  const run = deps.run ?? gateway.run;
  const recordCacheHit = deps.recordCacheHit ?? gateway.recordCacheHit;
  const now = deps.now ?? (() => new Date());
  const key = await enrichCacheKey(env, request);

  const stored = enrichSuggestionSchema.safeParse(await env.KV.get(key, 'json'));
  if (stored.success) {
    await recordCacheHit('enrich', { env, uid, now });
    return { ...stored.data, costUsd: 0 };
  }

  const { system, prompt } = buildEnrichPrompt({
    title: request.title,
    lead: request.lead ?? '',
    body: request.body,
    sources: request.sources ?? [],
  });
  const result = await run(
    'enrich',
    { kind: 'text', system, prompt, maxTokens: ENRICH_MAX_TOKENS },
    { env, uid, now },
  );
  if (result.output.kind !== 'text') throw providerError('Unexpected model output');

  const suggestion = normalizeSuggestion(parseModelJson(result.output.text), {
    model: result.model,
    costUsd: result.costUsd,
    createdAt: now().toISOString(),
  });

  await env.KV.put(key, JSON.stringify(suggestion), { expirationTtl: CACHE_TTL_SECONDS });
  return suggestion;
}
