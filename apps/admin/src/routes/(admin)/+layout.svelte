<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
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

	function isActive(path: string): boolean {
		return page.url.pathname.startsWith(path);
	}
</script>

{#if session.status === 'loading'}
	<main class="centered">
		<p class="muted">Cargando…</p>
	</main>
{:else if session.status === 'signed-out'}
	<main class="centered">
		<div class="card login">
			<span class="brand-mark" aria-hidden="true">PN</span>
			<h1>Portal de noticias</h1>
			<p class="muted">
				Inicia sesión con tu cuenta autorizada para publicar y verificar noticias.
			</p>
			<button class="primary wide" onclick={() => session.login()}>Continuar con Google</button>
			{#if USE_AUTH_EMULATOR}
				<form class="emulator" onsubmit={emulatorLogin}>
					<p class="muted">Entorno de pruebas (emulador de Auth)</p>
					<label>Correo <input type="email" bind:value={emulatorEmail} /></label>
					<label>Contraseña <input type="password" bind:value={emulatorPassword} /></label>
					<button type="submit">Entrar con el emulador</button>
					{#if emulatorError}<p role="alert">{emulatorError}</p>{/if}
				</form>
			{/if}
		</div>
	</main>
{:else if session.status === 'denied'}
	<main class="centered">
		<div class="card login">
			<h1>Sin acceso</h1>
			<p class="muted">Tu cuenta no está autorizada para entrar al portal.</p>
			<p>
				Pide a un admin que agregue este uid en Firestore (<code>admins/{session.user?.uid}</code>):
			</p>
			<code class="uid">{session.user?.uid}</code>
			<button class="wide" onclick={() => session.logout()}>Cerrar sesión</button>
		</div>
	</main>
{:else}
	<div class="shell">
		<header class="topbar">
			<a class="brand" href={resolve('/news')}>
				<span class="brand-mark" aria-hidden="true">PN</span>
				<span>Portal de noticias</span>
			</a>
			<nav aria-label="Principal">
				<a href={resolve('/news')} aria-current={isActive('/news') ? 'page' : undefined}>Noticias</a
				>
				<a href={resolve('/compare')} aria-current={isActive('/compare') ? 'page' : undefined}
					>Comparador</a
				>
				<a href={resolve('/costs')} aria-current={isActive('/costs') ? 'page' : undefined}>Costos</a
				>
				<a href={resolve('/indice')} aria-current={isActive('/indice') ? 'page' : undefined}
					>Índice</a
				>
				<a href={resolve('/instalar')} aria-current={isActive('/instalar') ? 'page' : undefined}
					>Instalar</a
				>
			</nav>
			<button class="logout" onclick={() => session.logout()}>Cerrar sesión</button>
		</header>
		<main class="content">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.centered {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 1.5rem;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.85rem;
		width: 100%;
		max-width: 26rem;
		padding: 2rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		text-align: center;
	}

	.login h1 {
		margin: 0.25rem 0 0;
	}

	.muted {
		color: var(--color-text-muted);
		margin: 0;
	}

	.wide {
		width: 100%;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: var(--radius-sm);
		background: var(--color-accent);
		color: var(--color-accent-text);
		font-weight: 700;
		font-size: 0.8rem;
		letter-spacing: 0.02em;
	}

	.emulator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		padding: 1rem;
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-sm);
		text-align: left;
	}

	.emulator label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.uid {
		padding: 0.5rem 1rem;
		background: var(--color-surface-muted);
		border-radius: var(--radius-sm);
		user-select: all;
		word-break: break-all;
	}

	.shell {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}

	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1.5rem;
		padding: 0.75rem 1.5rem;
		border-bottom: 1px solid var(--color-border);
		background: color-mix(in srgb, var(--color-surface) 92%, transparent);
		backdrop-filter: blur(8px);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-weight: 700;
		text-decoration: none;
		color: var(--color-text);
	}

	nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	nav a {
		padding: 0.4rem 0.75rem;
		border-radius: var(--radius-sm);
		color: var(--color-text-muted);
		font-weight: 600;
		text-decoration: none;
	}

	nav a:hover {
		background: var(--color-surface-muted);
		color: var(--color-text);
	}

	nav a[aria-current='page'] {
		background: var(--color-accent-soft);
		color: var(--color-accent);
	}

	.logout {
		margin-left: auto;
	}

	.content {
		flex: 1;
		width: 100%;
		max-width: 80rem;
		margin: 0 auto;
		padding: 1.5rem;
	}

	@media (max-width: 40rem) {
		.topbar {
			padding: 0.75rem 1rem;
		}

		.content {
			padding: 1rem;
		}

		.logout {
			margin-left: 0;
		}
	}
</style>
