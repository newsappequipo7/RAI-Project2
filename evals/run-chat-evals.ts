/**
 * Golden-set runner for the chat (F4-05, CHAT-RAG.md §6).
 *
 *   pnpm evals:chat --dry-run                       validates the set, no requests
 *   EVAL_ID_TOKEN=<admin Firebase ID token> pnpm evals:chat --api <worker url> --label v1
 *
 * Against a Worker with AI_MODE=live this SPENDS CREDITS (< USD 0.15 per run expected); check the
 * budget in PRESUPUESTO-IA.md §5 first. The token must belong to a project admin: in env=dev they
 * are exempt from the 20 messages/hour limit, which a full run exceeds.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chatResponseSchema, healthResponseSchema, type HealthResponse } from '@repo/shared';
import { auditGolden, parseGolden, type GoldenCase } from './src/golden';
import {
  aggregate,
  checkTargets,
  scoreCase,
  type CaseResult,
  type CaseScore,
  type Metrics,
  type Ratio,
} from './src/metrics';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_API = 'http://127.0.0.1:8787';
const REQUEST_TIMEOUT_MS = 60_000;

interface Options {
  api: string;
  label: string;
  only: Set<string> | null;
  dryRun: boolean;
  outDir: string;
}

function parseArgs(argv: string[]): Options {
  const value = (flag: string) => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const only = value('--only');
  return {
    api: (value('--api') ?? process.env.EVAL_API_URL ?? DEFAULT_API).replace(/\/$/, ''),
    label: value('--label') ?? 'sin-etiqueta',
    only: only ? new Set(only.split(',')) : null,
    dryRun: argv.includes('--dry-run'),
    outDir: value('--out') ?? join(ROOT, 'evidence/evals'),
  };
}

async function loadCorpus(): Promise<{ ids: Set<string>; retracted: Set<string> }> {
  const corpus = JSON.parse(
    await readFile(join(ROOT, 'packages/shared/fixtures/news.json'), 'utf8'),
  ) as { id: string; certainty: string }[];
  return {
    ids: new Set(corpus.map(({ id }) => id)),
    retracted: new Set(
      corpus.filter(({ certainty }) => certainty === 'retractada').map(({ id }) => id),
    ),
  };
}

async function fetchHealth(api: string): Promise<HealthResponse> {
  const response = await fetch(`${api}/health`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET /health → ${response.status}`);
  return healthResponseSchema.parse(await response.json());
}

async function ask(api: string, token: string, item: GoldenCase): Promise<CaseResult> {
  const started = performance.now();
  const latency = () => Math.round(performance.now() - started);
  try {
    const response = await fetch(`${api}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: item.message, locationId: item.locationId }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        id: item.id,
        ok: false,
        error: `HTTP ${response.status} ${JSON.stringify(body)}`,
        latencyMs: latency(),
      };
    }
    const parsed = chatResponseSchema.safeParse(body);
    if (!parsed.success) {
      return {
        id: item.id,
        ok: false,
        error: 'Response outside the contract',
        latencyMs: latency(),
      };
    }
    return { id: item.id, ok: true, response: parsed.data, latencyMs: latency() };
  } catch (error) {
    return { id: item.id, ok: false, error: String(error), latencyMs: latency() };
  }
}

const pct = ({ rate, hits, total }: Ratio) =>
  rate === null ? 'n/a' : `${(rate * 100).toFixed(1)} % (${hits}/${total})`;

function printSummary(metrics: Metrics, failures: string[]): void {
  console.table({
    'Modo esperado': pct(metrics.modeAccuracy),
    'Precisión de citas': pct(metrics.citationPrecision),
    Cobertura: pct(metrics.coverage),
    'Abstención correcta': pct(metrics.correctAbstention),
    'Falsas abstenciones': pct(metrics.falseAbstention),
    'Menciona incertidumbre': pct(metrics.uncertainty),
    'Citas prohibidas': String(metrics.forbiddenCitations),
    'Fallos ante inyección': String(metrics.injectionFailures),
    'Respuestas en caché': String(metrics.cached),
    Errores: String(metrics.errors),
    'Costo total (USD)': metrics.totalCostUsd.toFixed(4),
    'Costo medio por pregunta (USD)': metrics.meanCostUsd.toFixed(5),
    'Latencia p50 / p95 (ms)': `${metrics.p50LatencyMs} / ${metrics.p95LatencyMs}`,
  });
  console.log(
    failures.length
      ? `Objetivos F4-06 no cumplidos:\n- ${failures.join('\n- ')}`
      : 'Objetivos F4-06 cumplidos.',
  );
}

function printReview(scores: CaseScore[]): void {
  const flagged = scores.filter(
    (score) =>
      !score.modeOk ||
      score.missing.length > 0 ||
      score.doubtful.length > 0 ||
      score.forbidden.length > 0 ||
      (score.uncertaintyExpected && !score.uncertaintyMentioned) ||
      score.leaked ||
      score.saidForbidden.length > 0,
  );
  if (flagged.length === 0) return;
  console.log('\nCasos para revisar a mano:');
  for (const score of flagged) {
    const notes = [
      !score.modeOk && `modo ${score.mode}`,
      score.missing.length > 0 && `faltan ${score.missing.join(', ')}`,
      score.doubtful.length > 0 && `citas dudosas ${score.doubtful.join(', ')}`,
      score.forbidden.length > 0 && `CITA PROHIBIDA ${score.forbidden.join(', ')}`,
      score.uncertaintyExpected && !score.uncertaintyMentioned && 'no menciona incertidumbre',
      score.leaked && 'FILTRA EL PROMPT',
      score.saidForbidden.length > 0 && `dice «${score.saidForbidden.join('», «')}»`,
      score.error,
    ].filter(Boolean);
    console.log(
      `- ${score.id} (${score.category}, top ${score.topScore ?? 'n/a'}): ${notes.join('; ')}`,
    );
  }
}

function stamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const corpus = await loadCorpus();
  const golden = parseGolden(await readFile(join(ROOT, 'evals/chat-golden.jsonl'), 'utf8'));
  const problems = auditGolden(golden, corpus.ids);
  if (problems.length > 0) throw new Error(`Golden set problems:\n- ${problems.join('\n- ')}`);

  const selected = options.only ? golden.filter(({ id }) => options.only!.has(id)) : golden;
  console.log(`Set dorado válido: ${golden.length} casos (${selected.length} seleccionados).`);
  if (options.dryRun) return;

  const token = process.env.EVAL_ID_TOKEN;
  if (!token) throw new Error('Set EVAL_ID_TOKEN to a Firebase ID token of a project admin.');

  const health = await fetchHealth(options.api);
  console.log(
    `Worker ${options.api}: env=${health.env}, aiMode=${health.aiMode}, índice v${health.indexVersion}.`,
  );
  if (health.aiMode !== 'live') {
    console.warn(
      'AVISO: AI_MODE=mock. Las métricas solo validan el runner, no la calidad del chat.',
    );
  }

  const startedAt = new Date();
  const results: CaseResult[] = [];
  for (const item of selected) {
    const result = await ask(options.api, token, item);
    results.push(result);
    console.log(`${item.id} ${result.ok ? result.response.mode : `ERROR ${result.error}`}`);
  }

  const scores = selected.map((item, index) => scoreCase(item, results[index]!, corpus.retracted));
  const metrics = aggregate(selected, scores);
  const failures = checkTargets(metrics);
  printSummary(metrics, failures);
  printReview(scores);

  await mkdir(options.outDir, { recursive: true });
  const file = join(options.outDir, `chat-${stamp(startedAt)}.json`);
  await writeFile(
    file,
    `${JSON.stringify(
      {
        label: options.label,
        startedAt: startedAt.toISOString(),
        api: options.api,
        health,
        cases: selected.length,
        metrics,
        targetsFailed: failures,
        scores,
        responses: results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nResultado guardado en ${relative(ROOT, file)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
