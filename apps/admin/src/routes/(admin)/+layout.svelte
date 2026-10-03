<script lang="ts">
	import { resolve } from '$app/paths';
	import { USE_AUTH_EMULATOR } from '$lib/firebase';
	import { session } from '$lib/session.svelte';

	let { children } = $props();

	let emulatorEmail = $state('');
	let emulatorPassword = $state('');
	let emulatorError = $state('');

	async function emulatorLogin(event: SubmitEvent) {
		event.preventDefault();
		emulatorError = '';
		try {
			await session.loginWithEmulator(emulatorEmail, emulatorPassword);
		} catch (error) {
			emulatorError = error instanceof Error ? error.message : 'No se pudo entrar';
		}
	}
</script>

{#if session.status === 'loading'}
	<p>Cargando…</p>
{:else if session.status === 'signed-out'}
	<main class="centered">
		<h1>Portal de noticias</h1>
		<button onclick={() => session.login()}>Continuar con Google</button>
		{#if USE_AUTH_EMULATOR}
			<form class="emulator" onsubmit={emulatorLogin}>
				<p>Entorno de pruebas (emulador de Auth)</p>
				<label>Correo <input type="email" bind:value={emulatorEmail} /></label>
				<label>Contraseña <input type="password" bind:value={emulatorPassword} /></label>
				<button type="submit">Entrar con el emulador</button>
				{#if emulatorError}<p role="alert">{emulatorError}</p>{/if}
			</form>
		{/if}
	</main>
{:else if session.status === 'denied'}
	<main class="centered">
		<h1>Sin acceso</h1>
		<p>Tu cuenta no está autorizada para entrar al portal.</p>
		<p>
			Pide a un admin que agregue este uid en Firestore (<code>admins/{session.user?.uid}</code>):
		</p>
		<code class="uid">{session.user?.uid}</code>
		<button onclick={() => session.logout()}>Cerrar sesión</button>
	</main>
{:else}
	<div class="shell">
		<nav>
			<a href={resolve('/news')}>Noticias</a>
			<a href={resolve('/comparador')}>Comparador</a>
			<a href={resolve('/costs')}>Costos</a>
			<a href={resolve('/indice')}>Índice</a>
			<a href={resolve('/instalar')}>Instalar</a>
			<button onclick={() => session.logout()}>Cerrar sesión</button>
		</nav>
		<main>
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.centered {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		min-height: 100vh;
		padding: 2rem;
		text-align: center;
	}

	.emulator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		border: 1px dashed #bbb;
		border-radius: 4px;
	}

	.uid {
		padding: 0.5rem 1rem;
		background: #f0f0f0;
		border-radius: 4px;
		user-select: all;
	}

	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	nav {
		display: flex;
		gap: 1.5rem;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid #ddd;
	}

	nav a {
		text-decoration: none;
		color: inherit;
		font-weight: 600;
	}

	nav button {
		margin-left: auto;
	}

	main {
		flex: 1;
		padding: 1.5rem;
	}
</style>
