<script lang="ts">
	import { type EnrichSuggestion, type News, type PublishField } from '@repo/shared';
	import { apiFetch } from '$lib/api';
	import {
		addSuggestedClaims,
		approveSummary,
		suggestedGeo,
		suggestedTopicKeys
	} from '$lib/enrichApply';
	import { jumpToField } from '$lib/publishTargets';
	import { session } from '$lib/session.svelte';

	let {
		news = $bindable(),
		readonly,
		onchange
	}: { news: News; readonly: boolean; onchange: () => void } = $props();

	let busy = $state(false);
	let errorMessage = $state('');
	let summaryApproved = $state(false);

	const suggestion = $derived(news.aiSuggestions);
	const canAsk = $derived(
		!readonly && !busy && news.title.trim() !== '' && news.body.trim() !== ''
	);

	// Starts from the approved text, else the suggestion; the editor can type over it.
	let summaryDraft = $derived(news.aiSummary?.text ?? suggestion?.summary ?? '');

	async function ask() {
		if (!canAsk) return;
		busy = true;
		errorMessage = '';

		try {
			const result = await apiFetch<EnrichSuggestion>('/admin/enrich', {
				method: 'POST',
				body: JSON.stringify({
					newsId: news.id,
					title: news.title,
					lead: news.lead,
					body: news.body,
					sources: news.sources.map(({ name, url }) => ({ name, url }))
				})
			});
			// Stored for the audit trail «IA sugirió X, se publicó Y»; nothing else changes.
			news.aiSuggestions = result;
			summaryApproved = false;
			onchange();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'No se pudo obtener sugerencias';
		} finally {
			busy = false;
		}
	}

	/** «Aceptar» applies the value; «Editar» applies it and takes the editor to the field. */
	function apply(field: PublishField, edit: boolean) {
		if (!suggestion) return;

		if (field === 'topics') news.topics = suggestedTopicKeys(suggestion);
		if (field === 'geo') news.geo = suggestedGeo(suggestion);
		if (field === 'importance') news.importance = suggestion.importance.value;
		onchange();
		if (edit) jumpToField(field);
	}

	function addClaims(texts: string[], edit: boolean) {
		if (!suggestion) return;
		const wanted = suggestion.claims.filter((claim) => texts.includes(claim.text));
		news.claims = addSuggestedClaims(news.claims, wanted, news.sources);
		onchange();
		if (edit) jumpToField('claims');
	}

	function approve() {
		const uid = session.user?.uid;
		if (!uid || summaryDraft.trim() === '') return;
		news.aiSummary = approveSummary(summaryDraft, uid);
		summaryApproved = true;
		onchange();
	}

	function removeSummary() {
		news.aiSummary = undefined;
		summaryApproved = false;
		onchange();
	}

	const claimAdded = (text: string) =>
		news.claims.some((claim) => claim.text.trim().toLowerCase() === text.trim().toLowerCase());
</script>

