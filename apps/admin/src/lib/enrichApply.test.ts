import { createEmptyDraft, type EnrichSuggestion } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import {
	addSuggestedClaims,
	approveSummary,
	suggestedGeo,
	suggestedTopicKeys
} from './enrichApply';

const suggestion: EnrichSuggestion = {
	topics: [
		{ key: 'economia', confidence: 0.5 },
		{ key: 'salud', confidence: 0.9 }
	],
	geo: { scope: 'local', countries: ['GT'], cityIds: ['gt-guatemala'], regions: ['centroamerica'] },
	importance: { value: 2, rationale: 'r' },
	claims: [
		{ text: 'Hay 12 casos.', needsSource: true },
		{ text: 'El decreto entra en vigor el lunes.', needsSource: false }
	],
	summary: 'Resumen.',
	sensationalismFlag: { flagged: false },
	model: 'm',
	costUsd: 0,
	createdAt: '2026-10-03T00:00:00.000Z'
};

describe('suggested values', () => {
	it('orders topics by confidence', () => {
		expect(suggestedTopicKeys(suggestion)).toEqual(['salud', 'economia']);
	});

	it('copies the geography so editing it does not touch the stored suggestion', () => {
		const geo = suggestedGeo(suggestion);
		geo.countries.push('SV');
		expect(suggestion.geo.countries).toEqual(['GT']);
	});
});

describe('addSuggestedClaims', () => {
	const draft = createEmptyDraft('n1', 'u', new Date('2026-10-03T00:00:00Z'));
	let counter = 0;
	const newId = () => `id-${(counter += 1)}`;

	it('adds claims as AI-suggested and unbacked, never as respaldada', () => {
		const claims = addSuggestedClaims([], suggestion.claims, draft.sources, newId);
		expect(claims).toHaveLength(2);
		expect(claims.every((claim) => claim.suggestedByAi)).toBe(true);
		expect(claims.every((claim) => claim.status === 'sin_respaldo')).toBe(true);
		expect(claims.every((claim) => claim.sourceIds.length === 0)).toBe(true);
	});

	it('skips claims that are already there, ignoring case and spacing', () => {
		const existing = addSuggestedClaims(
			[],
			[{ text: 'Hay 12 casos.', needsSource: true }],
			[],
			newId
		);
		const merged = addSuggestedClaims(
			existing,
			[{ text: '  hay   12 CASOS. ', needsSource: true }, ...suggestion.claims.slice(1)],
			[],
			newId
		);
		expect(merged.map((claim) => claim.text)).toEqual([
			'Hay 12 casos.',
			'El decreto entra en vigor el lunes.'
		]);
	});

	it('does not mutate the current claims, and ignores empty suggestions', () => {
		const current = addSuggestedClaims([], suggestion.claims.slice(0, 1), [], newId);
		const merged = addSuggestedClaims(current, [{ text: '   ', needsSource: true }], [], newId);
		expect(merged).toEqual(current);
		expect(merged).not.toBe(current);
	});
});

describe('approveSummary', () => {
	it('records who approved it and when', () => {
		expect(approveSummary('  Texto  ', 'editor-1', new Date('2026-10-03T10:00:00Z'))).toEqual({
			text: 'Texto',
			approvedBy: 'editor-1',
			approvedAt: '2026-10-03T10:00:00.000Z'
		});
	});
});
