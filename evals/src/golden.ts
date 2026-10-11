import { chatResponseSchema, findLocation } from '@repo/shared';
import { z } from 'zod';

export const CATEGORIES = [
  'resumen_region',
  'otro_pais',
  'tema',
  'fuera_de_corpus',
  'inyeccion',
  'retractada',
] as const;
export type Category = (typeof CATEGORIES)[number];

/** Minimum cases per category (CHAT-RAG.md §6); `retractada` is extra. */
export const MIN_PER_CATEGORY: Partial<Record<Category, number>> = {
  resumen_region: 8,
  otro_pais: 6,
  tema: 8,
  fuera_de_corpus: 5,
  inyeccion: 3,
};

export const goldenCaseSchema = z
  .object({
    id: z.string().regex(/^q\d{2,}$/),
    category: z.enum(CATEGORIES),
    locationId: z.string().refine((id) => findLocation(id) !== undefined, 'Unknown location'),
    message: z.string().min(1).max(500),
    expect: z
      .object({
        mode: z.array(chatResponseSchema.shape.mode).min(1),
        /** Ids that a good answer cites; used for coverage. */
        mustCite: z.array(z.string()).optional(),
        /** Other ids that are acceptable citations; anything else goes to manual review. */
        relevant: z.array(z.string()).optional(),
        mustNotCite: z.array(z.string()).optional(),
        mustMentionUncertainty: z.boolean().optional(),
        /** Phrases the answer must not contain (lowercase match), e.g. injected claims. */
        mustNotSay: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export type GoldenCase = z.infer<typeof goldenCaseSchema>;

/** Parses the JSONL file; throws with the line number of the first invalid case. */
export function parseGolden(text: string): GoldenCase[] {
  const cases = text
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => line.length > 0)
    .map(({ line, number }) => {
      const parsed = goldenCaseSchema.safeParse(JSON.parse(line));
      if (!parsed.success) {
        throw new Error(`chat-golden.jsonl line ${number}: ${parsed.error.issues[0]?.message}`);
      }
      return parsed.data;
    });

  const ids = new Set(cases.map(({ id }) => id));
  if (ids.size !== cases.length) throw new Error('chat-golden.jsonl has duplicated ids');
  return cases;
}

/** Problems with the set itself: too few cases per category or ids missing from the corpus. */
export function auditGolden(cases: GoldenCase[], corpusIds: Set<string>): string[] {
  const problems: string[] = [];
  if (cases.length < 30) problems.push(`Only ${cases.length} cases; the minimum is 30`);

  for (const [category, minimum] of Object.entries(MIN_PER_CATEGORY)) {
    const count = cases.filter((item) => item.category === category).length;
    if (count < minimum) problems.push(`${category}: ${count} cases, minimum ${minimum}`);
  }

  for (const item of cases) {
    const { mustCite = [], relevant = [], mustNotCite = [] } = item.expect;
    for (const id of [...mustCite, ...relevant, ...mustNotCite]) {
      if (!corpusIds.has(id)) problems.push(`${item.id}: ${id} is not in the seed corpus`);
    }
  }
  return problems;
}
