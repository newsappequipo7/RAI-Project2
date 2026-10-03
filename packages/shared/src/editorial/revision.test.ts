import { describe, expect, it } from 'vitest';
import { newsSchema } from '../schemas';
import type { News } from '../types';
import { createEmptyDraft } from './draft';
import {
  addedCorrections,
  buildRetraction,
  buildRevision,
  changedFields,
  CORRECTION_SUMMARY_MAX,
  correctionSummaryIssue,
  diffVersions,
  EDITABLE_FIELDS,
  pickEditableFields,
  RevisionError,
} from './revision';

const NOW = new Date('2026-10-03T12:00:00.000Z');

const published: News = {
  ...createEmptyDraft('n1', 'author', new Date('2026-10-01T00:00:00.000Z')),
  title: 'Titular',
  lead: 'Entradilla.',
  body: 'Cuerpo.',
  topics: ['salud'],
  certainty: 'confirmada',
  workflow: 'publicada',
  version: 1,
  publishedAt: '2026-10-02T00:00:00.000Z',
  publishedBy: 'publisher',
};

const entry = { kind: 'correccion' as const, summary: ' Se corrigió la cifra. ' };
const codeOf = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    return error instanceof RevisionError ? error.code : 'other';
  }
  return 'none';
};

describe('changedFields', () => {
  it('lists only the editable fields that differ, deeply', () => {
    expect(changedFields(published, { ...published, title: 'Otro' })).toEqual(['title']);
    expect(changedFields(published, { ...published, topics: ['salud'] })).toEqual([]);
    expect(
      changedFields(published, { ...published, geo: { ...published.geo, countries: ['GT'] } }),
    ).toEqual(['geo']);
  });

  it('ignores non-editable fields and treats a missing optional as undefined', () => {
    expect(changedFields(published, { ...published, version: 9, publishedBy: 'x' })).toEqual([]);
    expect(changedFields(published, { ...published, certaintyNote: undefined })).toEqual([]);
    expect(changedFields(published, { ...published, certaintyNote: 'Nota' })).toEqual([
      'certaintyNote',
    ]);
  });

  it('pickEditableFields returns exactly the editable keys', () => {
    expect(Object.keys(pickEditableFields(published)).sort()).toEqual([...EDITABLE_FIELDS].sort());
  });
});

describe('correctionSummaryIssue', () => {
  it('requires a non-blank summary of at most 280 characters', () => {
    expect(correctionSummaryIssue('  ')).toContain('resumen');
    expect(correctionSummaryIssue('x'.repeat(CORRECTION_SUMMARY_MAX + 1))).toContain('280');
    expect(correctionSummaryIssue('x'.repeat(CORRECTION_SUMMARY_MAX))).toBeNull();
  });
});

