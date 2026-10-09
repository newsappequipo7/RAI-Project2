export const MS_PER_HOUR = 3_600_000;

export function recency(publishedAt: string, importance: number, now: Date): number {
  const hours = Math.max(0, (now.getTime() - Date.parse(publishedAt)) / MS_PER_HOUR);
  return 0.5 ** (hours / (importance >= 2 ? 24 : 18));
}
