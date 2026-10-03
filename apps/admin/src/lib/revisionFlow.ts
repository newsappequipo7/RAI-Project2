import {
	buildRetraction,
	buildRevision,
	validatePublish,
	type News,
	type Revision,
	type RevisionKind
} from '@repo/shared';
import {
	collection,
	deleteField,
	doc,
	getDocs,
	orderBy,
	query,
	runTransaction,
	type Firestore
} from 'firebase/firestore';
import { NotPublishableError, PublishBlockedError } from './publishFlow';

/** An `undefined` in a revision patch means "remove this field". */
function toFirestorePatch(patch: Revision['patch']): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(patch).map(([key, value]) => [key, value === undefined ? deleteField() : value])
	);
}

async function applyRevision(
	db: Firestore,
	id: string,
	build: (current: News) => Revision,
	check: (revision: Revision) => void = () => {}
): Promise<News> {
	return runTransaction(db, async (transaction) => {
		const reference = doc(db, 'news', id);
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists()) throw new NotPublishableError('La noticia no existe.');

		const revision = build({ ...snapshot.data(), id } as News);
		check(revision);

		transaction.update(reference, toFirestorePatch(revision.patch));
		transaction.set(
			doc(db, 'news', id, 'versions', String(revision.patch.version)),
			revision.snapshot
		);
		return revision.snapshot;
	});
}

/**
 * Saves an edit of a published news as a new version with its correction entry. The would-be news
 * must still pass every publish rule, checked against the stored data and not the screen's.
 */
export function saveRevision(
	db: Firestore,
	id: string,
	edited: News,
	entry: { kind: RevisionKind; summary: string },
	editorUid: string,
	now: Date = new Date()
): Promise<News> {
	return applyRevision(
		db,
		id,
		(current) => buildRevision(current, edited, entry, editorUid, now),
		(revision) => {
			const validation = validatePublish(revision.snapshot);
			if (!validation.ok) throw new PublishBlockedError(validation.errors);
		}
	);
}

/** Retracts a published news. It is never deleted: it stays stored with its correction. */
export function retractNews(
	db: Firestore,
	id: string,
	summary: string,
	editorUid: string,
	now: Date = new Date()
): Promise<News> {
	return applyRevision(db, id, (current) => buildRetraction(current, summary, editorUid, now));
}

/** Every stored version of a news, newest first. */
export async function listVersions(db: Firestore, id: string): Promise<News[]> {
	const snapshot = await getDocs(
		query(collection(db, 'news', id, 'versions'), orderBy('version', 'desc'))
	);
	return snapshot.docs.map((document) => ({ ...document.data(), id }) as News);
}
