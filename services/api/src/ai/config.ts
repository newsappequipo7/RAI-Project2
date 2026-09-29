import type { AiTask } from '@repo/shared';
import type { Bindings } from '../env';
import type { TaskRoute } from './types';

// ADR-009: Claude Haiku 4.5 is the default LLM; ADR-008: Workers AI bge-m3 for embeddings.
export const DEFAULT_LLM_MODEL = 'claude-haiku-4-5-20251001';
export const EMBEDDING_MODEL = '@cf/baai/bge-m3';

const WORKERS_AI_MODEL_PREFIX = '@cf/';

const MOCK_ROUTE: TaskRoute = { provider: 'mock', model: 'mock' };

function routeForModel(model: string): TaskRoute {
  const provider = model.startsWith(WORKERS_AI_MODEL_PREFIX) ? 'workers-ai' : 'anthropic';
  return { provider, model };
}

function configuredModel(task: AiTask, env: Bindings): string | null {
  switch (task) {
    case 'embed':
      return EMBEDDING_MODEL;
    case 'enrich':
      return env.AI_MODEL_ENRICH || DEFAULT_LLM_MODEL;
    case 'chat_answer':
      return env.AI_MODEL_CHAT_ANSWER || DEFAULT_LLM_MODEL;
    case 'digest':
      return env.AI_MODEL_DIGEST || DEFAULT_LLM_MODEL;
    case 'image_generate':
      return null;
  }
}

export function isLiveMode(env: Bindings): boolean {
  return env.AI_MODE === 'live';
}

export function resolveRoute(task: AiTask, env: Bindings): TaskRoute | null {
  if (!isLiveMode(env)) {
    return MOCK_ROUTE;
  }

  const model = configuredModel(task, env);
  return model ? routeForModel(model) : null;
}
