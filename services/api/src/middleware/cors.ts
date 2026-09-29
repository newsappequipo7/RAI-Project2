import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

const PREFLIGHT_MAX_AGE_SECONDS = 600;

function parseAllowedOrigins(rawList: string): string[] {
  return rawList
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const corsMiddleware: MiddlewareHandler<AppEnv> = (c, next) =>
  cors({
    origin: (origin) =>
      parseAllowedOrigins(c.env.ALLOWED_ORIGINS).includes(origin) ? origin : null,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
  })(c, next);
