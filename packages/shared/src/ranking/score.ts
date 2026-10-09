import type { Location } from '../catalogs/locations';
import type { News, RankedItem, RankingWeights, UserProfile } from '../types';
import { affinity } from './affinity';
import { proximity } from './proximity';
import { recency } from './recency';

export function normalizeWeights(
  weights: RankingWeights,
  personalization: boolean,
): RankingWeights {
  const wA = personalization ? weights.wA : 0;
  const total = weights.wI + weights.wG + wA + weights.wR;
  return { wI: weights.wI / total, wG: weights.wG / total, wA: wA / total, wR: weights.wR / total };
}

export function scoreNews(
  news: News,
  profile: UserProfile,
  location: Location,
  now: Date,
  weights: RankingWeights,
): RankedItem {
  const components = {
    importance: news.importance / 3,
    proximity: proximity(news.geo, location),
    affinity: affinity(news.topics, profile),
    recency: recency(news.publishedAt!, news.importance, now),
    penalties: profile.personalization && profile.readNewsIds.includes(news.id) ? 0.35 : 1,
  };
  const score =
    (weights.wI * components.importance +
      weights.wG * components.proximity +
      weights.wA * components.affinity +
      weights.wR * components.recency) *
    components.penalties;
  return {
    news,
    components,
    score: Math.min(1, Math.max(0, score)),
    tier: 'compacta',
    reasons: [],
  };
}

/** Codepoint ordering is stable across device locales. */
export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareScores(a: RankedItem, b: RankedItem): number {
  return (
    b.score - a.score ||
    Date.parse(b.news.publishedAt!) - Date.parse(a.news.publishedAt!) ||
    compareIds(a.news.id, b.news.id)
  );
}
