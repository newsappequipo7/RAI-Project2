import type { RankedFeed, RankedItem } from '@repo/shared';

/** Only a newly observed ID in a prominent position triggers the banner. */
export function findNewProminentStory(
  previousIds: ReadonlySet<string> | null,
  ranking: RankedFeed,
): RankedItem | null {
  if (!previousIds) return null;
  return (
    [...ranking.mustKnow, ...ranking.feed.slice(0, 3)].find(
      (item) => !previousIds.has(item.news.id),
    ) ?? null
  );
}

export function isProminentStory(id: string, ranking: RankedFeed): boolean {
  return [...ranking.mustKnow, ...ranking.feed.slice(0, 3)].some((item) => item.news.id === id);
}
