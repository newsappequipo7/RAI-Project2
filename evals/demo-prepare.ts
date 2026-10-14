/**
 * F4-09: checks the Worker before a rehearsal or the live demo and warms the digest of every location.
 * The only model calls are the digests that are not cached yet (a few thousandths of a dollar each).
 *
 *   EVAL_ID_TOKEN=<admin Firebase ID token> pnpm demo:prepare --api <worker url>
 *
 * Exits with code 1 when something would hurt the demo, so it can be run right before presenting.
 */
import {
  chatResponseSchema,
  healthResponseSchema,
  LOCATIONS,
  type ChatResponse,
  type CostsResponse,
  type HealthResponse,
} from '@repo/shared';

const DEFAULT_API = 'http://127.0.0.1:8787';
const REQUEST_TIMEOUT_MS = 60_000;

interface WarmedDigest {
  locationId: string;
  response: ChatResponse;
  latencyMs: number;
}

function value(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

async function getJson(api: string, path: string, token: string): Promise<unknown> {
  const response = await fetch(`${api}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`GET ${path} → ${response.status}`);
  return response.json();
}

function healthProblems(health: HealthResponse): string[] {
  return [
    health.aiMode !== 'live' ? `aiMode es "${health.aiMode}": el chat respondería con mocks` : '',
    health.flags.killSwitch ? 'el kill switch está encendido' : '',
    health.flags.chatMode !== 'full' ? `chatMode es "${health.flags.chatMode}"` : '',
    health.flags.imageGenEnabled
      ? 'imageGenEnabled está encendido (la demo usa portada tipográfica)'
      : '',
  ].filter(Boolean);
}

function budgetProblems(costs: CostsResponse): string[] {
  const { level, lastProviderBalance } = costs.budget;
  return [
    level !== 'normal' ? `el nivel de presupuesto es "${level}"` : '',
    lastProviderBalance === null ? 'no hay un saldo real registrado en /costs' : '',
  ].filter(Boolean);
}

async function warmDigest(api: string, token: string, locationId: string): Promise<WarmedDigest> {
  const started = performance.now();
  const response = chatResponseSchema.parse(await getJson(api, `/digest/${locationId}`, token));
  return { locationId, response, latencyMs: Math.round(performance.now() - started) };
}

function digestProblem({ locationId, response }: WarmedDigest): string {
  if (response.mode !== 'digest')
    return `${locationId}: respondió en modo "${response.mode}", no "digest"`;
  if (response.generatedBy?.provider !== 'anthropic')
    return `${locationId}: el digest no lo generó el modelo real`;
  return '';
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const api = (value(argv, '--api') ?? process.env.EVAL_API_URL ?? DEFAULT_API).replace(/\/$/, '');
  const token = process.env.EVAL_ID_TOKEN;
  if (!token) throw new Error('Set EVAL_ID_TOKEN to a Firebase ID token of a project admin.');

  const health = healthResponseSchema.parse(await getJson(api, '/health', token));
  console.log(
    `Worker ${api}: env=${health.env}, aiMode=${health.aiMode}, índice v${health.indexVersion}`,
  );

  const costs = (await getJson(api, '/admin/costs', token)) as CostsResponse;
  const { limitUsd, reserveUsd, level, lastProviderBalance } = costs.budget;
  console.log(
    `Gasto USD ${costs.totalUsd.toFixed(4)} de ${limitUsd} · reserva ${reserveUsd} · nivel ${level} · saldo real registrado: ${lastProviderBalance ?? 'ninguno'}`,
  );

  const digests: WarmedDigest[] = [];
  for (const { id } of LOCATIONS) digests.push(await warmDigest(api, token, id));
  console.table(
    digests.map(({ locationId, response, latencyMs }) => ({
      ubicación: locationId,
      modo: response.mode,
      caché: response.cached,
      modelo: response.generatedBy?.model ?? '—',
      'costo USD': response.costUsd,
      ms: latencyMs,
    })),
  );

  const problems = [
    ...healthProblems(health),
    ...budgetProblems(costs),
    ...digests.map(digestProblem),
  ].filter(Boolean);
  if (problems.length === 0) {
    console.log('Todo listo para el ensayo.');
    return;
  }
  console.error(
    `\nRevisar antes de empezar:\n${problems.map((problem) => `- ${problem}`).join('\n')}`,
  );
  process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
