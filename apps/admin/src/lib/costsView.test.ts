import type { CostsResponse } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import {
	avoidedCalls,
	describeFlagChange,
	formatDrift,
	parseBalance,
	recentDays,
	summarizeBudget,
	taskRows
} from './costsView';

function costs(patch: Partial<CostsResponse> = {}): CostsResponse {
	return {
		totalUsd: 4,
		byTask: { enrich: 1, chat_answer: 3, digest: 0, embed: 0, image_generate: 0 },
		byDay: [],
		calls: { total: 100, cached: 20, abstained: 10, blocked: 0 },
		budget: {
			limitUsd: 20,
			reserveUsd: 7,
			warnUsd: 8,
			softUsd: 11,
			hardUsd: 13,
			level: 'normal',
			lastProviderBalance: null
		},
		avgCostPerCall: { enrich: 0.004, chat_answer: 0.003 },
		...patch
	};
}

describe('summarizeBudget', () => {
	it('derives balance, spendable amount and the spent share', () => {
		expect(summarizeBudget(costs())).toEqual({
			spentPct: 20,
			estimatedBalanceUsd: 16,
			spendableBeforeReserveUsd: 9,
			reserveIntact: true,
			balanceDriftUsd: null,
			driftPct: null,
			driftExceeds: false
		});
	});

	it('flags a committed reserve once spending passes limit − reserve', () => {
		const summary = summarizeBudget(costs({ totalUsd: 14 }));
		expect(summary.reserveIntact).toBe(false);
		expect(summary.spendableBeforeReserveUsd).toBe(0);
		expect(summary.estimatedBalanceUsd).toBe(6);
	});

	it('compares the real provider balance with the estimate', () => {
		const base = costs();
		const summary = summarizeBudget({
			...base,
			budget: { ...base.budget, lastProviderBalance: 15.5 }
		});
		expect(summary.balanceDriftUsd).toBeCloseTo(-0.5);
	});

	it('flags a ledger that is more than 10% away from the provider panel', () => {
		const base = costs({ totalUsd: 4 });
		const withBalance = (lastProviderBalance: number) =>
			summarizeBudget({ ...base, budget: { ...base.budget, lastProviderBalance } });

		expect(withBalance(16).driftExceeds).toBe(false); // panel agrees: 4 spent
		expect(withBalance(15.7).driftExceeds).toBe(false); // 4.3 vs 4, 7%
		expect(withBalance(15).driftExceeds).toBe(true); // 5 vs 4, 20%
		expect(withBalance(15).driftPct).toBeCloseTo(20);
	});

	it('ignores sub-cent differences that are huge in percent', () => {
		const base = costs({ totalUsd: 0.000036 });
		const summary = summarizeBudget({
			...base,
			budget: { ...base.budget, lastProviderBalance: 20 }
		});
		expect(summary.driftExceeds).toBe(false);
	});

	it('caps the spent share at 100%', () => {
		expect(summarizeBudget(costs({ totalUsd: 25 })).spentPct).toBe(100);
	});
});

describe('avoidedCalls', () => {
	it('counts cache hits and abstentions over all calls', () => {
		expect(avoidedCalls({ total: 100, cached: 20, abstained: 10, blocked: 5 })).toEqual({
			count: 30,
			pct: 30
		});
	});

	it('is zero without calls', () => {
		expect(avoidedCalls({ total: 0, cached: 0, abstained: 0, blocked: 0 })).toEqual({
			count: 0,
			pct: 0
		});
	});
});

describe('taskRows', () => {
	it('lists every task by spend with its share and average cost', () => {
		const rows = taskRows(costs());
		// Highest spend first; tasks with no spend keep the catalog order.
		expect(rows.map((row) => row.task)).toEqual([
			'chat_answer',
			'enrich',
			'embed',
			'digest',
			'image_generate'
		]);
		expect(rows[0]).toMatchObject({ usd: 3, sharePct: 75, avgUsd: 0.003 });
		expect(rows.at(-1)).toMatchObject({ usd: 0, sharePct: 0, avgUsd: null });
	});

	it('has zero shares on an empty ledger', () => {
		const empty = costs({
			totalUsd: 0,
			byTask: { enrich: 0, chat_answer: 0, digest: 0, embed: 0, image_generate: 0 },
			avgCostPerCall: {}
		});
		expect(taskRows(empty).every((row) => row.sharePct === 0)).toBe(true);
	});
});

describe('recentDays', () => {
	it('keeps the latest days in chronological order', () => {
		const days = Array.from({ length: 20 }, (_, index) => ({ day: `d${index}`, usd: index }));
		const recent = recentDays(days, 3);
		expect(recent.map((item) => item.day)).toEqual(['d17', 'd18', 'd19']);
	});
});

describe('parseBalance', () => {
	it('accepts plain and formatted amounts', () => {
		expect(parseBalance('16.2')).toBe(16.2);
		expect(parseBalance(' $ 16,20 ')).toBe(16.2);
		expect(parseBalance('0')).toBe(0);
	});

	it('rejects empty, negative and non-numeric input', () => {
		for (const input of ['', '   ', '-3', 'abc', '1.2.3']) {
			expect(parseBalance(input), input).toBeNull();
		}
	});
});

describe('describeFlagChange', () => {
	it('explains what each change does', () => {
		expect(describeFlagChange({ killSwitch: true })).toContain('bloquea TODAS');
		expect(describeFlagChange({ killSwitch: false })).toContain('vuelve a permitir');
		expect(describeFlagChange({ chatMode: 'retrieval_only' })).toContain('sin gasto');
		expect(describeFlagChange({ chatMode: 'full' })).toContain('gasta créditos');
		expect(describeFlagChange({ imageGenEnabled: true })).toContain('ADR-011');
		expect(describeFlagChange({ imageGenEnabled: false })).toContain('bloquea la generación');
	});
});

describe('formatDrift', () => {
	it('shows an explicit sign', () => {
		expect(formatDrift(0.5)).toBe('+0.5000');
		expect(formatDrift(-0.0001)).toBe('−0.0001');
		expect(formatDrift(null)).toBe('—');
	});
});