<section id="section-enrich">
	<h2>Asistente de IA</h2>
	<p class="hint">
		La IA solo sugiere: nada cambia hasta que aceptes cada campo, y la certeza la decides tú. Una
		llamada por contenido distinto; repetir sin cambios no cuesta.
	</p>

	<div class="row">
		<button type="button" onclick={ask} disabled={!canAsk}>
			{busy ? 'Pensando…' : suggestion ? 'Volver a sugerir con IA' : 'Sugerir con IA'}
		</button>
		{#if !readonly && (news.title.trim() === '' || news.body.trim() === '')}
			<small>Escribe el título y el cuerpo para poder pedir sugerencias.</small>
		{/if}
	</div>
	{#if errorMessage}<p class="error" role="alert">{errorMessage}</p>{/if}

	{#if suggestion}
		<p class="meta">
			Modelo {suggestion.model} · costo USD {suggestion.costUsd.toFixed(6)} ·
			{new Date(suggestion.createdAt).toLocaleString('es-GT', { timeZone: 'America/Guatemala' })}
		</p>

		<ul class="items">
			<li>
				<div>
					<strong>Temas</strong>
					{#each suggestion.topics as topic (topic.key)}
						<span class="chip">{topic.key} {Math.round(topic.confidence * 100)}%</span>
					{:else}
						<em>sin sugerencia</em>
					{/each}
				</div>
				{#if !readonly && suggestion.topics.length > 0}
					<div class="buttons">
						<button type="button" onclick={() => apply('topics', false)}>Aceptar</button>
						<button type="button" onclick={() => apply('topics', true)}>Editar</button>
					</div>
				{/if}
			</li>

			<li>
				<div>
					<strong>Alcance geográfico</strong>
					<span class="chip">{suggestion.geo.scope}</span>
					{#each [...suggestion.geo.countries, ...suggestion.geo.cityIds, ...suggestion.geo.regions] as place (place)}
						<span class="chip">{place}</span>
					{/each}
				</div>
				{#if !readonly}
					<div class="buttons">
						<button type="button" onclick={() => apply('geo', false)}>Aceptar</button>
						<button type="button" onclick={() => apply('geo', true)}>Editar</button>
					</div>
				{/if}
			</li>

			<li>
				<div>
					<strong>Importancia {suggestion.importance.value}</strong>
					<small>{suggestion.importance.rationale}</small>
				</div>
				{#if !readonly}
					<div class="buttons">
						<button type="button" onclick={() => apply('importance', false)}>Aceptar</button>
						<button type="button" onclick={() => apply('importance', true)}>Editar</button>
					</div>
				{/if}
			</li>

			<li class="stack">
				<div class="head">
					<strong>Afirmaciones verificables ({suggestion.claims.length})</strong>
					{#if !readonly && suggestion.claims.length > 0}
						<button
							type="button"
							onclick={() =>
								addClaims(
									suggestion.claims.map((claim) => claim.text),
									false
								)}
						>
							Agregar todas
						</button>
					{/if}
				</div>
				<small>Entran como «sin respaldo»: solo tú puedes vincularles una fuente.</small>
				<ul class="claims">
					{#each suggestion.claims as claim (claim.text)}
						<li>
							<span>
								{claim.text}
								{#if claim.needsSource}<em class="needs">necesita fuente</em>{/if}
							</span>
							{#if !readonly}
								{#if claimAdded(claim.text)}
									<small>Agregada</small>
								{:else}
									<button type="button" onclick={() => addClaims([claim.text], true)}
										>Agregar</button
									>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			</li>

			<li class="stack">
				<strong>Resumen sugerido</strong>
				<textarea rows="3" aria-label="Resumen sugerido" bind:value={summaryDraft} {readonly}
				></textarea>
				{#if news.aiSummary}
					<small>
						Aprobado{summaryApproved ? ' ahora' : ''}: se mostrará como «Resumen generado con IA ·
						revisado por ti».
					</small>
				{/if}
				{#if !readonly}
					<div class="buttons">
						<button type="button" onclick={approve} disabled={summaryDraft.trim() === ''}>
							{news.aiSummary ? 'Aprobar texto editado' : 'Aprobar resumen'}
						</button>
						{#if news.aiSummary}
							<button type="button" onclick={removeSummary}>Quitar resumen</button>
						{/if}
					</div>
				{/if}
			</li>

			<li class="stack" class:warn={suggestion.sensationalismFlag.flagged}>
				<strong>Título</strong>
				{#if suggestion.sensationalismFlag.flagged}
					<span>
						La IA marca un posible sensacionalismo: {suggestion.sensationalismFlag.reason ??
							'sin motivo'}
					</span>
					<small>Es solo una alerta: decides tú en el checklist editorial.</small>
				{:else}
					<span>Sin alerta de sensacionalismo.</span>
				{/if}
			</li>
		</ul>
	{/if}
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	.hint,
	.meta {
		color: #666;
		font-size: 0.85rem;
	}

	.row,
	.buttons,
	.head {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.head {
		justify-content: space-between;
	}

	.items {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.items > li {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.items > li.stack {
		flex-direction: column;
	}

	.items > li.warn {
		background: #fff8e1;
		border-color: #f0d58a;
	}

	.chip {
		display: inline-block;
		margin: 0 0.25rem;
		padding: 0 0.4rem;
		border-radius: 3px;
		background: #eee;
		font-size: 0.8rem;
	}

	.claims {
		list-style: none;
		margin: 0;
		padding: 0;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.claims li {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: center;
	}

	.needs {
		margin-left: 0.35rem;
		color: #8a5a00;
		font-size: 0.75rem;
	}

	textarea {
		font: inherit;
		padding: 0.5rem;
		width: 100%;
		box-sizing: border-box;
	}

	small {
		color: #666;
	}

	.error {
		color: #b00020;
	}
</style>
