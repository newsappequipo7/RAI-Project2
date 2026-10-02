import { createEmptyDraft, type News } from '@repo/shared';
import { describe, expect, it } from 'vitest';
import { displayTitle, EMPTY_FILTERS, filterNews } from './newsList';

function make(id: string, patch: Partial<News>): News {
	return { ...createEmptyDraft(id, 'uid-1', new Date('2026-10-02T00:00:00Z')), ...patch };
}

const ITEMS: News[] = [
	make('a', { title: 'Sismo en Guatemala', workflow: 'publicada', certainty: 'confirmada' }),
	make('b', { title: 'Reforma económica', workflow: 'publicada', certainty: 'en_desarrollo' }),
	make('c', { title: 'Borrador sin terminar', workflow: 'borrador', certainty: 'en_desarrollo' }),
	make('d', { title: 'Cifras disputadas', workflow: 'publicada', certainty: 'disputada' })
];

const ids = (items: News[]) => items.map((item) => item.id);

describe('filterNews', () => {
	it('returns everything with empty filters', () => {
		expect(ids(filterNews(ITEMS, EMPTY_FILTERS))).toEqual(['a', 'b', 'c', 'd']);
	});

	it('filters by workflow', () => {
		const result = filterNews(ITEMS, { ...EMPTY_FILTERS, workflow: 'borrador' });
		expect(ids(result)).toEqual(['c']);
	});

	it('filters by certainty', () => {
		const result = filterNews(ITEMS, { ...EMPTY_FILTERS, certainty: 'en_desarrollo' });
		expect(ids(result)).toEqual(['b', 'c']);
	});

	it('combines workflow and certainty', () => {
		const result = filterNews(ITEMS, {
			...EMPTY_FILTERS,
			workflow: 'publicada',
			certainty: 'en_desarrollo'
		});
		expect(ids(result)).toEqual(['b']);
	});

	it('searches titles ignoring case and accents', () => {
		expect(ids(filterNews(ITEMS, { ...EMPTY_FILTERS, query: 'ECONOMICA' }))).toEqual(['b']);
		expect(ids(filterNews(ITEMS, { ...EMPTY_FILTERS, query: ' sismo ' }))).toEqual(['a']);
	});

	it('returns nothing when no title matches', () => {
		expect(filterNews(ITEMS, { ...EMPTY_FILTERS, query: 'zzz' })).toEqual([]);
	});
});

describe('displayTitle', () => {
	it('falls back to a placeholder for empty drafts', () => {
		expect(displayTitle({ title: '  ' })).toBe('Sin título');
		expect(displayTitle({ title: 'Hola' })).toBe('Hola');
	});
});
