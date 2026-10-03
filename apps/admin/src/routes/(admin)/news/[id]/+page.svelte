<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import {
		CERTAINTY_RULES,
		validateNewsFields,
		validatePublish,
		type AiMode,
		type News,
		type NewsFieldName
	} from '@repo/shared';
	import { Autosaver, type SaveStatus } from '$lib/autosave';
	import ClaimsSection from '$lib/components/ClaimsSection.svelte';
	import ClassificationSection from '$lib/components/ClassificationSection.svelte';
	import ContentSection from '$lib/components/ContentSection.svelte';
	import PublicationStatus from '$lib/components/PublicationStatus.svelte';
	import PublishSection from '$lib/components/PublishSection.svelte';
	import SourcesSection from '$lib/components/SourcesSection.svelte';
	import { db } from '$lib/firebase';
	import { fetchHealth, upsertNews } from '$lib/indexApi';
	import { loadNews, saveNewsFields } from '$lib/newsStore';
	import {
		clearIndexPending,
		indexNews,
		PublishBlockedError,
		publishNews,
		type IndexOutcome
	} from '$lib/publishFlow';
	import { session } from '$lib/session.svelte';

	const STATUS_LABELS: Record<SaveStatus, string> = {
		idle: '',
		dirty: 'Cambios sin guardar…',
		saving: 'Guardando…',
		saved: 'Guardado',
		error: 'Error al guardar'
	};

	let news = $state<News | null>(null);
	let loadState = $state<'loading' | 'ready' | 'missing' | 'error'>('loading');
	let loadError = $state('');
	let touched = $state<Partial<Record<NewsFieldName, boolean>>>({});
	let saveStatus = $state<SaveStatus>('idle');
	let saveError = $state('');
	let publishing = $state(false);
	let indexing = $state(false);
	let publishError = $state('');
	let indexOutcome = $state<IndexOutcome | null>(null);
	let aiMode = $state<AiMode | null>(null);

	// Published news stay read-only until F2-08 adds the mandatory correction entry.
	const readonly = $derived(news?.workflow === 'publicada');
	const issues = $derived(news ? validateNewsFields(news) : []);
	const pendingErrors = $derived(issues.filter((issue) => issue.severity === 'error').length);
	const publishResult = $derived(news ? validatePublish(news) : { ok: false, errors: [] });

	const saver = new Autosaver(
		async () => {
			if (news) await saveNewsFields(db, $state.snapshot(news) as News);
		},
		() => {
			saveStatus = saver.status;
			saveError = saver.errorMessage;
		}
	);

	function edited(field: NewsFieldName) {
		touched[field] = true;
		saver.schedule();
	}

	async function runIndex(item: News) {
		indexing = true;
		try {
			const [outcome, health] = await Promise.all([
				indexNews(item, {
					upsert: upsertNews,
					clearPending: (id) => clearIndexPending(db, id)
				}),
				fetchHealth().catch(() => null)
			]);
			indexOutcome = outcome;
			aiMode = health?.aiMode ?? null;
			if (outcome.status === 'indexed' && news) news.indexPending = false;
		} finally {
			indexing = false;
		}
	}

	async function publish() {
		const current = news;
		const uid = session.user?.uid;
		if (!current || !uid || publishing) return;

		const label = CERTAINTY_RULES[current.certainty].label;
		if (!window.confirm(`¿Publicar como «${label}»? Los lectores la verán de inmediato.`)) return;

		publishing = true;
		publishError = '';
		indexOutcome = null;

		try {
			await saver.flush();
			if (saver.status === 'error') {
				throw new Error(`No se pudo guardar el borrador: ${saver.errorMessage}`);
			}
			const published = await publishNews(db, current.id, uid);
			news = published;
			await runIndex(published);
		} catch (error) {
			publishError =
				error instanceof PublishBlockedError
					? `No se publicó: ${error.message}`
					: error instanceof Error
						? error.message
						: 'Error desconocido';
		} finally {
			publishing = false;
		}
	}

	onMount(async () => {
		try {
			news = await loadNews(db, page.params.id ?? '');
			loadState = news ? 'ready' : 'missing';
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Error desconocido';
			loadState = 'error';
		}
	});

	onDestroy(() => {
		void saver.flush();
		saver.dispose();
	});

	function warnBeforeLeaving(event: BeforeUnloadEvent) {
		if (saveStatus === 'dirty' || saveStatus === 'saving' || saveStatus === 'error') {
			event.preventDefault();
		}
	}
</script>

<svelte:window onbeforeunload={warnBeforeLeaving} />

<p><a href={resolve('/news')}>← Noticias</a></p>

{#if loadState === 'loading'}
	<p>Cargando noticia…</p>
{:else if loadState === 'missing'}
	<h1>Noticia no encontrada</h1>
	<p>No existe una noticia con el id <code>{page.params.id}</code>.</p>
{:else if loadState === 'error'}
	<p role="alert">No se pudo cargar la noticia: {loadError}</p>
{:else if news}
	<div class="header">
		<h1>{news.title.trim() === '' ? 'Borrador sin título' : news.title}</h1>
		<p class="save-status" class:error={saveStatus === 'error'} role="status">
			{STATUS_LABELS[saveStatus]}
			{#if saveStatus === 'error'}: {saveError}{/if}
		</p>
	</div>

	<p class="meta">
		Workflow: <strong>{news.workflow}</strong> · Certeza: <strong>{news.certainty}</strong> ·
		{pendingErrors === 0 ? 'Campos completos' : `${pendingErrors} campo(s) por completar`}
	</p>

	{#if readonly}
		<p class="notice" role="note">
			Esta noticia está publicada y es de solo lectura. Editarla exige registrar una corrección
			(F2-08).
		</p>
	{/if}

	<ContentSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<ClassificationSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<SourcesSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<ClaimsSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<PublishSection
		bind:news
		result={publishResult}
		{readonly}
		{publishing}
		onchange={() => saver.schedule()}
		onpublish={publish}
	/>
	{#if publishError}
		<p role="alert" class="publish-error">{publishError}</p>
	{/if}
	{#if news.workflow === 'publicada'}
		<PublicationStatus
			{news}
			outcome={indexOutcome}
			{aiMode}
			busy={indexing}
			onretry={() => runIndex(news!)}
		/>
	{/if}
{/if}

<style>
	.header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.save-status {
		margin: 0;
		color: #2e7d32;
		white-space: nowrap;
	}

	.save-status.error {
		color: #b00020;
	}

	.meta {
		color: #666;
	}

	.publish-error {
		color: #b00020;
	}

	.notice {
		padding: 0.75rem 1rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}
</style>