describe('buildRevision', () => {
  it('saves a new version with the correction appended (CA1)', () => {
    const { patch, snapshot } = buildRevision(
      published,
      { ...published, title: 'Titular corregido' },
      entry,
      'editor',
      NOW,
    );

    expect(patch.version).toBe(2);
    expect(patch.indexPending).toBe(true);
    expect(patch.corrections).toEqual([
      {
        at: NOW.toISOString(),
        kind: 'correccion',
        summary: 'Se corrigió la cifra.',
        editorUid: 'editor',
      },
    ]);
    expect(snapshot).toMatchObject({
      title: 'Titular corregido',
      version: 2,
      publishedAt: published.publishedAt,
      publishedBy: 'publisher',
      workflow: 'publicada',
    });
    expect(newsSchema.safeParse(snapshot).success).toBe(true);
  });

  it('keeps earlier corrections', () => {
    const earlier = { at: 'x', kind: 'actualizacion' as const, summary: 'Antes', editorUid: 'e' };
    const { patch } = buildRevision(
      { ...published, corrections: [earlier] },
      { ...published, corrections: [earlier], lead: 'Nueva entradilla.' },
      entry,
      'editor',
      NOW,
    );
    expect(patch.corrections).toHaveLength(2);
    expect(patch.corrections[0]).toEqual(earlier);
  });

  it('cannot change anything outside the editable fields', () => {
    const { snapshot } = buildRevision(
      published,
      { ...published, title: 'Nuevo', workflow: 'borrador', version: 99, createdBy: 'intruso' },
      entry,
      'editor',
      NOW,
    );
    expect(snapshot).toMatchObject({ workflow: 'publicada', version: 2, createdBy: 'author' });
  });

  it('the stored snapshot never contains undefined; the patch marks removals', () => {
    const withNote = { ...published, certaintyNote: 'Nota' };
    const { patch, snapshot } = buildRevision(
      withNote,
      { ...withNote, certaintyNote: undefined },
      entry,
      'editor',
      NOW,
    );
    expect('certaintyNote' in patch && patch.certaintyNote === undefined).toBe(true);
    expect('certaintyNote' in snapshot).toBe(false);
  });

  it('refuses a missing summary, no changes, drafts, retracted news and retraction by this path', () => {
    const edited = { ...published, title: 'Otro' };
    expect(
      codeOf(() => buildRevision(published, edited, { ...entry, summary: ' ' }, 'e', NOW)),
    ).toBe('summary_invalid');
    expect(codeOf(() => buildRevision(published, { ...published }, entry, 'e', NOW))).toBe(
      'no_changes',
    );
    expect(
      codeOf(() => buildRevision({ ...published, workflow: 'borrador' }, edited, entry, 'e', NOW)),
    ).toBe('not_published');
    expect(
      codeOf(() =>
        buildRevision({ ...published, certainty: 'retractada' }, edited, entry, 'e', NOW),
      ),
    ).toBe('already_retracted');
    expect(
      codeOf(() =>
        buildRevision(published, { ...edited, certainty: 'retractada' }, entry, 'e', NOW),
      ),
    ).toBe('retraction_via_revision');
    expect(
      codeOf(() =>
        buildRevision(published, edited, { kind: 'retractacion' as never, summary: 'x' }, 'e', NOW),
      ),
    ).toBe('retraction_via_revision');
  });
});

describe('buildRetraction', () => {
  it('marks the news retracted, keeps it, and records the retraction entry (CA1)', () => {
    const { patch, snapshot } = buildRetraction(published, ' Datos falsos. ', 'editor', NOW);

    expect(patch).toMatchObject({ certainty: 'retractada', version: 2, indexPending: true });
    expect(patch.corrections.at(-1)).toEqual({
      at: NOW.toISOString(),
      kind: 'retractacion',
      summary: 'Datos falsos.',
      editorUid: 'editor',
    });
    expect(snapshot).toMatchObject({
      workflow: 'publicada',
      title: 'Titular',
      certainty: 'retractada',
    });
    expect(newsSchema.safeParse(snapshot).success).toBe(true);
  });

  it('refuses drafts, already retracted news and a missing summary', () => {
    expect(
      codeOf(() => buildRetraction({ ...published, workflow: 'borrador' }, 'x', 'e', NOW)),
    ).toBe('not_published');
    expect(
      codeOf(() => buildRetraction({ ...published, certainty: 'retractada' }, 'x', 'e', NOW)),
    ).toBe('already_retracted');
    expect(codeOf(() => buildRetraction(published, '', 'e', NOW))).toBe('summary_invalid');
  });
});

describe('diffVersions and addedCorrections', () => {
  const v1 = published;
  const v2 = buildRevision(
    v1,
    { ...v1, title: 'Nuevo', certainty: 'en_desarrollo' },
    entry,
    'e',
    NOW,
  ).snapshot;

  it('reports title, lead and certainty changes between versions', () => {
    expect(diffVersions(v1, v2)).toEqual([
      { field: 'title', label: 'Título', from: 'Titular', to: 'Nuevo' },
      { field: 'certainty', label: 'Certeza', from: 'confirmada', to: 'en_desarrollo' },
    ]);
    expect(diffVersions(v1, v1)).toEqual([]);
  });

  it('has no diff for the first version', () => {
    expect(diffVersions(undefined, v1)).toEqual([]);
  });

  it('lists the corrections a version added', () => {
    expect(addedCorrections(v1, v2).map((item) => item.kind)).toEqual(['correccion']);
    expect(addedCorrections(undefined, v2)).toHaveLength(1);
    expect(addedCorrections(v2, v2)).toEqual([]);
  });
});
