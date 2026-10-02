import {
	saveBlockers,
	type EditableNewsFields,
	type GeoScope,
	type News,
	type NewsFieldName
} from '@repo/shared';
import { doc, getDoc, updateDoc, type Firestore } from 'firebase/firestore';

const EDITABLE_FIELDS: NewsFieldName[] = [
	'title',
	'lead',
	'body',
	'topics',
	'geo',
	'importance',
	'sources',
	'claims'
];

export class SaveBlockedError extends Error {}

/** The fields the editor sections (content, classification, sources, claims) may write. */
export function pickEditableFields(news: News): EditableNewsFields {
	return Object.fromEntries(
		EDITABLE_FIELDS.map((field) => [field, news[field]])
	) as unknown as EditableNewsFields;
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

	await updateDoc(doc(db, 'news', news.id), {
		...pickEditableFields(news),
		updatedAt: new Date().toISOString()
	});
}
