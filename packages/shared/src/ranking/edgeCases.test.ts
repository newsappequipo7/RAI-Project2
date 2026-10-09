import { describe, expect, it } from 'vitest';
import corpus from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import { createDefaultProfile } from '../profile';
import { LOCATIONS } from '../catalogs/locations';
import { DEFAULT_RANKING_WEIGHTS } from '../config/feed';
import { rankedFeedSchema } from '../schemas';
import type { News, RankedItem, RankFeedInput } from '../types';
import { rankFeed } from './rankFeed';
import { scoreNews } from './score';
import { applyQuotas } from './antibubble';
import { assignTiers } from './tiers';

const now = new Date('2026-10-09T12:00:00.000Z');
const profile = createDefaultProfile('test', 'Prueba', 'gt-guatemala', now);
const base = buildSeedNews(corpus as SeedNews[], now)[0]!;
const story = (id: string, patch: Partial<News> = {}): News => ({
  ...base,
  id,
  topics: ['salud'],
  importance: 1,
  certainty: 'confirmada',
  publishedAt: now.toISOString(),
  ...patch,
});
const rank = (news: News[], patch: Partial<RankFeedInput> = {}) =>
  rankFeed({ news, profile, now, locationId: profile.locationId, ...patch });
const domestic = (id: string, patch: Partial<News> = {}) =>
  story(id, { geo: { scope: 'nacional', countries: ['GT'], regions: [], cityIds: [] }, ...patch });
const foreign = (id: string, patch: Partial<News> = {}) =>
  story(id, {
    geo: { scope: 'internacional', countries: ['JP'], regions: [], cityIds: [] },
    ...patch,
  });
const score = (news: News) => scoreNews(news, profile, LOCATIONS[0]!, now, DEFAULT_RANKING_WEIGHTS);
const noTriples = (items: RankedItem[]) => {
  for (let i = 2; i < items.length; i++) {
    expect(
      items[i]!.news.topics[0] === items[i - 1]!.news.topics[0] &&
        items[i]!.news.topics[0] === items[i - 2]!.news.topics[0],
    ).toBe(false);
  }
};

describe('essential block and filtering', () => {
  it('retains all essentials for view-all, independently of profile and read history', () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      story(`essential-${i}`, {
        importance: 3,
        publishedAt: new Date(+now - i * 1000).toISOString(),
      }),
    );
    const first = rank(items).mustKnow;
    expect(first).toHaveLength(7);
    expect(first.map((item) => item.news.id)).toEqual(items.map((item) => item.id));
    expect(rank(items).feed).toHaveLength(0);
    expect(
      rank(items, {
        profile: {
          ...profile,
          interests: { salud: 10 },
          mutedTopics: ['salud'],
          readNewsIds: items.map((item) => item.id),
        },
      }).mustKnow,
    ).toEqual(first);
  });

  it('includes exactly 72h essentials and leaves older input items in the regular feed', () => {
    const items = [
      story('boundary', {
        importance: 3,
        publishedAt: new Date(+now - 72 * 3_600_000).toISOString(),
      }),
      story('expired', {
        importance: 3,
        publishedAt: new Date(+now - 72 * 3_600_000 - 1).toISOString(),
      }),
    ];
    expect(rank(items).mustKnow.map((item) => item.news.id)).toEqual(['boundary']);
    expect(rank(items).feed.map((item) => item.news.id)).toEqual(['expired']);
  });

  it('does not guarantee a distant essential with proximity below 0.4', () => {
    expect(rank([foreign('far', { importance: 3 })]).mustKnow).toEqual([]);
  });

  it('rejects drafts, retractions and invalid, missing or future publication dates', () => {
    const items = [
      story('draft', { workflow: 'borrador' }),
      story('retracted', { certainty: 'retractada' }),
      story('invalid', { publishedAt: 'bad' }),
      story('missing', { publishedAt: undefined }),
      story('future', { publishedAt: new Date(+now + 1).toISOString() }),
      story('visible', { indexPending: true }),
    ];
    expect(rank(items).feed.map((item) => item.news.id)).toEqual(['visible']);
  });
});

