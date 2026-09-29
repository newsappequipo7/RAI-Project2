import type { CallRecord } from './types';

const SPEND_CACHE_TTL_MS = 60_000;

interface CachedSpend {
  totalUsd: number;
  readAtMs: number;
}

let cachedSpend: CachedSpend | null = null;

export function invalidateSpendCache(): void {
  cachedSpend = null;
}

export async function recordCall(db: D1Database, record: CallRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ai_calls
        (id, ts, task, provider, model, input_tokens, output_tokens, cost_usd, uid, cached, outcome, env)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.ts,
      record.task,
      record.provider,
      record.model,
      record.inputTokens,
      record.outputTokens,
      record.costUsd,
      record.uid,
      record.cached ? 1 : 0,
      record.outcome,
      record.env,
    )
    .run();

  if (cachedSpend) {
    cachedSpend.totalUsd += record.costUsd;
  }
}

export async function getTotalSpend(db: D1Database, nowMs: number = Date.now()): Promise<number> {
  if (cachedSpend && nowMs - cachedSpend.readAtMs < SPEND_CACHE_TTL_MS) {
    return cachedSpend.totalUsd;
  }

  const row = await db
    .prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_calls')
    .first<{ total: number }>();

  cachedSpend = { totalUsd: row?.total ?? 0, readAtMs: nowMs };
  return cachedSpend.totalUsd;
}
