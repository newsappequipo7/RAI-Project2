import {
	buildPublication,
	MAX_INDEX_BATCH,
	toIndexInput,
	validatePublish,
	type IndexInput,
	type News,
	type PublishError
} from '@repo/shared';
import {
	collection,
	deleteField,
	doc,
	getDocs,
	query,
	runTransaction,
	updateDoc,
	where,
	writeBatch,
	type Firestore
} from 'firebase/firestore';

export class PublishBlockedError extends Error {
	constructor(readonly errors: PublishError[]) {
		super(errors.map((error) => error.message).join(' '));
	}
}

export class NotPublishableError extends Error {}

/**
 * Publishes a news in one transaction: re-validates what is stored (not what the screen shows),
 * sets the publication fields with `indexPending: true`, and writes the version snapshot.
 */
export async function publishNews(
	db: Firestore,
	id: string,
	publishedBy: string,
	now: Date = new Date()
): Promise<News> {
	return runTransaction(db, async (transaction) => {
		const reference = doc(db, 'news', id);
		const snapshot = await transaction.get(reference);
		if (!snapshot.exists()) throw new NotPublishableError('La noticia no existe.');

		const news = { ...snapshot.data(), id } as News;
		if (news.workflow === 'publicada') {
			throw new NotPublishableError('La noticia ya está publicada.');
		}

		const validation = validatePublish(news);
		if (!validation.ok) throw new PublishBlockedError(validation.errors);

		const publication = buildPublication(news, publishedBy, now);
		transaction.update(reference, publication.patch);
		transaction.set(
			doc(db, 'news', id, 'versions', String(publication.patch.version)),
			publication.snapshot
		);
		return publication.snapshot;
	});
}

export interface IndexDeps {
	upsert: (news: News) => Promise<{ indexVersion: number }>;
	clearPending: (id: string) => Promise<void>;
}

export type IndexOutcome =
	{ status: 'indexed'; indexVersion: number } | { status: 'pending'; error: string };

const describeError = (error: unknown) =>
	error instanceof Error ? error.message : 'Error desconocido';

/**
 * Sends a published news to the search index. It never throws: if the Worker is unreachable the
 * news keeps `indexPending: true` and the editor can retry. Upserting twice is harmless.
 */
export async function indexNews(news: News, deps: IndexDeps): Promise<IndexOutcome> {
	let indexVersion: number;
	try {
		({ indexVersion } = await deps.upsert(news));
	} catch (error) {
		return { status: 'pending', error: describeError(error) };
	}

	try {
		await deps.clearPending(news.id);
	} catch (error) {
		return {
			status: 'pending',
			error: `Se indexó, pero no se pudo quitar la marca de pendiente: ${describeError(error)}`
		};
	}
	return { status: 'indexed', indexVersion };
}

export async function clearIndexPending(db: Firestore, id: string): Promise<void> {
	await updateDoc(doc(db, 'news', id), { indexPending: deleteField() });
}

export class IndexTooLargeError extends Error {}

export interface RebuildDeps {
	rebuild: (news: IndexInput[]) => Promise<{ indexVersion: number; upserted: number }>;
}

/**
 * Replaces the whole index with every published news (retracted ones included, so the index keeps
 * their state; search excludes them) and clears the pending marks that the rebuild resolved.
 */
export async function rebuildIndex(
	db: Firestore,
	deps: RebuildDeps
): Promise<{ indexVersion: number; upserted: number }> {
	const snapshot = await getDocs(
		query(collection(db, 'news'), where('workflow', '==', 'publicada'))
	);
	const published = snapshot.docs.map(
		(document) => ({ ...document.data(), id: document.id }) as News
	);

	if (published.length > MAX_INDEX_BATCH) {
		throw new IndexTooLargeError(
			`Hay ${published.length} noticias publicadas y el índice acepta ${MAX_INDEX_BATCH} por reconstrucción.`
		);
	}

	const result = await deps.rebuild(published.map(toIndexInput));

	const pending = snapshot.docs.filter((document) => document.data().indexPending === true);
	for (let start = 0; start < pending.length; start += 400) {
		const batch = writeBatch(db);
		for (const document of pending.slice(start, start + 400)) {
			batch.update(document.ref, { indexPending: deleteField() });
		}
		await batch.commit();
	}
	return result;
}
