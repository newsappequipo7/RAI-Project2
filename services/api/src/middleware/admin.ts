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

export function isAdminUid(adminUids: string | undefined, uid: string): boolean {
  return parseUidList(adminUids).has(uid);
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!isAdminUid(c.env.ADMIN_UIDS, c.var.uid)) {
    throw forbidden();
  }

  await next();
};
