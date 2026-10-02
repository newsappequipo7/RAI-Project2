import { describe, expect, it } from 'vitest';
import { reindexWarning } from './indexGuard';

describe('reindexWarning', () => {
	it('lets live mode through without asking', () => {
		expect(reindexWarning({ aiMode: 'live' })).toBeNull();
	});

	it('warns in mock mode that embeddings would be fake', () => {
		expect(reindexWarning({ aiMode: 'mock' })).toContain('modo mock');
	});

	it('warns when the mode is unknown', () => {
		expect(reindexWarning(null)).toContain('modo desconocido');
	});
});
