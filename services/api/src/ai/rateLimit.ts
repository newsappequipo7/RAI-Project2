import { rateLimited } from '../errors';

export const CHAT_RATE_LIMIT_PER_HOUR = 20;

const HOUR_PREFIX_LENGTH = 'YYYY-MM-DDTHH'.length;

function hourWindowStart(now: Date): string {
  return `${now.toISOString().slice(0, HOUR_PREFIX_LENGTH)}:00:00.000Z`;
}

export async function consumeRateLimit(
  db: D1Database,
  uid: string,
  limitPerHour: number,
  now: Date,
): Promise<void> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (uid, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(uid, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    )
    .bind(uid, hourWindowStart(now))
    .first<{ count: number }>();

  if ((row?.count ?? 0) > limitPerHour) {
    throw rateLimited(`Limit of ${limitPerHour} requests per hour reached`);
  }
}
