import type { AiSelftestResponse, BudgetSnapshot, CostsResponse, Flags } from '@repo/shared';
import { apiFetch } from './api';

const post = (path: string, body?: unknown): RequestInit & { path: string } => ({
	path,
	method: 'POST',
	...(body === undefined ? {} : { body: JSON.stringify(body) })
});

export const fetchCosts = () => apiFetch<CostsResponse>('/admin/costs');

/** Returns the complete flags stored by the Worker after applying the patch. */
export function patchFlags(patch: Partial<Flags>): Promise<Flags> {
	const { path, ...init } = post('/admin/flags', patch);
	return apiFetch<Flags>(path, init);
}

export function saveBudgetSnapshot(providerBalanceUsd: number, note?: string) {
	const { path, ...init } = post('/admin/budget-snapshot', {
		providerBalanceUsd,
		...(note?.trim() ? { note: note.trim() } : {})
	});
	return apiFetch<BudgetSnapshot>(path, init);
}

export function runSelftest() {
	const { path, ...init } = post('/admin/ai/selftest');
	return apiFetch<AiSelftestResponse>(path, init);
}
