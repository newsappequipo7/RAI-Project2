import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { saveProfileLocation } from '../apps/mobile/src/services/profileLocation';
import corpus from '../packages/shared/fixtures/news.json';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';

const now = new Date('2026-10-09T12:00:00Z');
const news = buildSeedNews(corpus as SeedNews[], now);
let environment: RulesTestEnvironment;
const db = () => environment.authenticatedContext('reader').firestore() as unknown as Firestore;
const profileRef = () => doc(db(), 'users', 'reader');

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(async () => environment.cleanup());
beforeEach(async () => environment.clearFirestore());

describe('F3-09 simulated location change', () => {
  it('reranks cached news before the profile write resolves and preserves interests', async () => {
    const profile = {
      ...createDefaultProfile('reader', 'Lector', 'gt-guatemala', now),
      interests: { deportes: 4 },
    };
    await setDoc(profileRef(), profile);
    const before = rankFeed({ news, profile, locationId: profile.locationId, now });

    const write = saveProfileLocation(db(), profile, 'es-madrid');
    const optimistic = { ...profile, locationId: 'es-madrid' };
    const started = performance.now();
    const after = rankFeed({ news, profile: optimistic, locationId: optimistic.locationId, now });
    const rankingMs = performance.now() - started;

    expect(rankingMs).toBeLessThan(300);
    expect(after.feed.slice(0, 10).map((item) => item.news.id)).not.toEqual(
      before.feed.slice(0, 10).map((item) => item.news.id),
    );
    expect(after.feed.some((item) => item.news.geo.cityIds.includes('es-madrid'))).toBe(true);
    await write;
    expect((await getDoc(profileRef())).data()).toMatchObject({
      locationId: 'es-madrid',
      interests: { deportes: 4 },
    });
  });
});
