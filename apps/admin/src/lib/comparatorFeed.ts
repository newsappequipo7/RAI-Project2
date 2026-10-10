import {
	newsSchema,
	resolvePublicFeedConfig,
	type News,
	type PublicFeedConfig
} from '@repo/shared';
import {
	collection,
	doc,
	onSnapshot,
	orderBy,
	query,
	where,
	type Firestore,
	type Unsubscribe
} from 'firebase/firestore';

export type ComparatorSnapshot = { news: News[]; config: PublicFeedConfig };
export type ComparatorObserver = {
	next: (snapshot: ComparatorSnapshot) => void;
	error: (error: Error) => void;
};

/** Keep the portal comparison current when an editor publishes or changes a story. */
export function watchComparatorFeed(db: Firestore, observer: ComparatorObserver): Unsubscribe {
	let news: News[] | undefined;
	let config: PublicFeedConfig | undefined;
	let closed = false;
	let stopNews: Unsubscribe = () => {};
	let stopConfig: Unsubscribe = () => {};

	function emit() {
		if (!closed && news && config) observer.next({ news, config });
	}

	function fail(error: unknown) {
		if (closed) return;
		closed = true;
		stopNews();
		stopConfig();
		observer.error(error instanceof Error ? error : new Error('No se pudo cargar el comparador.'));
	}

	stopNews = onSnapshot(
		query(
			collection(db, 'news'),
			where('workflow', '==', 'publicada'),
			orderBy('publishedAt', 'desc')
		),
		(snapshot) => {
			try {
				news = snapshot.docs.map((document) => {
					const parsed = newsSchema.safeParse({ ...document.data(), id: document.id });
					if (!parsed.success) throw new Error(`La noticia ${document.id} tiene datos inválidos.`);
					return parsed.data;
				});
				emit();
			} catch (error) {
				fail(error);
			}
		},
		fail
	);
	if (!closed)
		stopConfig = onSnapshot(
			doc(db, 'config', 'public'),
			(snapshot) => {
				config = resolvePublicFeedConfig(snapshot.exists() ? snapshot.data() : undefined);
				emit();
			},
			fail
		);

	return () => {
		closed = true;
		stopNews();
		stopConfig();
	};
}
