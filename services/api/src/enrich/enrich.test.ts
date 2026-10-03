import type { EnrichRequest } from '@repo/shared';
import { describe, expect, it, vi } from 'vitest';
import type { GatewayResult } from '../ai/types';
import { buildEnv } from '../test-support/tokens';
import { fakeKv } from '../test-support/kv';
import { enrichCacheKey, enrichNews } from './enrich';

const REQUEST: EnrichRequest = {
  newsId: 'n1',
  title: 'Titular',
  lead: 'Entradilla',
  body: 'Cuerpo',
  sources: [],
};
const MODEL_JSON = JSON.stringify({
  topics: [{ key: 'salud', confidence: 0.9 }],
  geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
  importance: { value: 2, rationale: 'Razón.' },
  claims: [{ text: 'Hecho.', needsSource: true }],
  summary: 'Resumen.',
  sensationalismFlag: { flagged: false },
});

function result(text: string, costUsd = 0.004): GatewayResult {
  return {
    output: { kind: 'text', text },
    usage: { inputTokens: 900, outputTokens: 300 },
    costUsd,
    model: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
  };
}

function setup(text = MODEL_JSON, overrides = {}) {
  const run = vi.fn().mockResolvedValue(result(text));
  const recordCacheHit = vi.fn().mockResolvedValue(undefined);
  const env = buildEnv({ KV: fakeKv(), ...overrides });
  const deps = { run, recordCacheHit, now: () => new Date('2026-10-03T12:00:00.000Z') };
  return {
    run,
    recordCacheHit,
    env,
    call: (request = REQUEST) => enrichNews(env, 'admin', request, deps),
  };
}

describe('enrichNews', () => {
  it('asks the model once, with the versioned prompt, and returns a validated suggestion', async () => {
    const { run, call } = setup();
    const suggestion = await call();

    expect(run).toHaveBeenCalledTimes(1);
    const [task, input, context] = run.mock.calls[0] as [
      string,
      { system: string; prompt: string },
      { uid: string },
    ];
    expect(task).toBe('enrich');
    expect(input.system).toContain('SOLO de esta lista');
    expect(input.prompt).toContain('Titular');
    expect(context.uid).toBe('admin');
    expect(suggestion).toMatchObject({
      topics: [{ key: 'salud', confidence: 0.9 }],
      model: 'claude-haiku-4-5-20251001',
      costUsd: 0.004,
      createdAt: '2026-10-03T12:00:00.000Z',
    });
  });

  it('CA2: a second enrich of the same content costs 0 and calls no model', async () => {
    const { run, recordCacheHit, call } = setup();
    const first = await call();
    const second = await call();

    expect(run).toHaveBeenCalledTimes(1);
    expect(recordCacheHit).toHaveBeenCalledTimes(1);
    expect(recordCacheHit.mock.calls[0]?.[0]).toBe('enrich');
    expect(first.costUsd).toBe(0.004);
    expect(second.costUsd).toBe(0);
    expect({ ...second, costUsd: first.costUsd }).toEqual(first);
  });

  it('enriches again when the title, lead or body change', async () => {
    const { run, call } = setup();
    await call();
    await call({ ...REQUEST, body: 'Cuerpo distinto' });
    await call({ ...REQUEST, title: 'Otro titular' });
    await call({ ...REQUEST, lead: 'Otra entradilla' });
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('ignores a change in sources or newsId (the key is title + lead + body)', async () => {
    const { run, call } = setup();
    await call();
    await call({
      ...REQUEST,
      newsId: 'otra',
      sources: [{ name: 'Medio', url: 'https://example.org' }],
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never serves a mock result once the Worker is live, and vice versa', async () => {
    const mock = await enrichCacheKey(buildEnv({ AI_MODE: 'mock' }), REQUEST);
    const live = await enrichCacheKey(buildEnv({ AI_MODE: 'live' }), REQUEST);
    expect(mock).not.toBe(live);
    expect(mock).toContain(':mock:');
    expect(live).toContain(':live:');
    expect(live).toContain('enrich.v1');
  });

  it('does not cache an unusable model answer, and reports provider_error', async () => {
    const { run, call } = setup('Lo siento, no puedo ayudar con eso.');
    await expect(call()).rejects.toMatchObject({ code: 'provider_error' });

    run.mockResolvedValue(result(MODEL_JSON));
    await expect(call()).resolves.toMatchObject({ costUsd: 0.004 });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('discards a corrupt cache entry instead of returning it', async () => {
    const { run, env, call } = setup();
    await env.KV.put(await enrichCacheKey(env, REQUEST), JSON.stringify({ topics: 'roto' }));
    await call();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('lets gateway errors (kill switch, budget) reach the caller', async () => {
    const { run, call } = setup();
    run.mockRejectedValue(Object.assign(new Error('blocked'), { code: 'budget_blocked' }));
    await expect(call()).rejects.toMatchObject({ code: 'budget_blocked' });
  });
});
