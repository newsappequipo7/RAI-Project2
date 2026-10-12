import { execFileSync } from 'node:child_process';
import { firebaseConfig } from '../src/config/firebase';

export type Target = 'emulator' | 'prod';

export const DEFAULT_EMULATOR_HOST = '127.0.0.1:8080';
export const DEFAULT_EMULATOR_API_URL = 'http://127.0.0.1:8787';
export const DEFAULT_PROD_API_URL = 'https://news-api.diegovalenzuela.workers.dev';
const EMULATOR_ADMIN_TOKEN = 'owner';
export const NEWS_COLLECTION = 'news';

export interface FirestoreValue {
  [kind: string]: unknown;
}

export function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value) } };

  throw new Error(`Unsupported value for Firestore: ${typeof value}`);
}

export function toFirestoreFields(record: object): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toFirestoreValue(value)]),
  );
}

export function firestoreBaseUrl(target: Target): string {
  const documents = `v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  if (target === 'prod') return `https://firestore.googleapis.com/${documents}`;

  const host = process.env.FIRESTORE_EMULATOR_HOST ?? DEFAULT_EMULATOR_HOST;
  return `http://${host}/${documents}`;
}

export function accessToken(target: Target): string {
  if (target === 'emulator') return EMULATOR_ADMIN_TOKEN;

  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

/** Inverse of `toFirestoreValue`, for documents read through the REST API. */
export function fromFirestoreValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const { values = [] } = value.arrayValue as { values?: FirestoreValue[] };
    return values.map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    const { fields = {} } = value.mapValue as { fields?: Record<string, FirestoreValue> };
    return fromFirestoreFields(fields);
  }
  throw new Error(`Unsupported Firestore value: ${Object.keys(value).join(', ')}`);
}

export function fromFirestoreFields(
  fields: Record<string, FirestoreValue>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]),
  );
}

/** Reads a whole collection through the REST API, following pagination. */
export async function listDocuments(
  target: Target,
  collection: string,
): Promise<Record<string, unknown>[]> {
  const token = accessToken(target);
  const documents: Record<string, unknown>[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${firestoreBaseUrl(target)}/${collection}`);
    url.searchParams.set('pageSize', '300');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Firestore list ${collection}: ${response.status}`);
    const page = (await response.json()) as {
      documents?: { fields?: Record<string, FirestoreValue> }[];
      nextPageToken?: string;
    };
    page.documents?.forEach(({ fields = {} }) => documents.push(fromFirestoreFields(fields)));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return documents;
}
