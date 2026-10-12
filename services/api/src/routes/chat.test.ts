import type { ChatResponse, IndexInput } from '@repo/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { invalidateSpendCache } from '../ai/ledger';
import { createApp } from '../app';
import type { Bindings } from '../env';
import { CHAT_CONFIG } from '../rag/chatConfig';
import { CHAT_NOTICES } from '../rag/chat';
import { buildEmbeddingText, upsert } from '../rag/index';
import { createTestD1, type TestD1 } from '../test-support/d1';
import { fakeKv } from '../test-support/kv';
import {
  buildEnv,
  createTestKeys,
  signToken,
  USER_UID,
  type TestKeys,
} from '../test-support/tokens';

let keys: TestKeys;
let testDb: TestD1;
let kv: KVNamespace;
let env: Bindings;

const GT = 'gt-guatemala';
const OFF_CORPUS = '¿Quién ganó el campeonato mundial de críquet?';

// With AI_MODE=mock an embedding is a hash of the text: a question equal to a news item's
// embedding text scores 1 and any other text scores near 0. That makes τ checks deterministic.
function news(id: string, overrides: Partial<IndexInput> = {}): IndexInput {
  return {
    id,
    title: `Titular ${id}`,
    lead: `Entradilla de ${id}.`,
    body: `Cuerpo de ${id}.`,
    topics: ['politica'],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: [] },
    importance: 2,
    certainty: 'confirmada',
    sources: [
      { name: 'Prensa Libre', url: 'https://example.org/1' },
      { name: 'Prensa Libre', url: 'https://example.org/2' },
      { name: 'AGN', url: 'https://example.org/3' },
    ],
    publishedAt: '2026-10-10T12:00:00.000Z',
    ...overrides,
  };
}

const exactQuestion = (input: IndexInput) => buildEmbeddingText(input);

async function chat(body: unknown, token?: string | null) {
  const app = createApp(() => async () => keys.verificationKey);
  const bearer = token === undefined ? await signToken(keys, { uid: USER_UID }) : token;
  return app.request(
    '/chat',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
    },
    env,
  );
}

async function ask(message: string, locationId = GT) {
  const response = await chat({ message, locationId });
  expect(response.status).toBe(200);
  return (await response.json()) as ChatResponse;
}

function ledger() {
  return testDb.sqlite
    .prepare('SELECT task, outcome, cost_usd, input_tokens, output_tokens, cached FROM ai_calls')
    .all() as {
    task: string;
    outcome: string;
    cost_usd: number;
    input_tokens: number;
    output_tokens: number;
    cached: number;
  }[];
}

beforeAll(async () => {
  keys = await createTestKeys();
});

beforeEach(async () => {
  testDb = createTestD1();
  kv = fakeKv();
  env = buildEnv({ DB: testDb.d1, KV: kv });
  invalidateSpendCache();
  await upsert(env, [
    news('a'),
    news('dev', { certainty: 'en_desarrollo' }),
    news('r', { certainty: 'retractada' }),
    news('gt-ar', { title: 'Argentina y Guatemala firman un acuerdo' }),
    news('ar', {
      title: 'Argentina mantiene su tasa',
      geo: { scope: 'nacional', countries: ['AR'], cityIds: [], regions: [] },
    }),
  ]);
  testDb.sqlite.exec('DELETE FROM ai_calls');
});

describe('POST /chat — validation', () => {
  it('requires a Firebase token', async () => {
    expect((await chat({ message: 'Hola', locationId: GT }, null)).status).toBe(401);
  });

  it('rejects long messages, long histories and unknown locations', async () => {
    const turn = { role: 'user', content: 'Hola' };
    expect((await chat({ message: 'a'.repeat(501), locationId: GT })).status).toBe(422);
    expect(
      (await chat({ message: 'Hola', locationId: GT, history: Array(7).fill(turn) })).status,
    ).toBe(422);
    expect((await chat({ message: 'Hola', locationId: 'xx-nowhere' })).status).toBe(422);
  });

  it('returns 429 after 20 messages in the hour', async () => {
    for (let count = 0; count < 20; count += 1) await ask(OFF_CORPUS);
    expect((await chat({ message: OFF_CORPUS, locationId: GT })).status).toBe(429);
  });
});

