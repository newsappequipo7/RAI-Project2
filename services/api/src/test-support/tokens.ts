import { generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { createTestD1 } from './d1';
import { fakeKv } from './kv';
import type { Bindings } from '../env';

export const PROJECT_ID = 'test-project';
export const ADMIN_UID = 'admin-uid';
export const USER_UID = 'user-uid';

export interface TestKeys {
  signingKey: CryptoKey;
  verificationKey: CryptoKey;
  foreignSigningKey: CryptoKey;
}

export async function createTestKeys(): Promise<TestKeys> {
  const pair = await generateKeyPair('RS256');
  const foreign = await generateKeyPair('RS256');

  return {
    signingKey: pair.privateKey,
    verificationKey: pair.publicKey,
    foreignSigningKey: foreign.privateKey,
  };
}

export interface TokenOptions {
  uid?: string;
  audience?: string;
  issuer?: string;
  expiresIn?: string;
  key?: CryptoKey;
}

export function signToken(
  keys: TestKeys,
  {
    uid = USER_UID,
    audience = PROJECT_ID,
    issuer = `https://securetoken.google.com/${PROJECT_ID}`,
    expiresIn = '1h',
    key = keys.signingKey,
  }: TokenOptions = {},
) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setSubject(uid)
    .setAudience(audience)
    .setIssuer(issuer)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key);
}

export function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: createTestD1().d1,
    KV: fakeKv(),
    AI: {} as Ai,
    ADMIN_UIDS: ` ${ADMIN_UID} , other-admin`,
    FIREBASE_PROJECT_ID: PROJECT_ID,
    ENV: 'dev',
    ALLOWED_ORIGINS: 'https://portal.example',
    ...overrides,
  };
}
