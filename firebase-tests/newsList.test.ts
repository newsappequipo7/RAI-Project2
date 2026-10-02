import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import seedJson from '../packages/shared/fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import { createEmptyDraft } from '../packages/shared/src/editorial/draft';
import type { News } from '../packages/shared/src/types';

// Same query the portal's /news page subscribes to (F2-01).
const newsListQuery = (db: Firestore) =>
  query(collection(db, 'news'), orderBy('updatedAt', 'desc'));

const WAIT_MS = 12_000;

let testEnv: RulesTestEnvironment;

const adminDb = (uid: string) =>
  testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;

/** Live subscription to the news list, like the portal's page. */
function watchNews(db: Firestore) {
  let latest: News[] | undefined;
  let notify: () => void = () => {};
  let failure: Error | undefined;

  const stop = onSnapshot(
    newsListQuery(db),
    (snapshot) => {
      latest = snapshot.docs.map((document) => document.data() as News);
      notify();
    },
    (error) => {
      failure = error;
      notify();
    },
  );

  async function until(predicate: (items: News[]) => boolean): Promise<News[]> {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      if (failure) throw failure;
      if (latest && predicate(latest)) return latest;
      await new Promise<void>((resolve) => {
        notify = resolve;
        setTimeout(resolve, 250);
      });
    }
    throw new Error(
      `snapshot timeout after ${WAIT_MS} ms; last snapshot had ${latest?.length ?? 'no'} docs, ` +
        `first ids: ${(latest ?? [])
          .slice(0, 3)
          .map((item) => item.id)
          .join(', ')}`,
    );
  }

  return { until, stop };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    for (const uid of ['admin-a', 'admin-b']) {
      await setDoc(doc(db, 'admins', uid), { email: `${uid}@example.com` });
    }
    for (const item of buildSeedNews(seedJson as SeedNews[], new Date('2026-09-30T12:00:00Z'))) {
      await setDoc(doc(db, 'news', item.id), item);
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('F2-01 news list', () => {
  it('CA1: an admin lists the 40 seed news, newest update first', async () => {
    const watcher = watchNews(adminDb('admin-a'));
    try {
      const items = await watcher.until((all) => all.length >= 40);
      expect(items).toHaveLength(40);
      const updated = items.map((item) => item.updatedAt);
      expect(updated).toEqual([...updated].sort().reverse());
    } finally {
      watcher.stop();
    }
  });

  it('CA2: a draft created by another admin reaches an open list without reloading', async () => {
    const watcher = watchNews(adminDb('admin-a'));
    try {
      // The list is already open and showing the seed news before the other admin writes.
      await watcher.until((all) => all.length >= 40);

      const author = adminDb('admin-b');
      const draft = createEmptyDraft('draft-from-b', 'admin-b', new Date());
      await setDoc(doc(author, 'news', draft.id), draft);

      const items = await watcher.until((all) => all.some((item) => item.id === 'draft-from-b'));
      expect(items[0]).toMatchObject({
        id: 'draft-from-b',
        workflow: 'borrador',
        createdBy: 'admin-b',
      });
    } finally {
      watcher.stop();
    }
  });
});