describe('quotas and diversity', () => {
  it('preserves quotas and avoids triples across reproducible permutations with a known valid order', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let state = seed;
      const items = Array.from({ length: 18 }, (_, i) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return (i === 0 ? foreign : domestic)(`case-${seed}-${i}`, {
          topics: [i % 3 === 0 ? 'salud' : 'economia'],
          publishedAt: new Date(+now - (state % 200_000_000)).toISOString(),
        });
      });
      // Original order is a witness: foreign first and repeating salud/economia/economia.
      const result = rank(items);
      noTriples(result.feed);
      expect(result.feed.slice(0, 10).some((item) => item.news.id === `case-${seed}-0`)).toBe(true);
      expect(new Set(result.feed.map((item) => item.news.id)).size).toBe(18);
    }
  });

  it.each([true, false])(
    'promotes the best missing quota at its specified position (domestic=%s)',
    (missingDomestic) => {
      const majority = Array.from({ length: 12 }, (_, i) =>
        score((missingDomestic ? foreign : domestic)(`major-${i}`)),
      );
      const minority = score((missingDomestic ? domestic : foreign)('minor'));
      const promoted = applyQuotas([...majority, minority], 'GT');
      expect(promoted[missingDomestic ? 4 : 7]!.news.id).toBe('minor');
      expect(promoted[missingDomestic ? 4 : 7]!.guaranteedBy).toBe(
        missingDomestic ? 'cuota_nacional' : 'cuota_internacional',
      );
      expect(minority.guaranteedBy).toBeUndefined();
    },
  );

  it('keeps quota coverage after topic diversity reshuffles the top ten', () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      domestic(`major-${i}`, {
        topics: [i < 12 ? 'economia' : 'salud'],
        importance: 2,
      }),
    );
    items.push(foreign('minor', { topics: ['economia'], importance: 0 }));
    const result = rank(items);
    expect(result.feed.slice(0, 10).some((item) => item.news.id === 'minor')).toBe(true);
    noTriples(result.feed);
    expect(new Set(result.feed.map((item) => item.news.id)).size).toBe(items.length);
  });

  it('preserves enough separators for the tail when a valid no-triples order exists', () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) =>
        domestic(`politics-${i}`, { topics: ['politica'], importance: 2 }),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        domestic(`sports-${i}`, { topics: ['deportes'], importance: 0 }),
      ),
    ];
    const result = rank(items);
    noTriples(result.feed);
    expect(result.feed).toHaveLength(9);
  });

  it('preserves all stories and available quotas even when a single topic makes diversity impossible', () => {
    const items = [
      ...Array.from({ length: 12 }, (_, i) => domestic(`same-${i}`)),
      foreign('foreign'),
    ];
    const result = rank(items);
    expect(result.feed).toHaveLength(13);
    expect(result.feed.slice(0, 10).some((item) => item.news.id === 'foreign')).toBe(true);
  });

  it('counts all topics and actual scopes only in the regular top ten', () => {
    const items = Array.from({ length: 12 }, (_, i) =>
      domestic(`${i}`, { topics: i % 2 ? ['salud', 'ciencia'] : ['economia'] }),
    );
    const result = rank(items);
    expect(result.diversity).toEqual({
      topics: 3,
      scopes: { local: 0, nacional: 10, regional: 0, internacional: 0, global: 0 },
    });
  });
});

describe('scores, tiers and stable output', () => {
  it('applies the weighted sum and read multiplier only in personalized mode', () => {
    const item = domestic('read');
    const result = rank([item], { profile: { ...profile, readNewsIds: ['read'] } }).feed[0]!;
    expect(result.score).toBeCloseTo((0.35 / 3 + 0.3 * 0.75 + 0.2 * 0.3 + 0.15) * 0.35);
    expect(result.components.penalties).toBe(0.35);
    expect(
      rank([item], { profile: { ...profile, personalization: false, readNewsIds: ['read'] } })
        .feed[0]!.components.penalties,
    ).toBe(1);
  });

  it('essential with actual affinity zero beats routine with actual affinity one under default weights', () => {
    const p = { ...profile, interests: { salud: 0, deportes: 10 } };
    const high = scoreNews(
      domestic('essential', { importance: 3 }),
      p,
      LOCATIONS[0]!,
      now,
      DEFAULT_RANKING_WEIGHTS,
    );
    const low = scoreNews(
      domestic('routine', { importance: 0, topics: ['deportes'] }),
      p,
      LOCATIONS[0]!,
      now,
      DEFAULT_RANKING_WEIGHTS,
    );
    expect(high.components.affinity).toBe(0);
    expect(low.components.affinity).toBe(1);
    expect(high.score).toBeGreaterThan(low.score);
  });

  it('uses provided config weights and the explicit location instead of the stored profile location', () => {
    const local = story('local', {
      geo: { scope: 'local', countries: ['GT'], cityIds: ['gt-quetzaltenango'], regions: [] },
    });
    expect(
      rank([local], { locationId: 'gt-quetzaltenango', weights: { wI: 0, wG: 1, wA: 0, wR: 0 } })
        .feed[0]!.score,
    ).toBe(1);
  });

  it('uses deterministic id tie-breaking even if input order changes', () => {
    const items = [story('z'), story('a'), story('b')];
    expect(rank(items).feed.map((item) => item.news.id)).toEqual(['a', 'b', 'z']);
    expect(rank([...items].reverse())).toEqual(rank(items));
  });

  it('assigns base tiers and caps high-score upgrades at three large cards', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ ...score(story(`${i}`)), score: 0.5 }));
    expect(assignTiers(items).map((item) => item.tier)).toEqual([
      'hero',
      'grande',
      'grande',
      'mediana',
      'mediana',
      'mediana',
      'mediana',
      'mediana',
      'mediana',
      'compacta',
      'compacta',
      'compacta',
    ]);
    const upgraded = assignTiers(items.map((item) => ({ ...item, score: 0.85 })));
    expect(upgraded.filter((item) => item.tier === 'grande')).toHaveLength(3);
    expect(upgraded[3]!.tier).toBe('grande');
    expect(upgraded[9]!.tier).toBe('compacta');
  });

  it('provides schema-valid empty and populated outputs for every location', () => {
    expect(rankedFeedSchema.safeParse(rank([])).success).toBe(true);
    for (const location of LOCATIONS) {
      const result = rank(buildSeedNews(corpus as SeedNews[], now), { locationId: location.id });
      expect(rankedFeedSchema.safeParse(result).success).toBe(true);
    }
  });

  it('rejects unknown locations, invalid dates and explicit invalid weights', () => {
    expect(() => rank([], { locationId: 'gps' })).toThrow('Unknown simulated location');
    expect(() => rank([], { now: new Date('invalid') })).toThrow('Invalid ranking date');
    expect(() => rank([], { weights: { wI: 0, wG: 0, wA: 0, wR: 0 } })).toThrow();
  });
});
