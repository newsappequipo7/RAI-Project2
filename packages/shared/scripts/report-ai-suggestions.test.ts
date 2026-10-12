import { describe, expect, it } from 'vitest';
import { createEmptyDraft } from '../src/editorial/draft';
import type { News } from '../src/types';
import { fromFirestoreFields, toFirestoreFields } from './firestore-rest';
import { renderMarkdown } from './report-ai-suggestions';

describe('Firestore REST values', () => {
  it('round-trips nested records', () => {
    const record = {
      title: 'Hola',
      importance: 2,
      score: 0.5,
      ok: true,
      none: null,
      topics: ['salud', 'politica'],
      geo: { scope: 'nacional', countries: ['GT'], cityIds: [] },
    };
    expect(fromFirestoreFields(toFirestoreFields(record))).toEqual(record);
  });
});

describe('renderMarkdown (F4-11)', () => {
  it('summarizes per field and escapes table separators', () => {
    const news: News = {
      ...createEmptyDraft('n-1', 'u', new Date('2026-10-11T00:00:00Z')),
      title: 'Uno | dos',
      workflow: 'publicada',
      importance: 3,
      topics: ['salud'],
      aiSuggestions: {
        topics: [{ key: 'salud', confidence: 0.9 }],
        geo: { scope: 'local', countries: [], cityIds: [], regions: [] },
        importance: { value: 1, rationale: 'x' },
        claims: [],
        summary: 'Resumen',
        sensationalismFlag: { flagged: false },
        model: 'm',
        costUsd: 0,
        createdAt: '2026-10-11T00:00:00Z',
      },
    };
    const markdown = renderMarkdown([news], 'emulator', new Date('2026-10-11T00:00:00Z'));

    expect(markdown).toContain('| Importancia | 1 | 1 | 100 % |');
    expect(markdown).toContain('| Temas | 1 | 0 | 0 % |');
    expect(markdown).toContain('Uno \\| dos (`n-1`)');
  });
});
