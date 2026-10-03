import { describe, expect, it } from 'vitest';
import type { EnrichSuggestion, News } from '../types';
import { createEmptyDraft } from './draft';
import { compareSuggestions } from './suggestions';

const suggestion: EnrichSuggestion = {
  topics: [
    { key: 'economia', confidence: 0.6 },
    { key: 'politica', confidence: 0.9 },
  ],
  geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
  importance: { value: 2, rationale: 'Afecta a mucha gente.' },
  claims: [
    { text: 'El precio subió 5%.', needsSource: true },
    { text: 'Hay un decreto nuevo.', needsSource: true },
  ],
  summary: 'Sube el precio.',
  sensationalismFlag: { flagged: false },
  model: 'm',
  costUsd: 0.004,
  createdAt: '2026-10-03T00:00:00.000Z',
};

const base: News = {
  ...createEmptyDraft('n1', 'u', new Date('2026-10-03T00:00:00Z')),
  aiSuggestions: suggestion,
};
const by = (news: News) =>
  Object.fromEntries(compareSuggestions(news).map((row) => [row.field, row]));

describe('compareSuggestions', () => {
  it('returns nothing when the model was never asked', () => {
    expect(compareSuggestions({ ...base, aiSuggestions: undefined })).toEqual([]);
  });

  it('shows where the editor kept the suggestion and where they changed it', () => {
    const news: News = {
      ...base,
      topics: ['politica'],
      geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
      importance: 3,
      claims: [
        {
          id: 'c1',
          text: ' el precio subió 5%. ',
          sourceIds: [],
          status: 'sin_respaldo',
          suggestedByAi: true,
        },
      ],
      aiSummary: { text: 'Sube el precio.', approvedBy: 'u', approvedAt: '2026-10-03T00:00:00Z' },
    };
    const rows = by(news);

    expect(rows.topics).toMatchObject({
      suggested: 'politica, economia',
      published: 'politica',
      matches: false,
    });
    expect(rows.geo?.matches).toBe(true);
    expect(rows.importance).toMatchObject({ suggested: '2', published: '3', matches: false });
    expect(rows.claims).toMatchObject({
      suggested: '2 sugeridas',
      published: '1 incluidas',
      matches: false,
    });
    expect(rows.summary?.matches).toBe(true);
  });

  it('flags everything as not adopted when nothing was applied', () => {
    const rows = by(base);
    expect(Object.values(rows).every((row) => !row.matches)).toBe(true);
    expect(rows.summary?.published).toBe('No se aprobó ningún resumen');
    expect(rows.topics?.published).toBe('—');
  });

  it('matches topics regardless of order', () => {
    const news = { ...base, topics: ['economia', 'politica'] };
    expect(by(news).topics?.matches).toBe(true);
  });
});
