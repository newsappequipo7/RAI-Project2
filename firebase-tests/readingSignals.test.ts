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
import { changeInterestProfile } from '../apps/mobile/src/services/interestsProfile';
import { startReadingSession } from '../apps/mobile/src/services/readingSignals';
import { createDefaultProfile } from '../packages/shared/src/profile';

const startedAt = new Date('2026-10-09T12:00:00Z');
let environment: RulesTestEnvironment;
const db = () => environment.authenticatedContext('reader').firestore() as unknown as Firestore;
const profileRef = () => doc(db(), 'users', 'reader');
const eventsRef = () => collection(db(), 'users', 'reader', 'events');
const story = { id: 'sports-1', topics: ['deportes'] };

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'ai-news-app-f24cf',
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});
afterAll(async () => environment.cleanup());
beforeEach(async () => {
  await environment.clearFirestore();
  await setDoc(profileRef(), createDefaultProfile('reader', 'Lector', 'gt-guatemala', startedAt));
});

describe('F3-08 reading signals and profile controls', () => {
  it('records open on entry and only one profile update on a short reading', async () => {
    const session = startReadingSession(db(), 'reader', story, 'gt-guatemala', startedAt);
    await session.waitForOpen();
    expect((await getDocs(eventsRef())).docs.map((event) => event.data().type)).toEqual(['open']);
    // The profile is unchanged until the reading session ends.
    expect((await getDoc(profileRef())).data()?.interests).toEqual({});
    await session.finish(new Date(startedAt.getTime() + 19_000));
    await session.finish(new Date(startedAt.getTime() + 40_000));
    expect((await getDoc(profileRef())).data()).toMatchObject({
      interests: { deportes: 0.5 },
      readNewsIds: ['sports-1'],
    });
    expect((await getDocs(eventsRef())).docs.map((event) => event.data().type)).toEqual(['open']);
  });

  it('records dwell at 20 seconds and preserves a newer location edit', async () => {
    const session = startReadingSession(db(), 'reader', story, 'gt-guatemala', startedAt);
    await updateDoc(profileRef(), { locationId: 'gt-quetzaltenango' });
    await session.finish(new Date(startedAt.getTime() + 20_000));
    expect((await getDoc(profileRef())).data()).toMatchObject({
      locationId: 'gt-quetzaltenango',
      interests: { deportes: 1.5 },
      readNewsIds: ['sports-1'],
    });
    const events = (await getDocs(eventsRef())).docs.map((event) => event.data());
    expect(events.map((event) => event.type).sort()).toEqual(['dwell', 'open']);
    expect(events.find((event) => event.type === 'dwell')?.seconds).toBe(20);
  });

  it('retains only the most recent 200 distinct story IDs', async () => {
    await updateDoc(profileRef(), {
      readNewsIds: Array.from({ length: 200 }, (_, index) => `older-${index}`),
    });
    const session = startReadingSession(db(), 'reader', story, 'gt-guatemala', startedAt);
    await session.finish(new Date(startedAt.getTime() + 21_000));
    const ids = (await getDoc(profileRef())).data()?.readNewsIds as string[];
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe('sports-1');
    expect(ids).not.toContain('older-199');
  });

  it('toggles personalization, resets learned values, and reactivates muted topics', async () => {
    await updateDoc(profileRef(), { interests: { deportes: 0 }, mutedTopics: ['deportes'] });
    await changeInterestProfile(
      db(),
      'reader',
      { type: 'personalization', enabled: false },
      startedAt,
    );
    await changeInterestProfile(db(), 'reader', { type: 'unmute', topic: 'deportes' }, startedAt);
    expect((await getDoc(profileRef())).data()).toMatchObject({
      personalization: false,
      mutedTopics: [],
    });
    await changeInterestProfile(db(), 'reader', { type: 'reset' }, startedAt);
    expect((await getDoc(profileRef())).data()).toMatchObject({
      interests: {},
      mutedTopics: [],
      personalization: false,
    });
  });
});
