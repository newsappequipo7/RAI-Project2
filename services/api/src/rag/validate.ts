import {
  blockCertainty,
  normalizeText,
  UNCERTAIN_CERTAINTIES,
  type ChatBlock,
  type ChatSource,
  type IndexEntry,
} from '@repo/shared';
import { z } from 'zod';
import { CHAT_MAX_BLOCKS, CHAT_SYSTEM_PROMPT } from '../ai/prompts/chat.v2';

const MAX_BLOCK_TEXT = 1200;

/** Words in a row copied from the system prompt that count as leaking it. */
const LEAK_NGRAM = 8;
/** Markup and field names that only appear in our prompt and output format. */
const LEAK_MARKERS = [
  '<noticia',
  '</noticias',
  '<pregunta',
  '<conversacion',
  'newsids',
  '"insufficient"',
];

function ngrams(text: string, size: number): Set<string> {
  const words = normalizeText(text).split(' ').filter(Boolean);
  const result = new Set<string>();
  for (let start = 0; start + size <= words.length; start += 1) {
    result.add(words.slice(start, start + size).join(' '));
  }
  return result;
}

const PROMPT_NGRAMS = ngrams(CHAT_SYSTEM_PROMPT, LEAK_NGRAM);

/**
 * F4-07 defense in depth: a block that repeats a run of the system prompt or our markup is
 * dropped, whatever an injected instruction made the model write. Validation in code is the last
 * line of defense; the prompt alone is not trusted.
 */
export function leaksPrompt(text: string): boolean {
  const lower = text.toLowerCase();
  if (LEAK_MARKERS.some((marker) => lower.includes(marker))) return true;
  for (const gram of ngrams(text, LEAK_NGRAM)) if (PROMPT_NGRAMS.has(gram)) return true;
  return false;
}

/**
 * What the model is asked to return. Unknown keys (for example a `certainty` the model invents)
 * are stripped: certainty is never read from the model.
 */
const chatModelOutputSchema = z.object({
  blocks: z.array(
    z.object({
      text: z.string(),
      newsIds: z.array(z.string()).optional(),
    }),
  ),
  insufficient: z.boolean().optional(),
});

export type ChatModelOutput = z.infer<typeof chatModelOutputSchema>;

/** Parses the model text, tolerating a code fence or surrounding prose. `null` if unusable. */
export function parseChatOutput(text: string): ChatModelOutput | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = chatModelOutputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface ValidatedAnswer {
  blocks: ChatBlock[];
  sources: ChatSource[];
  /** The model said the news only answer part of the question. */
  partial: boolean;
  /** Some cited news is still developing or disputed. */
  uncertain: boolean;
  /** Blocks dropped for having no ids, ids outside the context, no text or a prompt leak. */
  discarded: number;
}

function toSource(entry: IndexEntry): ChatSource {
  return {
    newsId: entry.id,
    title: entry.title,
    certainty: entry.certainty,
    publishedAt: entry.publishedAt,
    outlets: [...new Set(entry.sources.map(({ name }) => name))],
  };
}

/**
 * Step 9 of CHAT-RAG.md §2. Keeps only blocks whose citations all belong to the retrieved news
 * (a block with a single invented id is dropped whole), sets each block's certainty from those
 * news, and lists as sources only the news actually cited.
 */
export function validateAnswer(output: ChatModelOutput, context: IndexEntry[]): ValidatedAnswer {
  const allowed = new Map(context.map((entry) => [entry.id, entry]));
  const blocks: ChatBlock[] = [];
  const cited = new Map<string, IndexEntry>();
  let discarded = 0;

  for (const block of output.blocks) {
    const ids = [...new Set(block.newsIds ?? [])];
    const entries = ids.map((id) => allowed.get(id));
    const text = block.text.trim().slice(0, MAX_BLOCK_TEXT);
    const certainty = blockCertainty(entries.flatMap((entry) => (entry ? [entry.certainty] : [])));

    if (
      !text ||
      ids.length === 0 ||
      entries.some((entry) => !entry) ||
      !certainty ||
      leaksPrompt(text)
    ) {
      discarded += 1;
      continue;
    }
    if (blocks.length >= CHAT_MAX_BLOCKS) {
      discarded += 1;
      continue;
    }

    blocks.push({ text, newsIds: ids, certainty });
    entries.forEach((entry) => entry && cited.set(entry.id, entry));
  }

  const sources = [...cited.values()].map(toSource);
  return {
    blocks,
    sources,
    partial: output.insufficient === true,
    uncertain: sources.some(({ certainty }) => UNCERTAIN_CERTAINTIES.includes(certainty)),
    discarded,
  };
}
