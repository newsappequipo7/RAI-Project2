import { AI_TASKS, type AiTask, type CostsResponse, type Flags } from '@repo/shared';

export const TASK_LABELS: Record<AiTask, string> = {
	enrich: 'Enriquecimiento (enrich)',
	chat_answer: 'Chat (chat_answer)',
	digest: 'Resumen del día (digest)',
	embed: 'Embeddings (embed)',
	image_generate: 'Ilustración IA (image_generate)'
};

export const BUDGET_LEVEL_LABELS: Record<CostsResponse['budget']['level'], string> = {
	normal: 'Normal',
	warn: 'Aviso',
	soft: 'Limitado',
	hard: 'Crítico',
	exhausted: 'Agotado'
};

export function formatUsd(value: number, digits = 4): string {
	return `USD ${value.toFixed(digits)}`;
}

export function formatDrift(value: number | null): string {
	if (value === null) return '—';
	return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(4)}`;
}

export interface BudgetSummary {
	spentPct: number;
	/** limit − spent, per the ledger. */
	estimatedBalanceUsd: number;
	/** What can still be spent without touching the untouchable reserve for the presentation. */
	spendableBeforeReserveUsd: number;
	reserveIntact: boolean;
	/** Real provider balance minus the estimate; null until a snapshot exists. */
	balanceDriftUsd: number | null;
	/** Ledger spend vs spend implied by the provider balance (PRESUPUESTO-IA.md §1.5). */
	driftPct: number | null;
	/** More than 10 % apart (ignoring differences under a cent): investigate and log a loop. */
	driftExceeds: boolean;
}

export const DRIFT_THRESHOLD_PCT = 10;
const DRIFT_MIN_USD = 0.01;

export function summarizeBudget(costs: CostsResponse): BudgetSummary {
	const { limitUsd, reserveUsd, lastProviderBalance } = costs.budget;
	const estimatedBalanceUsd = limitUsd - costs.totalUsd;
	const spendable = limitUsd - reserveUsd - costs.totalUsd;
	const panelSpent = lastProviderBalance === null ? null : limitUsd - lastProviderBalance;
	const gap = panelSpent === null ? null : Math.abs(panelSpent - costs.totalUsd);
	const larger = panelSpent === null ? 0 : Math.max(panelSpent, costs.totalUsd);
	const driftPct = gap === null ? null : larger > 0 ? (gap / larger) * 100 : 0;

	return {
		spentPct: limitUsd > 0 ? Math.min(100, (costs.totalUsd / limitUsd) * 100) : 0,
		estimatedBalanceUsd,
		spendableBeforeReserveUsd: Math.max(0, spendable),
		reserveIntact: spendable >= 0,
		balanceDriftUsd:
			lastProviderBalance === null ? null : lastProviderBalance - estimatedBalanceUsd,
		driftPct,
		driftExceeds: gap !== null && gap >= DRIFT_MIN_USD && (driftPct ?? 0) > DRIFT_THRESHOLD_PCT
	};
}

/** Calls that did not need a paid model: cache hits and abstentions, over all calls. */
export function avoidedCalls(calls: CostsResponse['calls']): { count: number; pct: number } {
	const count = calls.cached + calls.abstained;
	return { count, pct: calls.total > 0 ? (count / calls.total) * 100 : 0 };
}

export interface TaskRow {
	task: AiTask;
	label: string;
	usd: number;
	sharePct: number;
	/** Average cost of a paid, uncached call; null when the task had none. */
	avgUsd: number | null;
}

export function taskRows(costs: CostsResponse): TaskRow[] {
	return AI_TASKS.map((task) => ({
		task,
		label: TASK_LABELS[task],
		usd: costs.byTask[task] ?? 0,
		sharePct: costs.totalUsd > 0 ? ((costs.byTask[task] ?? 0) / costs.totalUsd) * 100 : 0,
		avgUsd: costs.avgCostPerCall[task] ?? null
	})).sort((a, b) => b.usd - a.usd);
}

/** The most recent `limit` days, oldest first, so the chart reads left to right in time. */
export function recentDays(byDay: CostsResponse['byDay'], limit = 14): CostsResponse['byDay'] {
	return byDay.slice(-limit);
}

/** Parses a balance typed by a person ("16.20", "16,20", "$ 16.2"); null when invalid or negative. */
export function parseBalance(input: string): number | null {
	const cleaned = input.replace(/[^\d.,-]/g, '').replace(',', '.');
	if (cleaned === '') return null;

	const value = Number(cleaned);
	return Number.isFinite(value) && value >= 0 ? value : null;
}

/** The sentence to confirm before changing a flag, saying what the change really does. */
export function describeFlagChange(patch: Partial<Flags>): string {
	if (patch.killSwitch === true) {
		return 'Activar el kill switch bloquea TODAS las llamadas a modelos de IA, incluido el chat, hasta que lo desactives.';
	}
	if (patch.killSwitch === false) {
		return 'Desactivar el kill switch vuelve a permitir las llamadas a modelos de IA (que gastan créditos).';
	}
	if (patch.imageGenEnabled === true) {
		return 'Permitir la ilustración con IA habilita la pestaña en el editor. Aún no hay un proveedor de imágenes aprobado (ADR-011) y cada imagen costaría créditos.';
	}
	if (patch.imageGenEnabled === false) {
		return 'Apagar la ilustración con IA quita la pestaña del editor y bloquea la generación desde la API.';
	}
	if (patch.chatMode === 'retrieval_only') {
		return 'El chat dejará de usar el modelo: solo devolverá las noticias recuperadas, sin gasto de créditos.';
	}
	if (patch.chatMode === 'full') {
		return 'El chat volverá a responder con el modelo, lo que gasta créditos en cada respuesta.';
	}
	return 'Cambiar esta configuración.';
}
