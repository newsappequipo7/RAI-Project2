import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../env';
import { ApiError } from '../errors';
import { createTestD1, type TestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import { buildEnv } from '../test-support/tokens';
import { gateway } from './gateway';
import { invalidateSpendCache } from './ledger';
import type { AiInput, GatewayContext, Provider } from './types';

const TEXT_INPUT: AiInput = { kind: 'text', prompt: 'hola', maxTokens: 50 };
const EMBED_INPUT: AiInput = { kind: 'embed', texts: ['uno', 'dos'] };
const CHAT_UID = 'chat-user';

let testDb: TestD1;

function seedSpend(totalUsd: number) {
  testDb.sqlite
    .prepare(
      `INSERT INTO ai_calls (id, ts, task, provider, model, cost_usd, outcome, env)
       VALUES ('seed', '2026-09-01T00:00:00.000Z', 'chat_answer', 'anthropic', 'm', ?, 'ok', 'dev')`,
    )
    .run(totalUsd);
  invalidateSpendCache();
}

function callRows(outcome?: string) {
  const sql = outcome
    ? 'SELECT * FROM ai_calls WHERE id != ? AND outcome = ?'
    : 'SELECT * FROM ai_calls WHERE id != ?';
  const params = outcome ? ['seed', outcome] : ['seed'];
  return testDb.sqlite.prepare(sql).all(...params) as Record<string, unknown>[];
}

function contextWith(overrides: Partial<Bindings> = {}, extra: Partial<GatewayContext> = {}): GatewayContext {
  return { env: buildEnv({ DB: testDb.d1, ...overrides }), ...extra };
}

function liveContext(providers: GatewayContext['providers'], overrides: Partial<Bindings> = {}) {
  return contextWith({ AI_MODE: 'live', ...overrides }, { providers });
}

function fakeAnthropic(inputTokens: number, outputTokens: number): Provider {
  return vi.fn(async () => ({
    output: { kind: 'text' as const, text: 'ok' },
    usage: { inputTokens, outputTokens },
  }));
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the gateway to throw an ApiError');
}

beforeEach(() => {
  testDb = createTestD1();
  invalidateSpendCache();
});

describe('mock mode', () => {
  it('answers from fixtures at zero cost and records the call', async () => {
    const result = await gateway.run('digest', TEXT_INPUT, contextWith());

    expect(result.provider).toBe('mock');
    expect(result.costUsd).toBe(0);
    expect(result.output.kind).toBe('text');
    expect(callRows('ok')).toHaveLength(1);
    expect(callRows('ok')[0]).toMatchObject({ task: 'digest', provider: 'mock', cost_usd: 0, env: 'dev' });
  });

  it('returns deterministic 1024-dimensional embeddings', async () => {
    const first = await gateway.run('embed', EMBED_INPUT, contextWith());
    const second = await gateway.run('embed', EMBED_INPUT, contextWith());

    expect(first.output.kind === 'embed' && first.output.embeddings).toHaveLength(2);
    expect(first.output).toEqual(second.output);
    expect(first.output.kind === 'embed' && first.output.embeddings[0]).toHaveLength(1024);
  });

  it('is the default whenever AI_MODE is not exactly "live"', async () => {
    const result = await gateway.run('enrich', TEXT_INPUT, contextWith({ AI_MODE: 'LIVE' }));
    expect(result.provider).toBe('mock');
  });
});

describe('cost calculation', () => {
  it('prices Haiku 4.5 at $1/$5 per million tokens and records it before returning', async () => {
    const provider = fakeAnthropic(1500, 500);

    const result = await gateway.run('enrich', TEXT_INPUT, liveContext({ anthropic: provider }));

    expect(result.costUsd).toBeCloseTo(0.004, 10);
    expect(result.model).toBe('claude-haiku-4-5-20251001');
    expect(callRows('ok')[0]).toMatchObject({
      provider: 'anthropic',
      input_tokens: 1500,
      output_tokens: 500,
    });
    expect(callRows('ok')[0]?.cost_usd).toBeCloseTo(0.004, 10);
  });

  it('honours a per-task model override', async () => {
    const provider = fakeAnthropic(1_000_000, 0);

    const result = await gateway.run(
      'digest',
      TEXT_INPUT,
      liveContext({ anthropic: provider }, { AI_MODEL_DIGEST: 'claude-haiku-4-5' }),
    );

    expect(result.model).toBe('claude-haiku-4-5');
    expect(result.costUsd).toBeCloseTo(1, 10);
  });

  it('refuses a model without pricing before spending anything', async () => {
    const provider = fakeAnthropic(1, 1);

    const error = await errorOf(
      gateway.run('enrich', TEXT_INPUT, liveContext({ anthropic: provider }, { AI_MODEL_ENRICH: 'claude-unknown' })),
    );

    expect(error.code).toBe('provider_error');
    expect(provider).not.toHaveBeenCalled();
  });

  it('routes @cf/ models to Workers AI at zero credit cost', async () => {
    const workersAi: Provider = async () => ({
      output: { kind: 'embed', embeddings: [[0.1], [0.2]] },
      usage: { inputTokens: 0, outputTokens: 0 },
    });

    const result = await gateway.run('embed', EMBED_INPUT, liveContext({ 'workers-ai': workersAi }));

    expect(result.provider).toBe('workers-ai');
    expect(result.model).toBe('@cf/baai/bge-m3');
    expect(result.costUsd).toBe(0);
  });
});

describe('provider failures', () => {
  it('records outcome=error with zero cost and hides provider details', async () => {
    const failing: Provider = async () => {
      throw new Error('secret upstream detail');
    };

    const error = await errorOf(gateway.run('enrich', TEXT_INPUT, liveContext({ anthropic: failing })));

    expect(error.code).toBe('provider_error');
    expect(error.message).not.toContain('secret');
    expect(callRows('error')).toHaveLength(1);
    expect(callRows('error')[0]).toMatchObject({ cost_usd: 0, provider: 'anthropic' });
  });

  it('fails cleanly when the API key is not configured', async () => {
    const error = await errorOf(gateway.run('enrich', TEXT_INPUT, contextWith({ AI_MODE: 'live' })));

    expect(error.code).toBe('provider_error');
    expect(error.message).toBe('AI provider is not configured');
    expect(callRows('error')).toHaveLength(1);
  });
});

describe('budget thresholds (env=dev)', () => {
  it('blocks every task once the ledger reaches the hard threshold', async () => {
    seedSpend(13);

    for (const [task, input] of [
      ['embed', EMBED_INPUT],
      ['enrich', TEXT_INPUT],
      ['chat_answer', TEXT_INPUT],
      ['digest', TEXT_INPUT],
    ] as const) {
      const error = await errorOf(gateway.run(task, input, contextWith()));
      expect(error.status).toBe(503);
      expect(error.code).toBe('budget_blocked');
    }

    expect(callRows('blocked_budget')).toHaveLength(4);
  });

  it('lets the same calls through with env=demo', async () => {
    seedSpend(13.5);

    const result = await gateway.run('chat_answer', TEXT_INPUT, contextWith({ ENV: 'demo' }, { uid: CHAT_UID }));

    expect(result.provider).toBe('mock');
  });

  it('still blocks env=demo once the whole $20 balance is spent', async () => {
    seedSpend(20);

    const error = await errorOf(gateway.run('chat_answer', TEXT_INPUT, contextWith({ ENV: 'demo' })));

    expect(error.code).toBe('budget_blocked');
  });

  it('at the soft threshold blocks live enrich and chat but not digest or mock', async () => {
    seedSpend(11.5);
    const provider = fakeAnthropic(10, 10);

    expect((await errorOf(gateway.run('enrich', TEXT_INPUT, liveContext({ anthropic: provider })))).code).toBe(
      'budget_blocked',
    );
    expect(
      (await errorOf(gateway.run('chat_answer', TEXT_INPUT, liveContext({ anthropic: provider })))).code,
    ).toBe('budget_blocked');
    expect(provider).not.toHaveBeenCalled();

    await expect(gateway.run('digest', TEXT_INPUT, liveContext({ anthropic: provider }))).resolves.toBeDefined();
    await expect(gateway.run('enrich', TEXT_INPUT, contextWith())).resolves.toBeDefined();
  });

  it('keeps spending below the warning level untouched', async () => {
    seedSpend(7.99);

    await expect(
      gateway.run('enrich', TEXT_INPUT, liveContext({ anthropic: fakeAnthropic(10, 10) })),
    ).resolves.toBeDefined();
  });

  it('caches the ledger total for 60 seconds', async () => {
    const start = new Date('2026-09-29T10:00:00.000Z');
    seedSpend(0);
    await gateway.run('digest', TEXT_INPUT, contextWith({}, { now: () => start }));

    // Changing the ledger behind the gateway's back is invisible until the cache expires.
    testDb.sqlite.prepare("UPDATE ai_calls SET cost_usd = 50 WHERE id = 'seed'").run();

    const within = new Date(start.getTime() + 30_000);
    await expect(gateway.run('digest', TEXT_INPUT, contextWith({}, { now: () => within }))).resolves.toBeDefined();

    const after = new Date(start.getTime() + 61_000);
    const error = await errorOf(gateway.run('digest', TEXT_INPUT, contextWith({}, { now: () => after })));
    expect(error.code).toBe('budget_blocked');
  });
});

describe('kill switch', () => {
  it('blocks every task and logs the blocked attempt', async () => {
    const kv = fakeKv({ flags: { killSwitch: true, imageGenEnabled: false, chatMode: 'full' } });

    const error = await errorOf(gateway.run('digest', TEXT_INPUT, contextWith({ KV: kv })));

    expect(error.code).toBe('budget_blocked');
    expect(callRows('blocked_budget')).toHaveLength(1);
  });
});

describe('image generation', () => {
  it('is forbidden while the flag is off', async () => {
    const error = await errorOf(gateway.run('image_generate', TEXT_INPUT, contextWith()));
    expect(error.code).toBe('forbidden');
  });

  it('stays forbidden past the warning threshold even if the flag is on', async () => {
    seedSpend(8);
    const kv = fakeKv({ flags: { killSwitch: false, imageGenEnabled: true, chatMode: 'full' } });

    const error = await errorOf(gateway.run('image_generate', TEXT_INPUT, contextWith({ KV: kv })));

    expect(error.code).toBe('forbidden');
  });

  it('reports that it is not implemented when enabled', async () => {
    const kv = fakeKv({ flags: { killSwitch: false, imageGenEnabled: true, chatMode: 'full' } });

    const error = await errorOf(gateway.run('image_generate', TEXT_INPUT, contextWith({ KV: kv })));

    expect(error.code).toBe('provider_error');
  });
});

describe('rate limit', () => {
  const noon = new Date('2026-09-29T12:30:00.000Z');

  async function chat(uid: string, now: Date) {
    return gateway.run('chat_answer', TEXT_INPUT, contextWith({}, { uid, now: () => now }));
  }

  it('allows 20 chat answers per hour per user and rejects the 21st', async () => {
    for (let call = 0; call < 20; call += 1) {
      await chat(CHAT_UID, noon);
    }

    const error = await errorOf(chat(CHAT_UID, noon));
    expect(error.status).toBe(429);
    expect(error.code).toBe('rate_limited');
  });

  it('does not limit other users or the next hour', async () => {
    for (let call = 0; call < 21; call += 1) {
      await chat(CHAT_UID, noon).catch(() => undefined);
    }

    await expect(chat('someone-else', noon)).resolves.toBeDefined();
    await expect(chat(CHAT_UID, new Date('2026-09-29T13:00:00.000Z'))).resolves.toBeDefined();
  });

  it('only applies to chat answers', async () => {
    for (let call = 0; call < 25; call += 1) {
      await gateway.run('digest', TEXT_INPUT, contextWith({}, { uid: CHAT_UID, now: () => noon }));
    }
  });
});
