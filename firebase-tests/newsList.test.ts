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
const newsListQuery = (db: Firestore) => query(collection(db, 'news'), orderBy('updatedAt', 'desc'));

let testEnv: RulesTestEnvironment;

const adminDb = (uid: string) => testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;

function nextSnapshot(db: Firestore, predicate: (items: News[]) => boolean): Promise<News[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('snapshot timeout')), 10_000);
    const unsubscribe = onSnapshot(newsListQuery(db), (snapshot) => {
      const items = snapshot.docs.map((document) => document.data() as News);
      if (predicate(items)) {
        clearTimeout(timer);
        unsubscribe();
        resolve(items);
      }
    }, reject);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
  });
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
    const items = await nextSnapshot(adminDb('admin-a'), (all) => all.length >= 40);
    expect(items).toHaveLength(40);
    const updated = items.map((item) => item.updatedAt);
    expect(updated).toEqual([...updated].sort().reverse());
    expect(new Set(items.map((item) => item.workflow)).size).toBeGreaterThan(0);
  });

  it('CA2: a draft created by another admin reaches an open list without reloading', async () => {
    const watcher = adminDb('admin-a');
    const delivered = nextSnapshot(watcher, (all) => all.some((item) => item.id === 'draft-from-b'));

    const author = adminDb('admin-b');
    const draft = createEmptyDraft('draft-from-b', 'admin-b', new Date());
    await setDoc(doc(author, 'news', draft.id), draft);

    const items = await delivered;
    expect(items[0]).toMatchObject({ id: 'draft-from-b', workflow: 'borrador', createdBy: 'admin-b' });
  });
});
