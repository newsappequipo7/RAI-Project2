import { generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import type { Bindings } from './env';
import { requireAuth } from './middleware/auth';

const PROJECT_ID = 'test-project';
const ADMIN_UID = 'admin-uid';
const USER_UID = 'user-uid';
const PORTAL_ORIGIN = 'https://portal.example';
const EVIL_ORIGIN = 'https://evil.example';

let signingKey: CryptoKey;
let verificationKey: CryptoKey;
let foreignSigningKey: CryptoKey;

interface TokenOptions {
  uid?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
  key?: CryptoKey;
}

function signToken({
  uid = USER_UID,
  audience = PROJECT_ID,
  issuer = `https://securetoken.google.com/${PROJECT_ID}`,
  expiresIn = '1h',
  key = signingKey,
}: TokenOptions = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(uid)
    .setAudience(audience)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

function fakeKv(entries: Record<string, unknown> = {}): KVNamespace {
  return {
    get: async (key: string, type?: string) => {
      const value = entries[key];
      if (value === undefined) return null;
      return type === 'json' ? value : String(value);
    },
  } as unknown as KVNamespace;
}

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    KV: fakeKv(),
    AI: {} as Ai,
    ADMIN_UIDS: ` ${ADMIN_UID} , other-admin`,
    FIREBASE_PROJECT_ID: PROJECT_ID,
    ENV: 'dev',
    ALLOWED_ORIGINS: PORTAL_ORIGIN,
    ...overrides,
  };
}

function buildApp() {
  const resolveKeys = () => async () => verificationKey;
  const app = createApp(resolveKeys);

  app.get('/admin/ping', (c) => c.json({ ok: true }));
  app.get('/boom', () => {
    throw new Error('kaboom');
  });
  app.use('/me', requireAuth(resolveKeys));
  app.get('/me', (c) => c.json({ uid: c.var.uid }));

  return app;
}

async function request(path: string, init: RequestInit = {}, env: Bindings = buildEnv()) {
  return buildApp().request(path, init, env);
}

async function withToken(path: string, token: string, env?: Bindings) {
  return request(path, { headers: { Authorization: `Bearer ${token}` } }, env);
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256');
  signingKey = pair.privateKey;
  verificationKey = pair.publicKey;
  foreignSigningKey = (await generateKeyPair('RS256')).privateKey;
});

describe('GET /health', () => {
  it('is public and returns defaults when KV is empty', async () => {
    const response = await request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      indexVersion: 0,
      flags: { killSwitch: false, imageGenEnabled: false, chatMode: 'full' },
      env: 'dev',
    });
  });

  it('reports stored flags, index version and env', async () => {
    const kv = fakeKv({
      flags: { killSwitch: true, imageGenEnabled: false, chatMode: 'retrieval_only' },
      'rag:index:current': 7,
    });

    const response = await request('/health', {}, buildEnv({ KV: kv, ENV: 'demo' }));

    expect(await response.json()).toEqual({
      ok: true,
      indexVersion: 7,
      flags: { killSwitch: true, imageGenEnabled: false, chatMode: 'retrieval_only' },
      env: 'demo',
    });
  });

  it('falls back to default flags when the stored value is invalid', async () => {
    const kv = fakeKv({ flags: { killSwitch: 'yes' } });

    const response = await request('/health', {}, buildEnv({ KV: kv }));
    const body = (await response.json()) as { flags: unknown };

    expect(body.flags).toEqual({ killSwitch: false, imageGenEnabled: false, chatMode: 'full' });
  });
});

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const response = await request('/me');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: 'unauthorized', message: 'Missing or invalid token' },
    });
  });

  it('rejects a malformed token', async () => {
    expect((await withToken('/me', 'not-a-jwt')).status).toBe(401);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await signToken({ audience: 'another-project' });
    expect((await withToken('/me', token)).status).toBe(401);
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await signToken({ issuer: 'https://evil.example' });
    expect((await withToken('/me', token)).status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ expiresIn: '-1m' });
    expect((await withToken('/me', token)).status).toBe(401);
  });

  it('rejects a token signed by an unknown key', async () => {
    const token = await signToken({ key: foreignSigningKey });
    expect((await withToken('/me', token)).status).toBe(401);
  });

  it('accepts a valid user token and exposes the uid', async () => {
    const response = await withToken('/me', await signToken());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ uid: USER_UID });
  });
});

describe('admin routes', () => {
  it('returns 401 without a token', async () => {
    expect((await request('/admin/ping')).status).toBe(401);
  });

  it('returns 401 on unimplemented admin routes too, before any 404', async () => {
    expect((await request('/admin/costs')).status).toBe(401);
  });

  it('returns 403 for a valid non-admin user', async () => {
    const response = await withToken('/admin/ping', await signToken({ uid: USER_UID }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: { code: 'forbidden', message: 'Admin access required' },
    });
  });

  it('returns 200 for an admin, tolerating spaces in ADMIN_UIDS', async () => {
    const response = await withToken('/admin/ping', await signToken({ uid: ADMIN_UID }));
    expect(response.status).toBe(200);
  });

  it('denies everyone when ADMIN_UIDS is not configured', async () => {
    const token = await signToken({ uid: ADMIN_UID });
    const response = await withToken('/admin/ping', token, buildEnv({ ADMIN_UIDS: undefined }));

    expect(response.status).toBe(403);
  });
});

describe('error handling', () => {
  it('returns the standard body for unknown routes', async () => {
    const response = await request('/nope');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'not_found', message: 'Route not found' },
    });
  });

  it('hides internal error details', async () => {
    const response = await request('/boom');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'internal_error', message: 'Unexpected error' },
    });
  });
});

describe('CORS', () => {
  it('allows the portal origin', async () => {
    const response = await request('/health', { headers: { Origin: PORTAL_ORIGIN } });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(PORTAL_ORIGIN);
  });

  it('does not allow other origins', async () => {
    const response = await request('/health', { headers: { Origin: EVIL_ORIGIN } });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('answers preflight requests for the portal origin', async () => {
    const response = await request('/admin/costs', {
      method: 'OPTIONS',
      headers: {
        Origin: PORTAL_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(PORTAL_ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
