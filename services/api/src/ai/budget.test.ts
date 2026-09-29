import { describe, expect, it } from 'vitest';
import { applyBudgetToFlags, evaluateBudget } from './budget';
import { computeCostUsd, findModelPrice } from './pricing';

describe('evaluateBudget', () => {
  it.each([
    [0, 'normal'],
    [7.99, 'normal'],
    [8, 'warn'],
    [10.99, 'warn'],
    [11, 'soft'],
    [12.99, 'soft'],
    [13, 'hard'],
    [19.99, 'hard'],
    [20, 'exhausted'],
    [25, 'exhausted'],
  ] as const)('maps $%f spent to %s', (spent, level) => {
    expect(evaluateBudget(spent)).toBe(level);
  });
});

describe('applyBudgetToFlags', () => {
  const flags = { killSwitch: false, imageGenEnabled: true, chatMode: 'full' } as const;

  it('leaves the flags alone under the warning threshold', () => {
    expect(applyBudgetToFlags(flags, 'normal', 'dev')).toEqual(flags);
  });

  it('disables image generation from the warning threshold on, in any env', () => {
    expect(applyBudgetToFlags(flags, 'warn', 'dev').imageGenEnabled).toBe(false);
    expect(applyBudgetToFlags(flags, 'warn', 'demo').imageGenEnabled).toBe(false);
  });

  it('switches the chat to retrieval_only from the soft threshold, in dev only', () => {
    expect(applyBudgetToFlags(flags, 'warn', 'dev').chatMode).toBe('full');
    expect(applyBudgetToFlags(flags, 'soft', 'dev').chatMode).toBe('retrieval_only');
    expect(applyBudgetToFlags(flags, 'soft', 'demo').chatMode).toBe('full');
  });
});

describe('pricing', () => {
  it('computes Haiku 4.5 cost as (in/1e6)*1 + (out/1e6)*5', () => {
    const price = findModelPrice('anthropic', 'claude-haiku-4-5-20251001');

    expect(price).not.toBeNull();
    expect(computeCostUsd(price!, { inputTokens: 3000, outputTokens: 400 })).toBeCloseTo(0.005, 10);
  });

  it('returns null for an unpriced Anthropic model instead of guessing', () => {
    expect(findModelPrice('anthropic', 'claude-mystery')).toBeNull();
  });

  it('prices mock and Workers AI calls at zero', () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000 };

    expect(computeCostUsd(findModelPrice('mock', 'x')!, usage)).toBe(0);
    expect(computeCostUsd(findModelPrice('workers-ai', '@cf/baai/bge-m3')!, usage)).toBe(0);
  });
});
