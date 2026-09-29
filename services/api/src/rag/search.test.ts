import type { IndexEntry } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { cosineSimilarity, rankEntries } from './search';

function entry(id: string, embedding: number[], overrides: Partial<IndexEntry> = {}): IndexEntry {
  return {
    id,
    title: id,
    lead: '',
    excerpt: '',
    topics: [],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] },
    importance: 1,
    certainty: 'confirmada',
    sources: [],
    publishedAt: '2026-09-01T00:00:00.000Z',
    embedding,
    indexedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('cosineSimilarity', () => {
  it('is 1 for parallel vectors and 0 for orthogonal ones', () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is 0 for mismatched or zero vectors', () => {
    expect(cosineSimilarity([1, 0], [1])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('rankEntries', () => {
  const entries = [
    entry('a', [1, 0]),
    entry('b', [0.8, 0.6]),
    entry('c', [0, 1]),
    entry('retracted', [1, 0], { certainty: 'retractada' }),
    entry('mx', [0.9, 0.1], {
      geo: { scope: 'nacional', countries: ['MX'], cityIds: [], regions: [] },
    }),
  ];

  it('orders by score and never returns retracted news', () => {
    const ids = rankEntries(entries, [1, 0]).map(({ entry: found }) => found.id);
    expect(ids).toEqual(['a', 'mx', 'b', 'c']);
    expect(ids).not.toContain('retracted');
  });

  it('applies topK', () => {
    expect(rankEntries(entries, [1, 0], { topK: 2 })).toHaveLength(2);
  });

  it('filters by country', () => {
    const ids = rankEntries(entries, [1, 0], { countries: ['MX'] }).map(
      ({ entry: found }) => found.id,
    );
    expect(ids).toEqual(['mx']);
  });

  it('keeps a retracted entry out even when it is the best match', () => {
    const only = [entry('retracted', [1, 0], { certainty: 'retractada' })];
    expect(rankEntries(only, [1, 0])).toEqual([]);
  });
});
