<script lang="ts">
	import {
		LEAD_MAX_LENGTH,
		TITLE_WARN_LENGTH,
		type FieldIssue,
		type News,
		type NewsFieldName
	} from '@repo/shared';
	import { renderMarkdown } from '$lib/markdown';
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

	let showPreview = $state(false);
	const preview = $derived(renderMarkdown(news.body));
</script>

<section>
	<h2>Contenido</h2>

	<label for="title">Título</label>
	<input
		id="title"
		type="text"
		bind:value={news.title}
		oninput={() => onedit('title')}
		{readonly}
		aria-describedby="title-count"
	/>
	<p id="title-count" class="counter" class:over={news.title.trim().length > TITLE_WARN_LENGTH}>
		{news.title.trim().length} / {TITLE_WARN_LENGTH} recomendados
	</p>
	<FieldIssues {issues} field="title" show={touched.title === true} />

	<label for="lead">Entradilla</label>
	<textarea
		id="lead"
		rows="3"
		bind:value={news.lead}
		oninput={() => onedit('lead')}
		{readonly}
		aria-describedby="lead-count"></textarea>
	<p id="lead-count" class="counter" class:over={news.lead.trim().length > LEAD_MAX_LENGTH}>
		{news.lead.trim().length} / {LEAD_MAX_LENGTH}
	</p>
	<FieldIssues {issues} field="lead" show={touched.lead === true} />

	<div class="body-header">
		<label for="body">Cuerpo (markdown simple)</label>
		<button type="button" onclick={() => (showPreview = !showPreview)}>
			{showPreview ? 'Ocultar vista previa' : 'Ver vista previa'}
		</button>
	</div>
	<div class="body-grid" class:split={showPreview}>
		<textarea
			id="body"
			rows="14"
			bind:value={news.body}
			oninput={() => onedit('body')}
			{readonly}
			placeholder="Párrafos separados por una línea en blanco. > para citas textuales, **negrita**, *cursiva*."
		></textarea>
		{#if showPreview}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- renderMarkdown escapes all input -->
			<article class="preview" aria-label="Vista previa">{@html preview}</article>
		{/if}
	</div>
	<FieldIssues {issues} field="body" show={touched.body === true} />
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 2rem;
	}

	label {
		margin-top: 0.75rem;
		font-weight: 600;
	}

	input,
	textarea {
		font: inherit;
		padding: 0.5rem;
		width: 100%;
		box-sizing: border-box;
	}

	.counter {
		margin: 0;
		font-size: 0.8rem;
		color: #666;
	}

	.counter.over {
		color: #b00020;
		font-weight: 600;
	}

	.body-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.body-grid.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.preview {
		padding: 0.5rem 1rem;
		border: 1px solid #ddd;
		border-radius: 4px;
		overflow: auto;
	}

	.preview :global(blockquote) {
		margin-left: 0;
		padding-left: 1rem;
		border-left: 3px solid #ccc;
		color: #444;
	}
</style>
