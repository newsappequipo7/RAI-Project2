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
