import { describe, expect, it } from 'vitest';
import { newsLabels, relativePublishedAt } from '../apps/mobile/src/feed/presentation';
import corpus from '../packages/shared/fixtures/news.json';
import { createDefaultProfile } from '../packages/shared/src/profile';
import { rankFeed } from '../packages/shared/src/ranking/rankFeed';
import { buildSeedNews, type SeedNews } from '../packages/shared/src/seed';
import type { UserProfile } from '../packages/shared/src/types';

const now = new Date('2026-10-09T12:00:00.000Z');
const news = buildSeedNews(corpus as SeedNews[], now);
const personas: UserProfile[] = [
  { ...createDefaultProfile('sports', 'Deportes', 'gt-guatemala', now), interests: { deportes: 10 } },
  createDefaultProfile('neutral', 'Sin historial', 'gt-quetzaltenango', now),
  {
    ...createDefaultProfile('tech', 'Tecnología', 'mx-cdmx', now),
    interests: { tecnologia: 10 },
    mutedTopics: ['politica'],
  },
  { ...createDefaultProfile('economy', 'Economía', 'es-madrid', now), interests: { economia: 10 } },
];

describe('F3-04 feed presentation data', () => {
  it('gives the four seed personas visibly different lead stories and tier hierarchies', () => {
    const ranked = personas.map((profile) =>
      rankFeed({ news, profile, locationId: profile.locationId, now }),
    );
    const signatures = ranked.map((result) => result.feed.slice(0, 5).map((item) => item.news.id).join(','));
    expect(new Set(signatures).size).toBe(4);
    for (const result of ranked) {
      expect(result.feed[0]?.tier).toBe('hero');
      expect(result.feed.slice(1, 3).map((item) => item.tier)).toEqual(['grande', 'grande']);
      expect(result.feed.some((item) => item.tier === 'mediana')).toBe(true);
      expect(result.feed.some((item) => item.tier === 'compacta')).toBe(true);
      expect(result.mustKnow.every((item) => item.guaranteedBy === 'esencial')).toBe(true);
    }
  });

  it('provides a topic and scope chip for every visible corpus story, plus a certainty chip when needed', () => {
    for (const story of news.filter((item) => item.certainty !== 'retractada')) {
      const labels = newsLabels(story);
      expect(labels.topic).toBeTruthy();
      expect(labels.scope).toBeTruthy();
      expect(labels.certainty === null).toBe(story.certainty === 'confirmada');
    }
    expect(newsLabels(news.find((item) => item.certainty === 'en_desarrollo')!).certainty).toBe(
      'En desarrollo',
    );
    expect(newsLabels(news.find((item) => item.certainty === 'disputada')!).certainty).toBe(
      'En disputa',
    );
  });

  it('formats relative publication time in Spanish and older dates in Guatemala time', () => {
    expect(relativePublishedAt(now.toISOString(), now)).toBe('Ahora');
    expect(relativePublishedAt(new Date(+now - 23 * 60_000).toISOString(), now)).toBe(
      'Hace 23 min',
    );
    expect(relativePublishedAt(new Date(+now - 26 * 3_600_000).toISOString(), now)).toBe('Ayer');
    expect(relativePublishedAt('2026-10-03T02:00:00.000Z', now)).toMatch(/2 oct/i);
  });
});
