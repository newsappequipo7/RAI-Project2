import type { Location } from '../catalogs/locations';
import { MUST_KNOW_WINDOW_HOURS } from '../config/feed';
import type { News, RankedItem } from '../types';
import { proximity } from './proximity';
import { MS_PER_HOUR } from './recency';

export function isEssential(news: News, location: Location, now: Date): boolean {
  const age = now.getTime() - Date.parse(news.publishedAt!);
  return (
    news.importance === 3 &&
    age >= 0 &&
    age <= MUST_KNOW_WINDOW_HOURS * MS_PER_HOUR &&
    (proximity(news.geo, location) >= 0.4 || news.geo.scope === 'global')
  );
}

const isDomestic = (item: RankedItem, country: string) => item.news.geo.countries.includes(country);

/** Promotions use one-based positions 5 and 8, clamped for a shorter feed. */
export function applyQuotas(items: RankedItem[], country: string): RankedItem[] {
  const result = [...items];
  for (const domestic of [true, false]) {
    const matches = (item: RankedItem) => isDomestic(item, country) === domestic;
    if (result.slice(0, 10).some(matches)) continue;
    const index = result.findIndex(matches);
    if (index < 0) continue;
    const [item] = result.splice(index, 1);
    result.splice(Math.min(domestic ? 4 : 7, result.length), 0, {
      ...item!,
      guaranteedBy: domestic ? 'cuota_nacional' : 'cuota_internacional',
    });
  }
  return result;
}

/** Keep both available quota groups in top ten while greedily spreading primary topics. */
export function diversify(items: RankedItem[], country: string): RankedItem[] {
  const remaining = [...items];
  const result: RankedItem[] = [];
  const required = new Set(items.map((item) => isDomestic(item, country)));
  const seen = new Set<boolean>();
  const limit = Math.min(10, items.length);
  const counts = new Map<string | undefined, number>();
  items.forEach((item) =>
    counts.set(item.news.topics[0], (counts.get(item.news.topics[0]) ?? 0) + 1),
  );
  while (remaining.length) {
    const position = result.length;
    const respectsQuotas = (item: RankedItem) => {
      if (position >= limit) return true;
      const group = isDomestic(item, country);
      const missing = [...required].filter((value) => !seen.has(value) && value !== group).length;
      return missing <= limit - position - 1;
    };
    const avoidsTriple = (item: RankedItem) =>
      position < 2 ||
      item.news.topics[0] !== result[position - 1]!.news.topics[0] ||
      item.news.topics[0] !== result[position - 2]!.news.topics[0];
    const leavesSeparators = (item: RankedItem) => {
      const topic = item.news.topics[0];
      const run = position > 0 && result[position - 1]!.news.topics[0] === topic ? 2 : 1;
      const left = remaining.length - 1;
      for (const [key, count] of counts) {
        const after = count - (key === topic ? 1 : 0);
        // Other topics supply separators: each gap can hold at most two of this topic.
        if (after > 2 * (left - after + 1) - (key === topic ? run : 0)) return false;
      }
      return true;
    };
    const leavesQuotaSeparator = (item: RankedItem) => {
      if (position !== limit - 2) return true;
      const missing = [...required].find(
        (value) => !seen.has(value) && value !== isDomestic(item, country),
      );
      if (missing === undefined) return true;
      return remaining.some(
        (next) =>
          next !== item &&
          isDomestic(next, country) === missing &&
          (position === 0 ||
            next.news.topics[0] !== item.news.topics[0] ||
            next.news.topics[0] !== result[position - 1]!.news.topics[0]),
      );
    };
    let index = remaining.findIndex(
      (item) =>
        respectsQuotas(item) &&
        avoidsTriple(item) &&
        leavesSeparators(item) &&
        leavesQuotaSeparator(item),
    );
    if (index < 0)
      index = remaining.findIndex((item) => respectsQuotas(item) && avoidsTriple(item));
    // When the corpus makes diversity impossible, preserve every story and prioritize quotas.
    if (index < 0) index = remaining.findIndex(respectsQuotas);
    const [item] = remaining.splice(index, 1);
    result.push(item!);
    const topic = item!.news.topics[0];
    counts.set(topic, counts.get(topic)! - 1);
    seen.add(isDomestic(item!, country));
  }
  return result;
}
