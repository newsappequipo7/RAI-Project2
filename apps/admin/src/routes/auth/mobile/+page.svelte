<script lang="ts">
	import { onMount } from 'svelte';
	import {
		beginGoogleSignIn,
		consumePendingRedirect,
		extractStateFromHash,
		extractIdTokenFromHash
	} from '$lib/googleOAuth';
	import { isAllowedRedirect, toAppLaunchUrl } from '$lib/redirectWhitelist';

	type Status = 'checking' | 'redirecting' | 'ready' | 'error';

	let status = $state<Status>('checking');
	let errorMessage = $state('');
	let appUrl = $state('');

	onMount(() => {
		const idToken = extractIdTokenFromHash(window.location.hash);

		if (idToken) {
			const redirect = extractStateFromHash(window.location.hash) ?? consumePendingRedirect();

			if (!redirect || !isAllowedRedirect(redirect)) {
				status = 'error';
				errorMessage = 'No se pudo completar el inicio de sesión.';
				return;
			}

			appUrl = toAppLaunchUrl(`${redirect}#id_token=${idToken}`, navigator.userAgent);
			status = 'ready';
			window.location.href = appUrl;
			return;
		}

		const redirect = new URLSearchParams(window.location.search).get('redirect');

		if (!redirect || !isAllowedRedirect(redirect)) {
			status = 'error';
			errorMessage = 'Redirección no permitida.';
			return;
		}

		status = 'redirecting';
		beginGoogleSignIn(redirect);
	});
</script>

<main>
	{#if status === 'checking' || status === 'redirecting'}
		<p>Iniciando sesión con Google…</p>
	{:else if status === 'ready'}
		<p>Sesión de Google verificada.</p>
		<a href={appUrl}>Abrir la app</a>
	{:else if status === 'error'}
		<p role="alert">{errorMessage}</p>
	{/if}
</main>
