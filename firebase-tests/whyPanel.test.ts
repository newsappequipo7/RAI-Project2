import { describe, expect, it } from 'vitest';
import { contributionBars } from '../apps/mobile/src/feed/contributions';
import corpus from '../packages/shared/fixtures/news.json';
import { DEFAULT_RANKING_WEIGHTS } from '../packages/shared/src/config/feed';
import { updateInterests } from '../packages/shared/src/interests/update';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { UserProfile } from '../packages/shared/src/types';

const now = new Date('2026-10-09T12:00:00Z');
const news = buildSeedNews(corpus as SeedNews[], now);
const profile: UserProfile = {
  ...createDefaultProfile('reader', 'Lector', 'gt-guatemala', now),
  interests: { deportes: 6 },
};
const ranked = (reader = profile) =>
  rankFeed({ news, profile: reader, locationId: reader.locationId, now });

describe('F3-06 explanation panel data', () => {
  it('bars add up to the actual rank score for ordinary and essential stories', () => {
    const result = ranked();
    for (const item of [...result.feed, ...result.mustKnow]) {
      const bars = contributionBars(item, DEFAULT_RANKING_WEIGHTS, profile.personalization);
      expect(bars.reduce((sum, bar) => sum + bar.value, 0)).toBeCloseTo(item.score, 10);
      expect(bars.every((bar) => bar.value >= 0 && bar.value <= 1)).toBe(true);
      if (item.guaranteedBy === 'esencial') expect(bars[2]?.value).toBe(0);
    }
  });

  it('less-like-this lowers matching feed scores on the next ranking but keeps essentials unchanged', () => {
    const before = ranked();
    const sports = before.feed.find((item) => item.news.topics.includes('deportes'))!;
    const changed = updateInterests({
      profile,
      signal: { type: 'less_like_this', topics: ['deportes'] },
      now,
    });
    const after = ranked(changed);
    expect(after.feed.find((item) => item.news.id === sports.news.id)!.score).toBeLessThan(
      sports.score,
    );
    expect(after.mustKnow).toEqual(before.mustKnow);
  });
});
