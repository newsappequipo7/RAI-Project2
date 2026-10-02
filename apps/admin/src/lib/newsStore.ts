import { saveBlockers, type GeoScope, type News } from '@repo/shared';
import { deleteField, doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore';

const EDITABLE_FIELDS = [
	'title',
	'lead',
	'body',
	'topics',
	'geo',
	'importance',
	'sources',
	'claims',
	'certainty',
	'certaintyNote',
	'checklist'
] as const satisfies readonly (keyof News)[];

export type EditableField = (typeof EDITABLE_FIELDS)[number];
export type EditablePatch = Pick<News, EditableField>;

export class SaveBlockedError extends Error {}

/** The fields the editor sections may write. Workflow, version and publication data are not here. */
export function pickEditableFields(news: News): EditablePatch {
	return Object.fromEntries(
		EDITABLE_FIELDS.map((field) => [field, news[field]])
	) as unknown as EditablePatch;
}

/** Drops the geography that a scope does not use (global: nothing; non-local: no cities). */
export function normalizeGeo(geo: News['geo'], scope: GeoScope): News['geo'] {
	if (scope === 'global') return { scope, countries: [], cityIds: [], regions: [] };
	return { ...geo, scope, cityIds: scope === 'local' ? geo.cityIds : [] };
}

export function toggleValue<T>(values: T[], value: T): T[] {
	return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export async function loadNews(db: Firestore, id: string): Promise<News | null> {
	const snapshot = await getDoc(doc(db, 'news', id));
	return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as News) : null;
}

/** Writes the editable fields. Refuses to store invalid data as a published news. */
export async function saveNewsFields(db: Firestore, news: News): Promise<void> {
	const blockers = saveBlockers(news);
	if (blockers.length > 0) {
		throw new SaveBlockedError(blockers.map((issue) => issue.message).join(' '));
	}

	// Firestore rejects `undefined`: an emptied optional field (certaintyNote) is deleted instead.
	const patch = Object.fromEntries(
		Object.entries(pickEditableFields(news)).map(([key, value]) => [
			key,
			value === undefined ? deleteField() : value
		])
	);

	await updateDoc(doc(db, 'news', news.id), {
		...patch,
		updatedAt: new Date().toISOString()
	});
}
