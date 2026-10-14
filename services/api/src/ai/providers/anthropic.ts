import Anthropic from '@anthropic-ai/sdk';
import { providerError } from '../../errors';
import type { Provider } from '../types';

const MAX_RETRIES = 1;
const ADAPTIVE_THINKING_MODEL_PREFIX = 'claude-haiku-5';

// Haiku 5.5 thinks by default, and thinking tokens count against max_tokens.
function thinkingOptions(model: string) {
  return model.startsWith(ADAPTIVE_THINKING_MODEL_PREFIX)
    ? { output_config: { effort: 'low' as const } }
    : {};
}

export const callAnthropic: Provider = async ({ env, model, input }) => {
  if (input.kind !== 'text') {
    throw providerError('Anthropic provider only supports text tasks');
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw providerError('AI provider is not configured');
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: MAX_RETRIES });

  try {
    const response = await client.messages.create({
      model,
      max_tokens: input.maxTokens,
      ...thinkingOptions(model),
      system: input.system,
      messages: [{ role: 'user', content: input.prompt }],
    });

    const text = response.content
      .flatMap((block) => (block.type === 'text' ? [block.text] : []))
      .join('');

    return {
      output: { kind: 'text', text },
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw providerError(`Provider request failed (${error.status ?? 'network'})`);
    }

    throw error;
  }
};
