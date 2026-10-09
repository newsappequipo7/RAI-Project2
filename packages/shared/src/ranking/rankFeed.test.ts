import { describe, expect, it } from 'vitest';
import corpus from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import { createDefaultProfile } from '../profile';
import { findLocation } from '../catalogs/locations';
import type { News, UserProfile } from '../types';
import { rankFeed } from './rankFeed';
import { rankedFeedSchema } from '../schemas';
import { DEFAULT_RANKING_WEIGHTS } from '../config/feed';

const now = new Date('2026-10-09T12:00:00.000Z');
const news = buildSeedNews(corpus as SeedNews[], now);
const personas: UserProfile[] = [
  {
    ...createDefaultProfile('sports', 'Deportes', 'gt-guatemala', now),
    interests: { deportes: 10 },
  },
  createDefaultProfile('neutral', 'Sin historial', 'gt-quetzaltenango', now),
  {
    ...createDefaultProfile('tech', 'Tecnología', 'mx-cdmx', now),
    interests: { tecnologia: 10 },
    mutedTopics: ['politica'],
  },
  { ...createDefaultProfile('economy', 'Economía', 'es-madrid', now), interests: { economia: 10 } },
];
const rank = (profile: UserProfile, items: News[] = news) =>
  rankFeed({ news: items, profile, locationId: profile.locationId, now });

describe('F3-03: explanations for every persona', () => {
  it.each(['GT', 'JP'])(
    'explains a real quota promotion when the majority country is %s',
    (country) => {
      const base = news[0]!;
      const items: News[] = Array.from({ length: 12 }, (_, index) => ({
        ...base,
        id: `majority-${index}`,
        importance: 2,
        publishedAt: now.toISOString(),
        topics: [index % 2 ? 'salud' : 'economia'],
        geo: { scope: 'nacional', countries: [country], regions: [], cityIds: [] },
      }));
      items.push({
        ...base,
        id: 'minority',
        importance: 0,
        publishedAt: now.toISOString(),
        topics: ['cultura'],
        geo: {
          scope: 'nacional',
          countries: [country === 'GT' ? 'JP' : 'GT'],
          regions: [],
          cityIds: [],
        },
      });
      const result = rank(personas[0]!, items);
      const promoted = result.feed.find((item) => item.news.id === 'minority')!;
      expect(result.feed.indexOf(promoted)).toBeLessThan(10);
      expect(promoted.reasons).toContainEqual({
        code: country === 'GT' ? 'international_quota' : 'national_quota',
        text:
          country === 'GT'
            ? 'Para que no te pierdas lo que pasa fuera de tu país'
            : 'Para que no te pierdas lo que pasa en tu país',
        contribution: 0,
      });
    },
  );

  it('uses normalized custom weights, the selected location, and the read multiplier together', () => {
    const item: News = {
      ...news[0]!,
      id: 'custom',
      importance: 2,
      publishedAt: now.toISOString(),
      geo: { scope: 'local', countries: ['MX'], cityIds: ['mx-cdmx'], regions: [] },
    };
    const result = rankFeed({
      news: [item],
      locationId: 'mx-cdmx',
      now,
      profile: { ...personas[0]!, readNewsIds: ['custom'] },
      weights: { wI: 1, wG: 1, wA: 0, wR: 1 },
    });
    expect(result.feed[0]!.reasons.map((reason) => reason.code)).toEqual([
      'city',
      'recent',
      'important',
    ]);
    expect(result.feed[0]!.reasons[0]!.text).toBe('Ocurre en tu ciudad (Ciudad de México)');
    expect(result.feed[0]!.reasons[0]!.contribution).toBeCloseTo(0.35 / 3);
    expect(result.feed[0]!.reasons[2]!.contribution).toBeCloseTo((2 / 3) * (1 / 3) * 0.35);
  });

  it.each(personas)(
    'explains every item for $uid without contradicting its components',
    (profile) => {
      const result = rank(profile);
      expect(rankedFeedSchema.safeParse(result).success).toBe(true);
      for (const item of [...result.mustKnow, ...result.feed]) {
        expect(item.reasons.length, item.news.id).toBeGreaterThanOrEqual(1);
        expect(item.reasons.length).toBeLessThanOrEqual(3);
        expect(item.reasons.map((reason) => reason.contribution)).toEqual(
          [...item.reasons.map((reason) => reason.contribution)].sort((a, b) => b - a),
        );
        for (const reason of item.reasons) {
          if (reason.code === 'city') expect(item.components.proximity).toBe(1);
          if (reason.code === 'country') expect(item.components.proximity).toBe(0.75);
          if (reason.code === 'region') expect(item.components.proximity).toBe(0.4);
          if (reason.code === 'global') expect(item.components.proximity).toBe(0.6);
          if (reason.code === 'recent') expect(item.components.recency).toBeGreaterThanOrEqual(0.8);
          if (reason.code === 'important') expect(item.news.importance).toBeGreaterThanOrEqual(2);
          if (reason.code === 'essential') expect(item.guaranteedBy).toBe('esencial');
          if (reason.code === 'national_quota') expect(item.guaranteedBy).toBe('cuota_nacional');
          if (reason.code === 'international_quota')
            expect(item.guaranteedBy).toBe('cuota_internacional');
          if (reason.code === 'affinity') {
            expect(profile.personalization).toBe(true);
            expect(item.components.affinity).toBeGreaterThanOrEqual(0.6);
            expect(item.news.topics.some((topic) => profile.mutedTopics.includes(topic))).toBe(
              false,
            );
          }
          const weights =
            item.guaranteedBy === 'esencial'
              ? { wI: 0.35 / 0.8, wG: 0.3 / 0.8, wA: 0, wR: 0.15 / 0.8 }
              : DEFAULT_RANKING_WEIGHTS;
          const expected = {
            importance: weights.wI * item.components.importance * item.components.penalties,
            proximity: weights.wG * item.components.proximity * item.components.penalties,
            affinity: weights.wA * item.components.affinity * item.components.penalties,
            recency: weights.wR * item.components.recency * item.components.penalties,
          };
          if (['city', 'country', 'region', 'global', 'proximity_score'].includes(reason.code))
            expect(reason.contribution).toBeCloseTo(expected.proximity);
          if (['important', 'importance_score'].includes(reason.code))
            expect(reason.contribution).toBeCloseTo(expected.importance);
          if (['affinity', 'affinity_score'].includes(reason.code))
            expect(reason.contribution).toBeCloseTo(expected.affinity);
          if (['recent', 'recency_score'].includes(reason.code))
            expect(reason.contribution).toBeCloseTo(expected.recency);
          if (reason.code.endsWith('_score'))
            expect(reason.contribution).toBeCloseTo(Math.max(...Object.values(expected)));
          if (
            ['essential', 'national_quota', 'international_quota', 'available'].includes(
              reason.code,
            )
          )
            expect(reason.contribution).toBe(0);
          if (reason.code === 'available') expect(item.score).toBe(0);
        }
        expect(
          item.reasons.reduce((sum, reason) => sum + reason.contribution, 0),
        ).toBeLessThanOrEqual(item.score + 1e-12);
      }
    },
  );
});

