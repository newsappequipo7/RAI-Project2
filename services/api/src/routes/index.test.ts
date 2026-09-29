import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { IndexInput, IndexSearchResponse, IndexUpsertResponse } from '@repo/shared';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { createTestD1 } from '../test-support/d1';
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
let kv: KVNamespace;
let env: Bindings;

function news(id: string, overrides: Partial<IndexInput> = {}): IndexInput {
  return {
    id,
    title: `Titular ${id}`,
    lead: '',
    body: '',
    topics: ['politica'],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] },
    importance: 2,
    certainty: 'confirmada',
    sources: [{ name: 'Fuente', url: 'https://example.org' }],
    publishedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

async function call(path: string, body: unknown, uid: string = ADMIN_UID) {
  const app = createApp(() => async () => keys.verificationKey);
  const token = await signToken(keys, { uid });
  return app.request(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    },
    env,
  );
}

async function search(query: string) {
  const response = await call('/admin/index/search', { query });
  return (await response.json()) as IndexSearchResponse;
}

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(() => {
  kv = fakeKv();
  env = buildEnv({ DB: createTestD1().d1, KV: kv });
});

describe('/admin/index', () => {
  it('rejects non-admins', async () => {
    const response = await call('/admin/index/upsert', { news: [news('a')] }, USER_UID);
    expect(response.status).toBe(403);
  });

  it('validates the body', async () => {
    expect((await call('/admin/index/upsert', { news: [] })).status).toBe(422);
    expect((await call('/admin/index/upsert', { news: [{ id: 'x' }] })).status).toBe(422);
  });

  it('upserts, bumps the version and finds the news by its own text', async () => {
    const response = await call('/admin/index/upsert', { news: [news('a'), news('b')] });
    const body = (await response.json()) as IndexUpsertResponse;
    expect(body).toMatchObject({ indexVersion: 1, upserted: 2 });

    const found = await search('Titular b');
    expect(found.indexVersion).toBe(1);
    expect(found.hits[0]).toMatchObject({ id: 'b', score: 1 });
  });

  it('replaces an existing id on upsert instead of duplicating it', async () => {
    await call('/admin/index/upsert', { news: [news('a')] });
    await call('/admin/index/upsert', { news: [news('a', { title: 'Nuevo titular' })] });

    const found = await search('Nuevo titular');
    expect(found.indexVersion).toBe(2);
    expect(found.hits).toHaveLength(1);
    expect(found.hits[0]?.title).toBe('Nuevo titular');
  });

  it('never returns a retracted news, even for its exact text', async () => {
    await call('/admin/index/upsert', {
      news: [news('a'), news('r', { certainty: 'retractada' })],
    });

    const found = await search('Titular r');
    expect(found.hits.map((hit) => hit.id)).not.toContain('r');
  });

  it('removes news and reports how many', async () => {
    await call('/admin/index/upsert', { news: [news('a'), news('b')] });
    const response = await call('/admin/index/remove', { ids: ['a', 'missing'] });
    expect(await response.json()).toMatchObject({ indexVersion: 2, removed: 1 });

    expect((await search('Titular a')).hits.map((hit) => hit.id)).toEqual(['b']);
  });

  it('rebuild replaces the whole index', async () => {
    await call('/admin/index/upsert', { news: [news('a')] });
    await call('/admin/index/rebuild', { news: [news('z')] });

    expect((await search('Titular z')).hits.map((hit) => hit.id)).toEqual(['z']);
  });

  it('invalidates digests on upsert', async () => {
    await kv.put('digest:gt-guatemala', '{}');
    await kv.put('digest:mx-cdmx', '{}');

    const response = await call('/admin/index/upsert', { news: [news('a')] });
    const body = (await response.json()) as IndexUpsertResponse;

    expect(body.invalidatedDigests.sort()).toEqual(['gt-guatemala', 'mx-cdmx']);
    expect(await kv.get('digest:gt-guatemala')).toBeNull();
  });

  it('keeps only the current version in KV', async () => {
    await call('/admin/index/upsert', { news: [news('a')] });
    await call('/admin/index/upsert', { news: [news('b')] });

    expect(await kv.get('rag:index:v1')).toBeNull();
    expect(await kv.get('rag:index:v2')).not.toBeNull();
  });

  it('filters search by country', async () => {
    await call('/admin/index/upsert', {
      news: [
        news('gt'),
        news('mx', { geo: { scope: 'nacional', countries: ['MX'], cityIds: [], regions: [] } }),
      ],
    });

    const response = await call('/admin/index/search', { query: 'Titular gt', countries: ['MX'] });
    const body = (await response.json()) as IndexSearchResponse;
    expect(body.hits.map((hit) => hit.id)).toEqual(['mx']);
  });
});
