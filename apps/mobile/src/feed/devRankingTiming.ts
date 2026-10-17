import { rankFeed } from '@repo/shared';

const BENCHMARK_NEWS_COUNT = 200;
const TIMING_RUNS = 5;

type RankFeedInput = Parameters<typeof rankFeed>[0];

function medianMs(run: () => void): number {
  const durations = Array.from({ length: TIMING_RUNS }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((a, b) => a - b);
  return durations[Math.floor(TIMING_RUNS / 2)] ?? 0;
}

function replicateNews(news: RankFeedInput['news'], count: number): RankFeedInput['news'] {
  if (news.length === 0) return news;
  return Array.from({ length: count }, (_, index) => {
    const source = news[index % news.length]!;
    return { ...source, id: `${source.id}#${index}` };
  });
}

/** Development-only measurement for F3-02 CA2; the caller must guard it with `__DEV__`. */
export function logRankingTiming(input: RankFeedInput): void {
  const real = medianMs(() => rankFeed(input));
  const replicated = medianMs(() =>
    rankFeed({ ...input, news: replicateNews(input.news, BENCHMARK_NEWS_COUNT) }),
  );
  console.log(
    `[ranking-timing] n=${input.news.length}: ${real.toFixed(1)} ms | ` +
      `n=${BENCHMARK_NEWS_COUNT} (replicas): ${replicated.toFixed(1)} ms | median of ${TIMING_RUNS} runs`,
  );
}
