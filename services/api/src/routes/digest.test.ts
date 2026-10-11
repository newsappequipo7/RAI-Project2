import type { ChatResponse } from '@repo/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { upsert } from '../rag/index';
import { createTestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import { buildEnv, createTestKeys, signToken, type TestKeys } from '../test-support/tokens';

let keys: TestKeys;
let env: Bindings;

async function get(path: string, authorized = true) {
  const app = createApp(() => async () => keys.verificationKey);
  const headers: Record<string, string> = authorized
    ? { Authorization: `Bearer ${await signToken(keys)}` }
    : {};
  return app.request(path, { headers }, env);
}

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(async () => {
  env = buildEnv({ DB: createTestD1().d1, KV: fakeKv() });
  invalidateSpendCache();
  await upsert(env, [
    {
      id: 'gt-1',
      title: 'Titular',
      lead: 'Entradilla.',
      body: 'Cuerpo.',
      topics: ['sociedad'],
      geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] },
      importance: 2,
      certainty: 'confirmada',
      sources: [{ name: 'AGN', url: 'https://example.org' }],
      publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ]);
});

describe('GET /digest/:locationId', () => {
  it('requires a Firebase token', async () => {
    expect((await get('/digest/gt-guatemala', false)).status).toBe(401);
  });

  it('rejects a location outside the catalog', async () => {
    expect((await get('/digest/xx-nowhere')).status).toBe(422);
  });

  it('returns the digest as a ChatResponse', async () => {
    const response = await get('/digest/gt-guatemala');
    const body = (await response.json()) as ChatResponse;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: 'digest', blocks: [{ newsIds: ['gt-1'] }] });
  });
});
