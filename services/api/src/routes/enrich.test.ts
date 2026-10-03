import type { EnrichSuggestion } from '@repo/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { createTestD1, type TestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import {
  ADMIN_UID,
  buildEnv,
  createTestKeys,
  signToken,
  USER_UID,
  type TestKeys,
} from '../test-support/tokens';

let keys: TestKeys;
let testDb: TestD1;
let env: Bindings;

const body = { newsId: 'n1', title: 'Titular', lead: 'Entradilla', body: 'Cuerpo de la noticia.' };

async function post(payload: unknown, uid: string = ADMIN_UID) {
  const app = createApp(() => async () => keys.verificationKey);
  const token = await signToken(keys, { uid });
  return app.request(
    '/admin/enrich',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    env,
  );
}

const ledger = () =>
  testDb.sqlite
    .prepare('SELECT task, cached, cost_usd, outcome, provider FROM ai_calls ORDER BY ts, rowid')
    .all() as {
    task: string;
    cached: number;
    cost_usd: number;
    outcome: string;
    provider: string;
  }[];

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(() => {
  testDb = createTestD1();
  env = buildEnv({ DB: testDb.d1, KV: fakeKv() });
  invalidateSpendCache();
});

describe('POST /admin/enrich (AI_MODE=mock)', () => {
  it('rejects non-admins and invalid bodies', async () => {
    expect((await post(body, USER_UID)).status).toBe(403);
    expect((await post({ ...body, title: '  ' })).status).toBe(422);
    expect((await post({ ...body, body: '' })).status).toBe(422);
    expect((await post({ newsId: 'n1' })).status).toBe(422);
    expect((await post({ ...body, extra: 1 })).status).toBe(422);
    expect((await post({ ...body, body: 'x'.repeat(20001) })).status).toBe(422);
  });

  it('returns a suggestion that matches the EnrichSuggestion contract', async () => {
    const response = await post(body);
    const suggestion = (await response.json()) as EnrichSuggestion;

    expect(response.status).toBe(200);
    expect(suggestion.topics.every((topic) => typeof topic.key === 'string')).toBe(true);
    expect(suggestion.geo.scope).toBeTruthy();
    expect([0, 1, 2, 3]).toContain(suggestion.importance.value);
    expect(suggestion.model).toBe('mock');
    expect(suggestion.costUsd).toBe(0);
    expect(Date.parse(suggestion.createdAt)).not.toBeNaN();
  });

  it('CA2: the second identical request is a cache hit in the ledger, at no cost', async () => {
    await post(body);
    const second = (await (await post(body)).json()) as EnrichSuggestion;

    expect(second.costUsd).toBe(0);
    const rows = ledger();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ task: 'enrich', cached: 0, outcome: 'ok', provider: 'mock' });
    expect(rows[1]).toMatchObject({ task: 'enrich', cached: 1, cost_usd: 0, outcome: 'ok' });
  });

  it('a change in the content is a new, uncached call', async () => {
    await post(body);
    await post({ ...body, body: 'Otro cuerpo.' });
    expect(ledger().map((row) => row.cached)).toEqual([0, 0]);
  });

  it('is blocked by the kill switch, like every model call', async () => {
    env = buildEnv({
      DB: testDb.d1,
      KV: fakeKv({ flags: { killSwitch: true, imageGenEnabled: false, chatMode: 'full' } }),
    });
    expect((await post(body)).status).toBe(503);
  });
});
