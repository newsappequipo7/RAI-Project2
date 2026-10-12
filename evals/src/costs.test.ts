import type { CostsResponse } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { estimateDemo, renderCostReport } from './costs';

function costs(patch: Partial<CostsResponse> = {}): CostsResponse {
  return {
    totalUsd: 0.5,
    byTask: { embed: 0, enrich: 0.0159, chat_answer: 0.45, digest: 0.03, image_generate: 0 },
    byDay: [],
    calls: { total: 200, cached: 30, abstained: 50, blocked: 0 },
    budget: {
      limitUsd: 20,
      reserveUsd: 7,
      warnUsd: 8,
      softUsd: 11,
      hardUsd: 13,
      level: 'normal',
      lastProviderBalance: null,
    },
    avgCostPerCall: {},
    taskStats: {
      enrich: { paidCalls: 5, avgInputTokens: 1362, avgOutputTokens: 364, avgCostUsd: 0.003183 },
      chat_answer: {
        paidCalls: 120,
        avgInputTokens: 2100,
        avgOutputTokens: 280,
        avgCostUsd: 0.0035,
      },
    },
    ...patch,
  };
}

describe('estimateDemo (PRESUPUESTO-IA §5, F4-08 CA2)', () => {
  it('estimates 255 model calls at the real mean cost and checks the 3× reserve', () => {
    const demo = estimateDemo(costs());
    expect(demo).toMatchObject({ llmCalls: 255, meanCostUsd: 0.0035, reserveUsd: 7, ok: true });
    expect(demo.estimateUsd).toBeCloseTo(0.8925, 6);
    expect(demo.coverage).toBeCloseTo(7.84, 2);
  });

  it('fails the check when the reserve covers less than 3×', () => {
    const expensive = costs({
      taskStats: {
        chat_answer: { paidCalls: 10, avgInputTokens: 0, avgOutputTokens: 0, avgCostUsd: 0.01 },
      },
    });
    expect(estimateDemo(expensive)).toMatchObject({ ok: false });
  });

  it('stays pending without real chat calls', () => {
    expect(estimateDemo(costs({ taskStats: {} }))).toMatchObject({
      meanCostUsd: null,
      estimateUsd: null,
      ok: null,
    });
  });
});

describe('renderCostReport', () => {
  it('fills the PRESUPUESTO-IA §4 rows and marks missing functions as pending', () => {
    const markdown = renderCostReport(costs(), new Date('2026-10-12T00:00:00Z'), 'https://w');
    expect(markdown).toContain('| `chat_answer` | 2100 | 280 | 0.003500 | 120 | 0.4500 |');
    expect(markdown).toContain('| `digest` | pendiente | pendiente | pendiente | 0 | 0.0300 |');
    expect(markdown).toContain('llamadas evitadas (caché o abstención): 40 % de 200');
    expect(markdown).toContain('cumple F4-08 CA2');
  });
});
