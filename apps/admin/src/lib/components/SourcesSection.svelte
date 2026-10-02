<script lang="ts">
	import {
		buildSource,
		countConfirmingOrganizations,
		isValidSourceUrl,
		recomputeClaims,
		validateSourceForm,
		type FieldIssue,
		type News,
		type NewsFieldName,
		type Source,
		type SourceFormIssue
	} from '@repo/shared';
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

	const TYPES: { value: Source['type']; label: string }[] = [
		{ value: 'primaria', label: 'Primaria (documento o vocero oficial)' },
		{ value: 'agencia', label: 'Agencia de noticias' },
		{ value: 'medio', label: 'Medio de comunicación' },
		{ value: 'redes', label: 'Redes sociales' },
		{ value: 'otro', label: 'Otro' }
	];
	const SUPPORTS: { value: Source['supports']; label: string }[] = [
		{ value: 'confirma', label: 'Confirma' },
		{ value: 'contradice', label: 'Contradice' },
		{ value: 'contexto', label: 'Contexto' }
	];
	const dateFormat = new Intl.DateTimeFormat('es-GT', {
		dateStyle: 'medium',
		timeZone: 'America/Guatemala'
	});

	interface SourceForm {
		name: string;
		organization: string;
		url: string;
		type: Source['type'];
		supports: Source['supports'];
		note: string;
		refreshAccessedAt: boolean;
	}

	const emptyForm = (): SourceForm => ({
		name: '',
		organization: '',
		url: '',
		type: 'medio',
		supports: 'confirma',
		note: '',
		refreshAccessedAt: true
	});

	let form = $state<SourceForm>(emptyForm());
	let editingId = $state<string | null>(null);
	let formIssues = $state<SourceFormIssue[]>([]);

	const confirming = $derived(countConfirmingOrganizations(news.sources));

	function formIssuesFor(field: SourceFormIssue['field']) {
		return formIssues.filter((issue) => issue.field === field);
	}

	function startEdit(source: Source) {
		editingId = source.id;
		form = {
			name: source.name,
			organization: source.organization,
			url: source.url,
			type: source.type,
			supports: source.supports,
			note: source.note ?? '',
			refreshAccessedAt: false
		};
		formIssues = [];
	}

	function resetForm() {
		editingId = null;
		form = emptyForm();
		formIssues = [];
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		formIssues = validateSourceForm(form);
		if (formIssues.length > 0) return;

		const existing = news.sources.find((source) => source.id === editingId);
		const saved = buildSource({
			id: existing?.id ?? crypto.randomUUID(),
			name: form.name,
			organization: form.organization,
			url: form.url,
			type: form.type,
			supports: form.supports,
			note: form.note,
			accessedAt:
				existing && !form.refreshAccessedAt ? existing.accessedAt : new Date().toISOString()
		});

		news.sources = existing
			? news.sources.map((source) => (source.id === saved.id ? saved : source))
			: [...news.sources, saved];
		news.claims = recomputeClaims(news.claims, news.sources);
		onedit('sources');
		onedit('claims');
		resetForm();
	}

	function remove(source: Source) {
		news.sources = news.sources.filter((item) => item.id !== source.id);
		news.claims = recomputeClaims(news.claims, news.sources);
		if (editingId === source.id) resetForm();
		onedit('sources');
		onedit('claims');
	}
</script>

<section>
	<h2>Fuentes</h2>

	<p class="independence" class:enough={confirming >= 2} role="status">
		<strong>{confirming}</strong>
		{confirming === 1 ? 'organización distinta confirma' : 'organizaciones distintas confirman'}
		esta noticia (sin contar redes sociales). <em>Confirmada</em> necesita al menos 2.
	</p>

	{#if news.sources.length === 0}
		<p class="empty">Aún no hay fuentes. Una noticia sin fuentes no se puede publicar.</p>
	{:else}
		<ul class="sources">
			{#each news.sources as source (source.id)}
				<li>
					<div>
						<strong>{source.name}</strong> · {source.organization}
						<span class="badge {source.supports}">{source.supports}</span>
						<span class="badge">{source.type}</span>
					</div>
					{#if isValidSourceUrl(source.url)}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source link, http(s) only -->
						<a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
					{:else}
						<span class="error">{source.url} (URL no válida)</span>
					{/if}
					<small>Consultada el {dateFormat.format(new Date(source.accessedAt))}</small>
					{#if source.note}<small>Nota: {source.note}</small>{/if}
					{#if !readonly}
						<div class="row-actions">
							<button type="button" onclick={() => startEdit(source)}>Editar</button>
							<button type="button" onclick={() => remove(source)}>Quitar</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
	<FieldIssues {issues} field="sources" show={touched.sources === true} />

	{#if !readonly}
		<form onsubmit={submit} novalidate>
			<h3>{editingId ? 'Editar fuente' : 'Agregar fuente'}</h3>

			<label for="source-name">Nombre</label>
			<input id="source-name" type="text" bind:value={form.name} placeholder="Prensa Libre" />
			{#each formIssuesFor('name') as issue (issue.code)}
				<p class="error" role="alert">{issue.message}</p>
			{/each}

			<label for="source-org">Organización</label>
			<input
				id="source-org"
				type="text"
				bind:value={form.organization}
				placeholder="Grupo Prensa Libre"
			/>
			{#each formIssuesFor('organization') as issue (issue.code)}
				<p class="error" role="alert">{issue.message}</p>
			{/each}

			<label for="source-url">URL</label>
			<input
				id="source-url"
				type="url"
				bind:value={form.url}
				placeholder="https://ejemplo.org/nota"
			/>
			{#each formIssuesFor('url') as issue (issue.code)}
				<p class="error" role="alert">{issue.message}</p>
			{/each}

			<div class="inline">
				<label>
					Tipo
					<select bind:value={form.type}>
						{#each TYPES as type (type.value)}
							<option value={type.value}>{type.label}</option>
						{/each}
					</select>
				</label>
				<label>
					Qué dice la fuente
					<select bind:value={form.supports}>
						{#each SUPPORTS as supports (supports.value)}
							<option value={supports.value}>{supports.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<label for="source-note">Nota (opcional)</label>
			<input id="source-note" type="text" bind:value={form.note} />

			{#if editingId}
				<label class="check">
					<input type="checkbox" bind:checked={form.refreshAccessedAt} />
					Actualizar la fecha de consulta a ahora
				</label>
			{/if}

			<div class="row-actions">
				<button type="submit">{editingId ? 'Guardar fuente' : 'Agregar fuente'}</button>
				{#if editingId}<button type="button" onclick={resetForm}>Cancelar</button>{/if}
			</div>
		</form>
	{/if}
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	.independence {
		padding: 0.5rem 0.75rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}

	.independence.enough {
		background: #e8f5e9;
		border-color: #a5d6a7;
	}

	.empty {
		color: #666;
	}

	.sources {
		list-style: none;
		margin: 1rem 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.sources li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.badge {
		display: inline-block;
		margin-left: 0.35rem;
		padding: 0 0.4rem;
		border-radius: 3px;
		background: #eee;
		font-size: 0.75rem;
	}

	.badge.confirma {
		background: #c8e6c9;
	}

	.badge.contradice {
		background: #ffcdd2;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px dashed #bbb;
		border-radius: 4px;
	}

	form label {
		margin-top: 0.5rem;
		font-weight: 600;
	}

	form input[type='text'],
	form input[type='url'] {
		font: inherit;
		padding: 0.5rem;
	}

	.inline {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.inline label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.check {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		font-weight: 400;
	}

	.row-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #b00020;
	}
</style>
