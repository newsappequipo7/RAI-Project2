import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, updateDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { publishNews } from '../apps/admin/src/lib/publishFlow';
import { watchNewsFeed, type NewsFeedSnapshot } from '../apps/mobile/src/services/newsFeed';
import { watchProfile } from '../apps/mobile/src/services/profileWatch';
import corpus from '../packages/shared/fixtures/news.json';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { News, UserProfile } from '../packages/shared/src/types';

const NOW = new Date('2026-10-09T12:00:00.000Z');
const HOUR_MS = 3_600_000;
const WAIT_MS = 5_000;
const template = buildSeedNews(corpus as SeedNews[], NOW).find(
  (news) => news.certainty === 'confirmada',
)!;
let testEnv: RulesTestEnvironment;

const adminDb = () => testEnv.authenticatedContext('editor').firestore() as unknown as Firestore;
const readerDb = () => testEnv.authenticatedContext('reader').firestore() as unknown as Firestore;
const at = (hoursAgo: number) => new Date(+NOW - hoursAgo * HOUR_MS).toISOString();
const story = (id: string, hoursAgo: number, patch: Partial<News> = {}): News => ({
  ...template,
  id,
  publishedAt: at(hoursAgo),
  createdAt: at(hoursAgo),
  updatedAt: at(hoursAgo),
  certainty: 'confirmada',
  importance: 1,
  corrections: [],
  ...patch,
});

function observeFeed() {
  let latest: NewsFeedSnapshot | undefined;
  let failure: Error | undefined;
  let notify: () => void = () => {};
  const stop = watchNewsFeed(
    readerDb(),
    {
      next: (value) => {
        latest = value;
        notify();
      },
      error: (error) => {
        failure = error;
        notify();
      },
    },
    () => NOW,
  );

  async function until(predicate: (value: NewsFeedSnapshot) => boolean): Promise<NewsFeedSnapshot> {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      if (latest && predicate(latest)) return latest;
      await new Promise<void>((resolve) => {
        notify = resolve;
        setTimeout(resolve, 50);
      });
    }
    throw new Error(`Feed timeout; last ids: ${latest?.news.map((news) => news.id).join(', ')}`);
  }
  return { until, stop };
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

