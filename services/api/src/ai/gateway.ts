import type { AiTask, CallOutcome } from '@repo/shared';
import { ApiError, budgetBlocked, forbidden, providerError } from '../errors';
import { readFlags } from '../kv';
import { applyBudgetToFlags, evaluateBudget, isTaskBlocked } from './budget';
import { resolveRoute } from './config';
import { getTotalSpend, recordCall } from './ledger';
import { computeCostUsd, findModelPrice } from './pricing';
import { callAnthropic } from './providers/anthropic';
import { callMock } from './providers/mock';
import { callWorkersAi } from './providers/workersAi';
import { CHAT_RATE_LIMIT_PER_HOUR, consumeRateLimit } from './rateLimit';
import type {
  AiInput,
  AiUsage,
  GatewayContext,
  GatewayResult,
  Provider,
  ProviderName,
  TaskRoute,
} from './types';

const DEFAULT_PROVIDERS: Record<ProviderName, Provider> = {
  mock: callMock,
  anthropic: callAnthropic,
  'workers-ai': callWorkersAi,
};

const UNROUTED: TaskRoute = { provider: 'mock', model: 'unrouted' };
const NO_USAGE: AiUsage = { inputTokens: 0, outputTokens: 0 };

interface LedgerEntry {
  outcome: CallOutcome;
  usage?: AiUsage;
  costUsd?: number;
}

async function run(task: AiTask, input: AiInput, ctx: GatewayContext): Promise<GatewayResult> {
  const now = ctx.now?.() ?? new Date();
  const route = resolveRoute(task, ctx.env) ?? UNROUTED;

  const log = ({ outcome, usage = NO_USAGE, costUsd = 0 }: LedgerEntry) =>
    recordCallSafely(ctx, task, route, now, { outcome, usage, costUsd });

  const [flags, totalUsd] = await Promise.all([
    readFlags(ctx.env.KV),
    getTotalSpend(ctx.env.DB, now.getTime()),
  ]);
  const level = evaluateBudget(totalUsd);

  if (flags.killSwitch) {
    await log({ outcome: 'blocked_budget' });
    throw budgetBlocked('AI calls are disabled by the kill switch');
  }

  if (isTaskBlocked(task, level, ctx.env.ENV, route.provider)) {
    await log({ outcome: 'blocked_budget' });
    throw budgetBlocked(`AI budget threshold reached (${level}) for env ${ctx.env.ENV}`);
  }

  if (task === 'image_generate') {
    if (!applyBudgetToFlags(flags, level, ctx.env.ENV).imageGenEnabled) {
      throw forbidden('Image generation is disabled');
    }
    throw providerError('Image generation is not implemented');
  }

  const price = findModelPrice(route.provider, route.model);

  if (!price) {
    throw providerError(`No pricing configured for model ${route.model}`);
  }

  if (task === 'chat_answer' && ctx.uid) {
    await consumeRateLimit(ctx.env.DB, ctx.uid, CHAT_RATE_LIMIT_PER_HOUR, now);
  }

  const provider = ctx.providers?.[route.provider] ?? DEFAULT_PROVIDERS[route.provider];
  let result;

  try {
    result = await provider({ task, model: route.model, input, env: ctx.env });
  } catch (error) {
    await log({ outcome: 'error' });
    throw error instanceof ApiError ? error : providerError('Provider request failed');
  }

  const costUsd = computeCostUsd(price, result.usage);
  await log({ outcome: 'ok', usage: result.usage, costUsd });

  return { ...result, costUsd, model: route.model, provider: route.provider };
}

async function recordCallSafely(
  ctx: GatewayContext,
  task: AiTask,
  route: TaskRoute,
  now: Date,
  entry: Required<LedgerEntry>,
  cached = false,
): Promise<void> {
  const record = {
    id: crypto.randomUUID(),
    ts: now.toISOString(),
    task,
    provider: route.provider,
    model: route.model,
    inputTokens: entry.usage.inputTokens,
    outputTokens: entry.usage.outputTokens,
    costUsd: entry.costUsd,
    uid: ctx.uid ?? null,
    cached,
    outcome: entry.outcome,
    env: ctx.env.ENV,
  };

  try {
    await recordCall(ctx.env.DB, record);
  } catch (error) {
    // The provider call already happened (and may have cost money): keep the row in the logs
    // instead of failing the request, so the ledger can be repaired from them.
    console.error('ai_calls insert failed', JSON.stringify(record), error);
  }
}

/**
 * Records that a result was served from cache instead of calling a model: a zero-cost row marked
 * `cached`, so the dashboard can show how many paid calls were avoided.
 */
async function recordCacheHit(task: AiTask, ctx: GatewayContext): Promise<void> {
  const route = resolveRoute(task, ctx.env) ?? UNROUTED;
  await recordCallSafely(
    ctx,
    task,
    route,
    ctx.now?.() ?? new Date(),
    { outcome: 'ok', usage: NO_USAGE, costUsd: 0 },
    true,
  );
}

export const gateway = { run, recordCacheHit };
