<script lang="ts">
	import { onMount } from 'svelte';
	import {
		beginGoogleSignIn,
		consumePendingRedirect,
		extractIdTokenFromHash
	} from '$lib/googleOAuth';
	import { isAllowedRedirect } from '$lib/redirectWhitelist';

	type Status = 'checking' | 'redirecting' | 'error';

	let status = $state<Status>('checking');
	let errorMessage = $state('');

	onMount(() => {
		const idToken = extractIdTokenFromHash(window.location.hash);

		if (idToken) {
			const redirect = consumePendingRedirect();

			if (!redirect || !isAllowedRedirect(redirect)) {
				status = 'error';
				errorMessage = 'No se pudo completar el inicio de sesión.';
				return;
			}

			status = 'redirecting';
			window.location.href = `${redirect}#id_token=${idToken}`;
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
	{:else if status === 'error'}
		<p role="alert">{errorMessage}</p>
	{/if}
</main>
