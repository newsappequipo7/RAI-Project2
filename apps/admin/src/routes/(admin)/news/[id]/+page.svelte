<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import {
		CERTAINTY_RULES,
		changedFields,
		CORRECTION_SUMMARY_MAX,
		correctionSummaryIssue,
		RevisionError,
		validateNewsFields,
		validatePublish,
		type AiMode,
		type News,
		type NewsFieldName,
		type RevisionKind
	} from '@repo/shared';
	import { Autosaver, type SaveStatus } from '$lib/autosave';
	import ClaimsSection from '$lib/components/ClaimsSection.svelte';
	import ClassificationSection from '$lib/components/ClassificationSection.svelte';
	import ContentSection from '$lib/components/ContentSection.svelte';
	import HistorySection from '$lib/components/HistorySection.svelte';
	import ImageSection from '$lib/components/ImageSection.svelte';
	import PublicationStatus from '$lib/components/PublicationStatus.svelte';
	import PublishSection from '$lib/components/PublishSection.svelte';
	import SourcesSection from '$lib/components/SourcesSection.svelte';
	import { db } from '$lib/firebase';
	import { fetchHealth, removeFromIndex, upsertNews } from '$lib/indexApi';
	import { loadNews, saveNewsFields } from '$lib/newsStore';
	import {
		clearIndexPending,
		indexNews,
		PublishBlockedError,
		publishNews,
		type IndexOutcome
	} from '$lib/publishFlow';
	import { retractNews, saveRevision } from '$lib/revisionFlow';
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

	// Correcting a published news (F2-08): edits stay local until a correction entry is saved.
	let revising = $state(false);
	let original = $state<News | null>(null);
	let revisionKind = $state<RevisionKind>('correccion');
	let revisionSummary = $state('');
	let retractOpen = $state(false);
	let retractSummary = $state('');
	let correctionBusy = $state(false);
	let correctionError = $state('');
	let correctionAttempted = $state(false);

	const isPublished = $derived(news?.workflow === 'publicada');
	const isRetracted = $derived(news?.certainty === 'retractada');
	const readonly = $derived(isPublished && !revising);
	const changed = $derived(revising && original && news ? changedFields(original, news) : []);
	const summaryIssue = $derived(correctionSummaryIssue(revisionSummary));
	const issues = $derived(news ? validateNewsFields(news) : []);
	const pendingErrors = $derived(issues.filter((issue) => issue.severity === 'error').length);
	const publishResult = $derived(news ? validatePublish(news) : { ok: false, errors: [] });

	const saver = new Autosaver(
		async () => {
			if (news && news.workflow !== 'publicada') {
				await saveNewsFields(db, $state.snapshot(news) as News);
			}
		},
		() => {
			saveStatus = saver.status;
			saveError = saver.errorMessage;
		}
	);

	/** Drafts autosave; a published news is only saved through a correction entry. */
	function afterChange() {
		if (!isPublished) saver.schedule();
	}

	function edited(field: NewsFieldName) {
		touched[field] = true;
		afterChange();
	}

	async function runIndex(item: News) {
		indexing = true;
		try {
			const [outcome, health] = await Promise.all([
				indexNews(item, {
					upsert: upsertNews,
					remove: removeFromIndex,
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

	function resetCorrectionForms() {
		revisionSummary = '';
		retractSummary = '';
		correctionError = '';
		correctionAttempted = false;
		retractOpen = false;
	}

	function startRevising() {
		if (!news) return;
		original = $state.snapshot(news) as News;
		revising = true;
		retractOpen = false;
		resetCorrectionForms();
	}

	function cancelRevising() {
		if (original) news = original;
		original = null;
		revising = false;
		touched = {};
		resetCorrectionForms();
	}

	function describe(error: unknown): string {
		if (error instanceof PublishBlockedError) return `No se guardó: ${error.message}`;
		if (error instanceof RevisionError) return error.message;
		return error instanceof Error ? error.message : 'Error desconocido';
	}

	async function submitRevision() {
		const current = news;
		const uid = session.user?.uid;
		correctionAttempted = true;
		if (!current || !uid || correctionBusy || summaryIssue || changed.length === 0) return;
		if (
			!window.confirm('¿Guardar esta corrección? Los lectores verán el resumen que escribiste.')
		) {
			return;
		}

		correctionBusy = true;
		correctionError = '';
		indexOutcome = null;
		try {
			const saved = await saveRevision(
				db,
				current.id,
				$state.snapshot(current) as News,
				{ kind: revisionKind, summary: revisionSummary },
				uid
			);
			news = saved;
			original = null;
			revising = false;
			touched = {};
			resetCorrectionForms();
			await runIndex(saved);
		} catch (error) {
			correctionError = describe(error);
		} finally {
			correctionBusy = false;
		}
	}

	async function submitRetraction() {
		const current = news;
		const uid = session.user?.uid;
		correctionAttempted = true;
		if (!current || !uid || correctionBusy || correctionSummaryIssue(retractSummary)) return;
		if (
			!window.confirm(
				'¿Retractar esta noticia? Seguirá visible con su corrección, pero saldrá del feed y del chat. No se puede deshacer.'
			)
		) {
			return;
		}

		correctionBusy = true;
		correctionError = '';
		indexOutcome = null;
		try {
			const retracted = await retractNews(db, current.id, retractSummary, uid);
			news = retracted;
			resetCorrectionForms();
			await runIndex(retracted);
		} catch (error) {
			correctionError = describe(error);
		} finally {
			correctionBusy = false;
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
		const unsavedCorrection = revising && changed.length > 0;
		if (
			unsavedCorrection ||
			saveStatus === 'dirty' ||
			saveStatus === 'saving' ||
			saveStatus === 'error'
		) {
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

	{#if isPublished && !revising}
		<div class="notice" role="note">
			{#if isRetracted}
				<p>
					Esta noticia fue retractada. Sigue visible con su corrección, pero ya no se puede editar.
				</p>
			{:else}
				<p>
					Esta noticia está publicada. Para cambiarla debes registrar una corrección que verán los
					lectores.
				</p>
				<div class="actions">
					<button type="button" onclick={startRevising} disabled={correctionBusy}>
						Corregir noticia
					</button>
					<button
						type="button"
						onclick={() => (retractOpen = !retractOpen)}
						disabled={correctionBusy}
					>
						Retractar noticia
					</button>
				</div>
			{/if}
		</div>

		{#if retractOpen && !isRetracted}
			<div class="correction-form" role="group" aria-label="Retractar noticia">
				<h2>Retractar noticia</h2>
				<p class="hint">
					La noticia no se borra: queda con su texto tachado y esta explicación visible, y sale del
					feed y del chat.
				</p>
				<label for="retract-summary">Por qué se retracta (lo verán los lectores)</label>
				<textarea id="retract-summary" rows="3" bind:value={retractSummary}></textarea>
				<p class="counter">{retractSummary.trim().length} / {CORRECTION_SUMMARY_MAX}</p>
				{#if correctionAttempted && correctionSummaryIssue(retractSummary)}
					<p class="error" role="alert">{correctionSummaryIssue(retractSummary)}</p>
				{/if}
				<div class="actions">
					<button type="button" class="danger" onclick={submitRetraction} disabled={correctionBusy}>
						{correctionBusy ? 'Retractando…' : 'Retractar'}
					</button>
					<button type="button" onclick={resetCorrectionForms} disabled={correctionBusy}>
						Cancelar
					</button>
				</div>
			</div>
		{/if}
	{:else if revising}
		<p class="notice" role="note">
			Estás corrigiendo una noticia publicada. Nada se guarda hasta que registres la corrección al
			final de la página.
		</p>
	{/if}
	{#if correctionError}
		<p role="alert" class="publish-error">{correctionError}</p>
	{/if}

	<ContentSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<ClassificationSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<SourcesSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<ClaimsSection bind:news {issues} {touched} {readonly} onedit={edited} />
	<ImageSection bind:news {readonly} onchange={afterChange} />
	<PublishSection
		bind:news
		result={publishResult}
		{readonly}
		{publishing}
		canPublish={!isPublished}
		onchange={afterChange}
		onpublish={publish}
	/>

	{#if revising}
		<section class="correction-form" id="section-correction">
			<h2>Registrar la corrección</h2>
			<p class="hint">
				Cada cambio a una noticia publicada crea una versión nueva y deja una entrada visible para
				los lectores.
			</p>

			{#if changed.length === 0}
				<p class="hint">Aún no hay cambios respecto a la versión publicada.</p>
			{:else}
				<p>Campos modificados: <strong>{changed.join(', ')}</strong></p>
			{/if}

			{#if !publishResult.ok}
				<p class="error" role="alert">
					Con estos cambios la noticia dejaría de cumplir los requisitos de publicación: revisa la
					lista «cosas por resolver» más arriba.
				</p>
			{/if}

			<label for="revision-kind">Tipo de entrada</label>
			<select id="revision-kind" bind:value={revisionKind}>
				<option value="correccion">Corrección: se arregló un error</option>
				<option value="actualizacion">Actualización: hay información nueva</option>
			</select>

			<label for="revision-summary">Resumen para los lectores</label>
			<textarea id="revision-summary" rows="3" bind:value={revisionSummary}></textarea>
			<p class="counter">{revisionSummary.trim().length} / {CORRECTION_SUMMARY_MAX}</p>
			{#if correctionAttempted && summaryIssue}
				<p class="error" role="alert">{summaryIssue}</p>
			{/if}

			<div class="actions">
				<button
					type="button"
					onclick={submitRevision}
					disabled={correctionBusy || changed.length === 0 || !publishResult.ok}
				>
					{correctionBusy ? 'Guardando…' : 'Guardar corrección'}
				</button>
				<button type="button" onclick={cancelRevising} disabled={correctionBusy}>Cancelar</button>
			</div>
		</section>
	{/if}
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
		<HistorySection newsId={news.id} version={news.version} />
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

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.correction-form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 1rem 0 2rem;
		padding: 1rem;
		border: 1px dashed #bbb;
		border-radius: 4px;
	}

	.correction-form label {
		margin-top: 0.5rem;
		font-weight: 600;
	}

	.correction-form textarea,
	.correction-form select {
		font: inherit;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.hint,
	.counter {
		margin: 0;
		color: #666;
		font-size: 0.85rem;
	}

	.error {
		margin: 0;
		color: #b00020;
		font-size: 0.9rem;
	}

	.danger {
		color: #b00020;
	}

	.notice {
		padding: 0.75rem 1rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}
</style>
