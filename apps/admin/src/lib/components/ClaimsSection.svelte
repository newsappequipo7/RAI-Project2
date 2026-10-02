<script lang="ts">
	import {
		createClaim,
		recomputeClaims,
		type Claim,
		type FieldIssue,
		type News,
		type NewsFieldName
	} from '@repo/shared';
	import { toggleValue } from '$lib/newsStore';
	import FieldIssues from './FieldIssues.svelte';

	let {
		news = $bindable(),
		issues,
		touched,
		readonly,
		onedit
	}: {
		news: News;
		issues: FieldIssue[];
		touched: Partial<Record<NewsFieldName, boolean>>;
		readonly: boolean;
		onedit: (field: NewsFieldName) => void;
	} = $props();

	const STATUS_LABELS: Record<Claim['status'], string> = {
		respaldada: 'Respaldada',
		sin_respaldo: 'Sin respaldo',
		en_disputa: 'En disputa'
	};
	const SUPPORT_LABELS = { confirma: 'confirma', contradice: 'contradice', contexto: 'contexto' };

	let newText = $state('');
	let newSourceIds = $state<string[]>([]);
	let newTextError = $state('');

	function addClaim(event: SubmitEvent) {
		event.preventDefault();
		if (newText.trim() === '') {
			newTextError = 'Escribe el texto de la afirmación.';
			return;
		}

		news.claims = [
			...news.claims,
			createClaim(crypto.randomUUID(), newText, newSourceIds, news.sources)
		];
		newText = '';
		newSourceIds = [];
		newTextError = '';
		onedit('claims');
	}

	function toggleSource(claim: Claim, sourceId: string) {
		news.claims = recomputeClaims(
			news.claims.map((item) =>
				item.id === claim.id ? { ...item, sourceIds: toggleValue(item.sourceIds, sourceId) } : item
			),
			news.sources
		);
		onedit('claims');
	}

	function editText(claim: Claim, text: string) {
		news.claims = news.claims.map((item) => (item.id === claim.id ? { ...item, text } : item));
		onedit('claims');
	}

	function remove(claim: Claim) {
		news.claims = news.claims.filter((item) => item.id !== claim.id);
		onedit('claims');
	}
</script>

<section id="section-claims">
	<h2>Afirmaciones verificables</h2>
	<p class="hint">
		El estado se calcula solo a partir de las fuentes vinculadas: <strong>respaldada</strong> si al
		menos una confirma, <strong>en disputa</strong> si alguna contradice y
		<strong>sin respaldo</strong> en cualquier otro caso.
	</p>

	{#if news.claims.length === 0}
		<p class="empty">Aún no hay afirmaciones.</p>
	{:else}
		<ul class="claims">
			{#each news.claims as claim (claim.id)}
				<li>
					<div class="claim-head">
						<span class="status {claim.status}">{STATUS_LABELS[claim.status]}</span>
						{#if claim.suggestedByAi}<span class="ai">Sugerida por IA</span>{/if}
					</div>
					<input
						type="text"
						aria-label="Texto de la afirmación"
						value={claim.text}
						{readonly}
						oninput={(event) => editText(claim, event.currentTarget.value)}
					/>
					{#if news.sources.length === 0}
						<small>Agrega fuentes para poder vincularlas.</small>
					{:else}
						<fieldset disabled={readonly}>
							<legend>Fuentes vinculadas</legend>
							{#each news.sources as source (source.id)}
								<label class="check">
									<input
										type="checkbox"
										checked={claim.sourceIds.includes(source.id)}
										onchange={() => toggleSource(claim, source.id)}
									/>
									{source.name} ({SUPPORT_LABELS[source.supports]})
								</label>
							{/each}
						</fieldset>
					{/if}
					{#if !readonly}
						<div>
							<button type="button" onclick={() => remove(claim)}>Quitar afirmación</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<FieldIssues {issues} field="claims" show={touched.claims === true} />

	{#if !readonly}
		<form onsubmit={addClaim} novalidate>
			<h3>Agregar afirmación</h3>
			<label for="claim-text">Texto</label>
			<textarea id="claim-text" rows="2" bind:value={newText}></textarea>
			{#if newTextError}<p class="error" role="alert">{newTextError}</p>{/if}

			{#if news.sources.length > 0}
				<fieldset>
					<legend>Fuentes vinculadas</legend>
					{#each news.sources as source (source.id)}
						<label class="check">
							<input
								type="checkbox"
								checked={newSourceIds.includes(source.id)}
								onchange={() => (newSourceIds = toggleValue(newSourceIds, source.id))}
							/>
							{source.name} ({SUPPORT_LABELS[source.supports]})
						</label>
					{/each}
				</fieldset>
			{/if}
			<div><button type="submit">Agregar afirmación</button></div>
		</form>
	{/if}
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	.hint,
	.empty {
		color: #666;
		font-size: 0.9rem;
	}

	.claims {
		list-style: none;
		margin: 1rem 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.claims li {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.claim-head {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.status {
		padding: 0 0.5rem;
		border-radius: 3px;
		font-size: 0.8rem;
		font-weight: 600;
		background: #eee;
	}

	.status.respaldada {
		background: #c8e6c9;
	}

	.status.en_disputa {
		background: #ffe0b2;
	}

	.ai {
		font-size: 0.75rem;
		color: #555;
	}

	input[type='text'],
	textarea {
		font: inherit;
		padding: 0.5rem;
		width: 100%;
		box-sizing: border-box;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px dashed #bbb;
		border-radius: 4px;
	}

	fieldset {
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.check {
		display: flex;
		gap: 0.4rem;
		align-items: center;
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #b00020;
	}
</style>
