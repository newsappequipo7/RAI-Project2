import { describe, expect, it } from 'vitest';
import seedJson from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import type { News } from '../types';
import { createEmptyDraft } from './draft';
import {
  hasErrors,
  LEAD_MAX_LENGTH,
  saveBlockers,
  TITLE_WARN_LENGTH,
  validateNewsFields,
} from './fieldRules';

const NOW = new Date('2026-10-02T15:00:00.000Z');

function valid(patch: Partial<News> = {}): News {
  return {
    ...createEmptyDraft('n1', 'uid-1', NOW),
    title: 'Título claro',
    lead: 'Entradilla breve.',
    body: 'Cuerpo de la noticia.',
    topics: ['salud'],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
    ...patch,
  };
}

const codes = (news: News) => validateNewsFields(news).map((issue) => issue.code);

describe('validateNewsFields', () => {
  it('accepts a complete news', () => {
    expect(validateNewsFields(valid())).toEqual([]);
  });

  it('accepts every seed news (rules match the real corpus)', () => {
    for (const item of buildSeedNews(seedJson as SeedNews[], NOW)) {
      expect(validateNewsFields(item), item.id).toEqual([]);
    }
  });

  it('flags an empty draft on every required field', () => {
    const issues = validateNewsFields(createEmptyDraft('n1', 'uid-1', NOW));
    expect(new Set(issues.map((issue) => issue.field))).toEqual(
      new Set(['title', 'lead', 'body', 'topics', 'geo']),
    );
    expect(hasErrors(issues)).toBe(true);
  });

  it('only warns when the title is long, and errors when the lead is over the limit', () => {
    const longTitle = validateNewsFields(valid({ title: 'x'.repeat(TITLE_WARN_LENGTH + 1) }));
    expect(longTitle).toHaveLength(1);
    expect(longTitle[0]).toMatchObject({ code: 'title_long', severity: 'warning' });
    expect(hasErrors(longTitle)).toBe(false);

    expect(codes(valid({ lead: 'x'.repeat(LEAD_MAX_LENGTH) }))).toEqual([]);
    expect(codes(valid({ lead: 'x'.repeat(LEAD_MAX_LENGTH + 1) }))).toEqual(['lead_too_long']);
  });

  it('requires 1 to 3 distinct catalog topics', () => {
    expect(codes(valid({ topics: [] }))).toEqual(['topics_count']);
    expect(codes(valid({ topics: ['salud', 'economia', 'cultura', 'deportes'] }))).toEqual([
      'topics_count',
    ]);
    expect(codes(valid({ topics: ['salud', 'salud'] }))).toEqual(['topics_duplicated']);
    expect(codes(valid({ topics: ['astrologia'] }))).toEqual(['topics_unknown']);
  });

  it('requires scope-consistent geography', () => {
    const geo = (patch: Partial<News['geo']>): News['geo'] => ({
      scope: 'nacional',
      countries: ['GT'],
      cityIds: [],
      regions: [],
      ...patch,
    });

    expect(codes(valid({ geo: geo({ countries: [] }) }))).toEqual(['geo_countries_required']);
    expect(codes(valid({ geo: geo({ countries: ['ZZ'] }) }))).toEqual(['geo_country_unknown']);
    expect(codes(valid({ geo: geo({ regions: ['atlantida'] }) }))).toEqual(['geo_region_unknown']);
    expect(codes(valid({ geo: geo({ scope: 'local' }) }))).toEqual(['geo_city_required']);
    expect(codes(valid({ geo: geo({ cityIds: ['gt-guatemala'] }) }))).toEqual([
      'geo_city_not_local',
    ]);
    expect(codes(valid({ geo: geo({ scope: 'local', cityIds: ['xx-nada'] }) }))).toEqual([
      'geo_city_unknown',
    ]);
    expect(codes(valid({ geo: geo({ scope: 'global' }) }))).toEqual(['geo_global_scoped']);
    expect(
      codes(valid({ geo: { scope: 'global', countries: [], cityIds: [], regions: [] } })),
    ).toEqual([]);
  });

  it('rejects an out-of-range importance', () => {
    expect(codes(valid({ importance: 4 as News['importance'] }))).toEqual(['importance_invalid']);
  });
});

describe('saveBlockers', () => {
  it('lets incomplete drafts be saved so autosave works', () => {
    expect(saveBlockers(createEmptyDraft('n1', 'uid-1', NOW))).toEqual([]);
    expect(
      saveBlockers({ ...createEmptyDraft('n1', 'uid-1', NOW), workflow: 'en_revision' }),
    ).toEqual([]);
  });

  it('blocks saving invalid data as published', () => {
    const invalid = valid({ workflow: 'publicada', title: '' });
    expect(saveBlockers(invalid).map((issue) => issue.code)).toEqual(['title_required']);
  });

  it('does not block a valid published news, nor a title warning', () => {
    expect(saveBlockers(valid({ workflow: 'publicada' }))).toEqual([]);
    expect(
      saveBlockers(valid({ workflow: 'publicada', title: 'x'.repeat(TITLE_WARN_LENGTH + 5) })),
    ).toEqual([]);
  });
});

describe('sources and claims integrity (F2-03)', () => {
  const source = {
    id: 's1',
    name: 'Prensa Libre',
    organization: 'Prensa Libre',
    url: 'https://example.org/nota',
    type: 'medio' as const,
    accessedAt: '2026-10-02T00:00:00.000Z',
    supports: 'confirma' as const,
  };
  const claim = {
    id: 'c1',
    text: 'Afirmación',
    sourceIds: ['s1'],
    status: 'respaldada' as const,
    suggestedByAi: false,
  };

  it('accepts valid sources and claims', () => {
    expect(codes(valid({ sources: [source], claims: [claim] }))).toEqual([]);
  });

  it('flags invalid source URLs, incomplete sources, and broken claims', () => {
    expect(codes(valid({ sources: [{ ...source, url: 'nota' }] }))).toEqual(['source_url_invalid']);
    expect(codes(valid({ sources: [{ ...source, organization: ' ' }] }))).toEqual([
      'source_incomplete',
    ]);
    expect(codes(valid({ sources: [source], claims: [{ ...claim, text: ' ' }] }))).toEqual([
      'claim_text_required',
    ]);
    expect(codes(valid({ claims: [claim] }))).toEqual(['claim_unknown_source']);
  });

  it('CA2: a broken source URL blocks saving even a draft, while other gaps do not', () => {
    const draft = createEmptyDraft('n1', 'uid-1', NOW);
    expect(
      saveBlockers({ ...draft, sources: [{ ...source, url: 'nota' }] }).map((i) => i.code),
    ).toEqual(['source_url_invalid']);
    expect(saveBlockers({ ...draft, sources: [source], claims: [claim] })).toEqual([]);
  });
});
