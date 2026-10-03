import type { Certainty, CorrectionEntry, News } from '../types';

/** The fields the editor sections may write. Workflow, version and publication data are not here. */
export const EDITABLE_FIELDS = [
  'title',
  'lead',
  'body',
  'topics',
  'geo',
  'importance',
  'sources',
  'claims',
  'image',
  'certainty',
  'certaintyNote',
  'checklist',
] as const satisfies readonly (keyof News)[];

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditablePatch = Pick<News, EditableField>;

export function pickEditableFields(news: News): EditablePatch {
  return Object.fromEntries(
    EDITABLE_FIELDS.map((field) => [field, news[field]]),
  ) as unknown as EditablePatch;
}

export const CORRECTION_SUMMARY_MAX = 280;

export type RevisionKind = Extract<CorrectionEntry['kind'], 'actualizacion' | 'correccion'>;

export type RevisionErrorCode =
  | 'not_published'
  | 'already_retracted'
  | 'no_changes'
  | 'summary_invalid'
  | 'retraction_via_revision';

export class RevisionError extends Error {
  constructor(
    readonly code: RevisionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** The summary is shown to readers, so it must exist and stay short. */
export function correctionSummaryIssue(summary: string): string | null {
  const text = summary.trim();
  if (text === '') return 'Escribe el resumen de la corrección: lo verán los lectores.';
  if (text.length > CORRECTION_SUMMARY_MAX) {
    return `El resumen no puede pasar de ${CORRECTION_SUMMARY_MAX} caracteres.`;
  }
  return null;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => same(left[key], right[key]));
}

/** Editable fields whose value differs. A missing optional field equals `undefined`. */
export function changedFields(before: News, after: News): EditableField[] {
  return EDITABLE_FIELDS.filter((field) => !same(before[field], after[field]));
}

export interface Revision {
  /** `undefined` values mean "remove the field"; the portal turns them into `deleteField()`. */
  patch: Partial<News> &
    Pick<News, 'corrections' | 'version' | 'updatedAt'> & { indexPending: true };
  /** What is stored in `news/{id}/versions/{version}`; never contains `undefined`. */
  snapshot: News;
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

function requirePublished(current: News): void {
  if (current.workflow !== 'publicada') {
    throw new RevisionError('not_published', 'Solo las noticias publicadas llevan correcciones.');
  }
  if (current.certainty === 'retractada') {
    throw new RevisionError('already_retracted', 'Una noticia retractada ya no se puede editar.');
  }
}

function build(current: News, patch: Revision['patch']): Revision {
  return { patch, snapshot: withoutUndefined({ ...current, ...patch }) };
}

/**
 * Edits a published news (F2-08). Only the editable fields are taken from `edited`, on top of the
 * stored `current`, so nothing else can change; a correction entry is appended and the version
 * grows by one. Readers see the entry summary as «Actualizada …».
 */
export function buildRevision(
  current: News,
  edited: News,
  entry: { kind: RevisionKind; summary: string },
  editorUid: string,
  now: Date,
): Revision {
  requirePublished(current);

  if ((entry.kind as string) === 'retractacion') {
    throw new RevisionError('retraction_via_revision', 'Retractar es una acción aparte.');
  }
  if (edited.certainty === 'retractada') {
    throw new RevisionError('retraction_via_revision', 'Retractar es una acción aparte.');
  }
  const issue = correctionSummaryIssue(entry.summary);
  if (issue) throw new RevisionError('summary_invalid', issue);
  if (changedFields(current, edited).length === 0) {
    throw new RevisionError('no_changes', 'No hay cambios que guardar.');
  }

  const timestamp = now.toISOString();
  const correction: CorrectionEntry = {
    at: timestamp,
    kind: entry.kind,
    summary: entry.summary.trim(),
    editorUid,
  };

  return build(current, {
    ...pickEditableFields(edited),
    corrections: [...current.corrections, correction],
    version: current.version + 1,
    updatedAt: timestamp,
    indexPending: true,
  });
}

/** Retracts a published news: it stays stored and visible with its correction (never deleted). */
export function buildRetraction(
  current: News,
  summary: string,
  editorUid: string,
  now: Date,
): Revision {
  requirePublished(current);

  const issue = correctionSummaryIssue(summary);
  if (issue) throw new RevisionError('summary_invalid', issue);

  const timestamp = now.toISOString();
  const certainty: Certainty = 'retractada';

  return build(current, {
    certainty,
    corrections: [
      ...current.corrections,
      { at: timestamp, kind: 'retractacion', summary: summary.trim(), editorUid },
    ],
    version: current.version + 1,
    updatedAt: timestamp,
    indexPending: true,
  });
}

export interface VersionChange {
  field: 'title' | 'lead' | 'certainty';
  label: string;
  from: string;
  to: string;
}

const DIFF_FIELDS: { field: VersionChange['field']; label: string }[] = [
  { field: 'title', label: 'Título' },
  { field: 'lead', label: 'Entradilla' },
  { field: 'certainty', label: 'Certeza' },
];

/** Simple diff shown in the history tab: title, lead and certainty between two versions. */
export function diffVersions(previous: News | undefined, next: News): VersionChange[] {
  if (!previous) return [];

  return DIFF_FIELDS.filter(({ field }) => previous[field] !== next[field]).map(
    ({ field, label }) => ({ field, label, from: previous[field], to: next[field] }),
  );
}

/** Correction entries that this version added on top of the previous one. */
export function addedCorrections(previous: News | undefined, next: News): CorrectionEntry[] {
  return next.corrections.slice(previous ? previous.corrections.length : 0);
}
