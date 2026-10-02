import type { HealthResponse } from '@repo/shared';

/**
 * Message to confirm before rebuilding the search index, or null when it is safe. In `mock` mode the
 * Worker produces fake embeddings, and rebuilding would replace the real index with useless vectors.
 * An unknown mode (health failed to load) is treated like mock.
 */
export function reindexWarning(health: Pick<HealthResponse, 'aiMode'> | null): string | null {
	if (health?.aiMode === 'live') return null;

	const mode = health ? 'mock' : 'desconocido';
	return (
		`El Worker está en modo ${mode}: los embeddings serían simulados y reemplazarían el índice ` +
		`real por vectores falsos (la búsqueda del chat dejaría de servir). ¿Reindexar de todos modos?`
	);
}
