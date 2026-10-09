import { describe, expect, it } from 'vitest';
import corpus from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import { createDefaultProfile } from '../profile';
import { rankFeed } from '../ranking/rankFeed';
import type { News, UserProfile } from '../types';
import { updateInterests } from './update';

const now = new Date('2026-10-09T12:00:00.000Z');
const profile = createDefaultProfile('reader', 'Lector', 'gt-guatemala', now);
const base = buildSeedNews(corpus as SeedNews[], now)[0]!;
const news: News[] = [
  ...['cultura', 'salud', 'economia', 'deportes'].map((topic, index): News => ({
    ...base,
    id: `unread-${index}`,
    importance: 1,
    topics: [topic],
    publishedAt: now.toISOString(),
  })),
  { ...base, id: 'essential', importance: 3, topics: ['politica'] },
];
const rank = (profile: UserProfile) =>
  rankFeed({ news, profile, locationId: profile.locationId, now });

function readThreeSportsStories() {
  let learned = profile;
  for (let i = 0; i < 3; i++) {
    learned = updateInterests({
      profile: learned,
      signal: { type: 'open', topics: ['deportes'] },
      now,
    });
    learned = updateInterests({
      profile: learned,
      signal: { type: 'dwell', topics: ['deportes'], seconds: 20 },
      now,
    });
  }
  // The app will also maintain readNewsIds; prospective ranked stories here are unread.
  return { ...learned, readNewsIds: ['read-sports-1', 'read-sports-2', 'read-sports-3'] };
}

describe('pure interest/ranking integration (phone UI remains pending)', () => {
  it('three reading sessions increase the position and score of an unread sports story', () => {
    const learned = readThreeSportsStories();
    expect(learned.interests.deportes).toBe(4.5);
    const before = rank(profile);
    const after = rank(learned);
    expect(after.feed.findIndex((item) => item.news.id === 'unread-3')).toBeLessThan(
      before.feed.findIndex((item) => item.news.id === 'unread-3'),
    );
    expect(after.feed.find((item) => item.news.id === 'unread-3')!.score).toBeGreaterThan(
      before.feed.find((item) => item.news.id === 'unread-3')!.score,
    );
    expect(after.mustKnow).toEqual(before.mustKnow);
  });

  it('less-like-this lowers the regular score, preserves essentials, and more-like-this reverses the mute', () => {
    const interested = updateInterests({
      profile,
      signal: { type: 'more_like_this', topics: ['deportes', 'politica'] },
      now,
    });
    const less = updateInterests({
      profile: interested,
      signal: { type: 'less_like_this', topics: ['deportes', 'politica'] },
      now,
    });
    expect(less.mutedTopics).toEqual(['deportes', 'politica']);
    expect(rank(less).feed.find((item) => item.news.id === 'unread-3')!.score).toBeLessThan(
      rank(interested).feed.find((item) => item.news.id === 'unread-3')!.score,
    );
    expect(rank(less).mustKnow).toEqual(rank(interested).mustKnow);
    const more = updateInterests({
      profile: less,
      signal: { type: 'more_like_this', topics: ['deportes'] },
      now,
    });
    expect(more.mutedTopics).toEqual(['politica']);
    expect(rank(more).feed.find((item) => item.news.id === 'unread-3')!.score).toBeGreaterThan(
      rank(less).feed.find((item) => item.news.id === 'unread-3')!.score,
    );
  });

  it('disabling personalization produces identical feeds despite learned interests and history', () => {
    const learned = readThreeSportsStories();
    expect(rank({ ...learned, personalization: false })).toEqual(
      rank({ ...profile, personalization: false }),
    );
  });

  it('reset restores the neutral ranking for the same read history', () => {
    const learned = readThreeSportsStories();
    const reset = updateInterests({ profile: learned, signal: { type: 'reset' }, now });
    expect(rank(reset)).toEqual(rank({ ...profile, readNewsIds: learned.readNewsIds }));
  });
});
