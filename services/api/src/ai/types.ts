import type { AiTask, ApiEnv, CallOutcome } from '@repo/shared';
import type { Bindings } from '../env';

export type ProviderName = 'mock' | 'anthropic' | 'workers-ai';

export interface TaskRoute {
  provider: ProviderName;
  model: string;
}

export type AiInput =
  | { kind: 'text'; system?: string; prompt: string; maxTokens: number }
  | { kind: 'embed'; texts: string[] };

export type AiOutput =
  | { kind: 'text'; text: string }
  | { kind: 'embed'; embeddings: number[][] };

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderCall {
  task: AiTask;
  model: string;
  input: AiInput;
  env: Bindings;
}

export interface ProviderResult {
  output: AiOutput;
  usage: AiUsage;
}

export type Provider = (call: ProviderCall) => Promise<ProviderResult>;

export interface GatewayContext {
  env: Bindings;
  uid?: string;
  now?: () => Date;
  providers?: Partial<Record<ProviderName, Provider>>;
}

export interface GatewayResult extends ProviderResult {
  costUsd: number;
  model: string;
  provider: ProviderName;
}

export interface CallRecord {
  id: string;
  ts: string;
  task: AiTask;
  provider: ProviderName;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  uid: string | null;
  cached: boolean;
  outcome: CallOutcome;
  env: ApiEnv;
}
