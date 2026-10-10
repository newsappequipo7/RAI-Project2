<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AI_ILLUSTRATION_DISCLOSURE,
		buildAiIllustration,
		buildCoverImage,
		buildFreeLicenseImage,
		buildPhotoImage,
		imageCaption,
		IMAGE_PROMPT_RULES,
		isValidSourceUrl,
		validatePhotoDetails,
		type ImageGenerateResponse,
		type ImageSearchResponse,
		type ImageSearchResult,
		type News,
		type PhotoIssue
	} from '@repo/shared';
	import { apiFetch } from '$lib/api';
	import { readCloudinaryConfig, uploadPhoto, validatePhotoFile } from '$lib/cloudinary';
	import { fetchHealth } from '$lib/indexApi';
	import CoverPreview from './CoverPreview.svelte';

	let {
		news = $bindable(),
		readonly,
		onchange
	}: { news: News; readonly: boolean; onchange: () => void } = $props();

	type Tab = 'photo' | 'free' | 'cover' | 'ai';

	const cloudinary = readCloudinaryConfig();
	const image = $derived(news.image);
	const imageUrlOk = $derived(image ? isValidSourceUrl(image.url) : false);

	let tab = $state<Tab>('photo');
	let imageGenEnabled = $state(false);

	// Real photo
	let photoMode = $state<'file' | 'url'>(cloudinary ? 'file' : 'url');
	let photoFile = $state<File | null>(null);
	let photo = $state({ url: '', credit: '', license: '', sourceUrl: '', altText: '' });
	let photoIssues = $state<PhotoIssue[]>([]);
	let photoError = $state('');
	let photoBusy = $state(false);

	// Free license
	let query = $state('');
	let results = $state<ImageSearchResult[]>([]);
	let searched = $state(false);
	let searching = $state(false);
	let searchError = $state('');
	let selected = $state<ImageSearchResult | null>(null);
	let freeAlt = $state('');
	let freeAltError = $state('');

	// AI illustration
	let aiPrompt = $state('');
	let aiAlt = $state('');
	let aiBusy = $state(false);
	let aiError = $state('');

	onMount(() => {
		fetchHealth()
			.then((health) => (imageGenEnabled = health.flags.imageGenEnabled))
			.catch(() => (imageGenEnabled = false));
	});

	function setImage(next: News['image']) {
		news.image = next;
		onchange();
	}

	function issuesFor(field: PhotoIssue['field']) {
		return photoIssues.filter((issue) => issue.field === field);
	}

	function onFileChosen(event: Event & { currentTarget: HTMLInputElement }) {
		photoFile = event.currentTarget.files?.[0] ?? null;
		photoError = photoFile ? (validatePhotoFile(photoFile) ?? '') : '';
	}

	async function submitPhoto(event: SubmitEvent) {
		event.preventDefault();
		photoError = '';

		const fileProblem = photoMode === 'file' && photoFile ? validatePhotoFile(photoFile) : null;
		if (fileProblem) {
			photoError = fileProblem;
			return;
		}

		// With a file the URL does not exist yet: check everything else first, so a rejected form
		// never leaves an orphan upload behind.
		const placeholder =
			photoMode === 'file' ? (photoFile ? 'https://pending.upload/' : '') : photo.url;
		photoIssues = validatePhotoDetails({ ...photo, url: placeholder });
		if (photoIssues.length > 0) return;

		photoBusy = true;
		try {
			let url = photo.url;
			if (photoMode === 'file') {
				if (!cloudinary || !photoFile) return;
				url = await uploadPhoto(photoFile, cloudinary);
			}
			setImage(buildPhotoImage({ ...photo, url }));
			photoFile = null;
			photo = { url: '', credit: '', license: '', sourceUrl: '', altText: '' };
		} catch (error) {
			photoError = error instanceof Error ? error.message : 'No se pudo subir la imagen';
		} finally {
			photoBusy = false;
		}
	}

	async function search(event: SubmitEvent) {
		event.preventDefault();
		if (query.trim().length < 2) return;

		searching = true;
		searchError = '';
		selected = null;
		try {
			const body = await apiFetch<ImageSearchResponse>('/admin/image/search', {
				method: 'POST',
				body: JSON.stringify({ query: query.trim() })
			});
			results = body.results;
			searched = true;
		} catch (error) {
			searchError = error instanceof Error ? error.message : 'No se pudo buscar';
		} finally {
			searching = false;
		}
	}

	function useFree() {
		if (!selected) return;
		if (freeAlt.trim() === '') {
			freeAltError = 'El texto alternativo es obligatorio.';
			return;
		}
		setImage(buildFreeLicenseImage(selected, freeAlt));
		freeAlt = '';
		freeAltError = '';
		selected = null;
	}

	async function generate(event: SubmitEvent) {
		event.preventDefault();
		if (aiAlt.trim() === '') {
			aiError = 'El texto alternativo es obligatorio.';
			return;
		}

		aiBusy = true;
		aiError = '';
		try {
			const result = await apiFetch<ImageGenerateResponse>('/admin/image/generate', {
				method: 'POST',
				body: JSON.stringify({ newsId: news.id, prompt: aiPrompt })
			});
			setImage(buildAiIllustration(result.url, result.model, aiAlt));
		} catch (error) {
			aiError = error instanceof Error ? error.message : 'No se pudo generar la ilustración';
		} finally {
			aiBusy = false;
		}
	}
