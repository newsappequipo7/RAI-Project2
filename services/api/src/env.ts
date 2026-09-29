import type { ApiEnv } from '@repo/shared';

export interface Bindings {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai;
  ADMIN_UIDS?: string;
  ANTHROPIC_API_KEY?: string;
  FIREBASE_PROJECT_ID: string;
  ENV: ApiEnv;
  AI_MODE?: string;
  AI_MODEL_ENRICH?: string;
  AI_MODEL_CHAT_ANSWER?: string;
  AI_MODEL_DIGEST?: string;
  ALLOWED_ORIGINS: string;
}

export interface Variables {
  uid: string;
}

export interface AppEnv {
  Bindings: Bindings;
  Variables: Variables;
}
