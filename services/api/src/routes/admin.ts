import {
  budgetSnapshotRequestSchema,
  flagsPatchSchema,
  type AiSelftestResponse,
  type BudgetSnapshot,
} from '@repo/shared';
import { Hono } from 'hono';
import { gateway } from '../ai/gateway';
import { loadCosts } from '../costs';
import type { AppEnv } from '../env';
import { parseJsonBody } from '../http';
import { readFlags, writeFlags } from '../kv';

const SELFTEST_PROMPT = 'Responde solo con la palabra: ok';
const SELFTEST_MAX_TOKENS = 16;

export const adminRoutes = new Hono<AppEnv>()
  .get('/costs', async (c) => c.json(await loadCosts(c.env.DB)))

  .post('/flags', async (c) => {
    const patch = await parseJsonBody(c, flagsPatchSchema);
    const flags = { ...(await readFlags(c.env.KV)), ...patch };
    await writeFlags(c.env.KV, flags);
    return c.json(flags);
  })

  .post('/budget-snapshot', async (c) => {
    const { providerBalanceUsd, note } = await parseJsonBody(c, budgetSnapshotRequestSchema);
    const snapshot: BudgetSnapshot = {
      ts: new Date().toISOString(),
      providerBalanceUsd,
      note: note ?? null,
    };

    await c.env.DB.prepare(
      'INSERT INTO budget_snapshots (ts, provider_balance_usd, note) VALUES (?, ?, ?)',
    )
      .bind(snapshot.ts, snapshot.providerBalanceUsd, snapshot.note)
      .run();

    return c.json(snapshot);
  })

  .post('/ai/selftest', async (c) => {
    const result = await gateway.run(
      'chat_answer',
      { kind: 'text', prompt: SELFTEST_PROMPT, maxTokens: SELFTEST_MAX_TOKENS },
      { env: c.env, uid: c.var.uid },
    );

    const body: AiSelftestResponse = {
      text: result.output.kind === 'text' ? result.output.text : '',
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      costUsd: result.costUsd,
    };

    return c.json(body);
  });
