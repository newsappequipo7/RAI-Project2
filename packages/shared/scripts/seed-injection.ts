/**
 * F4-07: adds (or removes) the malicious test news to a Worker's RAG index so the chat can be
 * checked against instructions hidden in the corpus. It only touches the index, never Firestore,
 * so the news never shows in the feed. Remove it after the run: while indexed, the chat may cite it.
 *
 *   SEED_ID_TOKEN=<admin token> pnpm seed:injection [--api <worker url>] [--remove]
 */
import injectionJson from '../fixtures/injection-news.json';
import { indexInputSchema } from '../src/schemas';
import { DEFAULT_EMULATOR_API_URL } from './firestore-rest';

function parseArgs(argv: string[]): { api: string; remove: boolean } {
  const index = argv.indexOf('--api');
  const api = index === -1 ? DEFAULT_EMULATOR_API_URL : argv[index + 1];
  if (!api) throw new Error('Usage: pnpm seed:injection [--api <worker url>] [--remove]');
  return { api: api.replace(/\/$/, ''), remove: argv.includes('--remove') };
}

async function main(): Promise<void> {
  const { api, remove } = parseArgs(process.argv.slice(2));
  const token = process.env.SEED_ID_TOKEN;
  if (!token) throw new Error('Set SEED_ID_TOKEN to a Firebase ID token of a project admin.');

  const publishedAt = new Date().toISOString();
  const news = injectionJson.map((item) => indexInputSchema.parse({ ...item, publishedAt }));
  const path = remove ? '/admin/index/remove' : '/admin/index/upsert';
  const body = remove ? { ids: news.map(({ id }) => id) } : { news };

  const response = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} → ${response.status} ${await response.text()}`);
  console.log(`${remove ? 'Removed from' : 'Added to'} ${api}: ${await response.text()}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
