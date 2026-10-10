<script lang="ts">
	import { resolve } from '$app/paths';
	import { resolvePublicFeedConfig, type News } from '@repo/shared';
	import { onMount } from 'svelte';
	import { buildComparison, COMPARATOR_PERSONAS, type ComparatorPersona } from '$lib/comparator';
	import { watchComparatorFeed } from '$lib/comparatorFeed';
	import { db } from '$lib/firebase';

	let news = $state<News[]>([]);
	let config = $state(resolvePublicFeedConfig(undefined));
	let persona = $state<ComparatorPersona>('neutral');
	let selectedId = $state('');
	let now = $state(new Date());
	let loading = $state(true);
	let errorMessage = $state('');
	const columns = $derived(buildComparison(news, config, persona, now));
	const selectedNews = $derived(news.find((item) => item.id === selectedId));
	const displayNews = $derived(news);

	onMount(() => {
		const stop = watchComparatorFeed(db, {
			next: (snapshot) => {
				news = snapshot.news;
				config = snapshot.config;
				if (!snapshot.news.some((item) => item.id === selectedId)) {
					selectedId = snapshot.news.find((item) => item.certainty !== 'retractada')?.id ?? '';
				}
				loading = false;
				errorMessage = '';
			},
			error: (error) => {
				loading = false;
				errorMessage = `No se pudo cargar el comparador: ${error.message}`;
			}
		});
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => {
			stop();
			clearInterval(timer);
		};
	});
</script>

<svelte:head><title>Comparador de ubicaciones</title></svelte:head>

<div class="heading">
	<div>
		<h1>Comparador de ubicaciones</h1>
		<p>Así cambia la posición de una noticia según la ciudad y el perfil simulado.</p>
	</div>
	<span class="live">Actualización en tiempo real</span>
</div>

<div class="controls">
	<label>
		Perfil de prueba
		<select bind:value={persona}>
			{#each COMPARATOR_PERSONAS as option (option.id)}
				<option value={option.id}>{option.label}</option>
			{/each}
		</select>
	</label>
	<label>
		Noticia para destacar
		<select bind:value={selectedId}>
			{#each displayNews as item (item.id)}
				<option value={item.id}>{item.title}</option>
			{/each}
		</select>
	</label>
</div>

{#if selectedNews}
	<p class="selected-story">
		<strong>Seleccionada:</strong>
		{selectedNews.title}
		<a href={resolve(`/news/${selectedNews.id}`)}>Abrir en el portal</a>
	</p>
{/if}

<p class="note">
	Posición E = “Lo que debes saber”; las demás posiciones son del feed. “—” indica que la noticia no
	aparece en esa ciudad. Las posiciones aplican la ventana de {config.feedWindowHours} horas; las esenciales
	conservan su ventana de 72 horas. Las retractadas quedan fuera del ranking.
</p>

{#if loading}
	<p role="status">Cargando comparación…</p>
{:else if errorMessage}
	<p role="alert">{errorMessage}</p>
{:else if displayNews.length === 0}
	<p>No hay noticias publicadas para comparar.</p>
{:else}
	<div
		class="table-scroll"
		role="region"
		aria-label="Comparación entre las ocho ubicaciones"
		tabindex="-1"
	>
		<table>
			<thead>
				<tr>
					<th scope="col">Noticia</th>
					{#each columns as column (column.location.id)}
						<th scope="col">{column.location.city}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each displayNews as item (item.id)}
					<tr class:selected={selectedId === item.id}>
						<th scope="row">
							<button
								class="story-button"
								onclick={() => (selectedId = item.id)}
								aria-pressed={selectedId === item.id}>{item.title}</button
							>
							{#if item.certainty === 'retractada'}<small>Retractada</small>{/if}
						</th>
						{#each columns as column (column.location.id)}
							{@const cell = column.cells.get(item.id)}
							<td>
								{#if cell}
									<span class="position"
										>{cell.section === 'mustKnow' ? 'E' : ''}{cell.position}</span
									>
									<span class={`tier ${cell.tier}`}>{cell.tier}</span>
								{:else}—{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h2>Diversidad en los primeros diez lugares</h2>
	<div class="diversity">
		{#each columns as column (column.location.id)}
			<section>
				<h3>{column.location.city}</h3>
				<p><strong>{column.ranking.diversity.topics}</strong> temas distintos</p>
				<ul>
					{#each Object.entries(column.ranking.diversity.scopes) as [scope, count] (scope)}
						<li>{scope}: {count}</li>
					{/each}
				</ul>
			</section>
		{/each}
	</div>
{/if}

<style>
	.heading {
		display: flex;
		justify-content: space-between;
		align-items: start;
		gap: 1rem;
	}
	.heading h1 {
		margin-top: 0;
	}
	.heading p,
	.note {
		color: #475569;
	}
	.live {
		padding: 0.45rem 0.75rem;
		border-radius: 999px;
		color: #166534;
		background: #dcfce7;
		white-space: nowrap;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		margin: 1.5rem 0;
	}
	.controls label {
		display: grid;
		gap: 0.35rem;
		flex: 1 1 14rem;
		font-weight: 600;
	}
	select {
		padding: 0.6rem;
		max-width: 100%;
	}
	.selected-story {
		padding: 0.8rem;
		background: #eff6ff;
		border-left: 4px solid #2563eb;
	}
	.selected-story a {
		margin-left: 1rem;
	}
	.note {
		font-size: 0.9rem;
	}
	.table-scroll {
		overflow-x: auto;
		max-width: 100%;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
	}
	table {
		border-collapse: collapse;
		width: 100%;
		min-width: 1120px;
	}
	th,
	td {
		padding: 0.7rem;
		border-bottom: 1px solid #e2e8f0;
		text-align: left;
		min-width: 105px;
	}
	thead th {
		background: #f1f5f9;
	}
	tbody th {
		min-width: 220px;
		max-width: 280px;
	}
	tr.selected {
		background: #dbeafe;
	}
	.story-button {
		padding: 0;
		border: 0;
		background: none;
		color: #1d4ed8;
		text-align: left;
		cursor: pointer;
		font: inherit;
	}
	.story-button:focus-visible {
		outline: 2px solid #1d4ed8;
	}
	small {
		display: block;
		color: #991b1b;
	}
	.position {
		display: inline-block;
		min-width: 2.2rem;
		font-weight: 700;
	}
	.tier {
		display: inline-block;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		background: #e2e8f0;
		font-size: 0.8rem;
	}
	.tier.esencial {
		background: #991b1b;
		color: #fff;
	}
	.tier.hero {
		background: #1d4ed8;
		color: #fff;
	}
	.tier.grande {
		background: #065f46;
		color: #fff;
	}
	.tier.mediana {
		background: #7c2d12;
		color: #fff;
	}
	.tier.compacta {
		background: #e2e8f0;
		color: #0f172a;
	}
	.diversity {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 0.75rem;
	}
	.diversity section {
		padding: 0.75rem;
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
	}
	.diversity h3 {
		margin: 0 0 0.4rem;
	}
	.diversity p {
		margin: 0.25rem 0;
	}
	.diversity ul {
		margin: 0.4rem 0 0;
		padding-left: 1.2rem;
	}
	@media (max-width: 640px) {
		.heading {
			display: block;
		}
		.selected-story a {
			display: block;
			margin: 0.5rem 0 0;
		}
	}
</style>
