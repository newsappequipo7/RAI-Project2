import type { AiTask, ApiEnv, BudgetLevel, Flags } from '@repo/shared';
import type { ProviderName } from './types';

// Thresholds from docs/ops/PRESUPUESTO-IA.md §2, in accumulated USD per the D1 ledger.
export const BUDGET = {
  limitUsd: 20,
  reserveUsd: 7,
  warnUsd: 8,
  softUsd: 11,
  hardUsd: 13,
} as const;

export function evaluateBudget(totalUsd: number): BudgetLevel {
  if (totalUsd >= BUDGET.limitUsd) return 'exhausted';
  if (totalUsd >= BUDGET.hardUsd) return 'hard';
  if (totalUsd >= BUDGET.softUsd) return 'soft';
  if (totalUsd >= BUDGET.warnUsd) return 'warn';
  return 'normal';
}

const SOFT_LIMITED_TASKS: readonly AiTask[] = ['enrich', 'chat_answer'];

export function isTaskBlocked(
  task: AiTask,
  level: BudgetLevel,
  env: ApiEnv,
  provider: ProviderName,
): boolean {
  if (level === 'exhausted') return true;
  if (env === 'demo') return false;
  if (level === 'hard') return true;

  const softLimit = level === 'soft' && SOFT_LIMITED_TASKS.includes(task);
  return softLimit && provider !== 'mock';
}

export function applyBudgetToFlags(flags: Flags, level: BudgetLevel, env: ApiEnv): Flags {
  const overWarn = level !== 'normal';
  const overSoftInDev = env === 'dev' && (level === 'soft' || level === 'hard' || level === 'exhausted');

  return {
    ...flags,
    imageGenEnabled: flags.imageGenEnabled && !overWarn,
    chatMode: overSoftInDev ? 'retrieval_only' : flags.chatMode,
  };
}