describe('POST /chat — abstention and cache', () => {
  it('abstains on an off-corpus question without any LLM row in the ledger (F4-01 CA2)', async () => {
    const body = await ask(OFF_CORPUS);

    expect(body).toMatchObject({
      mode: 'abstain',
      blocks: [],
      sources: [],
      notice: CHAT_NOTICES.abstain,
      generatedBy: null,
      cached: false,
    });
    expect(body.debug?.threshold).toBe(CHAT_CONFIG.abstainThreshold);
    expect(Math.max(...(body.debug?.topScores ?? [0]))).toBeLessThan(CHAT_CONFIG.abstainThreshold);

    const rows = ledger();
    const llmRows = rows.filter(
      (row) => row.task === 'chat_answer' && (row.outcome !== 'abstained' || row.cost_usd > 0),
    );
    expect(llmRows).toEqual([]);
    expect(rows.filter((row) => row.task === 'chat_answer')).toEqual([
      expect.objectContaining({
        outcome: 'abstained',
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
      }),
    ]);
  });

  it('serves an identical second question from the cache (F4-01 CA3)', async () => {
    const first = await ask(OFF_CORPUS);
    const rowsAfterFirst = ledger().length;
    const second = await ask(OFF_CORPUS);

    expect(first.cached).toBe(false);
    expect(second).toMatchObject({ mode: 'abstain', cached: true, costUsd: 0 });
    expect(ledger()).toHaveLength(rowsAfterFirst);
  });

  it('treats the same question with different case and accents as identical', async () => {
    await ask('¿Qué pasó con el críquet?');
    expect((await ask('que paso con el CRIQUET')).cached).toBe(true);
  });

  it('does not share the cache across locations or index versions', async () => {
    await ask(OFF_CORPUS);
    expect((await ask(OFF_CORPUS, 'mx-cdmx')).cached).toBe(false);

    await upsert(env, [news('b')]);
    expect((await ask(OFF_CORPUS)).cached).toBe(false);
  });
});

describe('POST /chat — retrieval only', () => {
  beforeEach(async () => {
    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: false, imageGenEnabled: false, chatMode: 'retrieval_only' }),
    );
  });

  it('returns the leads of the news found, with inherited certainty and no model', async () => {
    const body = await ask(exactQuestion(news('a')));

    expect(body).toMatchObject({
      mode: 'retrieval_only',
      generatedBy: null,
      cached: false,
      notice: CHAT_NOTICES.retrievalOnly,
      blocks: [{ text: 'Entradilla de a.', newsIds: ['a'], certainty: 'confirmada' }],
      sources: [
        {
          newsId: 'a',
          title: 'Titular a',
          certainty: 'confirmada',
          publishedAt: '2026-10-10T12:00:00.000Z',
          outlets: ['Prensa Libre', 'AGN'],
        },
      ],
    });
    expect(body.debug).toMatchObject({ intent: 'tema', threshold: CHAT_CONFIG.abstainThreshold });
    expect(body.debug?.topScores[0]).toBe(1);
    expect(ledger().filter((row) => row.task === 'chat_answer')).toEqual([]);
  });

  it('warns when a news found is still developing', async () => {
    const body = await ask(exactQuestion(news('dev', { certainty: 'en_desarrollo' })));
    expect(body.blocks[0]?.certainty).toBe('en_desarrollo');
    expect(body.notice).toContain(CHAT_NOTICES.uncertain);
  });

  it('never returns a retracted news, even for its exact text', async () => {
    const body = await ask(exactQuestion(news('r', { certainty: 'retractada' })));
    expect(body.mode).toBe('abstain');
  });

  it('filters otro_pais by the countries named in the question', async () => {
    const question = exactQuestion(
      news('gt-ar', { title: 'Argentina y Guatemala firman un acuerdo' }),
    );
    const body = await ask(question);

    // The exact match is a GT news, but the reader in Guatemala asked about Argentina.
    expect(body.debug?.intent).toBe('otro_pais');
    expect(body.mode).toBe('abstain');

    // From Buenos Aires the other country is Guatemala, so the same news qualifies.
    const fromArgentina = await ask(question, 'ar-buenos-aires');
    expect(fromArgentina.mode).toBe('retrieval_only');
    expect(fromArgentina.blocks.map((block) => block.newsIds)).toEqual([['gt-ar']]);
  });

  it('keeps at most top-k results', async () => {
    const body = await ask(exactQuestion(news('a')));
    expect(body.debug?.topScores.length).toBeLessThanOrEqual(CHAT_CONFIG.topK);
  });

  it('omits debug outside dev', async () => {
    env = { ...env, ENV: 'demo' };
    expect((await ask(exactQuestion(news('a')))).debug).toBeUndefined();
  });
});

describe('POST /chat — flags and budget', () => {
  it('answers blocked under the kill switch without embedding the question', async () => {
    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: true, imageGenEnabled: false, chatMode: 'full' }),
    );
    const body = await ask(exactQuestion(news('a')));

    expect(body).toMatchObject({
      mode: 'blocked',
      notice: CHAT_NOTICES.blocked,
      generatedBy: null,
    });
    expect(ledger()).toEqual([]);
  });

  it('answers blocked when the dev budget no longer allows embeddings', async () => {
    testDb.sqlite.exec(
      `INSERT INTO ai_calls (id, ts, task, provider, model, cost_usd, cached, outcome, env)
       VALUES ('spent', '2026-10-01T00:00:00.000Z', 'enrich', 'anthropic', 'm', 13, 0, 'ok', 'dev')`,
    );
    invalidateSpendCache();

    expect((await ask(exactQuestion(news('a')))).mode).toBe('blocked');
  });

  it('keeps retrieval_only when the flag asks for it', async () => {
    await kv.put(
      'flags',
      JSON.stringify({ killSwitch: false, imageGenEnabled: false, chatMode: 'retrieval_only' }),
    );
    const body = await ask(exactQuestion(news('a')));
    expect(body).toMatchObject({ mode: 'retrieval_only', generatedBy: null });
  });
});
