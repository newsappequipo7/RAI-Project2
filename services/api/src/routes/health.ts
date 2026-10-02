import type { HealthResponse } from '@repo/shared';
import { Hono } from 'hono';
import { isLiveMode } from '../ai/config';
import type { AppEnv } from '../env';
import { readFlags, readIndexVersion } from '../kv';

export const healthRoutes = new Hono<AppEnv>().get('/health', async (c) => {
  const [flags, indexVersion] = await Promise.all([readFlags(c.env.KV), readIndexVersion(c.env.KV)]);
  const body: HealthResponse = {
    ok: true,
    indexVersion,
    flags,
    env: c.env.ENV,
    aiMode: isLiveMode(c.env) ? 'live' : 'mock',
  };
  return c.json(body);
});
