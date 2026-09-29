<script lang="ts">
	import { onMount } from 'svelte';
	import type { AiSelftestResponse, CostsResponse } from '@repo/shared';
	import { apiFetch } from '$lib/api';

	let costs = $state<CostsResponse | null>(null);
	let selftest = $state<AiSelftestResponse | null>(null);
	let errorMessage = $state('');
	let running = $state(false);

	async function run<T>(action: () => Promise<T>): Promise<T | null> {
		running = true;
		errorMessage = '';

		try {
			return await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			return null;
		} finally {
			running = false;
		}
	}

	async function refreshCosts() {
		costs = (await run(() => apiFetch<CostsResponse>('/admin/costs'))) ?? costs;
	}

	async function runSelftest() {
		selftest =
			(await run(() => apiFetch<AiSelftestResponse>('/admin/ai/selftest', { method: 'POST' }))) ??
			selftest;
		await refreshCosts();
	}

	onMount(refreshCosts);
</script>

<h1>Costos</h1>

<div class="actions">
	<button onclick={refreshCosts} disabled={running}>Actualizar</button>
	<button onclick={runSelftest} disabled={running}>Llamada de prueba</button>
</div>

{#if errorMessage}
	<p role="alert">{errorMessage}</p>
{/if}

{#if costs}
	<h2>Resumen</h2>
	<ul>
		<li>
			Gasto acumulado: <strong>USD {costs.totalUsd.toFixed(4)}</strong> de {costs.budget.limitUsd}
		</li>
		<li>Nivel de presupuesto: <strong>{costs.budget.level}</strong></li>
		<li>
			Último saldo real registrado: {costs.budget.lastProviderBalance ?? 'ninguno'}
		</li>
		<li>
			Llamadas: {costs.calls.total} (cacheadas {costs.calls.cached}, abstenciones
			{costs.calls.abstained}, bloqueadas {costs.calls.blocked})
		</li>
	</ul>

	<h2>Respuesta completa de /admin/costs</h2>
	<pre>{JSON.stringify(costs, null, 2)}</pre>
{/if}

{#if selftest}
	<h2>Última llamada de prueba</h2>
	<pre>{JSON.stringify(selftest, null, 2)}</pre>
{/if}

<style>
	.actions {
		display: flex;
		gap: 0.75rem;
		margin: 1rem 0;
	}

	pre {
		padding: 1rem;
		background: #f5f5f5;
		border-radius: 4px;
		overflow-x: auto;
	}
</style>
