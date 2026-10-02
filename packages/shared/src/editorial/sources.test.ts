import { describe, expect, it } from 'vitest';
import type { Claim, Source } from '../types';
import {
  buildSource,
  computeClaimStatus,
  countConfirmingOrganizations,
  createClaim,
  isValidSourceUrl,
  recomputeClaims,
  validateSourceForm,
} from './sources';

function source(id: string, patch: Partial<Source> = {}): Source {
  return {
    id,
    name: `Fuente ${id}`,
    organization: `Org ${id}`,
    url: `https://example.org/${id}`,
    type: 'medio',
    accessedAt: '2026-10-02T00:00:00.000Z',
    supports: 'confirma',
    ...patch,
  };
}

describe('isValidSourceUrl', () => {
  it('accepts absolute http(s) urls', () => {
    expect(isValidSourceUrl('https://www.prensalibre.com/nota')).toBe(true);
    expect(isValidSourceUrl(' http://example.org/a?b=1 ')).toBe(true);
  });

  it('rejects everything else', () => {
    for (const value of [
      '',
      'prensalibre.com/nota',
      'ftp://example.org/a',
      'javascript:alert(1)',
      'https://localhost/a',
      'https://exa mple.org',
      'no es url',
    ]) {
      expect(isValidSourceUrl(value), value).toBe(false);
    }
  });
});

describe('validateSourceForm', () => {
  it('accepts a complete source', () => {
    expect(
      validateSourceForm({
        name: 'Prensa Libre',
        organization: 'Prensa Libre',
        url: 'https://a.com/x',
      }),
    ).toEqual([]);
  });

  it('reports each missing or invalid field (CA2: invalid URL is not accepted)', () => {
    const codes = validateSourceForm({ name: ' ', organization: '', url: 'nota' }).map(
      (i) => i.code,
    );
    expect(codes).toEqual([
      'source_name_required',
      'source_organization_required',
      'source_url_invalid',
    ]);
    expect(
      validateSourceForm({ name: 'a', organization: 'b', url: '' }).map((i) => i.code),
    ).toEqual(['source_url_required']);
  });
});

describe('buildSource', () => {
  const base = {
    id: 's1',
    name: ' Nombre ',
    organization: ' Org ',
    url: ' https://a.com/x ',
    type: 'medio' as const,
    accessedAt: '2026-10-02T00:00:00.000Z',
    supports: 'confirma' as const,
  };

  it('trims values and omits an empty note instead of storing undefined', () => {
    const built = buildSource({ ...base, note: '   ' });
    expect(built).toMatchObject({ name: 'Nombre', organization: 'Org', url: 'https://a.com/x' });
    expect('note' in built).toBe(false);
    expect(buildSource({ ...base, note: ' Dato ' }).note).toBe('Dato');
  });
});

describe('countConfirmingOrganizations', () => {
  it('counts distinct organizations, ignoring case, accents and spacing', () => {
    const sources = [
      source('a', { organization: 'Ministerio de Salud' }),
      source('b', { organization: ' ministerio  de salud ' }),
      source('c', { organization: 'Agencia EFE', type: 'agencia' }),
      source('d', { organization: 'Prensa Líbre' }),
      source('e', { organization: 'Prensa Libre' }),
    ];
    expect(countConfirmingOrganizations(sources)).toBe(3);
  });

  it('ignores sources that do not confirm and social networks', () => {
    const sources = [
      source('a', { supports: 'contradice' }),
      source('b', { supports: 'contexto' }),
      source('c', { type: 'redes' }),
      source('d', { organization: ' ' }),
    ];
    expect(countConfirmingOrganizations(sources)).toBe(0);
  });
});

describe('computeClaimStatus', () => {
  const sources = [
    source('yes', { supports: 'confirma' }),
    source('no', { supports: 'contradice' }),
    source('ctx', { supports: 'contexto' }),
  ];

  it('is respaldada with at least one confirming source', () => {
    expect(computeClaimStatus(['yes'], sources)).toBe('respaldada');
    expect(computeClaimStatus(['yes', 'ctx'], sources)).toBe('respaldada');
  });

  it('is en_disputa when any linked source contradicts, even if another confirms', () => {
    expect(computeClaimStatus(['no'], sources)).toBe('en_disputa');
    expect(computeClaimStatus(['yes', 'no'], sources)).toBe('en_disputa');
  });

  it('is sin_respaldo with no links or only context', () => {
    expect(computeClaimStatus([], sources)).toBe('sin_respaldo');
    expect(computeClaimStatus(['ctx'], sources)).toBe('sin_respaldo');
    expect(computeClaimStatus(['missing'], sources)).toBe('sin_respaldo');
  });
});

describe('recomputeClaims', () => {
  const claim = (sourceIds: string[], status: Claim['status'] = 'sin_respaldo'): Claim => ({
    id: 'c1',
    text: 'Afirmación',
    sourceIds,
    status,
    suggestedByAi: false,
  });

  it('CA1: status follows links and unlinks', () => {
    const sources = [source('yes'), source('no', { supports: 'contradice' })];

    const linked = recomputeClaims([claim(['yes'])], sources)[0];
    expect(linked?.status).toBe('respaldada');

    const disputed = recomputeClaims([claim(['yes', 'no'])], sources)[0];
    expect(disputed?.status).toBe('en_disputa');

    const unlinked = recomputeClaims([claim([], 'respaldada')], sources)[0];
    expect(unlinked?.status).toBe('sin_respaldo');
  });

  it('removing a source drops its links and downgrades the claim', () => {
    const sources = [source('yes')];
    const result = recomputeClaims([claim(['yes', 'gone'], 'respaldada')], []);
    expect(result[0]).toMatchObject({ sourceIds: [], status: 'sin_respaldo' });
    expect(recomputeClaims([claim(['yes', 'gone'])], sources)[0]?.sourceIds).toEqual(['yes']);
  });

  it('does not mutate its input', () => {
    const input = [claim(['yes'])];
    recomputeClaims(input, [source('yes')]);
    expect(input[0]?.status).toBe('sin_respaldo');
  });
});

describe('createClaim', () => {
  it('creates a human-authored claim with a computed status', () => {
    const created = createClaim('c1', '  Texto  ', ['yes'], [source('yes')]);
    expect(created).toEqual({
      id: 'c1',
      text: 'Texto',
      sourceIds: ['yes'],
      status: 'respaldada',
      suggestedByAi: false,
    });
  });
});
