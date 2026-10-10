import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildComparison } from '../apps/admin/src/lib/comparator';
import { watchComparatorFeed, type ComparatorSnapshot } from '../apps/admin/src/lib/comparatorFeed';
import { publishNews } from '../apps/admin/src/lib/publishFlow';
import { watchNewsFeed, type NewsFeedSnapshot } from '../apps/mobile/src/services/newsFeed';
import corpus from '../packages/shared/fixtures/news.json';
import { LOCATIONS } from '../packages/shared/src/catalogs/locations';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { News } from '../packages/shared/src/types';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const WAIT_MS = 5_000;
const template = buildSeedNews(corpus as SeedNews[], NOW).find(
  (news) => news.certainty === 'confirmada',
)!;
let testEnv: RulesTestEnvironment;

const adminDb = () => testEnv.authenticatedContext('editor').firestore() as unknown as Firestore;
const readerDb = () => testEnv.authenticatedContext('reader').firestore() as unknown as Firestore;

async function waitFor<T>(get: () => T | undefined, predicate: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const value = get();
    if (value && predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('El comparador no se actualizó dentro de cinco segundos.');
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins', 'editor'), { email: 'editor@example.com' });
  });
});

describe('F3-11 comparator', () => {
  it('CA1 and CA2: publication reaches the open comparator and matches the neutral mobile ranking', async () => {
    const existing = buildSeedNews(corpus as SeedNews[], NOW)
      .filter(
        (item) =>
          item.certainty === 'confirmada' &&
          Date.parse(item.publishedAt ?? '') > NOW.getTime() - 72 * 3_600_000,
      )
      .slice(0, 4);
    for (const item of existing) await setDoc(doc(adminDb(), 'news', item.id), item);

    let comparison: ComparatorSnapshot | undefined;
    let mobile: NewsFeedSnapshot | undefined;
    let error: Error | undefined;
    const stopComparison = watchComparatorFeed(adminDb(), {
      next: (value) => (comparison = value),
      error: (value) => (error = value),
    });
    const stopMobile = watchNewsFeed(
      readerDb(),
      { next: (value) => (mobile = value), error: (value) => (error = value) },
      () => NOW,
    );
    try {
      await waitFor(
        () => comparison,
        (value) => value.news.length === existing.length,
      );
      await waitFor(
        () => mobile,
        (value) => value.news.length === existing.length,
      );

      const published: News = {
        ...template,
        id: 'comparator-published',
        publishedAt: NOW.toISOString(),
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        certainty: 'confirmada',
        importance: 1,
        corrections: [],
      };
      const draft: News = { ...published, workflow: 'borrador' };
      delete draft.publishedAt;
      delete draft.publishedBy;
      await setDoc(doc(adminDb(), 'news', draft.id), draft);
      const started = Date.now();
      await publishNews(adminDb(), draft.id, 'editor', NOW);

      const portal = await waitFor(
        () => comparison,
        (value) => value.news.some((item) => item.id === published.id),
      );
      const reader = await waitFor(
        () => mobile,
        (value) => value.news.some((item) => item.id === published.id),
      );
      if (error) throw error;
      expect(Date.now() - started).toBeLessThan(WAIT_MS);

      const columns = buildComparison(portal.news, portal.config, 'neutral', NOW);
      expect(columns).toHaveLength(8);
      for (const location of LOCATIONS) {
        const column = columns.find((item) => item.location.id === location.id)!;
        const ranking = rankFeed({
          news: reader.news,
          profile: createDefaultProfile('reader', 'Reader', location.id, NOW),
          locationId: location.id,
          now: NOW,
          weights: reader.config.rankingWeights,
        });
        expect(column.ranking.mustKnow.map((item) => item.news.id)).toEqual(
          ranking.mustKnow.map((item) => item.news.id),
        );
        expect(column.ranking.feed.map((item) => item.news.id)).toEqual(
          ranking.feed.map((item) => item.news.id),
        );
        expect(column.cells.get(published.id)).toEqual({
          position: ranking.feed.findIndex((item) => item.news.id === published.id) + 1,
          section: 'feed',
          tier: ranking.feed.find((item) => item.news.id === published.id)?.tier,
        });
        expect(column.ranking.diversity).toEqual(ranking.diversity);
      }
    } finally {
      stopComparison();
      stopMobile();
    }
  });
});
