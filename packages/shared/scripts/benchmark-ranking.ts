import { cpus } from 'node:os';
import corpus from '../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../src/seed';
import { createDefaultProfile } from '../src/profile';
import { rankFeed } from '../src/ranking/rankFeed';
import type { News, RankFeedInput } from '../src/types';

// Desktop diagnostic only: CA2 still requires measuring inside Expo Go on a real phone.
const now = new Date('2026-10-09T12:00:00.000Z');
const source = buildSeedNews(corpus as SeedNews[], now).filter(
  (item) => item.certainty !== 'retractada',
);
const news: News[] = Array.from({ length: 200 }, (_, index) => ({
  ...source[index % source.length]!,
  id: `benchmark-${index}`,
}));
const input: RankFeedInput = {
  news,
  profile: createDefaultProfile('benchmark', 'Prueba', 'gt-guatemala', now),
  locationId: 'gt-guatemala',
  now,
};

function measure(scenario: string, input: RankFeedInput) {
  for (let i = 0; i < 100; i++) rankFeed(input);
  const samples = Array.from({ length: 1000 }, () => {
    const start = performance.now();
    rankFeed(input);
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return {
    scenario,
    stories: input.news.length,
    runs: samples.length,
    medianMs: samples[500],
    p95Ms: samples[950],
    maxMs: samples[999],
  };
}

console.log(
  JSON.stringify(
    {
      runtime: process.version,
      platform: `${process.platform}/${process.arch}`,
      cpu: cpus()[0]?.model,
      phoneAcceptanceVerified: false,
      results: [
        measure('fixed-corpus-expanded', input),
        measure('concentrated-topics', {
          ...input,
          news: news.map((item, index) => ({
            ...item,
            importance: index < 68 ? 2 : 0,
            topics: [index < 68 ? 'salud' : 'economia'],
          })),
        }),
      ],
    },
    null,
    2,
  ),
);
