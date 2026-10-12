import type { IndexInput } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import type { Bindings } from '../env';
import { createTestD1, type TestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import { buildEnv, USER_UID } from '../test-support/tokens';
import { runChat } from './chat';
import { DIGEST_SIZE, digestKey, getDigest, selectDigestNews } from './digest';
import { readIndex, rebuild, remove, upsert } from './index';

const NOW = new Date('2026-10-11T12:00:00.000Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const TOPICS = ['politica', 'economia', 'salud', 'deportes', 'cultura', 'tecnologia', 'sociedad'];

let testDb: TestD1;
let kv: KVNamespace;
let env: Bindings;

function news(id: string, overrides: Partial<IndexInput> = {}): IndexInput {
  return {
    id,
    title: `Titular ${id}`,
    lead: `Entradilla de ${id}.`,
    body: `Cuerpo de ${id}.`,
    topics: ['sociedad'],
    geo: { scope: 'nacional', countries: ['ES'], cityIds: [], regions: ['europa'] },
    importance: 2,
    certainty: 'confirmada',
    sources: [{ name: 'EFE', url: 'https://example.org/1' }],
    publishedAt: hoursAgo(2),
    ...overrides,
  };
}

// Nine Spanish national news, one global news (so Madrid's international quota is already met)
// and one Guatemalan national news.
const CORPUS: IndexInput[] = [
  ...Array.from({ length: 9 }, (_, index) =>
    news(`es-${index}`, {
      topics: [TOPICS[index % TOPICS.length]!],
      publishedAt: hoursAgo(1 + index),
    }),
  ),
  news('global', {
    topics: ['salud'],
    geo: { scope: 'global', countries: [], cityIds: [], regions: [] },
  }),
  news('gt-1', {
    importance: 1,
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
  }),
];

const GT_LOCAL = news('gt-local', {
  importance: 0,
  topics: ['cultura'],
  geo: { scope: 'local', countries: ['GT'], cityIds: ['gt-guatemala'], regions: [] },
  publishedAt: hoursAgo(0.5),
});

const digest = (locationId: string) =>
  getDigest(locationId, { env, uid: USER_UID, now: () => NOW });

function digestRows() {
  return testDb.sqlite
    .prepare("SELECT outcome, cached, cost_usd FROM ai_calls WHERE task = 'digest'")
    .all() as { outcome: string; cached: number; cost_usd: number }[];
}

beforeEach(async () => {
  testDb = createTestD1();
  kv = fakeKv();
  env = buildEnv({ DB: testDb.d1, KV: kv });
  invalidateSpendCache();
  await upsert(env, CORPUS, NOW);
  testDb.sqlite.exec('DELETE FROM ai_calls');
});

describe('selectDigestNews', () => {
  it('takes at most 8 news from rankFeed with a neutral profile, inside the feed window', async () => {
    const entries = await readIndex(kv);
    const old = { ...entries[0]!, id: 'viejo', publishedAt: hoursAgo(100) };
    const selected = selectDigestNews([...entries, old], 'es-madrid', NOW);

    expect(selected).toHaveLength(DIGEST_SIZE);
    expect(selected.map(({ id }) => id)).not.toContain('viejo');
  });

  it('is the same for every reader of a location and differs between locations', async () => {
    const entries = await readIndex(kv);
    const madrid = selectDigestNews(entries, 'es-madrid', NOW).map(({ id }) => id);

    expect(selectDigestNews(entries, 'es-madrid', NOW).map(({ id }) => id)).toEqual(madrid);
    expect(selectDigestNews(entries, 'gt-guatemala', NOW).map(({ id }) => id)).toContain('gt-1');
    expect(madrid).not.toContain('gt-1');
  });

  it('puts essentials first', async () => {
    await upsert(env, [news('esencial', { importance: 3, publishedAt: hoursAgo(5) })], NOW);
    const selected = selectDigestNews(await readIndex(kv), 'es-madrid', NOW);
    expect(selected[0]?.id).toBe('esencial');
  });
});

describe('getDigest', () => {
  it('generates once and serves the second request for the same location and index at cost 0 (F4-03 CA1)', async () => {
    const first = await digest('es-madrid');
    const second = await digest('es-madrid');

    expect(first).toMatchObject({
      mode: 'digest',
      cached: false,
      generatedBy: { provider: 'mock' },
    });
    expect(first.blocks.length).toBeGreaterThan(0);
    expect(second).toMatchObject({ mode: 'digest', cached: true, costUsd: 0 });
    expect(second.blocks).toEqual(first.blocks);
    expect(digestRows()).toEqual([
      { outcome: 'ok', cached: 0, cost_usd: 0 },
      { outcome: 'ok', cached: 1, cost_usd: 0 },
    ]);
  });

  it('cites only news of the selection', async () => {
    const response = await digest('es-madrid');
    const selection = new Set(
      selectDigestNews(await readIndex(kv), 'es-madrid', NOW).map(({ id }) => id),
    );
    expect(response.sources.every(({ newsId }) => selection.has(newsId))).toBe(true);
  });

  it('regenerates after an index change that affects it', async () => {
    await digest('es-madrid');
    await upsert(env, [news('es-0', { title: 'Titular corregido' })], NOW);

    expect((await digest('es-madrid')).cached).toBe(false);
  });

  it('answers blocked under the kill switch and abstains without recent news', async () => {
    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: true, imageGenEnabled: false, chatMode: 'full' }),
    );
    expect((await digest('es-madrid')).mode).toBe('blocked');

    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: false, imageGenEnabled: false, chatMode: 'full' }),
    );
    const later = new Date(NOW.getTime() + 200 * 3_600_000);
    const empty = await getDigest('es-madrid', { env, uid: USER_UID, now: () => later });
    expect(empty).toMatchObject({ mode: 'abstain', blocks: [] });
  });

  it('lists the selection without a model and stores nothing in retrieval_only', async () => {
    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: false, imageGenEnabled: false, chatMode: 'retrieval_only' }),
    );
    const response = await digest('es-madrid');

    expect(response).toMatchObject({ mode: 'retrieval_only', generatedBy: null });
    expect(response.blocks).toHaveLength(DIGEST_SIZE);
    expect(await kv.get(digestKey('es-madrid'))).toBeNull();
    expect(digestRows()).toEqual([]);
  });
});

