import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'ai-news-app-f24cf';
const ADMIN_UID = 'admin-uid';
const USER_UID = 'user-uid';
const OTHER_USER_UID = 'other-user-uid';
const PUBLISHED_NEWS_ID = 'n-published';
const DRAFT_NEWS_ID = 'n-draft';

let testEnv: RulesTestEnvironment;

function anonymousDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function userDb(uid: string = USER_UID) {
  return testEnv.authenticatedContext(uid).firestore();
}

function adminDb() {
  return testEnv.authenticatedContext(ADMIN_UID).firestore();
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'admins', ADMIN_UID), { email: 'admin@example.com', addedAt: '2026-01-01T00:00:00Z' });
    await setDoc(doc(db, 'news', PUBLISHED_NEWS_ID), { title: 'Publicada', workflow: 'publicada' });
    await setDoc(doc(db, 'news', DRAFT_NEWS_ID), { title: 'Borrador', workflow: 'borrador' });
    await setDoc(doc(db, 'news', PUBLISHED_NEWS_ID, 'versions', '1'), { title: 'Publicada v1' });
    await setDoc(doc(db, 'users', USER_UID), { displayName: 'Usuario' });
    await setDoc(doc(db, 'users', OTHER_USER_UID), { displayName: 'Otro' });
    await setDoc(doc(db, 'config', 'public'), { feedWindowHours: 72 });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe('anonymous users', () => {
  it('cannot read anything', async () => {
    await assertFails(getDoc(doc(anonymousDb(), 'news', PUBLISHED_NEWS_ID)));
    await assertFails(getDoc(doc(anonymousDb(), 'users', USER_UID)));
    await assertFails(getDoc(doc(anonymousDb(), 'config', 'public')));
    await assertFails(getDoc(doc(anonymousDb(), 'admins', ADMIN_UID)));
  });

  it('cannot write anything', async () => {
    await assertFails(setDoc(doc(anonymousDb(), 'users', USER_UID), { displayName: 'x' }));
  });
});

describe('news', () => {
  it('lets a signed-in user read published news', async () => {
    await assertSucceeds(getDoc(doc(userDb(), 'news', PUBLISHED_NEWS_ID)));
  });

  it('does not let a regular user read drafts', async () => {
    await assertFails(getDoc(doc(userDb(), 'news', DRAFT_NEWS_ID)));
  });

  it('does not let a regular user write news', async () => {
    await assertFails(setDoc(doc(userDb(), 'news', 'n-new'), { workflow: 'publicada' }));
    await assertFails(setDoc(doc(userDb(), 'news', PUBLISHED_NEWS_ID), { title: 'Hackeada' }));
    await assertFails(deleteDoc(doc(userDb(), 'news', PUBLISHED_NEWS_ID)));
  });

  it('lets an admin read drafts and write news', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'news', DRAFT_NEWS_ID)));
    await assertSucceeds(setDoc(doc(adminDb(), 'news', 'n-new'), { workflow: 'borrador' }));
    await assertSucceeds(setDoc(doc(adminDb(), 'news', PUBLISHED_NEWS_ID), { title: 'Editada', workflow: 'publicada' }));
  });

  it('lets signed-in users read versions but only admins write them', async () => {
    await assertSucceeds(getDoc(doc(userDb(), 'news', PUBLISHED_NEWS_ID, 'versions', '1')));
    await assertFails(setDoc(doc(userDb(), 'news', PUBLISHED_NEWS_ID, 'versions', '2'), { title: 'x' }));
    await assertSucceeds(setDoc(doc(adminDb(), 'news', PUBLISHED_NEWS_ID, 'versions', '2'), { title: 'v2' }));
  });
});

describe('users', () => {
  it('lets a user read and write only their own profile', async () => {
    await assertSucceeds(getDoc(doc(userDb(), 'users', USER_UID)));
    await assertSucceeds(setDoc(doc(userDb(), 'users', USER_UID), { displayName: 'Nuevo nombre' }));
    await assertFails(getDoc(doc(userDb(), 'users', OTHER_USER_UID)));
    await assertFails(setDoc(doc(userDb(), 'users', OTHER_USER_UID), { displayName: 'Suplantado' }));
  });

  it('lets an admin read any profile but not write it', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'users', USER_UID)));
    await assertFails(setDoc(doc(adminDb(), 'users', USER_UID), { displayName: 'Editado por admin' }));
  });

  it('lets a user create their own events but not read others or update them', async () => {
    await assertSucceeds(setDoc(doc(userDb(), 'users', USER_UID, 'events', 'e1'), { type: 'open' }));
    await assertSucceeds(getDoc(doc(userDb(), 'users', USER_UID, 'events', 'e1')));
    await assertFails(setDoc(doc(userDb(), 'users', OTHER_USER_UID, 'events', 'e2'), { type: 'open' }));
    await assertFails(getDoc(doc(userDb(OTHER_USER_UID), 'users', USER_UID, 'events', 'e1')));
    await assertFails(setDoc(doc(userDb(), 'users', USER_UID, 'events', 'e1'), { type: 'dwell' }));
  });
});

describe('admins collection', () => {
  it('lets an admin read only their own doc', async () => {
    await assertSucceeds(getDoc(doc(adminDb(), 'admins', ADMIN_UID)));
    await assertFails(getDoc(doc(userDb(), 'admins', ADMIN_UID)));
  });

  it('cannot be written by anyone, admins included', async () => {
    await assertFails(setDoc(doc(adminDb(), 'admins', ADMIN_UID), { email: 'x@example.com' }));
    await assertFails(setDoc(doc(adminDb(), 'admins', 'new-admin'), { email: 'y@example.com' }));
    await assertFails(setDoc(doc(userDb(), 'admins', USER_UID), { email: 'z@example.com' }));
    await assertFails(deleteDoc(doc(adminDb(), 'admins', ADMIN_UID)));
  });
});

describe('config', () => {
  it('lets signed-in users read but only admins write', async () => {
    await assertSucceeds(getDoc(doc(userDb(), 'config', 'public')));
    await assertFails(setDoc(doc(userDb(), 'config', 'public'), { feedWindowHours: 1 }));
    await assertSucceeds(setDoc(doc(adminDb(), 'config', 'public'), { feedWindowHours: 48 }));
  });
});
