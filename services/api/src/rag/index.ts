import type { IndexEntry, IndexInput } from '@repo/shared';
import { gateway } from '../ai/gateway';
import type { Bindings } from '../env';
import { DIGEST_PREFIX, indexEntriesKey, readIndexVersion, writeIndexVersion } from '../kv';

const EXCERPT_LENGTH = 1200;
const EMBED_BATCH_SIZE = 25;
const EMBEDDING_DECIMALS = 5;

export interface IndexMutation {
  indexVersion: number;
  invalidatedDigests: string[];
}

export function buildExcerpt(body: string): string {
  return body.slice(0, EXCERPT_LENGTH);
}

export function buildEmbeddingText(input: Pick<IndexInput, 'title' | 'lead' | 'body'>): string {
  return [input.title, input.lead, buildExcerpt(input.body)].filter(Boolean).join('\n');
}

function roundEmbedding(embedding: number[]): number[] {
  const factor = 10 ** EMBEDDING_DECIMALS;
  return embedding.map((value) => Math.round(value * factor) / factor);
}

export async function embedTexts(env: Bindings, texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    const result = await gateway.run(
      'embed',
      { kind: 'embed', texts: texts.slice(start, start + EMBED_BATCH_SIZE) },
      { env },
    );

    if (result.output.kind !== 'embed') {
      throw new Error('Embedding task returned a non-embedding output');
    }

    embeddings.push(...result.output.embeddings.map(roundEmbedding));
  }

  return embeddings;
}

export async function readIndex(kv: KVNamespace): Promise<IndexEntry[]> {
  const version = await readIndexVersion(kv);
  if (version === 0) return [];

  const stored = await kv.get<IndexEntry[]>(indexEntriesKey(version), 'json');
  return stored ?? [];
}

async function buildEntries(env: Bindings, inputs: IndexInput[]): Promise<IndexEntry[]> {
  const embeddings = await embedTexts(env, inputs.map(buildEmbeddingText));
  const indexedAt = new Date().toISOString();

  return inputs.map(({ body, ...rest }, position) => ({
    ...rest,
    excerpt: buildExcerpt(body),
    embedding: embeddings[position] ?? [],
    indexedAt,
  }));
}

async function invalidateDigests(kv: KVNamespace): Promise<string[]> {
  const { keys } = await kv.list({ prefix: DIGEST_PREFIX });
  await Promise.all(keys.map(({ name }) => kv.delete(name)));
  return keys.map(({ name }) => name.slice(DIGEST_PREFIX.length));
}

async function publishIndex(kv: KVNamespace, entries: IndexEntry[]): Promise<IndexMutation> {
  const previousVersion = await readIndexVersion(kv);
  const indexVersion = previousVersion + 1;

  await kv.put(indexEntriesKey(indexVersion), JSON.stringify(entries));
  await writeIndexVersion(kv, indexVersion);
  if (previousVersion > 0) await kv.delete(indexEntriesKey(previousVersion));

  return { indexVersion, invalidatedDigests: await invalidateDigests(kv) };
}

export async function upsert(env: Bindings, inputs: IndexInput[]): Promise<IndexMutation> {
  const [current, fresh] = await Promise.all([readIndex(env.KV), buildEntries(env, inputs)]);
  const freshIds = new Set(fresh.map((entry) => entry.id));
  const kept = current.filter((entry) => !freshIds.has(entry.id));

  return publishIndex(env.KV, [...kept, ...fresh]);
}

export async function remove(
  env: Bindings,
  ids: string[],
): Promise<IndexMutation & { removed: number }> {
  const current = await readIndex(env.KV);
  const idsToRemove = new Set(ids);
  const kept = current.filter((entry) => !idsToRemove.has(entry.id));

  return { ...(await publishIndex(env.KV, kept)), removed: current.length - kept.length };
}

export async function rebuild(env: Bindings, inputs: IndexInput[]): Promise<IndexMutation> {
  return publishIndex(env.KV, await buildEntries(env, inputs));
}
