import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';
import { unauthorized } from '../errors';

export type KeyResolver = JWTVerifyGetKey;

const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const BEARER_PREFIX = 'Bearer ';

let firebaseKeys: KeyResolver | undefined;

export function getFirebaseKeyResolver(): KeyResolver {
  firebaseKeys ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return firebaseKeys;
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  return header.slice(BEARER_PREFIX.length).trim() || null;
}

async function verifyFirebaseToken(
  token: string,
  keys: KeyResolver,
  projectId: string,
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (!payload.sub) {
      throw unauthorized();
    }

    return payload.sub;
  } catch {
    throw unauthorized();
  }
}

export function requireAuth(
  resolveKeys: () => KeyResolver = getFirebaseKeyResolver,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractBearerToken(c.req.header('Authorization'));

    if (!token) {
      throw unauthorized();
    }

    const uid = await verifyFirebaseToken(token, resolveKeys(), c.env.FIREBASE_PROJECT_ID);
    c.set('uid', uid);
    await next();
  };
}
