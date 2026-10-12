/**
 * F4-11: «IA sugirió vs editor publicó» for presentation section 7. Read-only: lists `news/` and
 * compares each published news with the `aiSuggestions` saved by the portal (F2-04).
 *
 *   pnpm report:ai-suggestions --target=emulator|prod [--out <file.md>]
 *
 * `prod` reads production Firestore with `gcloud auth print-access-token`.
 */
import { writeFile } from 'node:fs/promises';
import { auditSuggestions } from '../src/editorial/suggestions';
import { newsSchema } from '../src/schemas';
import type { News } from '../src/types';
import { listDocuments, NEWS_COLLECTION, type Target } from './firestore-rest';

function parseArgs(argv: string[]): { target: Target; out?: string } {
  const target = argv.find((arg) => arg.startsWith('--target='))?.split('=')[1];
  if (target !== 'emulator' && target !== 'prod') {
    throw new Error('Usage: pnpm report:ai-suggestions --target=emulator|prod [--out <file.md>]');
  }
  const index = argv.indexOf('--out');
  return { target, out: index === -1 ? undefined : argv[index + 1] };
}

const percent = (rate: number | null) => (rate === null ? 'n/a' : `${Math.round(rate * 100)} %`);
const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').slice(0, 120);

export function renderMarkdown(news: News[], target: Target, generatedAt: Date): string {
  const audit = auditSuggestions(news);
  const lines = [
    `# IA sugirió vs editor publicó`,
    '',
    `Fuente: Firestore \`${target}\` · ${generatedAt.toISOString()} · noticias publicadas con sugerencias guardadas: ` +
      `**${audit.audited}** (sin sugerencias: ${audit.withoutSuggestions}).`,
    '',
    '| Campo | Comparadas | El editor cambió | % cambiado |',
    '|---|---|---|---|',
    ...audit.fields.map(
      ({ label, compared, changed, changedRate }) =>
        `| ${label} | ${compared} | ${changed} | ${percent(changedRate)} |`,
    ),
    '',
    '## Detalle por noticia',
    '',
    '| Noticia | Campo | IA sugirió | Se publicó | ¿Igual? |',
    '|---|---|---|---|---|',
    ...audit.rows.flatMap(({ id, title, comparisons }) =>
      comparisons.map(
        ({ label, suggested, published, matches }) =>
          `| ${cell(title)} (\`${id}\`) | ${label} | ${cell(suggested)} | ${cell(published)} | ${matches ? 'sí' : '**no**'} |`,
      ),
    ),
  ];
  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const { target, out } = parseArgs(process.argv.slice(2));
  const raw = await listDocuments(target, NEWS_COLLECTION);
  const news = raw.flatMap((doc) => {
    const parsed = newsSchema.safeParse(doc);
    if (!parsed.success) console.warn(`Skipped ${String(doc.id)}: does not match newsSchema`);
    return parsed.success ? [parsed.data] : [];
  });
  const markdown = renderMarkdown(news, target, new Date());
  if (out) {
    await writeFile(out, markdown);
    console.log(`Written ${out}`);
  } else {
    console.log(markdown);
  }
}

if (process.argv[1]?.endsWith('report-ai-suggestions.ts')) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
