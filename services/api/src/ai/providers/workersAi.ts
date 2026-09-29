import { providerError } from '../../errors';
import type { Provider } from '../types';

interface WorkersAiRunner {
  run(model: string, input: unknown): Promise<unknown>;
}

interface EmbeddingResponse {
  data?: number[][];
}

export const callWorkersAi: Provider = async ({ env, model, input }) => {
  if (input.kind !== 'embed') {
    throw providerError('Workers AI provider only supports embeddings');
  }

  const runner = env.AI as unknown as WorkersAiRunner;
  const response = (await runner.run(model, { text: input.texts })) as EmbeddingResponse;

  if (!response.data || response.data.length !== input.texts.length) {
    throw providerError('Workers AI returned an unexpected embedding response');
  }

  return {
    output: { kind: 'embed', embeddings: response.data },
    usage: { inputTokens: 0, outputTokens: 0 },
  };
};
