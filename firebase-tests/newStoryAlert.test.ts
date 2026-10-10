import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { publishNews } from '../apps/admin/src/lib/publishFlow';
import { findNewProminentStory } from '../apps/mobile/src/feed/newStoryAlert';
import { watchNewsFeed } from '../apps/mobile/src/services/newsFeed';
import corpus from '../packages/shared/fixtures/news.json';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { News } from '../packages/shared/src/types';

const now = new Date('2026-10-09T12:00:00Z');
const news = buildSeedNews(corpus as SeedNews[], now);
const template = news.find((item) => item.certainty === 'confirmada')!;
let environment: RulesTestEnvironment;
const adminDb = () =>
  environment.authenticatedContext('editor').firestore() as unknown as Firestore;
const readerDb = (uid: string) =>
  environment.authenticatedContext(uid).firestore() as unknown as Firestore;

function withDeadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error('El aviso no llegó en cinco segundos.')), 5_000);
    }),
  ]).finally(() => clearTimeout(timer));
}

function observeReader(uid: string) {
  const profile = createDefaultProfile(uid, 'Lector', 'gt-guatemala', now);
  let previousIds: Set<string> | null = null;
  let resolveBaseline!: () => void;
  let resolveAlert!: (id: string) => void;
  let rejectBoth!: (error: Error) => void;
  let rejectAlert!: (error: Error) => void;
  const baseline = new Promise<void>((resolve, reject) => {
    resolveBaseline = resolve;
    rejectBoth = reject;
  });
  const alert = new Promise<string>((resolve, reject) => {
    resolveAlert = resolve;
    rejectAlert = reject;
  });
  const stop = watchNewsFeed(
    readerDb(uid),
    {
      next: ({ news: current, config }) => {
        const ranking = rankFeed({
          news: current,
          profile,
          locationId: profile.locationId,
          now,
          weights: config.rankingWeights,
        });
        const found = findNewProminentStory(previousIds, ranking);
        previousIds = new Set(current.map((item) => item.id));
        if (found) resolveAlert(found.news.id);
        if (previousIds.size === 0) resolveBaseline();
      },
      error: (error) => {
        rejectBoth(error);
        rejectAlert(error);
      },
    },
    () => now,
  );
  return { baseline, alert, stop };
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins', 'editor'), { email: 'editor@example.com' });
  });
});

describe('F3-10 live news alert', () => {
  it('ignores initial items and lower-ranked additions, but detects new top-three and essential items', () => {
    const profile = createDefaultProfile('reader', 'Lector', 'gt-guatemala', now);
    const ranking = rankFeed({ news, profile, locationId: profile.locationId, now });
    const ids = new Set(news.map((item) => item.id));
    const top = ranking.feed[0]!;
    const fourth = ranking.feed[3]!;
    const essential = ranking.mustKnow[0]!;
    expect(findNewProminentStory(null, ranking)).toBeNull();
    expect(findNewProminentStory(ids, ranking)).toBeNull();
    expect(
      findNewProminentStory(new Set([...ids].filter((id) => id !== fourth.news.id)), ranking),
    ).toBeNull();
    expect(
      findNewProminentStory(new Set([...ids].filter((id) => id !== top.news.id)), ranking)?.news.id,
    ).toBe(top.news.id);
    expect(
      findNewProminentStory(new Set([...ids].filter((id) => id !== essential.news.id)), ranking)
        ?.news.id,
    ).toBe(essential.news.id);
  });

  it('shows a portal publication to two already connected readers within five seconds', async () => {
    const draft: News = {
      ...template,
      id: 'live-story',
      workflow: 'borrador',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      importance: 2,
      corrections: [],
    };
    delete draft.publishedAt;
    delete draft.publishedBy;
    await setDoc(doc(adminDb(), 'news', draft.id), draft);

    const first = observeReader('reader-one');
    const second = observeReader('reader-two');
    try {
      await withDeadline(Promise.all([first.baseline, second.baseline]));
      const started = Date.now();
      await publishNews(adminDb(), draft.id, 'editor', now);
      const detected = await withDeadline(Promise.all([first.alert, second.alert]));
      expect(detected).toEqual(['live-story', 'live-story']);
      expect(Date.now() - started).toBeLessThan(5_000);
    } finally {
      first.stop();
      second.stop();
    }
  });
});
