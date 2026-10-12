/**
 * F4-08: real cost per AI function and the demo reserve check, read from the Worker ledger.
 * Read-only; makes no model calls.
 *
 *   EVAL_ID_TOKEN=<admin Firebase ID token> pnpm evals:costs --api <worker url> [--out <file.md>]
 */
import { writeFile } from 'node:fs/promises';
import type { CostsResponse } from '@repo/shared';
import { renderCostReport } from './src/costs';

function value(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const api = (value(argv, '--api') ?? process.env.EVAL_API_URL ?? 'http://127.0.0.1:8787').replace(
    /\/$/,
    '',
  );
  const token = process.env.EVAL_ID_TOKEN;
  if (!token) throw new Error('Set EVAL_ID_TOKEN to a Firebase ID token of a project admin.');

  const response = await fetch(`${api}/admin/costs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`GET /admin/costs → ${response.status}`);
  const costs = (await response.json()) as CostsResponse;
  if (!costs.taskStats)
    throw new Error('This Worker predates F4-08: /admin/costs has no taskStats. Deploy first.');

  const markdown = renderCostReport(costs, new Date(), api);
  const out = value(argv, '--out');
  if (out) {
    await writeFile(out, markdown);
    console.log(`Written ${out}`);
  } else {
    console.log(markdown);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
