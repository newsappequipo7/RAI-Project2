import type { Certainty, News, Workflow } from '@repo/shared';

export interface NewsListFilters {
	workflow: Workflow | 'all';
	certainty: Certainty | 'all';
	query: string;
}

export const EMPTY_FILTERS: NewsListFilters = { workflow: 'all', certainty: 'all', query: '' };

function normalize(text: string): string {
	return text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.trim();
}

/** Applies the workflow/certainty filters and the accent-insensitive title search. */
export function filterNews(items: News[], filters: NewsListFilters): News[] {
	const query = normalize(filters.query);

	return items.filter(
		(item) =>
			(filters.workflow === 'all' || item.workflow === filters.workflow) &&
			(filters.certainty === 'all' || item.certainty === filters.certainty) &&
			(query === '' || normalize(item.title).includes(query))
	);
}

/** Title shown in the list; drafts start with an empty title. */
export function displayTitle(item: Pick<News, 'title'>): string {
	return item.title.trim() === '' ? 'Sin título' : item.title;
}
