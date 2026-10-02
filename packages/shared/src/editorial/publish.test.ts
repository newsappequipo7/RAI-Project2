import { describe, expect, it } from 'vitest';
import { newsSchema } from '../schemas';
import { createEmptyDraft } from './draft';
import { buildPublication } from './publish';

const NOW = new Date('2026-10-03T10:00:00.000Z');
const draft = createEmptyDraft('n1', 'author', new Date('2026-10-02T00:00:00.000Z'));

describe('buildPublication', () => {
  it('publishes a draft as version 1 and marks the index as pending', () => {
    const { patch, snapshot } = buildPublication(draft, 'editor', NOW);

    expect(patch).toEqual({
      workflow: 'publicada',
      publishedAt: NOW.toISOString(),
      publishedBy: 'editor',
      version: 1,
      updatedAt: NOW.toISOString(),
      indexPending: true,
    });
    expect(snapshot).toEqual({ ...draft, ...patch });
    expect(newsSchema.safeParse(snapshot).success).toBe(true);
  });

  it('increments the version and keeps the first publication date', () => {
    const published = {
      ...draft,
      workflow: 'publicada' as const,
      version: 2,
      publishedAt: '2026-10-02T12:00:00.000Z',
    };
    const { patch } = buildPublication(published, 'editor', NOW);

    expect(patch.version).toBe(3);
    expect(patch.publishedAt).toBe('2026-10-02T12:00:00.000Z');
  });

  it('does not mutate its input', () => {
    buildPublication(draft, 'editor', NOW);
    expect(draft.workflow).toBe('borrador');
    expect(draft.version).toBe(0);
  });
});
