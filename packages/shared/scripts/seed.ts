import { execFileSync } from 'node:child_process';
import seedJson from '../fixtures/news.json';
import { firebaseConfig } from '../src/config/firebase';
import { newsSchema } from '../src/schemas';
import { buildSeedNews, toIndexInput, type SeedNews } from '../src/seed';

type Target = 'emulator' | 'prod';

const DEFAULT_EMULATOR_HOST = '127.0.0.1:8080';
const DEFAULT_EMULATOR_API_URL = 'http://127.0.0.1:8787';
const DEFAULT_PROD_API_URL = 'https://news-api.diegovalenzuela.workers.dev';
const EMULATOR_ADMIN_TOKEN = 'owner';
const NEWS_COLLECTION = 'news';

interface FirestoreValue {
  [kind: string]: unknown;
}

function parseArgs(argv: string[]): { target: Target; dryRun: boolean } {
  const targetArg = argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  const dryRun = argv.includes('--dry-run');

  if (dryRun && !targetArg) return { target: 'emulator', dryRun };
  if (targetArg === 'emulator' || targetArg === 'prod') return { target: targetArg, dryRun };

  throw new Error('Usage: pnpm seed --target=emulator|prod [--dry-run]');
}

function toFirestoreValue(value: unknown): FirestoreValue {
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

function toFirestoreFields(record: object): Record<string, FirestoreValue> {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toFirestoreValue(value)]),
  );
}

function firestoreBaseUrl(target: Target): string {
  const documents = `v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
  if (target === 'prod') return `https://firestore.googleapis.com/${documents}`;

  const host = process.env.FIRESTORE_EMULATOR_HOST ?? DEFAULT_EMULATOR_HOST;
  return `http://${host}/${documents}`;
}

function accessToken(target: Target): string {
  if (target === 'emulator') return EMULATOR_ADMIN_TOKEN;

  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

async function writeNews(target: Target, news: ReturnType<typeof buildSeedNews>): Promise<void> {
  const baseUrl = firestoreBaseUrl(target);
  const token = accessToken(target);

  for (const item of news) {
    const response = await fetch(`${baseUrl}/${NEWS_COLLECTION}/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(item) }),
    });

    if (!response.ok) {
      throw new Error(`Firestore rejected ${item.id}: ${response.status} ${await response.text()}`);
    }
  }
}

async function rebuildIndex(target: Target, news: ReturnType<typeof buildSeedNews>): Promise<void> {
  const idToken = process.env.SEED_ID_TOKEN;

  if (!idToken) {
    console.log(
      'Index skipped: set SEED_ID_TOKEN (admin Firebase ID token) or use the /indice page.',
    );
    return;
  }

  const apiUrl =
    process.env.SEED_API_URL ??
    (target === 'prod' ? DEFAULT_PROD_API_URL : DEFAULT_EMULATOR_API_URL);
  const response = await fetch(`${apiUrl}/admin/index/rebuild`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ news: news.map(toIndexInput) }),
  });

  if (!response.ok) {
    throw new Error(`Index rebuild failed: ${response.status} ${await response.text()}`);
  }

  console.log(`Index rebuilt: ${await response.text()}`);
}

function countBy(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].map(([key, count]) => `${key}=${count}`).join(' ');
}

async function main(): Promise<void> {
  const { target, dryRun } = parseArgs(process.argv.slice(2));
  const news = buildSeedNews(seedJson as SeedNews[]);

  news.forEach((item) => newsSchema.parse(item));
  console.log(`Validated ${news.length} news with zod`);
  console.log(`certainty: ${countBy(news.map((item) => item.certainty))}`);
  console.log(`scope: ${countBy(news.map((item) => item.geo.scope))}`);
  console.log(`importance: ${countBy(news.map((item) => String(item.importance)))}`);

  if (dryRun) return;

  console.log(`Writing to Firestore (${target}, project ${firebaseConfig.projectId})`);
  await writeNews(target, news);
  console.log(`Wrote ${news.length} documents to ${NEWS_COLLECTION}/`);
  await rebuildIndex(target, news);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
