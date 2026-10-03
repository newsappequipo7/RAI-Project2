const PROJECT = 'ai-news-app-f24cf';
const AUTH = 'http://127.0.0.1:9099';
const FIRESTORE = 'http://127.0.0.1:8080';

export interface TestAdmin {
  email: string;
  password: string;
  uid: string;
}

/** Creates a user in the Auth emulator and authorizes it as an admin (`admins/{uid}`). */
export async function createAdmin(suffix: string): Promise<TestAdmin> {
  const email = `editor-${suffix}@example.com`;
  const password = 'clave-de-prueba-123';

  const signUp = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!signUp.ok) throw new Error(`Auth emulator signUp failed: ${signUp.status}`);
  const { localId: uid } = (await signUp.json()) as { localId: string };

  // The emulator accepts the literal token "owner" as a privileged caller, bypassing the rules.
  const admin = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/admins/${uid}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { email: { stringValue: email } } }),
    },
  );
  if (!admin.ok) throw new Error(`Could not create admins/${uid}: ${admin.status}`);

  return { email, password, uid };
}

interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

function plain(value: FirestoreValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(plain);
  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([k, v]) => [k, plain(v)]),
    );
  }
  return null;
}

/** Reads a document straight from the Firestore emulator, as ground truth outside the portal. */
export async function readDoc(path: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      headers: { Authorization: 'Bearer owner' },
    },
  );
  if (response.status === 404) return null;
  const body = (await response.json()) as { fields?: Record<string, FirestoreValue> };
  return Object.fromEntries(Object.entries(body.fields ?? {}).map(([k, v]) => [k, plain(v)]));
}

export async function listDocs(collectionPath: string): Promise<string[]> {
  const response = await fetch(
    `${FIRESTORE}/v1/projects/${PROJECT}/databases/(default)/documents/${collectionPath}`,
    {
      headers: { Authorization: 'Bearer owner' },
    },
  );
  const body = (await response.json()) as { documents?: { name: string }[] };
  return (body.documents ?? []).map((doc) => doc.name.split('/').pop() as string);
}
