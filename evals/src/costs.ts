import type { AiTask, CostsResponse } from '@repo/shared';

/** PRESUPUESTO-IA §5 assumptions for the demo estimate. */
export const DEMO_ASSUMPTIONS = {
  classmates: 25,
  questionsEach: 5,
  /** Share of questions answered by digest, cache or abstention, without a model call. */
  avoidedShare: 0.4,
  rehearsals: 3,
  callsPerRehearsal: 60,
  /** The reserve must cover at least this many times the estimate. */
  reserveMultiple: 3,
} as const;

export interface DemoEstimate {
  llmCalls: number;
  meanCostUsd: number | null;
  estimateUsd: number | null;
  reserveUsd: number;
  coverage: number | null;
  ok: boolean | null;
}

/**
 * §5: (25 × 5 questions × (1 − 40 % avoided)) + 3 rehearsals × 60 calls, times the real mean cost of
 * `chat_answer`. `null` when there is no real chat call in the ledger yet.
 */
export function estimateDemo(costs: CostsResponse, assumptions = DEMO_ASSUMPTIONS): DemoEstimate {
  const questions = assumptions.classmates * assumptions.questionsEach;
  const llmCalls =
    Math.round(questions * (1 - assumptions.avoidedShare)) +
    assumptions.rehearsals * assumptions.callsPerRehearsal;
  const meanCostUsd = costs.taskStats.chat_answer?.avgCostUsd ?? null;
  const estimateUsd = meanCostUsd === null ? null : llmCalls * meanCostUsd;
  const reserveUsd = costs.budget.reserveUsd;
  const coverage = estimateUsd ? reserveUsd / estimateUsd : null;
  return {
    llmCalls,
    meanCostUsd,
    estimateUsd,
    reserveUsd,
    coverage,
    ok: coverage === null ? null : coverage >= assumptions.reserveMultiple,
  };
}

const TASKS: AiTask[] = ['enrich', 'chat_answer', 'digest', 'embed'];
const usd = (value: number, digits = 6) => value.toFixed(digits);

/** Markdown with the rows for PRESUPUESTO-IA §4 and the §5 check, from `GET /admin/costs`. */
export function renderCostReport(costs: CostsResponse, generatedAt: Date, api: string): string {
  const demo = estimateDemo(costs);
  const avoided =
    costs.calls.total === 0
      ? null
      : (costs.calls.cached + costs.calls.abstained) / costs.calls.total;
  const rows = TASKS.map((task) => {
    const stats = costs.taskStats[task];
    return stats
      ? `| \`${task}\` | ${Math.round(stats.avgInputTokens)} | ${Math.round(stats.avgOutputTokens)} | ${usd(stats.avgCostUsd)} | ${stats.paidCalls} | ${usd(costs.byTask[task], 4)} |`
      : `| \`${task}\` | pendiente | pendiente | pendiente | 0 | ${usd(costs.byTask[task], 4)} |`;
  });

  return `${[
    '# Costo real por función (F4-08)',
    '',
    `Fuente: \`GET ${api}/admin/costs\` · ${generatedAt.toISOString()} · ledger D1. Solo llamadas reales pagadas: sin`,
    'caché, sin `mock` y con resultado `ok`.',
    '',
    '| Función | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por llamada (USD) | Llamadas pagadas | Gasto total (USD) |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
    `Gasto total del ledger: USD ${usd(costs.totalUsd, 4)} · nivel \`${costs.budget.level}\` · llamadas evitadas (caché o abstención): ${
      avoided === null ? 'n/a' : `${Math.round(avoided * 100)} %`
    } de ${costs.calls.total}.`,
    '',
    '## Estimación de la demo (PRESUPUESTO-IA §5)',
    '',
    `- Llamadas LLM estimadas: **${demo.llmCalls}** (${DEMO_ASSUMPTIONS.classmates} × ${DEMO_ASSUMPTIONS.questionsEach} preguntas con ${DEMO_ASSUMPTIONS.avoidedShare * 100} % evitadas + ${DEMO_ASSUMPTIONS.rehearsals} ensayos × ${DEMO_ASSUMPTIONS.callsPerRehearsal}).`,
    `- Costo medio real de \`chat_answer\`: ${demo.meanCostUsd === null ? '**pendiente** (no hay llamadas reales en el ledger)' : `USD ${usd(demo.meanCostUsd)}`}.`,
    `- Estimación: ${demo.estimateUsd === null ? 'pendiente' : `**USD ${usd(demo.estimateUsd, 2)}**`} · reserva: USD ${usd(demo.reserveUsd, 2)}.`,
    `- Cobertura de la reserva: ${demo.coverage === null ? 'pendiente' : `${demo.coverage.toFixed(1)}×`} → ${
      demo.ok === null
        ? 'sin datos para F4-08 CA2'
        : demo.ok
          ? `cumple F4-08 CA2 (≥ ${DEMO_ASSUMPTIONS.reserveMultiple}×)`
          : `**no cumple** F4-08 CA2: bajar el modelo del chat en demo (PRESUPUESTO-IA §5)`
    }.`,
  ].join('\n')}\n`;
}
