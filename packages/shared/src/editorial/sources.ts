import type { Claim, Source } from '../types';

export type SourceFormField = 'name' | 'organization' | 'url';

export interface SourceFormIssue {
  field: SourceFormField;
  code: string;
  message: string;
}

/** Only absolute http(s) URLs with a dotted host are accepted as public sources. */
export function isValidSourceUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
  } catch {
    return false;
  }
}

/** Checks what an editor types in the "add source" form; nothing is stored until this is empty. */
export function validateSourceForm(
  source: Pick<Source, 'name' | 'organization' | 'url'>,
): SourceFormIssue[] {
  const issues: SourceFormIssue[] = [];

  if (source.name.trim() === '') {
    issues.push({
      field: 'name',
      code: 'source_name_required',
      message: 'El nombre es obligatorio.',
    });
  }
  if (source.organization.trim() === '') {
    issues.push({
      field: 'organization',
      code: 'source_organization_required',
      message: 'La organización es obligatoria (sirve para medir independencia entre fuentes).',
    });
  }
  if (source.url.trim() === '') {
    issues.push({ field: 'url', code: 'source_url_required', message: 'La URL es obligatoria.' });
  } else if (!isValidSourceUrl(source.url)) {
    issues.push({
      field: 'url',
      code: 'source_url_invalid',
      message: 'La URL debe ser un enlace http(s) completo, por ejemplo https://ejemplo.org/nota.',
    });
  }

  return issues;
}

/** Builds a Source from form input, omitting an empty note (Firestore rejects `undefined`). */
export function buildSource(input: Omit<Source, 'note'> & { note?: string }): Source {
  const { note, ...rest } = input;
  const trimmedNote = note?.trim();

  return {
    ...rest,
    name: rest.name.trim(),
    organization: rest.organization.trim(),
    url: rest.url.trim(),
    ...(trimmedNote ? { note: trimmedNote } : {}),
  };
}

export function normalizeOrganization(organization: string): string {
  return organization
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * How many distinct organizations confirm the news. Social-network sources never count toward
 * the two independent sources that `confirmada` needs (VERIFICACION-Y-FUENTES.md §2).
 */
export function countConfirmingOrganizations(sources: Source[]): number {
  const organizations = sources
    .filter((source) => source.supports === 'confirma' && source.type !== 'redes')
    .map((source) => normalizeOrganization(source.organization))
    .filter((organization) => organization !== '');

  return new Set(organizations).size;
}

/**
 * Derived, never typed by hand and never decided by a model: `en_disputa` when any linked source
 * contradicts (even if others confirm), `respaldada` when at least one linked source confirms,
 * otherwise `sin_respaldo`.
 */
export function computeClaimStatus(sourceIds: string[], sources: Source[]): Claim['status'] {
  const linked = sources.filter((source) => sourceIds.includes(source.id));

  if (linked.some((source) => source.supports === 'contradice')) return 'en_disputa';
  if (linked.some((source) => source.supports === 'confirma')) return 'respaldada';
  return 'sin_respaldo';
}

/** Drops links to sources that no longer exist and refreshes every claim status. */
export function recomputeClaims(claims: Claim[], sources: Source[]): Claim[] {
  const known = new Set(sources.map((source) => source.id));

  return claims.map((claim) => {
    const sourceIds = claim.sourceIds.filter((id) => known.has(id));
    return { ...claim, sourceIds, status: computeClaimStatus(sourceIds, sources) };
  });
}

export function createClaim(
  id: string,
  text: string,
  sourceIds: string[],
  sources: Source[],
): Claim {
  return {
    id,
    text: text.trim(),
    sourceIds,
    status: computeClaimStatus(sourceIds, sources),
    suggestedByAi: false,
  };
}
