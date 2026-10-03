<script lang="ts">
	import { onMount } from 'svelte';
	import type { AiSelftestResponse, CostsResponse, Flags, HealthResponse } from '@repo/shared';
	import BarChart from '$lib/components/BarChart.svelte';
	import { fetchCosts, patchFlags, runSelftest, saveBudgetSnapshot } from '$lib/costsApi';
	import {
		avoidedCalls,
		BUDGET_LEVEL_LABELS,
		DRIFT_THRESHOLD_PCT,
		formatDrift,
		describeFlagChange,
		formatUsd,
		parseBalance,
		recentDays,
		summarizeBudget,
		taskRows
	} from '$lib/costsView';
	import { fetchHealth } from '$lib/indexApi';

	let costs = $state<CostsResponse | null>(null);
	let health = $state<HealthResponse | null>(null);
	let selftest = $state<AiSelftestResponse | null>(null);
	let errorMessage = $state('');
	let notice = $state('');
	let busy = $state(false);
	let balanceInput = $state('');
	let balanceNote = $state('');
	let balanceError = $state('');

	const summary = $derived(costs ? summarizeBudget(costs) : null);
	const avoided = $derived(costs ? avoidedCalls(costs.calls) : null);
	const rows = $derived(costs ? taskRows(costs) : []);
	const days = $derived(costs ? recentDays(costs.byDay) : []);

	async function run<T>(action: () => Promise<T>): Promise<T | null> {
		busy = true;
		errorMessage = '';
		try {
			return await action();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Error desconocido';
			return null;
		} finally {
			busy = false;
		}
	}

	async function refresh() {
		const result = await run(() => Promise.all([fetchCosts(), fetchHealth()]));
		if (result) [costs, health] = result;
	}

	async function changeFlag(patch: Partial<Flags>) {
		if (!window.confirm(`${describeFlagChange(patch)}\n\n¿Continuar?`)) return;
		notice = '';

		const saved = await run(() => patchFlags(patch));
		if (!saved) return;

		// Read /health back: it is what the app and the chat see (F2-09 CA2).
		const fresh = await run(() => fetchHealth());
		if (fresh) {
			health = fresh;
			const same = JSON.stringify(fresh.flags) === JSON.stringify(saved);
			notice = same
				? 'Guardado y confirmado en /health.'
				: 'Guardado, pero /health todavía muestra otros valores: vuelve a actualizar.';
		}
	}

	async function submitBalance(event: SubmitEvent) {
		event.preventDefault();
		const value = parseBalance(balanceInput);
		if (value === null) {
			balanceError = 'Escribe un saldo en USD, por ejemplo 16.20.';
			return;
		}
		balanceError = '';
		notice = '';

		if (await run(() => saveBudgetSnapshot(value, balanceNote))) {
			balanceInput = '';
			balanceNote = '';
			notice = 'Saldo registrado.';
			await refresh();
		}
	}

	async function selfTest() {
		const live = health?.aiMode === 'live';
		if (
			live &&
			!window.confirm('El Worker está en modo live: la llamada de prueba gasta ~USD 0.00004.')
		) {
			return;
		}
		selftest = (await run(() => runSelftest())) ?? selftest;
		await refresh();
	}

	onMount(refresh);
</script>

<div class="header">
	<h1>Costos</h1>
	<div class="actions">
		<button onclick={refresh} disabled={busy}>Actualizar</button>
		<button onclick={selfTest} disabled={busy}>Llamada de prueba</button>
	</div>
</div>

