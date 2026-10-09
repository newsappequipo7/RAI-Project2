import { publicFeedConfigSchema } from '../schemas';
import type { PublicFeedConfig, RankingWeights } from '../types';

export const DEFAULT_RANKING_WEIGHTS: Readonly<RankingWeights> = Object.freeze({
  wI: 0.35,
  wG: 0.3,
  wA: 0.2,
  wR: 0.15,
});
export const DEFAULT_FEED_WINDOW_HOURS = 72;
export const MUST_KNOW_WINDOW_HOURS = 72;
export const MUST_KNOW_PREVIEW_LIMIT = 5;

/** Accepts config/public snapshot.data(); never reads Firestore itself. */
export function resolvePublicFeedConfig(value: unknown): PublicFeedConfig {
  const schema = publicFeedConfigSchema.shape;
  const record =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const hours = schema.feedWindowHours.safeParse(record.feedWindowHours);
  const weights = schema.rankingWeights.safeParse(record.rankingWeights);
  const demo = schema.demoMode.safeParse(record.demoMode);
  return {
    feedWindowHours: hours.success ? hours.data : DEFAULT_FEED_WINDOW_HOURS,
    rankingWeights: weights.success ? weights.data : { ...DEFAULT_RANKING_WEIGHTS },
    demoMode: demo.success ? demo.data : false,
  };
}
