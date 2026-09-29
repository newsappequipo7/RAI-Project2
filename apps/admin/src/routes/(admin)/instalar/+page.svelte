<script lang="ts">
	import QRCode from 'qrcode';

	const STORAGE_KEY = 'instalar:expoProjectUrl';
	const DEFAULT_URL = import.meta.env.VITE_EXPO_PROJECT_URL ?? '';

	let projectUrl = $state(readStoredUrl());
	let qrDataUrl = $state<string | null>(null);

	function readStoredUrl(): string {
		try {
			return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_URL;
		} catch {
			return DEFAULT_URL;
		}
	}

	$effect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, projectUrl);
		} catch {
			// Ignore storage failures (private browsing, etc.); the QR still works this session.
		}

		if (!projectUrl) {
			qrDataUrl = null;
			return;
		}

		QRCode.toDataURL(projectUrl, { margin: 1, width: 240 })
			.then((url) => {
				qrDataUrl = url;
			})
			.catch(() => {
				qrDataUrl = null;
			});
	});
</script>

<h1>Instalar la app</h1>

<ol>
	<li>Instala <strong>Expo Go</strong> desde tu tienda de apps.</li>
	<li>Abre Expo Go y escanea el código QR (o pega el link del túnel abajo).</li>
	<li>Espera a que cargue el proyecto — puede tardar unos segundos.</li>
</ol>

<div class="stores">
	<a href="https://apps.apple.com/app/expo-go/id982107779" target="_blank" rel="noreferrer"
		>Expo Go en App Store</a
	>
	<a
		href="https://play.google.com/store/apps/details?id=host.exp.exponent"
		target="_blank"
		rel="noreferrer">Expo Go en Play Store</a
	>
</div>

<label for="project-url">URL del proyecto Expo (túnel, cambia cada sesión de desarrollo)</label>
<input
	id="project-url"
	type="text"
	bind:value={projectUrl}
	placeholder="exp://xxxxxxx.exp.direct"
/>

{#if qrDataUrl}
	<img src={qrDataUrl} alt="Código QR para abrir el proyecto en Expo Go" width="240" height="240" />
{:else}
	<p>Pega la URL del proyecto para generar el código QR.</p>
{/if}

<style>
	.stores {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
	}

	label {
		display: block;
		margin-top: 1.5rem;
		font-weight: 600;
	}

	input {
		display: block;
		width: 100%;
		max-width: 32rem;
		margin: 0.5rem 0 1.5rem;
		padding: 0.5rem;
	}
</style>