{#if errorMessage}<p role="alert" class="error">{errorMessage}</p>{/if}
{#if notice}<p role="status" class="notice">{notice}</p>{/if}

{#if costs && summary && avoided}
	<section class="cards" aria-label="Resumen">
		<article class="card">
			<h2>Gasto acumulado</h2>
			<p class="big">{formatUsd(costs.totalUsd)}</p>
			<p class="sub">{summary.spentPct.toFixed(1)}% de USD {costs.budget.limitUsd}</p>
			<progress max="100" value={summary.spentPct}></progress>
		</article>
		<article class="card">
			<h2>Saldo estimado</h2>
			<p class="big">{formatUsd(summary.estimatedBalanceUsd, 2)}</p>
			<p class="sub">USD {costs.budget.limitUsd} − gasto según el ledger</p>
		</article>
		<article class="card" class:alert={!summary.reserveIntact}>
			<h2>Reserva para la presentación</h2>
			<p class="big">USD {costs.budget.reserveUsd}</p>
			<p class="sub">
				{#if summary.reserveIntact}
					Intacta. Quedan {formatUsd(summary.spendableBeforeReserveUsd, 2)} antes de tocarla.
				{:else}
					<strong>Comprometida:</strong> el gasto ya pasó USD {costs.budget.limitUsd -
						costs.budget.reserveUsd}.
				{/if}
			</p>
		</article>
		<article class="card" class:alert={summary.driftExceeds}>
			<h2>Último saldo real</h2>
			{#if costs.budget.lastProviderBalance === null}
				<p class="big">—</p>
				<p class="sub">Aún no hay snapshot: regístralo abajo desde el panel del proveedor.</p>
			{:else}
				<p class="big">{formatUsd(costs.budget.lastProviderBalance, 2)}</p>
				<p class="sub">
					Diferencia con la estimación: {formatDrift(summary.balanceDriftUsd)}
					{#if summary.driftPct !== null}({summary.driftPct.toFixed(1)}% de gasto){/if}
				</p>
				{#if summary.driftExceeds}
					<p class="sub">
						<strong>El ledger y el panel difieren más de {DRIFT_THRESHOLD_PCT}%:</strong> investiga y
						registra un loop.
					</p>
				{/if}
			{/if}
		</article>
	</section>

	<section>
		<h2>Nivel de presupuesto: {BUDGET_LEVEL_LABELS[costs.budget.level]}</h2>
		<table>
			<thead>
				<tr><th>Umbral</th><th>USD</th><th>Qué pasa</th></tr>
			</thead>
			<tbody>
				<tr>
					<td>Aviso</td>
					<td>{costs.budget.warnUsd}</td>
					<td>Se deshabilita la ilustración con IA</td>
				</tr>
				<tr>
					<td>Limitado</td>
					<td>{costs.budget.softUsd}</td>
					<td
						>Enrich y chat con modelo real se limitan; el chat en desarrollo pasa a retrieval_only</td
					>
				</tr>
				<tr>
					<td>Crítico</td>
					<td>{costs.budget.hardUsd}</td>
					<td>Kill switch en desarrollo: toda tarea de IA bloqueada salvo en el entorno demo</td>
				</tr>
				<tr>
					<td>Límite</td>
					<td>{costs.budget.limitUsd}</td>
					<td>Se bloquea todo, también la demo</td>
				</tr>
			</tbody>
		</table>
	</section>

	<section>
		<h2>Gasto por día</h2>
		<BarChart
			label="Gasto por día"
			bars={days.map((item) => ({ label: item.day, value: item.usd }))}
			format={(value) => formatUsd(value)}
			empty="Todavía no hay llamadas registradas."
		/>
	</section>

	<section>
		<h2>Gasto y costo medio por tarea</h2>
		<BarChart
			label="Gasto por tarea"
			bars={rows.map((row) => ({
				label: row.label,
				value: row.usd,
				detail: `${row.sharePct.toFixed(0)}%`
			}))}
			format={(value) => formatUsd(value)}
		/>
		<table>
			<thead>
				<tr><th>Tarea</th><th>Gasto</th><th>Costo medio por llamada</th></tr>
			</thead>
			<tbody>
				{#each rows as row (row.task)}
					<tr>
						<td>{row.label}</td>
						<td>{formatUsd(row.usd)}</td>
						<td>{row.avgUsd === null ? '—' : formatUsd(row.avgUsd, 6)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
		<p class="sub">El costo medio solo cuenta llamadas pagadas (sin caché).</p>
	</section>

	<section>
		<h2>Llamadas</h2>
		<p>
			Total <strong>{costs.calls.total}</strong> · cacheadas {costs.calls.cached} · abstenciones
			{costs.calls.abstained} · bloqueadas {costs.calls.blocked}
		</p>
		<p>
			Llamadas evitadas (caché + abstención): <strong>{avoided.count}</strong>
			({avoided.pct.toFixed(1)}%)
		</p>
	</section>
{/if}

{#if health}
	<section>
		<h2>Configuración activa (lo que ve <code>/health</code>)</h2>
		<p class="sub">
			Entorno {health.env} · modo de IA <strong>{health.aiMode}</strong> · versión del índice
			{health.indexVersion}
		</p>
		{#if health.aiMode === 'mock'}
			<p class="note">
				El Worker está en modo <strong>mock</strong>: no gasta créditos. Los flags se guardan igual.
			</p>
		{/if}

		<ul class="flags">
			<li>
				<div>
					<strong>Kill switch</strong>
					<span class="state" class:on={health.flags.killSwitch}>
						{health.flags.killSwitch ? 'ACTIVADO' : 'apagado'}
					</span>
					<small>Bloquea todas las llamadas a modelos.</small>
				</div>
				<button
					disabled={busy}
					onclick={() => changeFlag({ killSwitch: !health!.flags.killSwitch })}
				>
					{health.flags.killSwitch ? 'Desactivar' : 'Activar'}
				</button>
			</li>
			<li>
				<div>
					<strong>Modo del chat</strong>
					<span class="state">{health.flags.chatMode}</span>
					<small>retrieval_only responde sin modelo y sin gasto.</small>
				</div>
				<button
					disabled={busy}
					onclick={() =>
						changeFlag({
							chatMode: health!.flags.chatMode === 'full' ? 'retrieval_only' : 'full'
						})}
				>
					Cambiar a {health.flags.chatMode === 'full' ? 'retrieval_only' : 'full'}
				</button>
			</li>
			<li>
				<div>
					<strong>Ilustración con IA</strong>
					<span class="state" class:on={health.flags.imageGenEnabled}>
						{health.flags.imageGenEnabled ? 'habilitada' : 'deshabilitada'}
					</span>
					<small>Sin proveedor aprobado todavía (ADR-011).</small>
				</div>
				<button
					disabled={busy}
					onclick={() => changeFlag({ imageGenEnabled: !health!.flags.imageGenEnabled })}
				>
					{health.flags.imageGenEnabled ? 'Deshabilitar' : 'Habilitar'}
				</button>
			</li>
		</ul>
	</section>
{/if}

<section>
	<h2>Registrar saldo real del proveedor</h2>
	<p class="sub">
		Cópialo del panel de Anthropic cada lunes y antes de la demo; sirve para comprobar que el ledger
		no se desvía.
	</p>
	<form onsubmit={submitBalance} novalidate>
		<label for="balance">Saldo (USD)</label>
		<input
			id="balance"
			type="text"
			inputmode="decimal"
			bind:value={balanceInput}
			placeholder="16.20"
		/>
		<label for="balance-note">Nota (opcional)</label>
		<input id="balance-note" type="text" bind:value={balanceNote} />
		{#if balanceError}<p class="error" role="alert">{balanceError}</p>{/if}
		<div><button type="submit" disabled={busy}>Guardar saldo</button></div>
	</form>
</section>

{#if selftest}
	<section>
		<h2>Última llamada de prueba</h2>
		<p>
			Proveedor <strong>{selftest.provider}</strong> · modelo {selftest.model} · costo
			{formatUsd(selftest.costUsd, 6)} · tokens {selftest.usage.inputTokens} /
			{selftest.usage.outputTokens}
		</p>
	</section>
{/if}

<style>
	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
	}

	section {
		margin: 1.5rem 0;
	}

	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 1rem;
	}

	.card {
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.card.alert {
		border-color: #b00020;
		background: #fdecea;
	}

	.card h2 {
		margin: 0 0 0.5rem;
		font-size: 0.95rem;
		color: #555;
	}

	.big {
		margin: 0;
		font-size: 1.6rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.sub {
		margin: 0.25rem 0 0;
		color: #666;
		font-size: 0.85rem;
	}

	progress {
		width: 100%;
		margin-top: 0.5rem;
	}

	table {
		margin-top: 0.75rem;
		border-collapse: collapse;
		width: 100%;
	}

	th,
	td {
		padding: 0.4rem 0.6rem;
		border-bottom: 1px solid #ddd;
		text-align: left;
	}

	.flags {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.flags li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
	}

	.flags li div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.state {
		font-size: 0.85rem;
		color: #1b5e20;
	}

	.state.on {
		color: #b00020;
		font-weight: 700;
	}

	small {
		color: #666;
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 24rem;
	}

	form label {
		margin-top: 0.5rem;
		font-weight: 600;
	}

	form input {
		font: inherit;
		padding: 0.5rem;
	}

	.error {
		color: #b00020;
	}

	.notice {
		padding: 0.5rem 0.75rem;
		background: #e8f5e9;
		border: 1px solid #a5d6a7;
		border-radius: 4px;
	}

	.note {
		padding: 0.5rem 0.75rem;
		background: #fff8e1;
		border: 1px solid #f0d58a;
		border-radius: 4px;
	}
</style>
