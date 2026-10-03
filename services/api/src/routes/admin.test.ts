import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { createTestD1, type TestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import { ADMIN_UID, buildEnv, createTestKeys, signToken, USER_UID, type TestKeys } from '../test-support/tokens';

let keys: TestKeys;
let testDb: TestD1;
let kv: KVNamespace;
let env: Bindings;

function insertCall(fields: {
  id: string;
  ts: string;
  task: string;
  cost: number;
  outcome?: string;
  cached?: number;
}) {
  testDb.sqlite
    .prepare(
      `INSERT INTO ai_calls (id, ts, task, provider, model, cost_usd, cached, outcome, env)
       VALUES (?, ?, ?, 'anthropic', 'm', ?, ?, ?, 'dev')`,
    )
    .run(fields.id, fields.ts, fields.task, fields.cost, fields.cached ?? 0, fields.outcome ?? 'ok');
  invalidateSpendCache();
}

async function adminRequest(path: string, init: RequestInit = {}, uid: string = ADMIN_UID) {
  const app = createApp(() => async () => keys.verificationKey);
  const token = await signToken(keys, { uid });
  const headers = { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` };
  return app.request(path, { ...init, headers }, env);
}

function postJson(path: string, body: unknown, uid?: string) {
  return adminRequest(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    uid,
  );
}

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(() => {
  testDb = createTestD1();
  kv = fakeKv();
  env = buildEnv({ DB: testDb.d1, KV: kv });
  invalidateSpendCache();
});

describe('GET /admin/costs', () => {
  it('returns zeros on an empty ledger', async () => {
    const response = await adminRequest('/admin/costs');
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalUsd: 0,
      byTask: { embed: 0, enrich: 0, chat_answer: 0, digest: 0, image_generate: 0 },
      byDay: [],
      calls: { total: 0, cached: 0, abstained: 0, blocked: 0 },
      budget: { limitUsd: 20, reserveUsd: 7, warnUsd: 8, softUsd: 11, hardUsd: 13, level: 'normal', lastProviderBalance: null },
      avgCostPerCall: {},
    });
  });

  it('aggregates cost by task and day, counts outcomes, and averages paid calls only', async () => {
    insertCall({ id: '1', ts: '2026-09-28T10:00:00.000Z', task: 'enrich', cost: 0.004 });
    insertCall({ id: '2', ts: '2026-09-28T11:00:00.000Z', task: 'enrich', cost: 0.006 });
    insertCall({ id: '3', ts: '2026-09-29T09:00:00.000Z', task: 'chat_answer', cost: 0.002, cached: 1 });
    insertCall({ id: '4', ts: '2026-09-29T09:05:00.000Z', task: 'chat_answer', cost: 0, outcome: 'blocked_budget' });
    insertCall({ id: '5', ts: '2026-09-29T09:10:00.000Z', task: 'chat_answer', cost: 0, outcome: 'abstained' });

    const response = await adminRequest('/admin/costs');
    const body = (await response.json()) as {
      totalUsd: number;
      byTask: Record<string, number>;
      byDay: { day: string; usd: number }[];
      calls: Record<string, number>;
      avgCostPerCall: Record<string, number>;
    };

    expect(body.totalUsd).toBeCloseTo(0.012, 10);
    expect(body.byTask.enrich).toBeCloseTo(0.01, 10);
    expect(body.byTask.chat_answer).toBeCloseTo(0.002, 10);
    expect(body.byDay.map((entry) => entry.day)).toEqual(['2026-09-28', '2026-09-29']);
    expect(body.byDay[0]?.usd).toBeCloseTo(0.01, 10);
    expect(body.calls).toEqual({ total: 5, cached: 1, abstained: 1, blocked: 1 });
    expect(body.avgCostPerCall.enrich).toBeCloseTo(0.005, 10);
    expect(body.avgCostPerCall.chat_answer).toBeUndefined();
  });

  it('matches an independent read of the ledger rows (F2-09 CA1)', async () => {
    const tasks = ['embed', 'enrich', 'chat_answer', 'digest'];
    const outcomes = ['ok', 'ok', 'ok', 'error', 'abstained', 'blocked_budget'];
    for (let index = 0; index < 60; index += 1) {
      insertCall({
        id: `row-${index}`,
        ts: `2026-09-${String(20 + (index % 9)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
        task: tasks[index % tasks.length] as string,
        cost: ((index * 7) % 13) / 1000,
        outcome: outcomes[index % outcomes.length] as string,
        cached: index % 5 === 0 ? 1 : 0,
      });
    }

    const rows = testDb.sqlite.prepare('SELECT * FROM ai_calls').all() as {
      ts: string;
      task: string;
      cost_usd: number;
      cached: number;
      outcome: string;
    }[];
    const sum = (items: { cost_usd: number }[]) => items.reduce((total, row) => total + row.cost_usd, 0);

    const body = (await (await adminRequest('/admin/costs')).json()) as {
      totalUsd: number;
      byTask: Record<string, number>;
      byDay: { day: string; usd: number }[];
      calls: { total: number; cached: number; abstained: number; blocked: number };
      avgCostPerCall: Record<string, number>;
    };

    expect(body.totalUsd).toBeCloseTo(sum(rows), 10);
    for (const task of tasks) {
      expect(body.byTask[task]).toBeCloseTo(sum(rows.filter((row) => row.task === task)), 10);
    }
    const days = [...new Set(rows.map((row) => row.ts.slice(0, 10)))].sort();
    expect(body.byDay.map((entry) => entry.day)).toEqual(days);
    for (const entry of body.byDay) {
      expect(entry.usd).toBeCloseTo(sum(rows.filter((row) => row.ts.startsWith(entry.day))), 10);
    }
    expect(body.byDay.reduce((total, entry) => total + entry.usd, 0)).toBeCloseTo(body.totalUsd, 10);
    expect(body.calls).toEqual({
      total: rows.length,
      cached: rows.filter((row) => row.cached === 1).length,
      abstained: rows.filter((row) => row.outcome === 'abstained').length,
      blocked: rows.filter((row) => row.outcome === 'blocked_budget').length,
    });
    for (const task of tasks) {
      const paid = rows.filter((row) => row.task === task && row.outcome === 'ok' && row.cached === 0);
      if (paid.length > 0) expect(body.avgCostPerCall[task]).toBeCloseTo(sum(paid) / paid.length, 10);
    }
  });

  it('reports the budget level and the latest provider balance', async () => {
    insertCall({ id: '1', ts: '2026-09-28T10:00:00.000Z', task: 'chat_answer', cost: 11.2 });
    await postJson('/admin/budget-snapshot', { providerBalanceUsd: 8.5 });

    const body = (await (await adminRequest('/admin/costs')).json()) as {
      budget: { level: string; lastProviderBalance: number };
    };

    expect(body.budget.level).toBe('soft');
    expect(body.budget.lastProviderBalance).toBe(8.5);
  });

  it('is admin only', async () => {
    expect((await adminRequest('/admin/costs', {}, USER_UID)).status).toBe(403);
  });
});

