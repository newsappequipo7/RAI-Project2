import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const AI_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = dirname(AI_DIR);
const PROVIDER_MARKERS = /@anthropic-ai\/|api\.anthropic\.com|from ['"]openai|api\.openai\.com/;

function sourceFilesOutside(directory: string, excluded: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (path === excluded) return [];
    if (entry.isDirectory()) return sourceFilesOutside(path, excluded);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('AI provider boundary', () => {
  it('keeps every provider SDK and endpoint inside src/ai (golden rule #2)', () => {
    const offenders = sourceFilesOutside(SRC_DIR, AI_DIR)
      .filter((file) => PROVIDER_MARKERS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC_DIR, file).split(sep).join('/'));

    expect(offenders).toEqual([]);
  });

  it('actually finds provider code inside src/ai, so the scan is not vacuous', () => {
    const providerFile = join(AI_DIR, 'providers', 'anthropic.ts');
    expect(PROVIDER_MARKERS.test(readFileSync(providerFile, 'utf8'))).toBe(true);
  });
});
