import type { ApiEnv } from '@repo/shared';

export interface Bindings {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai;
  ADMIN_UIDS?: string;
  FIREBASE_PROJECT_ID: string;
  ENV: ApiEnv;
  ALLOWED_ORIGINS: string;
}

export interface Variables {
  uid: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
