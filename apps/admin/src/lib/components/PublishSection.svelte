<script lang="ts">
	import {
		CERTAINTY_RULES,
		CHECKLIST_LABELS,
		type Certainty,
		type ChecklistItem,
		type News,
		type PublishValidation
	} from '@repo/shared';
	import { hasJumpTarget, jumpToField } from '$lib/publishTargets';

	let {
		news = $bindable(),
		result,
		readonly,
		onchange,
		onpublish
	}: {
		news: News;
		result: PublishValidation;
		readonly: boolean;
		onchange: () => void;
		/** Wired by F2-06; until then the button stays disabled even when the news is ready. */
		onpublish?: () => void;
	} = $props();

	const CERTAINTIES = Object.keys(CERTAINTY_RULES) as Certainty[];
	const CHECKLIST_ITEMS = Object.keys(CHECKLIST_LABELS) as ChecklistItem[];

	const needsNote = $derived(news.certainty === 'en_desarrollo' || news.certainty === 'disputada');
	const noteLabel = $derived(
		news.certainty === 'disputada'
			? 'Nota: describe las dos versiones en conflicto'
			: 'Nota: qué falta confirmar'
	);

	function setCertainty(value: Certainty) {
		news.certainty = value;
		onchange();
	}

	function setNote(value: string) {
		news.certaintyNote = value.trim() === '' ? undefined : value;
		onchange();
	}

	function toggleChecklist(item: ChecklistItem) {
		news.checklist = { ...news.checklist, [item]: !news.checklist[item] };
		onchange();
	}
</script>

<section id="section-publish">
	<h2>Certeza y publicación</h2>
	<p class="hint">
		La certeza la decides tú, nunca un modelo. Cada opción exige lo que dice abajo; si no se cumple,
		el botón Publicar queda bloqueado y te decimos qué falta.
	</p>

	<fieldset id="certainty-options" disabled={readonly}>
		<legend>Certeza que verá el lector</legend>
		{#each CERTAINTIES as certainty (certainty)}
			{@const rule = CERTAINTY_RULES[certainty]}
			{@const unavailable = certainty === 'retractada'}
			<label class="option" class:unavailable>
				<input
					type="radio"
					name="certainty"
					value={certainty}
					checked={news.certainty === certainty}
					disabled={unavailable}
					onchange={() => setCertainty(certainty)}
				/>
				<span>
					<strong>{rule.label}</strong>
					<small>Requisito: {rule.requirement}</small>
					<small>El lector ve: {rule.reader}</small>
					{#if unavailable}
						<small>Se aplica con la acción «Retractar» de una noticia ya publicada (F2-08).</small>
					{/if}
				</span>
			</label>
		{/each}
	</fieldset>

	{#if needsNote}
		<label for="certainty-note">{noteLabel}</label>
		<textarea
			id="certainty-note"
			rows="3"
			value={news.certaintyNote ?? ''}
			{readonly}
			oninput={(event) => setNote(event.currentTarget.value)}></textarea>
	{/if}

	<fieldset id="section-checklist" disabled={readonly}>
		<legend>Checklist editorial (todas para publicar)</legend>
		{#each CHECKLIST_ITEMS as item (item)}
			<label class="check">
				<input
					type="checkbox"
					checked={news.checklist[item]}
					onchange={() => toggleChecklist(item)}
				/>
				{CHECKLIST_LABELS[item]}
			</label>
		{/each}
	</fieldset>

	<div class="status" class:ready={result.ok} role="status" aria-live="polite">
		{#if result.ok}
			<p><strong>Lista para publicar como «{CERTAINTY_RULES[news.certainty].label}».</strong></p>
		{:else}
			<p>
				<strong>
					{result.errors.length}
					{result.errors.length === 1 ? 'cosa por resolver' : 'cosas por resolver'} antes de publicar:
				</strong>
			</p>
			<ul>
				{#each result.errors as error (error.code + error.message)}
					<li>
						{error.message}
						{#if hasJumpTarget(error.field)}
							<button type="button" class="link" onclick={() => jumpToField(error.field)}>
								Ir al campo
							</button>
						{:else}
							<small>(se resuelve en la sección de imagen, que llega con F2-07)</small>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="actions">
		<button type="button" disabled={readonly || !result.ok || !onpublish} onclick={onpublish}>
			Publicar
		</button>
		{#if result.ok && !onpublish && !readonly}
			<small>La publicación se activa con F2-06.</small>
		{/if}
	</div>
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	.hint {
		color: #666;
		font-size: 0.9rem;
	}

	fieldset {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	legend {
		font-weight: 600;
		padding: 0 0.5rem;
	}

	.option,
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
		margin: 0.5rem 0;
	}

	.option span {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.option.unavailable {
		opacity: 0.6;
	}

	small {
		color: #666;
	}

	textarea {
		display: block;
		font: inherit;
		padding: 0.5rem;
		width: 100%;
		box-sizing: border-box;
		margin-top: 0.25rem;
	}

	label[for='certainty-note'] {
		display: block;
		margin-top: 0.75rem;
		font-weight: 600;
	}

	.status {
		margin: 1rem 0;
		padding: 0.75rem 1rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}

	.status.ready {
		background: #e8f5e9;
		border-color: #a5d6a7;
	}

	.status p {
		margin: 0 0 0.5rem;
	}

	.status ul {
		margin: 0;
		padding-left: 1.25rem;
	}

	.status li {
		margin: 0.35rem 0;
	}

	.link {
		margin-left: 0.5rem;
		padding: 0;
		border: none;
		background: none;
		color: #0b57d0;
		text-decoration: underline;
		cursor: pointer;
		font: inherit;
	}

	.actions {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
</style>
