import { describe, expect, it } from 'vitest';
import { newsSchema } from '../schemas';
import { createEmptyDraft } from './draft';

const NOW = new Date('2026-10-02T15:00:00.000Z');

describe('createEmptyDraft', () => {
  it('produces a draft that satisfies newsSchema', () => {
    const draft = createEmptyDraft('abc', 'uid-1', NOW);
    expect(newsSchema.safeParse(draft).success).toBe(true);
  });

  it('starts as an unpublished draft owned by its creator', () => {
    const draft = createEmptyDraft('abc', 'uid-1', NOW);
    expect(draft).toMatchObject({
      id: 'abc',
      workflow: 'borrador',
      createdBy: 'uid-1',
      version: 0,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(draft.publishedAt).toBeUndefined();
    expect(draft.publishedBy).toBeUndefined();
  });

  it('starts with every checklist item unchecked', () => {
    const draft = createEmptyDraft('abc', 'uid-1', NOW);
    expect(Object.values(draft.checklist).every((checked) => checked === false)).toBe(true);
  });
});