describe('POST /admin/flags', () => {
  it('merges a partial patch into the stored flags', async () => {
    const response = await postJson('/admin/flags', { killSwitch: true });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ killSwitch: true, imageGenEnabled: false, chatMode: 'full' });

    const second = await postJson('/admin/flags', { chatMode: 'retrieval_only' });
    expect(await second.json()).toEqual({ killSwitch: true, imageGenEnabled: false, chatMode: 'retrieval_only' });

    const health = (await (await createApp().request('/health', {}, env)).json()) as { flags: unknown };
    expect(health.flags).toEqual({ killSwitch: true, imageGenEnabled: false, chatMode: 'retrieval_only' });
  });

  it('rejects unknown fields and invalid values with 422', async () => {
    for (const body of [{ nope: true }, { killSwitch: 'yes' }, { chatMode: 'other' }]) {
      const response = await postJson('/admin/flags', body);
      expect(response.status).toBe(422);
      expect(((await response.json()) as { error: { code: string } }).error.code).toBe('invalid_input');
    }
  });

  it('rejects a body that is not JSON', async () => {
    const response = await adminRequest('/admin/flags', { method: 'POST', body: 'not json' });
    expect(response.status).toBe(422);
  });

  it('is admin only', async () => {
    expect((await postJson('/admin/flags', { killSwitch: true }, USER_UID)).status).toBe(403);
  });
});

describe('POST /admin/budget-snapshot', () => {
  it('stores the manual provider balance', async () => {
    const response = await postJson('/admin/budget-snapshot', { providerBalanceUsd: 16.2, note: 'lunes' });
    const body = (await response.json()) as { ts: string; providerBalanceUsd: number; note: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ providerBalanceUsd: 16.2, note: 'lunes' });

    const stored = testDb.sqlite.prepare('SELECT * FROM budget_snapshots').all();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ provider_balance_usd: 16.2, note: 'lunes' });
  });

  it('rejects negative balances, non-numbers and unknown fields', async () => {
    for (const body of [{ providerBalanceUsd: -1 }, { providerBalanceUsd: '5' }, {}, { providerBalanceUsd: 1, extra: 1 }]) {
      expect((await postJson('/admin/budget-snapshot', body)).status).toBe(422);
    }
  });
});

describe('POST /admin/ai/selftest', () => {
  it('runs one tiny call through the gateway and records it', async () => {
    const response = await postJson('/admin/ai/selftest', {});
    const body = (await response.json()) as { provider: string; costUsd: number; text: string };

    expect(response.status).toBe(200);
    expect(body.provider).toBe('mock');
    expect(body.costUsd).toBe(0);
    expect(body.text.length).toBeGreaterThan(0);
    expect(testDb.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_calls').get()).toEqual({ n: 1 });
  });

  it('is blocked by the kill switch', async () => {
    await postJson('/admin/flags', { killSwitch: true });

    const response = await postJson('/admin/ai/selftest', {});

    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe('budget_blocked');
  });
});
