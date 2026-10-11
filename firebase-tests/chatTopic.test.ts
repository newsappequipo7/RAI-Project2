import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { recordChatTopic } from '../apps/mobile/src/services/chatTopic';
import { createDefaultProfile } from '../packages/shared/src/profile';

const now = new Date('2026-10-11T12:00:00Z');
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
beforeEach(async () => {
  await environment.clearFirestore();
  await setDoc(profileRef(), createDefaultProfile('reader', 'Lector', 'gt-guatemala', now));
});

describe('F4-04 chat_topic signal', () => {
  it('records the event and gives the topic a soft interest boost under the real rules', async () => {
    await recordChatTopic(db(), 'reader', 'salud', now);

    const profile = (await getDoc(profileRef())).data();
    const events = (await getDocs(collection(db(), 'users', 'reader', 'events'))).docs.map((item) =>
      item.data(),
    );
    expect(profile?.interests).toEqual({ salud: 0.5 });
    expect(events).toEqual([
      { type: 'chat_topic', topic: 'salud', locationId: 'gt-guatemala', at: now.toISOString() },
    ]);
  });

  it('rejects a topic outside the catalog without writing anything', async () => {
    await expect(recordChatTopic(db(), 'reader', 'inventado', now)).rejects.toThrow();
    expect((await getDocs(collection(db(), 'users', 'reader', 'events'))).empty).toBe(true);
  });
});
