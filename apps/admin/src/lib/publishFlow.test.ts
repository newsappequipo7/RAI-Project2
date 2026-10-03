import { createEmptyDraft } from '@repo/shared';
import { describe, expect, it, vi } from 'vitest';
import { indexNews } from './publishFlow';

const noRemove = vi.fn();
const news = {
	...createEmptyDraft('n1', 'uid-1', new Date('2026-10-03T00:00:00Z')),
	workflow: 'publicada' as const
};

describe('indexNews', () => {
	it('clears the pending mark once the Worker confirms', async () => {
		const clearPending = vi.fn().mockResolvedValue(undefined);
		const upsert = vi.fn().mockResolvedValue({ indexVersion: 8 });

		await expect(indexNews(news, { upsert, remove: noRemove, clearPending })).resolves.toEqual({
			status: 'indexed',
			indexVersion: 8
		});
		expect(upsert).toHaveBeenCalledWith(news);
		expect(clearPending).toHaveBeenCalledWith('n1');
	});

	it('does not throw when the Worker is down, and keeps the news pending (CA2)', async () => {
		const clearPending = vi.fn();
		const upsert = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

		await expect(indexNews(news, { upsert, remove: noRemove, clearPending })).resolves.toEqual({
			status: 'pending',
			error: 'Failed to fetch'
		});
		expect(clearPending).not.toHaveBeenCalled();
	});

	it('reports pending, not success, if the mark cannot be cleared', async () => {
		const outcome = await indexNews(news, {
			upsert: vi.fn().mockResolvedValue({ indexVersion: 8 }),
			remove: noRemove,
			clearPending: vi.fn().mockRejectedValue(new Error('permission-denied'))
		});

		expect(outcome.status).toBe('pending');
		expect(outcome).toMatchObject({ error: expect.stringContaining('permission-denied') });
	});

	it('a retry after the Worker recovers succeeds', async () => {
		const clearPending = vi.fn().mockResolvedValue(undefined);
		const upsert = vi
			.fn()
			.mockRejectedValueOnce(new Error('offline'))
			.mockResolvedValue({ indexVersion: 9 });

		expect((await indexNews(news, { upsert, remove: noRemove, clearPending })).status).toBe(
			'pending'
		);
		expect(await indexNews(news, { upsert, remove: noRemove, clearPending })).toEqual({
			status: 'indexed',
			indexVersion: 9
		});
	});
});

describe('indexNews for a retracted news (F2-08 CA1)', () => {
	const retracted = { ...news, certainty: 'retractada' as const };

	it('removes it from the index instead of upserting, and clears the mark', async () => {
		const upsert = vi.fn();
		const remove = vi.fn().mockResolvedValue({ indexVersion: 10 });
		const clearPending = vi.fn().mockResolvedValue(undefined);

		await expect(indexNews(retracted, { upsert, remove, clearPending })).resolves.toEqual({
			status: 'indexed',
			indexVersion: 10
		});
		expect(remove).toHaveBeenCalledWith('n1');
		expect(upsert).not.toHaveBeenCalled();
		expect(clearPending).toHaveBeenCalledWith('n1');
	});

	it('stays pending if the removal fails, so it can be retried', async () => {
		const clearPending = vi.fn();
		const remove = vi.fn().mockRejectedValue(new Error('offline'));

		await expect(indexNews(retracted, { upsert: vi.fn(), remove, clearPending })).resolves.toEqual({
			status: 'pending',
			error: 'offline'
		});
		expect(clearPending).not.toHaveBeenCalled();
	});
});
