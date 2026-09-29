import { providerError } from '../../errors';
import { MOCK_EMBEDDING_DIMENSION, MOCK_TEXT_BY_TASK } from '../mocks/fixtures';
import type { Provider } from '../types';

const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;
const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const UINT32_RANGE = 2 ** 32;

function hashText(text: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash;
}

function deterministicEmbedding(text: string): number[] {
  let state = hashText(text);
  const values: number[] = [];

  for (let index = 0; index < MOCK_EMBEDDING_DIMENSION; index += 1) {
    state = (Math.imul(state, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
    values.push((state / UINT32_RANGE) * 2 - 1);
  }

  const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return values.map((value) => value / norm);
}

export const callMock: Provider = async ({ task, input }) => {
  const usage = { inputTokens: 0, outputTokens: 0 };

  if (input.kind === 'embed') {
    return {
      output: { kind: 'embed', embeddings: input.texts.map(deterministicEmbedding) },
      usage,
    };
  }

  if (task === 'embed' || task === 'image_generate') {
    throw providerError(`Mock provider has no fixture for task ${task}`);
  }

  return { output: { kind: 'text', text: MOCK_TEXT_BY_TASK[task] }, usage };
};
