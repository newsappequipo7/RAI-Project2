import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { forbidden } from '../errors';

function parseUidList(rawList: string | undefined): Set<string> {
  const uids = (rawList ?? '')
    .split(',')
    .map((uid) => uid.trim())
    .filter(Boolean);

  return new Set(uids);
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!parseUidList(c.env.ADMIN_UIDS).has(c.var.uid)) {
    throw forbidden();
  }

  await next();
};