</script>

<section id="section-image">
	<h2>Imagen</h2>
	<p class="hint">
		Ninguna imagen puede hacerse pasar por evidencia del hecho: cada tipo lleva su pie. Sin foto, lo
		recomendado es la portada generada.
	</p>

	{#if image}
		<div class="current">
			{#if image.kind === 'portada_generada'}
				<CoverPreview title={news.title} topics={news.topics} geo={news.geo} />
			{:else if imageUrlOk}
				<img src={image.url} alt={image.altText} />
			{/if}
			<div>
				<p><strong>Pie:</strong> {imageCaption(image)}</p>
				<p><strong>Texto alternativo:</strong> {image.altText}</p>
				{#if image.licenseUrl && isValidSourceUrl(image.licenseUrl)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external license link -->
					<a href={image.licenseUrl} target="_blank" rel="noopener noreferrer"
						>Ver condiciones de la licencia</a
					>
				{/if}
				{#if !readonly}
					<button type="button" onclick={() => setImage(undefined)}>Quitar imagen</button>
				{/if}
			</div>
		</div>
	{:else}
		<p class="empty">Esta noticia aún no tiene imagen.</p>
	{/if}

	{#if !readonly}
		<div class="tabs" role="tablist" aria-label="Origen de la imagen">
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'photo'}
				onclick={() => (tab = 'photo')}
			>
				Subir foto real
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'free'}
				onclick={() => (tab = 'free')}
			>
				Buscar con licencia libre
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={tab === 'cover'}
				onclick={() => (tab = 'cover')}
			>
				Portada generada
			</button>
			{#if imageGenEnabled}
				<button type="button" role="tab" aria-selected={tab === 'ai'} onclick={() => (tab = 'ai')}>
					Ilustración IA
				</button>
			{/if}
		</div>

		{#if tab === 'photo'}
			<form onsubmit={submitPhoto} novalidate>
				<div class="mode">
					<label>
						<input type="radio" bind:group={photoMode} value="file" disabled={!cloudinary} />
						Subir archivo
					</label>
					<label><input type="radio" bind:group={photoMode} value="url" /> Pegar URL</label>
				</div>
				{#if !cloudinary}
					<p class="hint">
						La subida de archivos necesita <code>VITE_CLOUDINARY_CLOUD_NAME</code> y
						<code>VITE_CLOUDINARY_UPLOAD_PRESET</code> (ADR-010). Mientras tanto usa una URL.
					</p>
				{/if}

				{#if photoMode === 'file'}
					<label for="photo-file">Archivo (JPG, PNG o WebP, máx. 5 MB)</label>
					<input
						id="photo-file"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onchange={onFileChosen}
					/>
				{:else}
					<label for="photo-url">URL de la imagen</label>
					<input id="photo-url" type="url" bind:value={photo.url} placeholder="https://…" />
				{/if}
				{#each issuesFor('url') as issue (issue.code)}<p class="error" role="alert">
						{issue.message}
					</p>{/each}

				<label for="photo-credit">Crédito del autor</label>
				<input id="photo-credit" type="text" bind:value={photo.credit} />
				{#each issuesFor('credit') as issue (issue.code)}<p class="error" role="alert">
						{issue.message}
					</p>{/each}

				<label for="photo-license">Licencia o permiso de uso</label>
				<input
					id="photo-license"
					type="text"
					bind:value={photo.license}
					placeholder="Permiso del autor, CC BY 4.0…"
				/>
				{#each issuesFor('license') as issue (issue.code)}<p class="error" role="alert">
						{issue.message}
					</p>{/each}

				<label for="photo-source">Fuente (enlace de origen)</label>
				<input id="photo-source" type="url" bind:value={photo.sourceUrl} placeholder="https://…" />
				{#each issuesFor('sourceUrl') as issue (issue.code)}<p class="error" role="alert">
						{issue.message}
					</p>{/each}

				<label for="photo-alt">Texto alternativo</label>
				<input id="photo-alt" type="text" bind:value={photo.altText} />
				{#each issuesFor('altText') as issue (issue.code)}<p class="error" role="alert">
						{issue.message}
					</p>{/each}

				{#if photoError}<p class="error" role="alert">{photoError}</p>{/if}
				<div>
					<button type="submit" disabled={photoBusy}
						>{photoBusy ? 'Subiendo…' : 'Usar esta foto'}</button
					>
				</div>
			</form>
		{:else if tab === 'free'}
			<form onsubmit={search} novalidate>
				<label for="free-query">Buscar en Openverse y Wikimedia Commons</label>
				<div class="row">
					<input id="free-query" type="search" bind:value={query} placeholder="volcán de fuego" />
					<button type="submit" disabled={searching}>{searching ? 'Buscando…' : 'Buscar'}</button>
				</div>
				<p class="hint">
					Solo licencias que permiten uso comercial. Se mostrará como imagen de archivo.
				</p>
			</form>
			{#if searchError}<p class="error" role="alert">{searchError}</p>{/if}
			{#if searched && results.length === 0}<p class="empty">Sin resultados.</p>{/if}

			<ul class="grid">
				{#each results as result (result.url)}
					<li class:chosen={selected?.url === result.url}>
						<img src={result.thumbUrl} alt={result.title} loading="lazy" />
						<strong>{result.title}</strong>
						<small>{result.creator || 'Autor no indicado'}</small>
						<small class="license">
							{#if result.licenseUrl}
								<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external license link -->
								<a href={result.licenseUrl} target="_blank" rel="noopener noreferrer"
									>{result.license}</a
								>
							{:else}
								{result.license}
							{/if}
						</small>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external source link -->
						<a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Ver origen</a>
						<button type="button" onclick={() => ((selected = result), (freeAltError = ''))}
							>Elegir</button
						>
					</li>
				{/each}
			</ul>

			{#if selected}
				<div class="choose">
					<p>
						<strong>{selected.title}</strong> · {selected.creator || 'Autor no indicado'} · {selected.license}
					</p>
					<label for="free-alt">Texto alternativo</label>
					<input id="free-alt" type="text" bind:value={freeAlt} />
					{#if freeAltError}<p class="error" role="alert">{freeAltError}</p>{/if}
					<div><button type="button" onclick={useFree}>Usar esta imagen</button></div>
				</div>
			{/if}
		{:else if tab === 'cover'}
			<div class="cover">
				<CoverPreview title={news.title} topics={news.topics} geo={news.geo} />
				<div>
					<p>
						Portada tipográfica dibujada por la app con el color del tema principal. No es una
						fotografía y lo dice en su pie. Cuesta 0 y no necesita almacenamiento.
					</p>
					<button type="button" onclick={() => setImage(buildCoverImage(news.title))}>
						Usar portada generada
					</button>
				</div>
			</div>
		{:else if tab === 'ai' && imageGenEnabled}
			<form onsubmit={generate} novalidate>
				<p class="warning" role="note">
					Último recurso. Una ilustración con IA <strong>no documenta el hecho</strong>: llevará un
					sello incrustado y el aviso «{AI_ILLUSTRATION_DISCLOSURE}».
				</p>
				<p>
					<strong>Costo estimado:</strong> no disponible. Aún no hay un proveedor de imágenes aprobado
					(ADR-011).
				</p>
				<p>Reglas fijas que se añaden a tu texto:</p>
				<ul>
					{#each IMAGE_PROMPT_RULES as rule (rule)}<li>{rule}</li>{/each}
				</ul>
				<label for="ai-prompt">Qué tema quieres ilustrar</label>
				<textarea id="ai-prompt" rows="3" bind:value={aiPrompt}></textarea>
				<label for="ai-alt">Texto alternativo</label>
				<input id="ai-alt" type="text" bind:value={aiAlt} />
				{#if aiError}<p class="error" role="alert">{aiError}</p>{/if}
				<div>
					<button type="submit" disabled={aiBusy}
						>{aiBusy ? 'Generando…' : 'Generar ilustración'}</button
					>
				</div>
			</form>
		{/if}
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

	.current,
	.cover {
		display: flex;
		gap: 1rem;
		flex-wrap: wrap;
		align-items: flex-start;
		margin: 1rem 0;
	}

	.current img {
		max-width: 320px;
		border-radius: 4px;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
		margin: 1rem 0 0;
		border-bottom: 1px solid #ddd;
	}

	.tabs button {
		border: 1px solid transparent;
		border-bottom: none;
		background: none;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		font: inherit;
	}

	.tabs button[aria-selected='true'] {
		border-color: #ddd;
		background: #f5f5f5;
		font-weight: 600;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 1rem;
		border: 1px solid #ddd;
		border-top: none;
	}

	form label {
		margin-top: 0.5rem;
		font-weight: 600;
	}

	.mode {
		display: flex;
		gap: 1rem;
	}

	.mode label {
		margin-top: 0;
		font-weight: 400;
	}

	input[type='text'],
	input[type='url'],
	input[type='search'],
	textarea {
		font: inherit;
		padding: 0.5rem;
		box-sizing: border-box;
	}

	.row {
		display: flex;
		gap: 0.5rem;
	}

	.row input {
		flex: 1;
	}

	.grid {
		list-style: none;
		margin: 1rem 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.grid li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.5rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.grid li.chosen {
		border-color: #0b57d0;
		box-shadow: 0 0 0 2px #cfe0fc;
	}

	.grid img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
		border-radius: 3px;
	}

	.license {
		font-weight: 600;
	}

	.choose {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
		border: 1px dashed #bbb;
		border-radius: 4px;
	}

	.warning {
		padding: 0.5rem 0.75rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}

	.error {
		margin: 0;
		font-size: 0.85rem;
		color: #b00020;
	}
</style>
