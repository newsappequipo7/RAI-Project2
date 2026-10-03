import { createClaim, type Claim, type EnrichSuggestion, type News } from '@repo/shared';

/** Suggested topic keys, most confident first (the Worker already limits them to the catalog). */
export function suggestedTopicKeys(suggestion: EnrichSuggestion): string[] {
	return [...suggestion.topics]
		.sort((a, b) => b.confidence - a.confidence)
		.map((topic) => topic.key);
}

export function suggestedGeo(suggestion: EnrichSuggestion): News['geo'] {
	return {
		scope: suggestion.geo.scope,
		countries: [...suggestion.geo.countries],
		cityIds: [...suggestion.geo.cityIds],
		regions: [...suggestion.geo.regions]
	};
}

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Adds the suggested claims that are not already there. The model can never mark a claim as backed:
 * they enter with no linked sources, so their status is `sin_respaldo` until an editor links one
 * (VERIFICACION-Y-FUENTES.md §5).
 */
export function addSuggestedClaims(
	current: Claim[],
	suggested: { text: string; needsSource: boolean }[],
	sources: News['sources'],
	newId: () => string = () => crypto.randomUUID()
): Claim[] {
	const known = new Set(current.map((claim) => normalize(claim.text)));
	const added: Claim[] = [];

	for (const item of suggested) {
		const key = normalize(item.text);
		if (key === '' || known.has(key)) continue;
		known.add(key);
		added.push({ ...createClaim(newId(), item.text, [], sources), suggestedByAi: true });
	}
	return [...current, ...added];
}

/** The AI summary only exists once an editor approved it, and records who and when. */
export function approveSummary(
	text: string,
	approvedBy: string,
	now: Date = new Date()
): NonNullable<News['aiSummary']> {
	return { text: text.trim(), approvedBy, approvedAt: now.toISOString() };
}
