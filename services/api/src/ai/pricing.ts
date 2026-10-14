import type { AiUsage, ProviderName } from './types';

interface TokenRates {
  inputPerMTok: number;
  outputPerMTok: number;
}

interface ModelPrice extends TokenRates {
  longPrompt?: { thresholdTokens: number; rates: TokenRates };
}

// Verified 2026-10-12 at https://platform.claude.com/docs/en/about-claude/pricing (base rates, no caching or batch).
// Claude Haiku 5.5: $0.10 / $0.50 per MTok up to 100k prompt tokens, $0.50 / $2.50 for longer prompts.
// Claude Haiku 4.5: $1 / MTok input, $5 / MTok output.
// The gateway never enables prompt caching, so cache read/write tokens are not priced here.
const HAIKU_4_5_PRICE: ModelPrice = { inputPerMTok: 1, outputPerMTok: 5 };
const HAIKU_5_5_PRICE: ModelPrice = {
  inputPerMTok: 0.1,
  outputPerMTok: 0.5,
  longPrompt: { thresholdTokens: 100_000, rates: { inputPerMTok: 0.5, outputPerMTok: 2.5 } },
};

const ANTHROPIC_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': HAIKU_5_5_PRICE,
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

function ratesFor(price: ModelPrice, usage: AiUsage): TokenRates {
  const { longPrompt } = price;
  return longPrompt && usage.inputTokens > longPrompt.thresholdTokens ? longPrompt.rates : price;
}

export function computeCostUsd(price: ModelPrice, usage: AiUsage): number {
  const rates = ratesFor(price, usage);
  return (
    (usage.inputTokens / TOKENS_PER_MTOK) * rates.inputPerMTok +
    (usage.outputTokens / TOKENS_PER_MTOK) * rates.outputPerMTok
  );
}
