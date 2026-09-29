export const AI_TASKS = ['embed', 'enrich', 'chat_answer', 'digest', 'image_generate'] as const;
export type AiTask = (typeof AI_TASKS)[number];

export const CALL_OUTCOMES = ['ok', 'error', 'blocked_budget', 'abstained'] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const BUDGET_LEVELS = ['normal', 'warn', 'soft', 'hard', 'exhausted'] as const;
export type BudgetLevel = (typeof BUDGET_LEVELS)[number];
