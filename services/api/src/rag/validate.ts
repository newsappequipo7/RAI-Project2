import {
  blockCertainty,
  UNCERTAIN_CERTAINTIES,
  type ChatBlock,
  type ChatSource,
  type IndexEntry,
} from '@repo/shared';
import { z } from 'zod';
import { CHAT_MAX_BLOCKS } from '../ai/prompts/chat.v1';

const MAX_BLOCK_TEXT = 1200;

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
  /** Blocks dropped for having no ids, ids outside the context or no text. */
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

    if (!text || ids.length === 0 || entries.some((entry) => !entry) || !certainty) {
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
