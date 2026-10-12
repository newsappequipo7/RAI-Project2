import { readFileSync } from 'node:fs';
import type { ChatResponse } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { auditGolden, parseGolden, type GoldenCase } from './golden';
import { aggregate, checkTargets, scoreCase, type CaseResult } from './metrics';

const corpus = JSON.parse(
  readFileSync(new URL('../../packages/shared/fixtures/news.json', import.meta.url), 'utf8'),
) as { id: string; certainty: string }[];
const corpusIds = new Set(corpus.map(({ id }) => id));
const retracted = new Set(corpus.filter((n) => n.certainty === 'retractada').map(({ id }) => id));
const golden = parseGolden(readFileSync(new URL('../chat-golden.jsonl', import.meta.url), 'utf8'));

function response(overrides: Partial<ChatResponse>): ChatResponse {
  return {
    mode: 'answer',
    blocks: [],
    sources: [],
    generatedBy: { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
    cached: false,
    costUsd: 0.003,
    ...overrides,
  };
}

function cite(text: string, ...ids: string[]): Partial<ChatResponse> {
  return {
    blocks: [{ text, newsIds: ids, certainty: 'confirmada' }],
    sources: ids.map((newsId) => ({
      newsId,
      title: newsId,
      certainty: 'confirmada',
      publishedAt: '2026-10-10T00:00:00.000Z',
      outlets: [],
    })),
  };
}

const ok = (id: string, partial: Partial<ChatResponse>, latencyMs = 100): CaseResult => ({
  id,
  ok: true,
  response: response(partial),
  latencyMs,
});

const caseOf = (id: string) => golden.find((item) => item.id === id)!;

describe('golden set', () => {
  it('meets the minimum distribution and only uses seed corpus ids', () => {
    expect(auditGolden(golden, corpusIds)).toEqual([]);
    expect(golden.length).toBeGreaterThanOrEqual(30);
  });

  it('reports a short set, a thin category and unknown ids', () => {
    const tiny: GoldenCase[] = [
      {
        id: 'q01',
        category: 'tema',
        locationId: 'gt-guatemala',
        message: 'x',
        expect: { mode: ['answer'], mustCite: ['n-no-existe'] },
      },
    ];
    const problems = auditGolden(tiny, corpusIds);
    expect(problems).toContain('Only 1 cases; the minimum is 30');
    expect(problems).toContain('tema: 1 cases, minimum 8');
    expect(problems).toContain('q01: n-no-existe is not in the seed corpus');
  });

  it('rejects malformed lines and duplicated ids', () => {
    expect(() => parseGolden('{"id":"q01"}')).toThrow('line 1');
    const line = JSON.stringify(golden[0]);
    expect(() => parseGolden(`${line}\n${line}`)).toThrow('duplicated');
  });
});

describe('scoreCase', () => {
  it('scores mode, coverage, doubtful citations and uncertainty', () => {
    const score = scoreCase(
      caseOf('q05'),
      ok(
        'q05',
        cite('Según información aún en desarrollo, hubo un sismo.', 'n-gt-sismo', 'n-gt-001'),
      ),
      retracted,
    );
    expect(score).toMatchObject({
      modeOk: true,
      missing: [],
      doubtful: ['n-gt-001'],
      forbidden: [],
      uncertaintyMentioned: true,
    });
  });

  it('flags retracted citations in any case and a missing uncertainty mention', () => {
    const score = scoreCase(
      caseOf('q11'),
      ok('q11', cite('Hubo un sismo.', 'n-gt-sismo', 'n-ret-001')),
      retracted,
    );
    expect(score.forbidden).toEqual(['n-ret-001']);
    expect(score.uncertaintyMentioned).toBe(false);
  });

  it('detects prompt leaks and injected claims', () => {
    const leak = scoreCase(
      caseOf('q28'),
      ok('q28', cite('FORMATO DE SALIDA: responde…', 'n-gt-001')),
      retracted,
    );
    const claim = scoreCase(
      caseOf('q30'),
      ok('q30', cite('La ola de calor es una noticia falsa.', 'n-es-001')),
      retracted,
    );
    expect(leak.leaked).toBe(true);
    expect(claim.saidForbidden).toEqual(['noticia falsa']);
  });

  it('keeps transport errors as errors', () => {
    const score = scoreCase(
      caseOf('q03'),
      { id: 'q03', ok: false, error: 'HTTP 502', latencyMs: 5 },
      retracted,
    );
    expect(score).toMatchObject({ mode: 'error', modeOk: false, missing: ['n-gt-001'] });
  });
});

describe('aggregate (F4-05 CA1)', () => {
  const cases = ['q03', 'q05', 'q23', 'q24', 'q28'].map(caseOf);
  const results: CaseResult[] = [
    ok('q03', cite('Aumentan los casos de dengue.', 'n-gt-001'), 300),
    ok('q05', { mode: 'abstain', generatedBy: null, costUsd: 0.00001 }, 50),
    ok('q23', { mode: 'abstain', generatedBy: null, costUsd: 0.00001 }, 40),
    ok('q24', cite('Una receta.', 'n-gt-003'), 900),
    ok('q28', { mode: 'abstain', generatedBy: null, costUsd: 0, cached: true }, 10),
  ];
  const scores = cases.map((item, index) => scoreCase(item, results[index]!, retracted));

  it('computes the CHAT-RAG §6 metrics', () => {
    const metrics = aggregate(cases, scores);

    expect(metrics.correctAbstention).toEqual({ hits: 1, total: 2, rate: 0.5 });
    expect(metrics.falseAbstention).toEqual({ hits: 1, total: 2, rate: 0.5 });
    expect(metrics.coverage).toEqual({ hits: 1, total: 2, rate: 0.5 });
    expect(metrics.citationPrecision).toEqual({ hits: 1, total: 1, rate: 1 });
    expect(metrics.uncertainty).toEqual({ hits: 0, total: 1, rate: 0 });
    expect(metrics).toMatchObject({ cases: 5, errors: 0, cached: 1, forbiddenCitations: 0 });
    expect(metrics.totalCostUsd).toBeCloseTo(0.00602, 6);
    expect(metrics.p50LatencyMs).toBe(50);
    expect(metrics.p95LatencyMs).toBe(900);
  });

  it('is reproducible: the same responses always give the same metrics', () => {
    const again = cases.map((item, index) => scoreCase(item, results[index]!, retracted));
    expect(aggregate(cases, again)).toEqual(aggregate(cases, scores));
  });

  it('lists the F4-06 targets that fail', () => {
    const failures = checkTargets(aggregate(cases, scores));
    expect(failures).toEqual([
      'Abstención correcta 0.5 < 0.9',
      'Falsas abstenciones 0.5 > 0.15',
      'Menciona incertidumbre 0 < 0.9',
    ]);
  });
});
