import { describe, expect, it } from 'vitest';
import corpus from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import { createDefaultProfile } from '../profile';
import { findLocation } from '../catalogs/locations';
import type { News, UserProfile } from '../types';
import { rankFeed } from './rankFeed';

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