describe('F3-01 mobile feed subscription', () => {
  it('CA1: a portal publication reaches the already open reader subscription within five seconds', async () => {
    const watcher = observeFeed();
    try {
      const initial = await watcher.until((value) => value.news.length === 0);
      expect(initial.config.feedWindowHours).toBe(72); // config/public does not exist
      const draft = story('published-from-portal', 0);
      const unpublished: News = { ...draft, workflow: 'borrador' };
      delete unpublished.publishedAt;
      delete unpublished.publishedBy;
      await setDoc(doc(adminDb(), 'news', draft.id), unpublished);
      const started = Date.now();
      await publishNews(adminDb(), draft.id, 'editor', NOW);
      const result = await watcher.until((value) =>
        value.news.some((news) => news.id === draft.id),
      );
      expect(result.news.find((news) => news.id === draft.id)).toMatchObject({
        workflow: 'publicada',
        indexPending: true,
      });
      expect(Date.now() - started).toBeLessThan(WAIT_MS);
    } finally {
      watcher.stop();
    }
  });

  it('uses the configured window, fixed essential window, deduplication and published-only rules', async () => {
    await setDoc(doc(adminDb(), 'config', 'public'), { feedWindowHours: 24 });
    const items = [
      story('recent', 2),
      story('essential-recent', 2, { importance: 3 }),
      story('essential-older', 48, { importance: 3 }),
      story('regular-older', 48),
      story('essential-expired', 80, { importance: 3 }),
      story('retracted', 2, { certainty: 'retractada' }),
      story('draft', 1, { workflow: 'borrador' }),
      story('future', -1),
    ];
    for (const item of items) await setDoc(doc(adminDb(), 'news', item.id), item);
    const watcher = observeFeed();
    try {
      const result = await watcher.until((value) => value.news.length === 3);
      expect(result.config.feedWindowHours).toBe(24);
      expect(result.news.map((news) => news.id).sort()).toEqual([
        'essential-older',
        'essential-recent',
        'recent',
      ]);
      expect(new Set(result.news.map((news) => news.id)).size).toBe(3);

      await updateDoc(doc(adminDb(), 'config', 'public'), { feedWindowHours: 72 });
      const expanded = await watcher.until((value) => value.news.length === 4);
      expect(expanded.news.map((news) => news.id)).toContain('regular-older');
    } finally {
      watcher.stop();
    }
  });

  it('removes a retracted story even when it appears in both queries', async () => {
    const item = story('corrected', 1, { importance: 3 });
    await setDoc(doc(adminDb(), 'news', item.id), item);
    const watcher = observeFeed();
    try {
      await watcher.until((value) => value.news.some((news) => news.id === item.id));
      await updateDoc(doc(adminDb(), 'news', item.id), {
        certainty: 'retractada',
        version: 2,
        updatedAt: NOW.toISOString(),
      });
      await watcher.until((value) => value.news.every((news) => news.id !== item.id));
    } finally {
      watcher.stop();
    }
  });

  it('uses defaults again if config/public is removed during the session', async () => {
    await setDoc(doc(adminDb(), 'config', 'public'), { feedWindowHours: 24 });
    await setDoc(doc(adminDb(), 'news', 'older'), story('older', 48));
    const watcher = observeFeed();
    try {
      await watcher.until(
        (value) => value.config.feedWindowHours === 24 && value.news.length === 0,
      );
      await deleteDoc(doc(adminDb(), 'config', 'public'));
      const result = await watcher.until(
        (value) => value.config.feedWindowHours === 72 && value.news.length === 1,
      );
      expect(result.news[0]?.id).toBe('older');
    } finally {
      watcher.stop();
    }
  });

  it('reports malformed published documents so the hook can offer retry', async () => {
    await setDoc(doc(adminDb(), 'news', 'broken'), {
      workflow: 'publicada',
      publishedAt: NOW.toISOString(),
      importance: 1,
    });
    let failure: Error | undefined;
    let notify: () => void = () => {};
    const stop = watchNewsFeed(
      readerDb(),
      {
        next: () => {},
        error: (error) => {
          failure = error;
          notify();
        },
      },
      () => NOW,
    );
    try {
      if (!failure) {
        await Promise.race([
          new Promise<void>((resolve) => {
            notify = resolve;
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('No llegó el error de datos inválidos')), WAIT_MS),
          ),
        ]);
      }
      expect(failure?.message).toContain('broken');
    } finally {
      stop();
    }
    await setDoc(doc(adminDb(), 'news', 'broken'), story('broken', 1));
    const retried = observeFeed();
    try {
      const result = await retried.until((value) =>
        value.news.some((news) => news.id === 'broken'),
      );
      expect(result.news[0]?.id).toBe('broken');
    } finally {
      retried.stop();
    }
  });
});

describe('F3-01 profile subscription', () => {
  it('streams creation and later profile changes for the signed-in user', async () => {
    let latest: UserProfile | null | undefined;
    let failure: Error | undefined;
    let notify: () => void = () => {};
    const stop = watchProfile(
      readerDb(),
      'reader',
      (profile) => {
        latest = profile;
        notify();
      },
      (error) => {
        failure = error;
        notify();
      },
    );
    async function until(predicate: (profile: UserProfile | null) => boolean) {
      const deadline = Date.now() + WAIT_MS;
      while (Date.now() < deadline) {
        if (failure) throw failure;
        if (latest !== undefined && predicate(latest)) return latest;
        await new Promise<void>((resolve) => {
          notify = resolve;
          setTimeout(resolve, 50);
        });
      }
      throw new Error('Profile timeout');
    }
    try {
      expect(await until((profile) => profile === null)).toBeNull();
      const profile = createDefaultProfile('reader', 'Lector', 'gt-guatemala', NOW);
      await setDoc(doc(readerDb(), 'users', 'reader'), profile);
      expect((await until((value) => value?.locationId === 'gt-guatemala'))?.uid).toBe('reader');
      await updateDoc(doc(readerDb(), 'users', 'reader'), { locationId: 'es-madrid' });
      expect((await until((value) => value?.locationId === 'es-madrid'))?.locationId).toBe(
        'es-madrid',
      );
    } finally {
      stop();
    }
  });
});
