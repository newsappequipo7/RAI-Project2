import { AI_TASKS, type AiTask, type CostsResponse } from '@repo/shared';
import { BUDGET, evaluateBudget } from './ai/budget';

interface TaskCostRow {
  task: AiTask;
  usd: number;
}

interface DayCostRow {
  day: string;
  usd: number;
}

interface CallCountsRow {
  total: number;
  cached: number | null;
  abstained: number | null;
  blocked: number | null;
}

interface BalanceRow {
  provider_balance_usd: number | null;
}

function emptyCostsByTask(): Record<AiTask, number> {
  return Object.fromEntries(AI_TASKS.map((task) => [task, 0])) as Record<AiTask, number>;
}

export async function loadCosts(db: D1Database): Promise<CostsResponse> {
  const [totalResult, byTaskResult, byDayResult, callsResult, averagesResult, balanceResult] =
    await db.batch([
      db.prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_calls'),
      db.prepare('SELECT task, SUM(cost_usd) AS usd FROM ai_calls GROUP BY task'),
      db.prepare(
        'SELECT substr(ts, 1, 10) AS day, SUM(cost_usd) AS usd FROM ai_calls GROUP BY day ORDER BY day',
      ),
      db.prepare(
        `SELECT COUNT(*) AS total,
                SUM(cached) AS cached,
                SUM(outcome = 'abstained') AS abstained,
                SUM(outcome = 'blocked_budget') AS blocked
         FROM ai_calls`,
      ),
      db.prepare(
        `SELECT task, AVG(cost_usd) AS usd FROM ai_calls
         WHERE outcome = 'ok' AND cached = 0 GROUP BY task`,
      ),
      db.prepare('SELECT provider_balance_usd FROM budget_snapshots ORDER BY ts DESC LIMIT 1'),
    ]);

  const totalUsd = (totalResult?.results[0] as { total: number } | undefined)?.total ?? 0;

  const byTask = emptyCostsByTask();
  for (const row of (byTaskResult?.results ?? []) as TaskCostRow[]) {
    byTask[row.task] = row.usd;
  }

  const avgCostPerCall: Partial<Record<AiTask, number>> = {};
  for (const row of (averagesResult?.results ?? []) as TaskCostRow[]) {
    avgCostPerCall[row.task] = row.usd;
  }

  const counts = callsResult?.results[0] as CallCountsRow | undefined;
  const lastBalance = balanceResult?.results[0] as BalanceRow | undefined;

  return {
    totalUsd,
    byTask,
    byDay: (byDayResult?.results ?? []) as DayCostRow[],
    calls: {
      total: counts?.total ?? 0,
      cached: counts?.cached ?? 0,
      abstained: counts?.abstained ?? 0,
      blocked: counts?.blocked ?? 0,
    },
    budget: {
      ...BUDGET,
      level: evaluateBudget(totalUsd),
      lastProviderBalance: lastBalance?.provider_balance_usd ?? null,
    },
    avgCostPerCall,
  };
}
