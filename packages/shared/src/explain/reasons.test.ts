import { describe, expect, it } from 'vitest';
import corpus from '../../fixtures/news.json';
import { findLocation } from '../catalogs/locations';
import { DEFAULT_RANKING_WEIGHTS } from '../config/feed';
import { createDefaultProfile } from '../profile';
import { buildSeedNews, type SeedNews } from '../seed';
import type { RankedItem, UserProfile } from '../types';
import { buildReasons } from './reasons';

const now = new Date('2026-10-09T12:00:00.000Z');
const location = findLocation('gt-guatemala')!;
const profile = createDefaultProfile('test', 'Prueba', location.id, now);
const news = buildSeedNews(corpus as SeedNews[], now)[0]!;
const base: RankedItem = {
  news: { ...news, importance: 1, topics: ['salud'] },
  score: 0.1,
  components: { importance: 1 / 3, proximity: 0.1, affinity: 0.3, recency: 0.1, penalties: 1 },
  tier: 'compacta',
  reasons: [],
};
const explain = (item: RankedItem, user: UserProfile = profile) =>
  buildReasons(item, location, user, DEFAULT_RANKING_WEIGHTS);

describe('reason catalogue', () => {
  it.each([
    [1, 'city', 'Ocurre en tu ciudad (Ciudad de Guatemala)'],
    [0.75, 'country', 'Afecta a tu país (Guatemala)'],
    [0.4, 'region', 'Es relevante para tu región (Centroamérica)'],
    [0.6, 'global', 'Tiene alcance global'],
  ] as const)('explains proximity %s with the matching text', (proximity, code, text) => {
    const reasons = explain({ ...base, components: { ...base.components, proximity } });
    expect(reasons).toContainEqual({
      code,
      text,
      contribution: DEFAULT_RANKING_WEIGHTS.wG * proximity,
    });
  });

  it.each([
    ['esencial', 'essential', 'Información esencial para tu zona: se muestra a todas las personas'],
    ['cuota_nacional', 'national_quota', 'Para que no te pierdas lo que pasa en tu país'],
    [
      'cuota_internacional',
      'international_quota',
      'Para que no te pierdas lo que pasa fuera de tu país',
    ],
  ] as const)('explains %s without inventing a score bonus', (guaranteedBy, code, text) => {
    expect(explain({ ...base, guaranteedBy })).toContainEqual({ code, text, contribution: 0 });
  });

  it('uses the strongest topic, even when it is secondary, for affinity at the inclusive threshold', () => {
    const item = {
      ...base,
      news: { ...base.news, topics: ['salud', 'tecnologia'] },
      components: { ...base.components, affinity: 0.6 },
    };
    expect(explain(item, { ...profile, interests: { salud: 2, tecnologia: 10 } })).toContainEqual({
      code: 'affinity',
      text: 'Sueles leer sobre tecnología',
      contribution: 0.12,
    });
  });

  it('explains recency at the inclusive threshold', () => {
    expect(explain({ ...base, components: { ...base.components, recency: 0.8 } })).toContainEqual({
      code: 'recent',
      text: 'Publicada hace poco',
      contribution: 0.12,
    });
  });

  it('explains editorial importance at level two', () => {
    expect(
      explain({
        ...base,
        news: { ...base.news, importance: 2 },
        components: { ...base.components, importance: 2 / 3 },
      }),
    ).toContainEqual({
      code: 'important',
      text: 'El equipo editorial la marcó como importante',
      contribution: 0.35 * (2 / 3),
    });
  });

  it('does not claim a threshold condition that is not met', () => {
    const reasons = explain({
      ...base,
      components: { ...base.components, affinity: 0.599, recency: 0.799, proximity: 0.45 },
    });
    expect(
      reasons.some((reason) =>
        ['affinity', 'recent', 'important', 'city', 'country'].includes(reason.code),
      ),
    ).toBe(false);
  });

  it('omits affinity explanations when personalization is disabled or a topic is muted', () => {
    const item = { ...base, components: { ...base.components, affinity: 1 } };
    for (const user of [
      { ...profile, personalization: false },
      { ...profile, mutedTopics: ['salud'] },
    ]) {
      expect(explain(item, user).some((reason) => reason.code === 'affinity')).toBe(false);
    }
  });

  it('selects at most three reasons by effective contribution and retains the guarantee', () => {
    const item: RankedItem = {
      ...base,
      guaranteedBy: 'esencial',
      news: { ...base.news, importance: 3 },
      components: { importance: 1, proximity: 1, affinity: 1, recency: 1, penalties: 1 },
    };
    const weights = { wI: 0.05, wG: 0.1, wA: 0.8, wR: 0.05 };
    const reasons = buildReasons(item, location, { ...profile, interests: { salud: 10 } }, weights);
    expect(reasons.map((reason) => reason.code)).toEqual(['affinity', 'city', 'essential']);
    expect(reasons.map((reason) => reason.contribution)).toEqual([0.8, 0.1, 0]);
    const ordinary = buildReasons(
      { ...item, guaranteedBy: undefined },
      location,
      profile,
      DEFAULT_RANKING_WEIGHTS,
    );
    expect(ordinary).toHaveLength(3);
    expect(ordinary.map((reason) => reason.contribution)).toEqual(
      [...ordinary.map((reason) => reason.contribution)].sort((a, b) => b - a),
    );
  });

  it('includes the read multiplier and omits zero-weight claims', () => {
    const item = {
      ...base,
      components: { ...base.components, proximity: 1, recency: 1, penalties: 0.35 },
    };
    const reasons = buildReasons(item, location, profile, { wI: 0, wG: 1, wA: 0, wR: 0 });
    expect(reasons).toEqual([
      { code: 'city', text: 'Ocurre en tu ciudad (Ciudad de Guatemala)', contribution: 0.35 },
    ]);
  });

  it('uses stable catalogue tie-breaking and never mutates the item or profile', () => {
    const item: RankedItem = {
      ...base,
      news: { ...base.news, importance: 3 },
      components: { importance: 1, proximity: 1, affinity: 1, recency: 1, penalties: 1 },
    };
    const before = JSON.stringify({ item, profile });
    const weights = { wI: 0.25, wG: 0.25, wA: 0.25, wR: 0.25 };
    expect(buildReasons(item, location, profile, weights).map((reason) => reason.code)).toEqual([
      'city',
      'affinity',
      'recent',
    ]);
    expect(buildReasons(item, location, profile, weights)).toEqual(
      buildReasons(item, location, profile, weights),
    );
    expect(JSON.stringify({ item, profile })).toBe(before);
  });

  it.each([
    ['importance_score', { wI: 1, wG: 0, wA: 0, wR: 0 }, 1 / 3],
    ['proximity_score', { wI: 0, wG: 1, wA: 0, wR: 0 }, 0.1],
    ['affinity_score', { wI: 0, wG: 0, wA: 0.9, wR: 0.1 }, 0.27],
    ['recency_score', { wI: 0, wG: 0, wA: 0, wR: 1 }, 0.1],
  ] as const)(
    'explains the strongest actual contribution when thresholds do not match: %s',
    (code, weights, contribution) => {
      const reasons = buildReasons(base, location, profile, weights);
      expect(reasons).toHaveLength(1);
      expect(reasons[0]!.code).toBe(code);
      expect(reasons[0]!.contribution).toBeCloseTo(contribution);
      expect(reasons[0]!.text).not.toContain('Publicada hace poco');
      expect(reasons[0]!.text).not.toContain('Sueles leer');
    },
  );

  it('uses availability when no component contributes', () => {
    const item = { ...base, components: { ...base.components, importance: 0 } };
    expect(buildReasons(item, location, profile, { wI: 1, wG: 0, wA: 0, wR: 0 })).toEqual([
      {
        code: 'available',
        text: 'Forma parte de las noticias publicadas disponibles',
        contribution: 0,
      },
    ]);
  });

  it('handles unknown topic labels without exposing internal topic IDs or picking an unrelated topic', () => {
    const item = {
      ...base,
      news: { ...base.news, topics: ['salud', 'legacy-topic'] },
      components: { ...base.components, affinity: 0.6 },
    };
    const reasons = explain(item, { ...profile, interests: { salud: 2, 'legacy-topic': 10 } });
    expect(reasons.find((reason) => reason.code === 'affinity')?.text).toBe(
      'Sueles leer sobre los temas de esta noticia',
    );
  });

  it('uses the original topic order to break equal-interest ties', () => {
    const item = {
      ...base,
      news: { ...base.news, topics: ['tecnologia', 'salud'] },
      components: { ...base.components, affinity: 1 },
    };
    expect(
      explain(item, { ...profile, interests: { salud: 10, tecnologia: 10 } }).find(
        (reason) => reason.code === 'affinity',
      )?.text,
    ).toBe('Sueles leer sobre tecnología');
  });
});
