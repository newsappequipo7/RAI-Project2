import {
  chatBlockSchema,
  chatSourceSchema,
  createDefaultProfile,
  DEFAULT_FEED_WINDOW_HOURS,
  findCountry,
  findLocation,
  MUST_KNOW_WINDOW_HOURS,
  rankFeed,
  type ChatResponse,
  type IndexEntry,
  type News,
} from '@repo/shared';
import { z } from 'zod';
import { gateway } from '../ai/gateway';
import type { GatewayContext } from '../ai/types';
import type { Bindings } from '../env';
import { DIGEST_PREFIX, readIndexVersion } from '../kv';
import { askModel, CHAT_NOTICES, emptyResponse, retrievalOnlyResponse } from './answer';
import { readIndex } from './index';

/** CHAT-RAG.md §5: the digest summarizes the 8 best-ranked news for the location. */
export const DIGEST_SIZE = 8;
/** A digest also expires on its own, so the time window keeps moving even without publications. */
export const DIGEST_TTL_SECONDS = 6 * 60 * 60;
export const DIGEST_PROMPT_VERSION = 'digest.v1';

const HOUR_MS = 3_600_000;
/** Cloudflare KV rejects a shorter `expirationTtl`. */
const MIN_KV_TTL_SECONDS = 60;

const storedDigestSchema = z
  .object({
    version: z.literal(DIGEST_PROMPT_VERSION),
    locationId: z.string(),
    indexVersion: z.number().int(),
    generatedAt: z.string(),
    newsIds: z.array(z.string()),
    blocks: z.array(chatBlockSchema),
    sources: z.array(chatSourceSchema),
    notice: z.string().optional(),
    generatedBy: z.object({ provider: z.string(), model: z.string() }).strict(),
  })
  .strict();

type StoredDigest = z.infer<typeof storedDigestSchema>;

export interface DigestContext {
  env: Bindings;
  uid: string;
  now?: () => Date;
  /** Test seam: replaces the model providers used for generation. */
  providers?: GatewayContext['providers'];
}

export function digestKey(locationId: string): string {
  return `${DIGEST_PREFIX}${locationId}`;
}

/**
 * The index holds only published news, so the fields `rankFeed` reads (id, geo, topics,
 * importance, certainty, publishedAt, workflow) are all available; the rest is filler.
 */
function toRankable(entry: IndexEntry): News {
  return {
    id: entry.id,
    title: entry.title,
    lead: entry.lead,
    body: '',
    bodyOrigin: 'original_editorial',
    topics: entry.topics,
    geo: entry.geo,
    importance: entry.importance,
    certainty: entry.certainty,
    sources: [],
    claims: [],
    workflow: 'publicada',
    checklist: {
      fuentes_revisadas: true,
      afirmaciones_con_respaldo: true,
      titulo_no_sensacionalista: true,
      imagen_etiquetada: true,
      alcance_geo_revisado: true,
      certeza_justificada: true,
    },
    corrections: [],
    version: 1,
    createdBy: 'index',
    createdAt: entry.publishedAt,
    publishedAt: entry.publishedAt,
    updatedAt: entry.publishedAt,
  };
}

/**
 * The news a digest summarizes: same window as the default feed (72 h, essentials 72 h; the Worker
 * does not read `config/public`) and `rankFeed` with a neutral profile, so every reader of the
 * location gets the same, auditable selection. "Lo que debes saber" first, then the feed.
 */
export function selectDigestNews(
  entries: IndexEntry[],
  locationId: string,
  now: Date,
): IndexEntry[] {
  const feedCutoff = now.getTime() - DEFAULT_FEED_WINDOW_HOURS * HOUR_MS;
  const essentialCutoff = now.getTime() - MUST_KNOW_WINDOW_HOURS * HOUR_MS;
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const visible = entries.filter((entry) => {
    const published = Date.parse(entry.publishedAt);
    return (
      Number.isFinite(published) &&
      (published >= feedCutoff || (entry.importance === 3 && published >= essentialCutoff))
    );
  });
  if (visible.length === 0) return [];

  const profile = {
    ...createDefaultProfile('digest', 'Digest', locationId, now),
    personalization: false,
  };
  const ranked = rankFeed({ news: visible.map(toRankable), profile, locationId, now });

  return [...ranked.mustKnow, ...ranked.feed]
    .slice(0, DIGEST_SIZE)
    .flatMap(({ news }) => byId.get(news.id) ?? []);
}

