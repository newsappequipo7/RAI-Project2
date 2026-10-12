import { classifyIntent, type IndexInput } from '@repo/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import type { Bindings } from '../env';
import { createTestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import { buildEnv, USER_UID } from '../test-support/tokens';
import { runChat } from './chat';
import { getDigest } from './digest';
import { buildEmbeddingText, remove, upsert } from './index';

// DEMO-RUNBOOK §2, steps 4–5: the chat inherits D1's certainty and stops citing a retracted news.
const NOW = new Date('2026-10-11T12:00:00.000Z');
const D1: IndexInput = {
  id: 'demo-d1',
  title: 'Alerta por lluvias intensas en Quetzaltenango',
  lead: 'Las autoridades emitieron una alerta por lluvias intensas en Quetzaltenango.',
  body: 'Noticia de prueba para el proyecto académico.',
  topics: ['clima-desastres'],
  geo: { scope: 'local', countries: ['GT'], cityIds: ['gt-quetzaltenango'], regions: [] },
  importance: 3,
  certainty: 'en_desarrollo',
  certaintyNote: 'Solo hay un reporte oficial preliminar.',
  sources: [{ name: 'Fuente de ejemplo', url: 'https://example.org/d1' }],
  publishedAt: '2026-10-11T11:00:00.000Z',
};

let env: Bindings;
const ctx = () => ({ env, uid: USER_UID, now: () => NOW });

beforeEach(async () => {
  env = buildEnv({ DB: createTestD1().d1, KV: fakeKv() });
  invalidateSpendCache();
  await upsert(env, [D1], NOW);
});

describe('demo section 5 (chat)', () => {
  it('routes the scripted question from Mexico City to Guatemala news', () => {
    expect(classifyIntent('¿Qué se sabe de las lluvias en Guatemala?', 'mx-cdmx')).toMatchObject({
      intent: 'otro_pais',
      countries: ['GT'],
    });
  });

  it('answers about D1 with the inherited "en desarrollo" certainty and a warning', async () => {
    // With AI_MODE=mock only the exact indexed text retrieves D1; live embeddings match the question.
    const response = await runChat(
      { message: buildEmbeddingText(D1), locationId: 'mx-cdmx' },
      ctx(),
    );

    expect(response.mode).toBe('answer');
    expect(response.blocks[0]).toMatchObject({ newsIds: ['demo-d1'], certainty: 'en_desarrollo' });
    expect(response.notice).toMatch(/en desarrollo/);
  });
});

describe('demo section 7 (live retraction)', () => {
  it('stops citing a retracted news in the chat, even a question asked before', async () => {
    const question = { message: buildEmbeddingText(D1), locationId: 'gt-quetzaltenango' };
    expect((await runChat(question, ctx())).sources.map(({ newsId }) => newsId)).toEqual([
      'demo-d1',
    ]);

    // Retracting in the portal removes the news from the index (F2-08).
    await remove(env, ['demo-d1'], NOW);
    const after = await runChat(question, ctx());

    expect(after.cached).toBe(false);
    expect(after.mode).toBe('abstain');
    expect(JSON.stringify(after)).not.toContain('demo-d1');
  });

  it('drops the location digest that cited it', async () => {
    const before = await getDigest('gt-quetzaltenango', ctx());
    expect(before.sources.map(({ newsId }) => newsId)).toContain('demo-d1');

    const mutation = await remove(env, ['demo-d1'], NOW);
    expect(mutation.invalidatedDigests).toContain('gt-quetzaltenango');
    expect(JSON.stringify(await getDigest('gt-quetzaltenango', ctx()))).not.toContain('demo-d1');
  });
});
