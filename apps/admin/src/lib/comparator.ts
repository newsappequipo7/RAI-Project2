import {
	createDefaultProfile,
	LOCATIONS,
	MUST_KNOW_WINDOW_HOURS,
	rankFeed,
	type Location,
	type News,
	type PublicFeedConfig,
	type RankedFeed,
	type UserProfile
} from '@repo/shared';

const HOUR_MS = 3_600_000;

export const COMPARATOR_PERSONAS = [
	{ id: 'neutral', label: 'Sin historial' },
	{ id: 'sports', label: 'Interés en deportes' },
	{ id: 'tech', label: 'Tecnología; política silenciada' },
	{ id: 'economy', label: 'Interés en economía' }
] as const;

export type ComparatorPersona = (typeof COMPARATOR_PERSONAS)[number]['id'];
export type ComparisonCell = {
	position: number;
	section: 'mustKnow' | 'feed';
	tier: 'esencial' | 'hero' | 'grande' | 'mediana' | 'compacta';
};
export type ComparisonColumn = {
	location: Location;
	ranking: RankedFeed;
	cells: Map<string, ComparisonCell>;
};

/** Matches the mobile feed's normal window plus the fixed 72-hour essential window. */
export function comparableNews(news: News[], config: PublicFeedConfig, now: Date): News[] {
	const currentCutoff = now.getTime() - config.feedWindowHours * HOUR_MS;
	const essentialCutoff = now.getTime() - MUST_KNOW_WINDOW_HOURS * HOUR_MS;
	return news.filter((item) => {
		const published = Date.parse(item.publishedAt ?? '');
		return (
			item.workflow === 'publicada' &&
			item.certainty !== 'retractada' &&
			Number.isFinite(published) &&
			published <= now.getTime() &&
			(published >= currentCutoff || (item.importance === 3 && published >= essentialCutoff))
		);
	});
}

export function comparatorProfile(
	persona: ComparatorPersona,
	locationId: string,
	now: Date
): UserProfile {
	const base = createDefaultProfile(`compare-${persona}`, 'Perfil de comparación', locationId, now);
	switch (persona) {
		case 'sports':
			return { ...base, interests: { deportes: 10 } };
		case 'tech':
			return { ...base, interests: { tecnologia: 10 }, mutedTopics: ['politica'] };
		case 'economy':
			return { ...base, interests: { economia: 10 } };
		default:
			return base;
	}
}

export function buildComparison(
	news: News[],
	config: PublicFeedConfig,
	persona: ComparatorPersona,
	now: Date
): ComparisonColumn[] {
	const visible = comparableNews(news, config, now);
	return LOCATIONS.map((location) => {
		const profile = comparatorProfile(persona, location.id, now);
		const ranking = rankFeed({
			news: visible,
			profile,
			locationId: location.id,
			now,
			weights: config.rankingWeights
		});
		const cells = new Map<string, ComparisonCell>();
		ranking.mustKnow.forEach((item, index) =>
			cells.set(item.news.id, { position: index + 1, section: 'mustKnow', tier: 'esencial' })
		);
		ranking.feed.forEach((item, index) =>
			cells.set(item.news.id, { position: index + 1, section: 'feed', tier: item.tier })
		);
		return { location, ranking, cells };
	});
}
