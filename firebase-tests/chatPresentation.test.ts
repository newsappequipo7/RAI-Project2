import { describe, expect, it } from 'vitest';
import {
  blockCertaintyLabel,
  buildSuggestions,
  chatTopic,
  generationTrace,
  greeting,
  provenanceFooter,
  toHistory,
  type ChatEntry,
} from '../apps/mobile/src/chat/presentation';
import { ChatApiError, sendChat } from '../apps/mobile/src/services/chatApi';
import corpus from '../packages/shared/fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { ChatResponse, News } from '../packages/shared/src/types';

const now = new Date('2026-10-09T12:00:00.000Z');
const news = buildSeedNews(corpus as SeedNews[], now);

const answer: ChatResponse = {
  mode: 'answer',
  blocks: [
    { text: 'Un sismo sacudió la costa sur.', newsIds: ['n-a'], certainty: 'confirmada' },
    { text: 'Dos versiones del incidente.', newsIds: ['n-a', 'n-b'], certainty: 'mixta' },
  ],
  sources: [
    {
      newsId: 'n-a',
      title: 'Sismo',
      certainty: 'confirmada',
      publishedAt: now.toISOString(),
      outlets: ['AGN'],
    },
    {
      newsId: 'n-b',
      title: 'Incidente',
      certainty: 'disputada',
      publishedAt: now.toISOString(),
      outlets: [],
    },
  ],
  notice: 'Hay información en desarrollo o disputada: revisa la certeza de cada noticia.',
  generatedBy: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  cached: false,
  costUsd: 0.0031,
};

describe('F4-04 chat presentation', () => {
  it('offers the four cases of the brief, with a country and topic that have news', () => {
    const suggestions = buildSuggestions(news, 'gt-guatemala');

    expect(suggestions).toHaveLength(4);
    expect(suggestions[0]).toBe('Resume lo más importante de hoy');
    expect(suggestions[1]).toBe('¿Qué pasa en mi zona?');
    expect(suggestions[2]).toMatch(/^Explícame lo más importante de (?!Guatemala)/);
    expect(suggestions[3]).toMatch(/^¿Qué hay de nuevo sobre .+\?$/);
  });

  it('falls back to fixed suggestions without news', () => {
    expect(buildSuggestions([], 'mx-cdmx').slice(2)).toEqual([
      'Explícame lo más importante de España',
      '¿Qué hay de nuevo sobre economía?',
    ]);
  });

  it('greets with the simulated location', () => {
    expect(greeting('es-madrid')).toContain('Madrid, España');
  });

  it('sends at most six text turns as history', () => {
    const entries: ChatEntry[] = Array.from({ length: 5 }, (_, index) => [
      { id: `u${index}`, role: 'user' as const, text: `Pregunta ${index}` },
      {
        id: `a${index}`,
        role: 'assistant' as const,
        question: `Pregunta ${index}`,
        response: answer,
      },
    ]).flat();
    const history = toHistory(entries);

    expect(history).toHaveLength(6);
    expect(history.at(-1)).toEqual({
      role: 'assistant',
      content: 'Un sismo sacudió la costa sur.\nDos versiones del incidente.',
    });
  });

  it('labels inherited certainty, showing the least certain news of a mixed block', () => {
    expect(blockCertaintyLabel(answer.blocks[0]!, answer)).toBe('Confirmada');
    expect(blockCertaintyLabel(answer.blocks[1]!, answer)).toBe(
      'Certeza mixta · incluye en disputa',
    );
  });

  it('labels every answer with its origin (CA2)', () => {
    expect(provenanceFooter(answer)).toBe(
      'Respuesta generada con IA a partir de 2 noticias publicadas · claude-haiku-4-5-20251001',
    );
    expect(provenanceFooter({ ...answer, mode: 'digest' })).toMatch(/^Resumen generado con IA/);
    expect(provenanceFooter({ ...answer, mode: 'retrieval_only', generatedBy: null })).toBe(
      'Sin IA: resultado de búsqueda (2 noticias publicadas)',
    );
    expect(
      provenanceFooter({ ...answer, mode: 'abstain', blocks: [], sources: [], generatedBy: null }),
    ).toBe('Sin IA: no se encontraron noticias publicadas que respondan esto');
  });

  it('explains how an answer was made even without debug (demo env)', () => {
    const trace = generationTrace(
      answer,
      'Explícame lo más importante de Argentina',
      'gt-guatemala',
    );
    expect(trace).toEqual({
      intent: 'Noticias de otro país',
      news: ['Sismo', 'Incidente'],
      origin: 'Generada ahora con claude-haiku-4-5-20251001',
      cost: '≈ USD 0.0031',
    });
    expect(
      generationTrace(
        { ...answer, mode: 'digest', cached: true, costUsd: 0 },
        'Resume',
        'gt-guatemala',
      ),
    ).toMatchObject({
      origin: 'Resumen del día de tu ubicación, ya generado (caché)',
      cost: 'USD 0',
    });
  });

  it('derives the chat topic from the cited news only for model answers', () => {
    const byId = new Map<string, News>([
      ['n-a', { ...news[0]!, id: 'n-a', topics: ['salud'] }],
      ['n-b', { ...news[1]!, id: 'n-b', topics: ['salud', 'politica'] }],
    ]);
    expect(chatTopic(answer, byId)).toBe('salud');
    expect(chatTopic({ ...answer, mode: 'retrieval_only' }, byId)).toBeUndefined();
  });
});

describe('F4-04 chat API client', () => {
  const ok = (body: unknown, status = 200) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const request = { message: 'Hola', locationId: 'gt-guatemala' };

  it('sends the token and validates the response against the contract', async () => {
    let seen: RequestInit | undefined;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify(answer));
    }) as unknown as typeof fetch;

    expect(await sendChat(request, 'token-1', fetchImpl)).toEqual(answer);
    expect((seen?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it.each([
    [429, 'rate_limited'],
    [401, 'unauthorized'],
    [502, 'server'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    await expect(sendChat(request, 't', ok({ error: {} }, status))).rejects.toMatchObject({ kind });
  });

  it('reports network errors and responses outside the contract', async () => {
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(sendChat(request, 't', offline)).rejects.toEqual(new ChatApiError('network'));
    await expect(sendChat(request, 't', ok({ mode: 'answer', blocks: 'x' }))).rejects.toMatchObject(
      {
        kind: 'server',
      },
    );
  });
});
