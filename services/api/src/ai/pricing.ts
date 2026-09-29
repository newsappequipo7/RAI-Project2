import type { AiUsage, ProviderName } from './types';

interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

// Verified 2026-09-29 at https://platform.claude.com/docs/en/about-claude/pricing
// Claude Haiku 4.5: $1 / MTok input, $5 / MTok output (base rates, no caching or batch).
// The gateway never enables prompt caching, so cache read/write tokens are not priced here.
const HAIKU_4_5_PRICE: ModelPrice = { inputPerMTok: 1, outputPerMTok: 5 };

const ANTHROPIC_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-4-5-20251001': HAIKU_4_5_PRICE,
  'claude-haiku-4-5': HAIKU_4_5_PRICE,
};

const TOKENS_PER_MTOK = 1_000_000;

export function findModelPrice(provider: ProviderName, model: string): ModelPrice | null {
  // Mock calls never leave the Worker and Workers AI embeddings stay inside Cloudflare's free quota.
  if (provider === 'mock' || provider === 'workers-ai') {
    return { inputPerMTok: 0, outputPerMTok: 0 };
  }

  return ANTHROPIC_PRICES[model] ?? null;
}

export function computeCostUsd(price: ModelPrice, usage: AiUsage): number {
  return (
    (usage.inputTokens / TOKENS_PER_MTOK) * price.inputPerMTok +
    (usage.outputTokens / TOKENS_PER_MTOK) * price.outputPerMTok
  );
}
