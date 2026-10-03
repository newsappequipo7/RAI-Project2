<script lang="ts">
	import { resolve } from '$app/paths';
	import type { AiMode, News } from '@repo/shared';
	import type { IndexOutcome } from '$lib/publishFlow';

	let {
		news,
		outcome,
		aiMode,
		busy,
		onretry
	}: {
		news: News;
		outcome: IndexOutcome | null;
		aiMode: AiMode | null;
		busy: boolean;
		onretry: () => void;
	} = $props();

	// A news that was published earlier may still carry the mark even without a fresh outcome.
	const pending = $derived(outcome ? outcome.status === 'pending' : news.indexPending === true);
</script>

<div class="panel" class:pending role="status" aria-live="polite">
	{#if pending}
		<p>
			<strong>Publicada, pero la indexación está pendiente.</strong>
			{#if news.certainty === 'retractada'}
				La retractación ya está guardada, pero el chat todavía podría citar la noticia hasta que se
				retire del índice.
			{:else}
				La noticia ya está en Firestore y la app la puede mostrar, pero el chat aún no la encuentra.
			{/if}
		</p>
		{#if outcome?.status === 'pending'}<p class="detail">{outcome.error}</p>{/if}
		<button type="button" onclick={onretry} disabled={busy}>
			{busy ? 'Reintentando…' : 'Reintentar indexación'}
		</button>
	{:else}
		<p>
			{#if news.certainty === 'retractada'}
				<strong>Retractada (versión {news.version}) y retirada del índice.</strong>
				El chat ya no la cita; sigue visible con su corrección.
			{:else}
				<strong>Publicada (versión {news.version}) y añadida al índice.</strong>
			{/if}
			{#if outcome?.status === 'indexed'}Versión del índice: {outcome.indexVersion}.{/if}
		</p>
		{#if aiMode === 'mock'}
			<p class="warning">
				El Worker está en modo <strong>mock</strong>: la noticia se indexó con un embedding simulado
				y no aparecerá en las búsquedas del chat hasta que se reindexe con el Worker en modo live.
			</p>
		{/if}
	{/if}
	<p><a href={resolve('/comparador')}>Ver en el comparador</a></p>
</div>

<style>
	.panel {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		background: #e8f5e9;
		border: 1px solid #a5d6a7;
		border-radius: 4px;
	}

	.panel.pending {
		background: #fff8e1;
		border-color: #f0d58a;
	}

	p {
		margin: 0 0 0.5rem;
	}

	.detail {
		color: #666;
		font-size: 0.9rem;
	}

	.warning {
		color: #8a5a00;
	}
</style>
