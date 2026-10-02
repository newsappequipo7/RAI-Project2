<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { collection, doc, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
	import { onMount } from 'svelte';
	import { createEmptyDraft, type Certainty, type News, type Workflow } from '@repo/shared';
	import { db } from '$lib/firebase';
	import { fetchHealth, rebuildNews } from '$lib/indexApi';
	import { reindexWarning } from '$lib/indexGuard';
	import { displayTitle, EMPTY_FILTERS, filterNews, type NewsListFilters } from '$lib/newsList';
	import { rebuildIndex } from '$lib/publishFlow';
	import { session } from '$lib/session.svelte';

	const WORKFLOWS: Workflow[] = ['borrador', 'en_revision', 'publicada', 'rechazada'];
	const CERTAINTIES: Certainty[] = ['confirmada', 'en_desarrollo', 'disputada', 'retractada'];
	const dateFormat = new Intl.DateTimeFormat('es-GT', {
		dateStyle: 'short',
		timeStyle: 'short',
		timeZone: 'America/Guatemala'
	});

	let items = $state<News[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');
	let creating = $state(false);
	let rebuilding = $state(false);
	let rebuildMessage = $state('');
	let filters = $state<NewsListFilters>({ ...EMPTY_FILTERS });

	const visible = $derived(filterNews(items, filters));

	onMount(() =>
		onSnapshot(
			query(collection(db, 'news'), orderBy('updatedAt', 'desc')),
			(snapshot) => {
				// Drafts may be incomplete, so the list shows them as stored instead of validating them.
				items = snapshot.docs.map((document) => ({ ...document.data(), id: document.id }) as News);
				loading = false;
				errorMessage = '';
			},
			(error) => {
				loading = false;
				errorMessage = `No se pudo leer la lista de noticias: ${error.message}`;
			}
		)
	);

	async function createDraft() {
		const uid = session.user?.uid;
		if (!uid || creating) return;

		creating = true;
		errorMessage = '';

		try {
			const reference = doc(collection(db, 'news'));
			await setDoc(reference, createEmptyDraft(reference.id, uid, new Date()));
			await goto(resolve(`/news/${reference.id}`));
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'No se pudo crear el borrador';
		} finally {
			creating = false;
		}
	}

	async function rebuild() {
		if (rebuilding) return;
		rebuilding = true;
		errorMessage = '';
		rebuildMessage = '';

		try {
			// Rebuilding in mock mode would replace the real index with fake embeddings.
			const warning = reindexWarning(await fetchHealth().catch(() => null));
			if (warning && !window.confirm(warning)) return;

			const result = await rebuildIndex(db, { rebuild: rebuildNews });
			rebuildMessage = `Índice reconstruido: versión ${result.indexVersion}, ${result.upserted} noticias publicadas.`;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'No se pudo reconstruir el índice';
		} finally {
			rebuilding = false;
		}
	}

	function formatDate(iso: string): string {
		return dateFormat.format(new Date(iso));
	}
</script>

<div class="header">
	<h1>Noticias</h1>
	<div class="actions">
		<button onclick={rebuild} disabled={rebuilding}>
			{rebuilding ? 'Reconstruyendo…' : 'Reconstruir índice'}
		</button>
		<button onclick={createDraft} disabled={creating}>Nueva noticia</button>
	</div>
</div>

<div class="filters">
	<label>
		Buscar por título
		<input type="search" bind:value={filters.query} placeholder="Título…" />
	</label>
	<label>
		Workflow
		<select bind:value={filters.workflow}>
			<option value="all">Todos</option>
			{#each WORKFLOWS as workflow (workflow)}
				<option value={workflow}>{workflow}</option>
			{/each}
		</select>
	</label>
	<label>
		Certeza
		<select bind:value={filters.certainty}>
			<option value="all">Todas</option>
			{#each CERTAINTIES as certainty (certainty)}
				<option value={certainty}>{certainty}</option>
			{/each}
		</select>
	</label>
</div>

{#if errorMessage}
	<p role="alert">{errorMessage}</p>
{/if}
{#if rebuildMessage}
	<p role="status">{rebuildMessage}</p>
{/if}

{#if loading}
	<p>Cargando noticias…</p>
{:else}
	<p class="count">{visible.length} de {items.length} noticias</p>
	<table>
		<thead>
			<tr>
				<th>Título</th>
				<th>Workflow</th>
				<th>Certeza</th>
				<th>Importancia</th>
				<th>Alcance</th>
				<th>Actualizada</th>
				<th>Autor</th>
			</tr>
		</thead>
		<tbody>
			{#each visible as item (item.id)}
				<tr>
					<td><a href={resolve(`/news/${item.id}`)}>{displayTitle(item)}</a></td>
					<td>
						{item.workflow}
						{#if item.indexPending}<span class="badge" title="Publicada, falta indexarla"
								>indexación pendiente</span
							>{/if}
					</td>
					<td>{item.certainty}</td>
					<td>{item.importance}</td>
					<td>{item.geo.scope}</td>
					<td>{formatDate(item.updatedAt)}</td>
					<td title={item.createdBy}>{item.createdBy.slice(0, 8)}</td>
				</tr>
			{:else}
				<tr><td colspan="7">No hay noticias que coincidan con los filtros.</td></tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	.badge {
		margin-left: 0.35rem;
		padding: 0 0.4rem;
		border-radius: 3px;
		background: #fff3cd;
		font-size: 0.75rem;
	}

	.filters {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		margin: 1rem 0;
	}

	.filters label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
	}

	.count {
		color: #666;
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.5rem;
		border-bottom: 1px solid #ddd;
		text-align: left;
	}
</style>
