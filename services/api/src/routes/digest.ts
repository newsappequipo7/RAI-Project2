import { findLocation } from '@repo/shared';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { invalidInput } from '../errors';
import { getDigest } from '../rag/digest';

export const digestRoutes = new Hono<AppEnv>().get('/digest/:locationId', async (c) => {
  const locationId = c.req.param('locationId');
  if (!findLocation(locationId)) throw invalidInput(`Unknown location: ${locationId}`);
  return c.json(await getDigest(locationId, { env: c.env, uid: c.get('uid') }));
});
