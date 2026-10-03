<script lang="ts">
	import { addedCorrections, diffVersions, type News } from '@repo/shared';
	import { db } from '$lib/firebase';
	import { listVersions } from '$lib/revisionFlow';

	let { newsId, version }: { newsId: string; version: number } = $props();

	const KIND_LABELS = {
		actualizacion: 'Actualización',
		correccion: 'Corrección',
		retractacion: 'Retractación'
	} as const;
	const dateFormat = new Intl.DateTimeFormat('es-GT', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'America/Guatemala'
	});

	let versions = $state<News[]>([]);
	let loading = $state(true);
	let errorMessage = $state('');

	// Reload whenever the news moves to a new version (publish, correction or retraction).
	$effect(() => {
		void version;
		loading = true;
		errorMessage = '';
		listVersions(db, newsId)
			.then((items) => (versions = items))
			.catch((error) => {
				errorMessage = error instanceof Error ? error.message : 'No se pudo leer el historial';
			})
			.finally(() => (loading = false));
	});
</script>

<section id="section-history">
	<h2>Historial</h2>

	{#if loading}
		<p>Cargando historial…</p>
	{:else if errorMessage}
		<p class="error" role="alert">{errorMessage}</p>
	{:else if versions.length === 0}
		<p class="empty">
			Aún no hay versiones guardadas. Cada publicación, corrección o retractación crea una.
		</p>
	{:else}
		<p class="count">{versions.length} {versions.length === 1 ? 'versión' : 'versiones'}</p>
		<ol>
			{#each versions as item, index (item.version)}
				{@const previous = versions[index + 1]}
				{@const changes = diffVersions(previous, item)}
				{@const corrections = addedCorrections(previous, item)}
				<li>
					<p>
						<strong>Versión {item.version}</strong> ·
						{dateFormat.format(new Date(item.updatedAt))} · certeza {item.certainty}
						{#if index === 0}<span class="badge">actual</span>{/if}
					</p>
					{#each corrections as correction (correction.at + correction.kind)}
						<p class="correction">
							<strong>{KIND_LABELS[correction.kind]}:</strong>
							{correction.summary}
						</p>
					{/each}
					{#if changes.length > 0}
						<ul class="changes">
							{#each changes as change (change.field)}
								<li>
									{change.label}: <del>{change.from}</del> → <ins>{change.to}</ins>
								</li>
							{/each}
						</ul>
					{:else if !previous}
						<p class="empty">Primera versión publicada.</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	section {
		margin-bottom: 2rem;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	ol > li {
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	p {
		margin: 0 0 0.35rem;
	}

	.count,
	.empty {
		color: #666;
		font-size: 0.9rem;
	}

	.badge {
		margin-left: 0.35rem;
		padding: 0 0.4rem;
		border-radius: 3px;
		background: #c8e6c9;
		font-size: 0.75rem;
	}

	.correction {
		padding: 0.35rem 0.5rem;
		background: #fff8e1;
		border-radius: 3px;
	}

	.changes {
		margin: 0;
		padding-left: 1.25rem;
	}

	del {
		color: #b00020;
	}

	ins {
		color: #1b5e20;
		text-decoration: none;
	}

	.error {
		color: #b00020;
	}
</style>
