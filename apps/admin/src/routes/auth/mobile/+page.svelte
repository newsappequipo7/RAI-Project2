<script lang="ts">
	import { onMount } from 'svelte';
	import {
		buildGoogleAuthUrl,
		consumePendingRedirect,
		extractErrorFromHash,
		extractStateFromHash,
		extractIdTokenFromHash
	} from '$lib/googleOAuth';
	import { deliverHandoff } from '$lib/mobileHandoff';
	import { isAllowedRedirect, toAppLaunchUrl } from '$lib/redirectWhitelist';

	type Status = 'checking' | 'to-google' | 'delivering' | 'to-app' | 'error';

	// Paint the manual link first: a pending navigation can freeze the frame on Android
	// browsers, and some block script navigations that lack a user gesture.
	const AUTO_NAVIGATION_DELAY_MS = 300;

	let status = $state<Status>('checking');
	let errorMessage = $state('');
	let nextUrl = $state('');
	let handedOff = $state(false);

	function navigateSoon(url: string) {
		nextUrl = url;
		setTimeout(() => {
			window.location.href = url;
		}, AUTO_NAVIGATION_DELAY_MS);
	}

	function fail(message: string) {
		status = 'error';
		errorMessage = message;
	}

	function allowedOrNull(redirect: string | null): string | null {
		return redirect && isAllowedRedirect(redirect) ? redirect : null;
	}

	async function returnToApp(hash: string, idToken: string) {
		const bridgeState = extractStateFromHash(hash);
		const redirect = allowedOrNull(bridgeState.redirect ?? consumePendingRedirect());

		if (bridgeState.handoff) {
			status = 'delivering';
			handedOff = await deliverHandoff(bridgeState.handoff, idToken);
		}

		if (!handedOff && !redirect) {
			fail('No se pudo completar el inicio de sesión. Vuelve a la app e inténtalo de nuevo.');
			return;
		}

		status = 'to-app';
		if (redirect) {
			navigateSoon(toAppLaunchUrl(`${redirect}#id_token=${idToken}`, navigator.userAgent));
		}
	}

	function startGoogleSignIn(search: string) {
		const query = new URLSearchParams(search);
		const redirect = allowedOrNull(query.get('redirect'));
		const handoff = query.get('handoff');

		if (!redirect && !handoff) {
			fail('Redirección no permitida.');
			return;
		}

		status = 'to-google';
		navigateSoon(buildGoogleAuthUrl({ redirect, handoff }));
	}

	onMount(() => {
		try {
			const { hash, search } = window.location;
			const googleError = extractErrorFromHash(hash);
			const idToken = extractIdTokenFromHash(hash);

			if (googleError) {
				fail(`Google rechazó el inicio de sesión (${googleError}).`);
			} else if (idToken) {
				void returnToApp(hash, idToken);
			} else {
				startGoogleSignIn(search);
			}
		} catch (error) {
			fail(error instanceof Error ? error.message : 'Error inesperado en el inicio de sesión.');
		}
	});
</script>

<main>
	{#if status === 'checking'}
		<p>Cargando…</p>
	{:else if status === 'to-google'}
		<p>Iniciando sesión con Google…</p>
		<a class="action" href={nextUrl}>Continuar con Google</a>
	{:else if status === 'delivering'}
		<p>Sesión de Google verificada. Enviando a la app…</p>
	{:else if status === 'to-app'}
		{#if handedOff}
			<p><strong>Listo.</strong> Vuelve a la app: la sesión se abrirá sola.</p>
		{:else}
			<p>Sesión de Google verificada.</p>
		{/if}
		{#if nextUrl}
			<a class="action" href={nextUrl}>Abrir la app</a>
		{/if}
	{:else}
		<p role="alert">{errorMessage}</p>
	{/if}
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem 1rem;
		text-align: center;
	}

	.action {
		padding: 0.9rem 1.5rem;
		border-radius: var(--radius-md);
		background: var(--color-accent);
		color: var(--color-accent-text);
		font-weight: 700;
		text-decoration: none;
	}
</style>
