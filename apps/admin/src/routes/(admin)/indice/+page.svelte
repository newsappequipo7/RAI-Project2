<script lang="ts">
	import {
		buildSeedNews,
		toIndexInput,
		type IndexSearchResponse,
		type IndexUpsertResponse,
		type SeedNews
	} from '@repo/shared';
	import seedNews from '@repo/shared/fixtures/news.json';
	import { apiFetch } from '$lib/api';
	import {
		CALIBRATION_NEWS,
		CALIBRATION_QUERIES,
		RETRACTED_ID,
		RETRACTED_QUERY
	} from '$lib/ragCalibration';

	interface Row {
		query: string;
		expectedId: string;
		topId: string | null;
		topScore: number | null;
		ok: boolean;
		retractedShown: boolean;
	}

	let rows = $state<Row[]>([]);
	let loaded = $state<IndexUpsertResponse | null>(null);
	let errorMessage = $state('');
	let running = $state(false);

	function search(query: string) {
		return apiFetch<IndexSearchResponse>('/admin/index/search', {
			method: 'POST',
			body: JSON.stringify({ query, topK: 6 })
		});
	}

	async function indexSeedCorpus() {
		running = true;
		errorMessage = '';

		try {
			const news = buildSeedNews(seedNews as SeedNews[]).map(toIndexInput);
			loaded = await apiFetch<IndexUpsertResponse>('/admin/index/rebuild', {
				method: 'POST',
				body: JSON.stringify({ news })
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Error desconocido';
		} finally {
			running = false;
		}
	}

	async function runCalibration() {
		running = true;
		errorMessage = '';
		rows = [];

		try {
			loaded = await apiFetch<IndexUpsertResponse>('/admin/index/rebuild', {
				method: 'POST',
				body: JSON.stringify({ news: CALIBRATION_NEWS })
			});

			const queries = [
				...CALIBRATION_QUERIES,
				{ query: RETRACTED_QUERY, expectedId: RETRACTED_ID }
			];
			const results: Row[] = [];

			for (const { query, expectedId } of queries) {
				const { hits } = await search(query);
				const top = hits[0];
				results.push({
					query,
					expectedId,
					topId: top?.id ?? null,
					topScore: top?.score ?? null,
					ok: top?.id === expectedId,
					retractedShown: hits.some((hit) => hit.id === RETRACTED_ID)
				});
			}

			rows = results;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Error desconocido';
		} finally {
			running = false;
		}
	}
</script>

<h1>Índice de búsqueda</h1>
<p>
	Reemplaza el índice con {CALIBRATION_NEWS.length} noticias de prueba y corre 5 consultas en español
	más una consulta sobre la noticia retractada (no debe aparecer).
</p>

<button onclick={runCalibration} disabled={running}>Cargar corpus y correr consultas</button>
<button onclick={indexSeedCorpus} disabled={running}
	>Indexar corpus semilla ({seedNews.length})</button
>

{#if errorMessage}
	<p role="alert">{errorMessage}</p>
{/if}

{#if loaded}
	<p>Versión del índice: {loaded.indexVersion} · noticias: {loaded.upserted}</p>
{/if}

{#if rows.length}
	<table>
		<thead>
			<tr><th>Consulta</th><th>Esperada</th><th>Primer resultado</th><th>Puntaje</th><th>OK</th></tr
			>
		</thead>
		<tbody>
			{#each rows as row (row.query)}
				<tr>
					<td>{row.query}</td>
					<td>{row.expectedId}</td>
					<td>{row.topId ?? '—'}</td>
					<td>{row.topScore ?? '—'}</td>
					<td>
						{#if row.expectedId === RETRACTED_ID}
							{row.retractedShown ? '✗ apareció' : '✓ no aparece'}
						{:else}
							{row.ok ? '✓' : '✗'}
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	table {
		margin-top: 1rem;
		border-collapse: collapse;
	}

	th,
	td {
		padding: 0.4rem 0.75rem;
		border: 1px solid #ccc;
		text-align: left;
	}
</style>