function digestQuestion(locationId: string): string {
  const location = findLocation(locationId);
  const country = location ? findCountry(location.countryIso)?.name : undefined;
  const place = location ? [location.city, country].filter(Boolean).join(', ') : locationId;
  return `Resume lo más importante de las noticias publicadas para un lector de ${place}. Un bloque por tema, empezando por lo más importante.`;
}

async function readStored(kv: KVNamespace, locationId: string): Promise<StoredDigest | null> {
  const parsed = storedDigestSchema.safeParse(await kv.get(digestKey(locationId), 'json'));
  return parsed.success && parsed.data.locationId === locationId ? parsed.data : null;
}

function fromStored(stored: StoredDigest, cached: boolean, costUsd: number): ChatResponse {
  return {
    mode: 'digest',
    blocks: stored.blocks,
    sources: stored.sources,
    ...(stored.notice ? { notice: stored.notice } : {}),
    generatedBy: stored.generatedBy,
    cached,
    costUsd,
  };
}

/**
 * `GET /digest/:locationId` and the chat shortcut (CHAT-RAG.md §2 step 4, §5). Served from KV while
 * it belongs to the current index; otherwise generated once, lazily, and stored. Degraded answers
 * (no model allowed, provider failure) are returned but not stored.
 */
export async function getDigest(locationId: string, ctx: DigestContext): Promise<ChatResponse> {
  const { env, uid } = ctx;
  const now = ctx.now?.() ?? new Date();
  const gatewayCtx: GatewayContext = { env, uid, now: () => now, providers: ctx.providers };

  const policy = await gateway.chatPolicy(gatewayCtx);
  if (policy.killSwitch) return emptyResponse('blocked', CHAT_NOTICES.blocked);

  const indexVersion = await readIndexVersion(env.KV);
  const stored = await readStored(env.KV, locationId);
  if (stored && stored.indexVersion === indexVersion) {
    await gateway.recordCacheHit('digest', gatewayCtx);
    return fromStored(stored, true, 0);
  }

  const selected = selectDigestNews(await readIndex(env.KV), locationId, now);
  if (selected.length === 0) return emptyResponse('abstain', CHAT_NOTICES.noRecentNews);
  if (policy.chatMode === 'retrieval_only') return retrievalOnlyResponse(selected, 0);

  const answer = await askModel(
    'digest',
    { question: digestQuestion(locationId), history: [], context: selected },
    gatewayCtx,
  );
  if (!answer.ok || answer.response.blocks.length === 0) {
    return retrievalOnlyResponse(selected, answer.costUsd);
  }

  const digest: StoredDigest = {
    version: DIGEST_PROMPT_VERSION,
    locationId,
    indexVersion,
    generatedAt: now.toISOString(),
    newsIds: selected.map(({ id }) => id),
    ...answer.response,
    generatedBy: answer.generatedBy,
  };
  await env.KV.put(digestKey(locationId), JSON.stringify(digest), {
    expirationTtl: DIGEST_TTL_SECONDS,
  });
  return fromStored(digest, false, answer.costUsd);
}

/**
 * After an index change, keeps only the digests that are still right (CHAT-RAG.md §5). A digest is
 * invalidated when it cites a news that changed or left, or when its location would now select
 * different news; otherwise it is re-stamped with the new index version. Returns the invalidated
 * location ids. `mutatedIds = 'all'` invalidates every digest (full rebuild).
 */
export async function refreshDigests(
  kv: KVNamespace,
  entries: IndexEntry[],
  mutatedIds: Set<string> | 'all',
  indexVersion: number,
  now: Date = new Date(),
): Promise<string[]> {
  const { keys } = await kv.list({ prefix: DIGEST_PREFIX });
  const invalidated: string[] = [];

  for (const { name } of keys) {
    const locationId = name.slice(DIGEST_PREFIX.length);
    const stored = await readStored(kv, locationId);
    const selection = stored ? selectDigestNews(entries, locationId, now).map(({ id }) => id) : [];
    const stillValid =
      stored !== null &&
      mutatedIds !== 'all' &&
      !stored.newsIds.some((id) => mutatedIds.has(id)) &&
      selection.join('\n') === stored.newsIds.join('\n');

    if (stillValid) {
      // Keep the original expiry: re-stamping must not make a digest live longer.
      const ageSeconds = Math.floor((now.getTime() - Date.parse(stored.generatedAt)) / 1000);
      await kv.put(name, JSON.stringify({ ...stored, indexVersion }), {
        expirationTtl: Math.max(MIN_KV_TTL_SECONDS, DIGEST_TTL_SECONDS - ageSeconds),
      });
    } else {
      await kv.delete(name);
      invalidated.push(locationId);
    }
  }

  return invalidated;
}
