import { findLocation } from '../catalogs/locations';
import { DEFAULT_RANKING_WEIGHTS } from '../config/feed';
import { rankingWeightsSchema } from '../schemas';
import { buildReasons } from '../explain/reasons';
import type { RankedFeed, RankFeedInput } from '../types';
import { applyQuotas, diversify, isEssential } from './antibubble';
import { compareIds, compareScores, normalizeWeights, scoreNews } from './score';
import { assignTiers } from './tiers';

export function rankFeed({
  news,
  profile,
  locationId,
  now,
  weights = DEFAULT_RANKING_WEIGHTS,
}: RankFeedInput): RankedFeed {
  const location = findLocation(locationId);
  if (!location) throw new Error(`Unknown simulated location: ${locationId}`);
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid ranking date');
  const validatedWeights = rankingWeightsSchema.parse(weights);
  const personalizedWeights = normalizeWeights(validatedWeights, profile.personalization);
  const neutralWeights = normalizeWeights(validatedWeights, false);
  const neutralProfile = { ...profile, personalization: false };
  const mustKnow: RankedFeed['mustKnow'] = [];
  const candidates: RankedFeed['feed'] = [];
  // F3-01 owns the configurable feed window and merges/deduplicates Firestore queries.
  for (const item of news) {
    const published = Date.parse(item.publishedAt ?? '');
    if (
      item.workflow !== 'publicada' ||
      item.certainty === 'retractada' ||
      !Number.isFinite(published) ||
      published > now.getTime()
    )
      continue;
    if (isEssential(item, location, now)) {
      mustKnow.push({
        ...scoreNews(item, neutralProfile, location, now, neutralWeights),
        guaranteedBy: 'esencial',
      });
    } else {
      candidates.push(scoreNews(item, profile, location, now, personalizedWeights));
    }
  }
  mustKnow.sort(
    (a, b) =>
      Date.parse(b.news.publishedAt!) - Date.parse(a.news.publishedAt!) ||
      compareIds(a.news.id, b.news.id),
  );
  const feed = assignTiers(
    diversify(
      applyQuotas(candidates.sort(compareScores), location.countryIso),
      location.countryIso,
    ),
  ).map((item) => ({
    ...item,
    reasons: buildReasons(item, location, profile, personalizedWeights),
  }));
  const scopes: RankedFeed['diversity']['scopes'] = {
    local: 0,
    nacional: 0,
    regional: 0,
    internacional: 0,
    global: 0,
  };
  const topics = new Set<string>();
  for (const item of feed.slice(0, 10)) {
    scopes[item.news.geo.scope]++;
    item.news.topics.forEach((topic) => topics.add(topic));
  }
  return {
    mustKnow: mustKnow.map((item) => ({
      ...item,
      reasons: buildReasons(item, location, neutralProfile, neutralWeights),
    })),
    feed,
    diversity: { topics: topics.size, scopes },
  };
}
