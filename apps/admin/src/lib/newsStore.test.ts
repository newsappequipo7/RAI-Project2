import { createEmptyDraft } from '@repo/shared';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
	doc: vi.fn(),
	getDoc: vi.fn(),
	updateDoc: vi.fn()
}));

import { updateDoc, type Firestore } from 'firebase/firestore';
import {
	normalizeGeo,
	pickEditableFields,
	SaveBlockedError,
	saveNewsFields,
	toggleValue
} from './newsStore';

const NOW = new Date('2026-10-02T00:00:00Z');
const db = {} as Firestore;

describe('pickEditableFields', () => {
	it('returns only the fields the editor may write', () => {
		const draft = createEmptyDraft('n1', 'uid-1', NOW);
		expect(Object.keys(pickEditableFields(draft)).sort()).toEqual([
			'body',
			'geo',
			'importance',
			'lead',
			'title',
			'topics'
		]);
	});
});

describe('normalizeGeo', () => {
	const geo = {
		scope: 'local' as const,
		countries: ['GT'],
		cityIds: ['gt-guatemala'],
		regions: ['centroamerica']
	};

	it('clears everything for a global scope', () => {
		expect(normalizeGeo(geo, 'global')).toEqual({
			scope: 'global',
			countries: [],
			cityIds: [],
			regions: []
		});
	});

	it('drops cities when leaving the local scope, keeps them when staying local', () => {
		expect(normalizeGeo(geo, 'nacional').cityIds).toEqual([]);
		expect(normalizeGeo(geo, 'local').cityIds).toEqual(['gt-guatemala']);
	});
});

describe('toggleValue', () => {
	it('adds and removes without mutating', () => {
		const values = ['a'];
		expect(toggleValue(values, 'b')).toEqual(['a', 'b']);
		expect(toggleValue(values, 'a')).toEqual([]);
		expect(values).toEqual(['a']);
	});
});

describe('saveNewsFields', () => {
	it('saves an incomplete draft (autosave) and stamps updatedAt', async () => {
		const draft = createEmptyDraft('n1', 'uid-1', NOW);
		await saveNewsFields(db, draft);

		expect(updateDoc).toHaveBeenCalledTimes(1);
		const written = vi.mocked(updateDoc).mock.calls[0]?.[1] as unknown as Record<string, unknown>;
		expect(written.title).toBe('');
		expect(typeof written.updatedAt).toBe('string');
		expect(written).not.toHaveProperty('workflow');
	});

	it('refuses to store invalid data as published (CA2)', async () => {
		vi.mocked(updateDoc).mockClear();
		const published = { ...createEmptyDraft('n1', 'uid-1', NOW), workflow: 'publicada' as const };

		await expect(saveNewsFields(db, published)).rejects.toBeInstanceOf(SaveBlockedError);
		expect(updateDoc).not.toHaveBeenCalled();
	});
});
