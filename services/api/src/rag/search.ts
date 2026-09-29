import type { IndexEntry } from '@repo/shared';
import type { Bindings } from '../env';
import { embedTexts, readIndex } from './index';

export const DEFAULT_TOP_K = 6;

export interface SearchOptions {
  topK?: number;
  countries?: string[];
}

export interface ScoredEntry {
  entry: IndexEntry;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let position = 0; position < a.length; position += 1) {
    const valueA = a[position] ?? 0;
    const valueB = b[position] ?? 0;
    dot += valueA * valueB;
    normA += valueA * valueA;
    normB += valueB * valueB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dot / denominator;
}

function matchesCountries(entry: IndexEntry, countries: string[] | undefined): boolean {
  if (!countries || countries.length === 0) return true;
  return entry.geo.countries.some((country) => countries.includes(country));
}

export function rankEntries(
  entries: IndexEntry[],
  queryEmbedding: number[],
  { topK = DEFAULT_TOP_K, countries }: SearchOptions = {},
): ScoredEntry[] {
  return entries
    .filter((entry) => entry.certainty !== 'retractada' && matchesCountries(entry, countries))
    .map((entry) => ({ entry, score: cosineSimilarity(entry.embedding, queryEmbedding) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

export async function searchIndex(
  env: Bindings,
  query: string,
  options: SearchOptions = {},
): Promise<ScoredEntry[]> {
  const [queryEmbedding] = await embedTexts(env, [query]);
  if (!queryEmbedding) return [];

  return rankEntries(await readIndex(env.KV), queryEmbedding, options);
}
