import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { recordWhyOpened, submitFeedFeedback } from '../apps/mobile/src/services/feedFeedback';
import corpus from '../packages/shared/fixtures/news.json';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';

const now = new Date('2026-10-09T12:00:00Z');
let environment: RulesTestEnvironment;
const db = () => environment.authenticatedContext('reader').firestore() as unknown as Firestore;
const profileRef = () => doc(db(), 'users', 'reader');
const eventsRef = () => collection(db(), 'users', 'reader', 'events');

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await setDoc(profileRef(), createDefaultProfile('reader', 'Lector', 'gt-guatemala', now));
});

describe('F3-06 feedback persistence', () => {
  it('records why_opened without changing the profile', async () => {
    const before = (await getDoc(profileRef())).data();
    await recordWhyOpened(db(), 'reader', 'story-1', 'gt-guatemala', now);
    const events = await getDocs(eventsRef());
    expect(events.size).toBe(1);
    expect(events.docs[0]?.data()).toMatchObject({
      type: 'why_opened',
      newsId: 'story-1',
      locationId: 'gt-guatemala',
      at: now.toISOString(),
    });
    expect((await getDoc(profileRef())).data()).toEqual(before);
  });

  it('saves feedback and its event atomically while preserving a newer location edit', async () => {
    await updateDoc(profileRef(), {
      locationId: 'gt-quetzaltenango',
      updatedAt: now.toISOString(),
    });
    const story = { id: 'sports-1', topics: ['deportes'] };
    const more = await submitFeedFeedback(db(), 'reader', story, 'more_like_this', now);
    expect(more.locationId).toBe('gt-quetzaltenango');
    expect(more.interests.deportes).toBe(2);
    const less = await submitFeedFeedback(db(), 'reader', story, 'less_like_this', now);
    expect(less.interests.deportes).toBe(0);
    expect(less.mutedTopics).toContain('deportes');
    const news = buildSeedNews(corpus as SeedNews[], now);
    const beforeRanking = rankFeed({ news, profile: more, locationId: more.locationId, now });
    const afterRanking = rankFeed({ news, profile: less, locationId: less.locationId, now });
    const sportsItem = beforeRanking.feed.find((item) => item.news.topics.includes('deportes'))!;
    expect(afterRanking.feed.find((item) => item.news.id === sportsItem.news.id)!.score).toBeLessThan(sportsItem.score);
    expect(afterRanking.mustKnow).toEqual(beforeRanking.mustKnow);
    const persisted = (await getDoc(profileRef())).data();
    expect(persisted).toMatchObject({
      locationId: 'gt-quetzaltenango',
      interests: { deportes: 0 },
      mutedTopics: ['deportes'],
    });
    const events = (await getDocs(eventsRef())).docs.map((event) => event.data());
    expect(events.map((event) => event.type).sort()).toEqual(['less_like_this', 'more_like_this']);
    expect(events.every((event) => event.locationId === 'gt-quetzaltenango')).toBe(true);
  });
});