describe('RELEVANCIA §8: nine acceptance properties', () => {
  it('1: keeps essential GT news for both GT personas despite muted politics', () => {
    const political = news.map((item) =>
      item.id === 'n-gt-sismo' ? { ...item, topics: ['politica'] } : item,
    );
    for (const profile of personas.slice(0, 2)) {
      expect(
        rank({ ...profile, mutedTopics: ['politica'] }, political).mustKnow.map(
          (item) => item.news.id,
        ),
      ).toContain('n-gt-sismo');
    }
  });

  it('2: shows global essentials to all four personas', () => {
    for (const profile of personas) {
      expect(rank(profile).mustKnow.map((item) => item.news.id)).toEqual(
        expect.arrayContaining(['n-glo-001', 'n-glo-002']),
      );
    }
  });

  it('3: essential with zero affinity beats routine with full affinity in the same zone', () => {
    const profile = { ...personas[0]!, interests: { salud: 0, deportes: 10 } };
    const base = news.find((item) => item.id === 'n-gt-001')!;
    const essential: News = { ...base, id: 'essential', topics: ['salud'], importance: 3 };
    const routine: News = { ...base, id: 'routine', topics: ['deportes'], importance: 0 };
    const result = rank(profile, [essential, routine]);
    expect(result.mustKnow[0]!.score).toBeGreaterThan(result.feed[0]!.score);
  });

  it('4: includes domestic and foreign news in every persona top ten', () => {
    for (const profile of personas) {
      const country = findLocation(profile.locationId)!.countryIso;
      const firstTen = rank(profile).feed.slice(0, 10);
      expect(firstTen.some((item) => item.news.geo.countries.includes(country))).toBe(true);
      expect(firstTen.some((item) => !item.news.geo.countries.includes(country))).toBe(true);
    }
  });

  it('5: never has three consecutive primary topics in the fixed corpus', () => {
    for (const profile of personas) {
      const topics = rank(profile).feed.map((item) => item.news.topics[0]);
      for (let i = 2; i < topics.length; i++) {
        expect(topics[i] === topics[i - 1] && topics[i] === topics[i - 2]).toBe(false);
      }
    }
  });

  it('6: disabling personalization yields identical ordering despite interests, mute and read history', () => {
    const first = { ...personas[0]!, personalization: false };
    const second = {
      ...personas[2]!,
      personalization: false,
      locationId: first.locationId,
      readNewsIds: ['n-gt-002', 'n-gt-004'],
    };
    expect(rank(first)).toEqual(rank(second));
  });

  it('7: ranks local Quetzaltenango news higher for Quetzaltenango than the capital', () => {
    const position = (profile: UserProfile) =>
      rank(profile).feed.findIndex((item) => item.news.id === 'n-gt-003');
    expect(position(personas[1]!)).toBeGreaterThanOrEqual(0);
    expect(position(personas[1]!)).toBeLessThan(position(personas[0]!));
  });

  it('8: excludes retracted news from both blocks, including fresh essentials', () => {
    const items = news.map((item) =>
      item.certainty === 'retractada'
        ? { ...item, importance: 3 as const, publishedAt: now.toISOString() }
        : item,
    );
    for (const profile of personas) {
      const result = rank(profile, items);
      expect(
        [...result.feed, ...result.mustKnow].every((item) => item.news.certainty !== 'retractada'),
      ).toBe(true);
    }
  });

  it('9: is deterministic and does not mutate the inputs', () => {
    const before = JSON.stringify({ news, personas });
    for (const profile of personas) expect(rank(profile)).toEqual(rank(profile));
    expect(JSON.stringify({ news, personas })).toBe(before);
  });
});
