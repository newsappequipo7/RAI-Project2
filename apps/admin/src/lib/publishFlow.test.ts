import { createEmptyDraft } from '@repo/shared';
import { describe, expect, it, vi } from 'vitest';
import { indexNews } from './publishFlow';

const news = {
	...createEmptyDraft('n1', 'uid-1', new Date('2026-10-03T00:00:00Z')),
	workflow: 'publicada' as const
};

describe('indexNews', () => {
	it('clears the pending mark once the Worker confirms', async () => {
		const clearPending = vi.fn().mockResolvedValue(undefined);
		const upsert = vi.fn().mockResolvedValue({ indexVersion: 8 });

		await expect(indexNews(news, { upsert, clearPending })).resolves.toEqual({
			status: 'indexed',
			indexVersion: 8
		});
		expect(upsert).toHaveBeenCalledWith(news);
		expect(clearPending).toHaveBeenCalledWith('n1');
	});

	it('does not throw when the Worker is down, and keeps the news pending (CA2)', async () => {
		const clearPending = vi.fn();
		const upsert = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

		await expect(indexNews(news, { upsert, clearPending })).resolves.toEqual({
			status: 'pending',
			error: 'Failed to fetch'
		});
		expect(clearPending).not.toHaveBeenCalled();
	});

	it('reports pending, not success, if the mark cannot be cleared', async () => {
		const outcome = await indexNews(news, {
			upsert: vi.fn().mockResolvedValue({ indexVersion: 8 }),
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

		expect((await indexNews(news, { upsert, clearPending })).status).toBe('pending');
		expect(await indexNews(news, { upsert, clearPending })).toEqual({
			status: 'indexed',
			indexVersion: 9
		});
	});
});
