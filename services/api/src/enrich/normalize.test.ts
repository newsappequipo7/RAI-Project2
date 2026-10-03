import { enrichSuggestionSchema } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { normalizeSuggestion, parseModelJson, type ModelOutput } from './normalize';

const META = {
  model: 'claude-haiku-4-5-20251001',
  costUsd: 0.004,
  createdAt: '2026-10-03T00:00:00.000Z',
};

function output(patch: Partial<ModelOutput> = {}): ModelOutput {
  return {
    topics: [{ key: 'salud', confidence: 0.9 }],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
    importance: { value: 2, rationale: 'Afecta a muchas personas.' },
    claims: [{ text: 'Hay 12 casos.', needsSource: true }],
    summary: 'Primera oración. Segunda oración.',
    sensationalismFlag: { flagged: false },
    ...patch,
  };
}

const run = (patch?: Partial<ModelOutput>) => normalizeSuggestion(output(patch), META);

describe('parseModelJson', () => {
  const json = JSON.stringify(output());

  it('reads plain JSON, a code fence and JSON surrounded by prose', () => {
    expect(parseModelJson(json).importance.value).toBe(2);
    expect(parseModelJson('```json\n' + json + '\n```').topics).toHaveLength(1);
    expect(parseModelJson(`Aquí está: ${json} Espero que ayude.`).summary).toContain('Primera');
  });

  it('rejects text without JSON, broken JSON and the wrong shape with provider_error', () => {
    for (const text of ['no hay json', '{"topics": [', '{"hola": 1}']) {
      expect(() => parseModelJson(text), text).toThrow(/model/i);
    }
  });

  it('ignores extra keys and fills defaults', () => {
    const parsed = parseModelJson(
      JSON.stringify({ geo: { scope: 'global' }, importance: { value: '1' }, extra: true }),
    );
    expect(parsed.importance.value).toBe(1);
    expect(parsed.claims).toEqual([]);
    expect(parsed.geo.countries).toEqual([]);
  });
});

describe('normalizeSuggestion', () => {
  it('produces something the News schema accepts, with the real model, cost and date (CA1)', () => {
    const suggestion = run();
    expect(enrichSuggestionSchema.safeParse(suggestion).success).toBe(true);
    expect(suggestion).toMatchObject({
      model: META.model,
      costUsd: 0.004,
      createdAt: META.createdAt,
    });
  });

  it('drops topics outside the catalog, de-duplicates, sorts by confidence and keeps at most 3', () => {
    const suggestion = run({
      topics: [
        { key: 'astrologia', confidence: 1 },
        { key: 'salud', confidence: 0.4 },
        { key: 'salud', confidence: 0.9 },
        { key: 'economia', confidence: 0.7 },
        { key: 'cultura', confidence: 0.5 },
        { key: 'deportes', confidence: 0.1 },
      ],
    });
    expect(suggestion.topics.map((topic) => topic.key)).toEqual(['salud', 'economia', 'cultura']);
  });

  it('clamps confidence into [0, 1]', () => {
    const suggestion = run({
      topics: [
        { key: 'salud', confidence: 7 },
        { key: 'economia', confidence: -2 },
      ],
    });
    expect(suggestion.topics.map((topic) => topic.confidence)).toEqual([1, 0]);
  });

  it('normalizes countries to catalog ISO codes, and drops unknown regions and cities', () => {
    const suggestion = run({
      geo: {
        scope: 'Regional',
        countries: [' gt', 'SV', 'ZZ', 'gt'],
        regions: ['centroamerica', 'atlantida'],
        cityIds: ['gt-guatemala'],
      },
    });
    expect(suggestion.geo).toEqual({
      scope: 'regional',
      countries: ['GT', 'SV'],
      regions: ['centroamerica'],
      cityIds: [], // cities only belong to the local scope
    });
  });

  it('keeps cities for a local scope, and downgrades it when no known city remains', () => {
    const local = run({
      geo: { scope: 'local', countries: ['GT'], regions: [], cityIds: ['gt-quetzaltenango', 'xx'] },
    });
    expect(local.geo).toMatchObject({ scope: 'local', cityIds: ['gt-quetzaltenango'] });

    const noCity = run({
      geo: { scope: 'local', countries: ['GT'], regions: [], cityIds: ['xx'] },
    });
    expect(noCity.geo.scope).toBe('nacional');
  });

  it('clears all geography for a global scope and falls back from an unknown scope', () => {
    const global = run({
      geo: { scope: 'global', countries: ['GT'], regions: ['europa'], cityIds: [] },
    });
    expect(global.geo).toEqual({ scope: 'global', countries: [], regions: [], cityIds: [] });
    expect(
      run({ geo: { scope: 'galáctico', countries: [], regions: [], cityIds: [] } }).geo.scope,
    ).toBe('nacional');
  });

  it('rounds and clamps importance into 0–3', () => {
    expect(run({ importance: { value: 7, rationale: ' r ' } }).importance).toEqual({
      value: 3,
      rationale: 'r',
    });
    expect(run({ importance: { value: -1, rationale: '' } }).importance.value).toBe(0);
    expect(run({ importance: { value: 1.6, rationale: '' } }).importance.value).toBe(2);
  });

  it('keeps at most 8 distinct, non-empty claims', () => {
    const claims = [
      ...Array.from({ length: 12 }, (_, index) => ({
        text: `Afirmación ${index}`,
        needsSource: true,
      })),
      { text: 'afirmación 0', needsSource: false },
      { text: '   ', needsSource: true },
    ];
    const suggestion = run({ claims });
    expect(suggestion.claims).toHaveLength(8);
    expect(new Set(suggestion.claims.map((claim) => claim.text.toLowerCase())).size).toBe(8);
  });

  it('limits the summary to two sentences', () => {
    expect(run({ summary: 'Uno. Dos. Tres. Cuatro.' }).summary).toBe('Uno. Dos.');
    expect(run({ summary: '  Solo una oración  ' }).summary).toBe('Solo una oración');
  });

  it('keeps the sensationalism reason only when flagged, and shortened', () => {
    expect(
      run({ sensationalismFlag: { flagged: false, reason: 'ignorada' } }).sensationalismFlag,
    ).toEqual({
      flagged: false,
    });
    const flagged = run({ sensationalismFlag: { flagged: true, reason: 'x'.repeat(500) } });
    expect(flagged.sensationalismFlag.flagged).toBe(true);
    expect(flagged.sensationalismFlag.reason).toHaveLength(240);
    expect(run({ sensationalismFlag: { flagged: true } }).sensationalismFlag).toEqual({
      flagged: true,
    });
  });
});