describe('digest invalidation (F4-03 CA2)', () => {
  beforeEach(async () => {
    await digest('es-madrid');
    await digest('gt-guatemala');
  });

  it('publishing a Guatemala news invalidates only the digests it changes', async () => {
    const mutation = await upsert(env, [GT_LOCAL], NOW);

    expect(mutation.invalidatedDigests).toEqual(['gt-guatemala']);
    expect(await kv.get(digestKey('gt-guatemala'))).toBeNull();

    const madrid = await digest('es-madrid');
    expect(madrid).toMatchObject({ mode: 'digest', cached: true, costUsd: 0 });
  });

  it('invalidates a digest that cites a corrected or removed news', async () => {
    const madridIds = selectDigestNews(await readIndex(kv), 'es-madrid', NOW).map(({ id }) => id);
    const cited = madridIds[0]!;

    const mutation = await remove(env, [cited], NOW);
    expect(mutation.invalidatedDigests).toContain('es-madrid');
  });

  it('a full rebuild invalidates every digest', async () => {
    const mutation = await rebuild(env, CORPUS, NOW);
    expect(mutation.invalidatedDigests.sort()).toEqual(['es-madrid', 'gt-guatemala']);
  });
});

describe('chat digest shortcut (CHAT-RAG §2 step 4)', () => {
  const ask = (message: string) =>
    runChat({ message, locationId: 'es-madrid' }, { env, uid: USER_UID, now: () => NOW });

  it('answers a generic summary request with the location digest', async () => {
    const response = await ask('Resume lo más importante de hoy');
    expect(response).toMatchObject({ mode: 'digest', debug: { intent: 'resumen' } });
    expect((await ask('¿Qué pasa en mi zona?')).mode).toBe('digest');
  });

  it('does not use the digest for a question with a topic', async () => {
    const response = await ask('¿Qué pasa en mi zona con el dengue?');
    expect(response.mode).not.toBe('digest');
    expect(response.debug?.intent).toBe('mi_region');
  });
});
