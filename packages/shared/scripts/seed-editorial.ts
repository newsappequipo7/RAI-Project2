import demoJson from '../fixtures/demo-drafts.json';
import corpusJson from '../fixtures/editorial-corpus.json';
import { firebaseConfig } from '../src/config/firebase';
import { buildEditorialDrafts, type CorpusItem } from '../src/editorial/corpus';
import { buildCoverImage } from '../src/editorial/images';
import { validatePublish } from '../src/editorial/validatePublish';
import { newsSchema } from '../src/schemas';
import type { News } from '../src/types';
import {
  accessToken,
  firestoreBaseUrl,
  NEWS_COLLECTION,
  toFirestoreFields,
  type Target,
} from './firestore-rest';

type Only = 'all' | 'corpus' | 'demo';

interface Options {
  target: Target;
  check: boolean;
  only: Only;
  overwriteDrafts: boolean;
}

const USAGE =
  'Usage: pnpm seed:editorial --check | --target=emulator|prod [--only=corpus|demo] [--overwrite-drafts]';

function parseArgs(argv: string[]): Options {
  const value = (name: string) => argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  const check = argv.includes('--check');
  const target = value('target');
  const only = (value('only') ?? 'all') as Only;

  if (!['all', 'corpus', 'demo'].includes(only)) throw new Error(USAGE);
  if (check && !target) return { target: 'emulator', check, only, overwriteDrafts: false };
  if (target !== 'emulator' && target !== 'prod') throw new Error(USAGE);

  return { target, check, only, overwriteDrafts: argv.includes('--overwrite-drafts') };
}

/** What the editor does by hand: open each link, tick the checklist, keep or pick the cover. */
function asIfAttested(news: News): News {
  return {
    ...news,
    checklist: Object.fromEntries(
      Object.keys(news.checklist).map((item) => [item, true]),
    ) as News['checklist'],
    image: news.image ?? buildCoverImage(news.title),
  };
}

function report(drafts: News[]): boolean {
  let allPass = true;
  for (const draft of drafts) {
    const result = validatePublish(asIfAttested(draft), draft.certainty);
    allPass &&= result.ok;
    const detail = result.ok ? 'ok' : result.errors.map((error) => error.code).join(', ');
    console.log(
      `${draft.id.padEnd(10)} ${draft.certainty.padEnd(14)} fuentes=${draft.sources.length} ` +
        `afirmaciones=${draft.claims.length}  validatePublish: ${detail}`,
    );
  }
  return allPass;
}

async function existingWorkflow(
  baseUrl: string,
  token: string,
  id: string,
): Promise<string | null> {
  const response = await fetch(`${baseUrl}/${NEWS_COLLECTION}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Could not read ${id}: ${response.status} ${await response.text()}`);

  const body = (await response.json()) as { fields?: { workflow?: { stringValue?: string } } };
  return body.fields?.workflow?.stringValue ?? 'unknown';
}

/**
 * Writes drafts only. It never overwrites a document that exists, unless `--overwrite-drafts` is
 * given and that document is still a draft: whatever an editor already published or changed stays.
 */
async function writeDrafts(drafts: News[], options: Options): Promise<void> {
  const baseUrl = firestoreBaseUrl(options.target);
  const token = accessToken(options.target);
  const tally = { created: 0, overwritten: 0, skipped: 0 };

  for (const draft of drafts) {
    const workflow = await existingWorkflow(baseUrl, token, draft.id);
    const canOverwrite = workflow === 'borrador' && options.overwriteDrafts;

    if (workflow !== null && !canOverwrite) {
      console.log(`  skipped ${draft.id}: already exists (${workflow}); it was not touched`);
      tally.skipped += 1;
      continue;
    }

    const precondition =
      workflow === null ? 'currentDocument.exists=false' : 'currentDocument.exists=true';
    const response = await fetch(`${baseUrl}/${NEWS_COLLECTION}/${draft.id}?${precondition}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFirestoreFields(draft) }),
    });
    if (!response.ok) {
      throw new Error(
        `Firestore rejected ${draft.id}: ${response.status} ${await response.text()}`,
      );
    }
    tally[workflow === null ? 'created' : 'overwritten'] += 1;
  }

  console.log(
    `Done: ${tally.created} created, ${tally.overwritten} overwritten, ${tally.skipped} skipped`,
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const createdBy = process.env.EDITORIAL_CREATED_BY ?? 'editorial-corpus';
  const now = new Date();

  const corpus =
    options.only === 'demo'
      ? []
      : buildEditorialDrafts(corpusJson as unknown as CorpusItem[], createdBy, now);
  const demo =
    options.only === 'corpus'
      ? []
      : buildEditorialDrafts(demoJson as unknown as CorpusItem[], createdBy, now);
  const drafts = [...corpus, ...demo];

  drafts.forEach((draft) => newsSchema.parse(draft));
  console.log(
    `Validated ${drafts.length} drafts with zod (${corpus.length} corpus, ${demo.length} demo)`,
  );
  const allPass = report(drafts);

  if (options.check) {
    if (!allPass) process.exit(1);
    console.log('Every draft passes validatePublish once the editor completes the checklist.');
    return;
  }

  console.log(
    `Writing DRAFTS to Firestore (${options.target}, project ${firebaseConfig.projectId})`,
  );
  await writeDrafts(drafts, options);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
