import {
  budgetSnapshotRequestSchema,
  enrichRequestSchema,
  flagsPatchSchema,
  imageGenerateRequestSchema,
  imageSearchRequestSchema,
  indexRebuildRequestSchema,
  indexRemoveRequestSchema,
  indexSearchRequestSchema,
  indexUpsertRequestSchema,
  wrapImagePrompt,
  type AiSelftestResponse,
  type BudgetSnapshot,
  type ImageSearchResponse,
  type IndexRemoveResponse,
  type IndexSearchResponse,
  type IndexUpsertResponse,
} from '@repo/shared';
import { Hono } from 'hono';
import { gateway } from '../ai/gateway';
import { loadCosts } from '../costs';
import { enrichNews } from '../enrich/enrich';
import type { AppEnv } from '../env';
import { providerError } from '../errors';
import { parseJsonBody } from '../http';
import { ImageSearchFailed, searchFreeImages } from '../images/search';
import { readFlags, readIndexVersion, writeFlags } from '../kv';
import { rebuild, remove, upsert } from '../rag/index';
import { searchIndex } from '../rag/search';

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
  })
  .post('/enrich', async (c) => {
    const request = await parseJsonBody(c, enrichRequestSchema);
    return c.json(await enrichNews(c.env, c.var.uid, request));
  })

  .post('/image/search', async (c) => {
    const { query } = await parseJsonBody(c, imageSearchRequestSchema);

    try {
      const body: ImageSearchResponse = { results: await searchFreeImages(query) };
      return c.json(body);
    } catch (error) {
      if (error instanceof ImageSearchFailed) throw providerError(error.message);
      throw error;
    }
  })

  .post('/image/generate', async (c) => {
    const { prompt } = await parseJsonBody(c, imageGenerateRequestSchema);

    // The gateway is the only door: it enforces the flag, the kill switch and the budget levels.
    await gateway.run(
      'image_generate',
      { kind: 'text', prompt: wrapImagePrompt(prompt), maxTokens: 1 },
      { env: c.env, uid: c.var.uid },
    );
    throw providerError('Image generation is not implemented');
  })

  .post('/index/upsert', async (c) => {
    const { news } = await parseJsonBody(c, indexUpsertRequestSchema);
    const result = await upsert(c.env, news);
    const body: IndexUpsertResponse = { ...result, upserted: news.length };
    return c.json(body);
  })

  .post('/index/remove', async (c) => {
    const { ids } = await parseJsonBody(c, indexRemoveRequestSchema);
    const body: IndexRemoveResponse = await remove(c.env, ids);
    return c.json(body);
  })

  .post('/index/rebuild', async (c) => {
    const { news } = await parseJsonBody(c, indexRebuildRequestSchema);
    const result = await rebuild(c.env, news);
    const body: IndexUpsertResponse = { ...result, upserted: news.length };
    return c.json(body);
  })

  .post('/index/search', async (c) => {
    const { query, countries, topK } = await parseJsonBody(c, indexSearchRequestSchema);
    const scored = await searchIndex(c.env, query, { countries, topK });
    const body: IndexSearchResponse = {
      indexVersion: await readIndexVersion(c.env.KV),
      hits: scored.map(({ entry, score }) => ({
        id: entry.id,
        title: entry.title,
        certainty: entry.certainty,
        score: Math.round(score * 10000) / 10000,
      })),
    };
    return c.json(body);
  });
