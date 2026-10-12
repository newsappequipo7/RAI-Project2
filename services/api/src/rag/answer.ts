import {
  UNCERTAIN_CERTAINTIES,
  type AiTask,
  type ChatResponse,
  type ChatTurn,
  type IndexEntry,
} from '@repo/shared';
import { gateway } from '../ai/gateway';
import { buildChatPrompt, CHAT_MAX_TOKENS } from '../ai/prompts/chat.v1';
import type { GatewayContext, GatewayResult } from '../ai/types';
import { ApiError } from '../errors';
import { CHAT_CONFIG } from './chatConfig';
import { parseChatOutput, validateAnswer, type ChatModelOutput } from './validate';

export const CHAT_NOTICES = {
  blocked:
    'El chat está pausado por ahora. Puedes seguir leyendo las noticias publicadas en el feed.',
  abstain: 'No encontré noticias publicadas sobre eso. Puedo contarte lo más reciente de tu zona.',
  noRecentNews: 'No hay noticias recientes publicadas para tu zona.',
  retrievalOnly:
    'Respuesta sin IA: estas son las noticias publicadas que encontré sobre tu pregunta.',
  uncertain: 'Hay información en desarrollo o disputada: revisa la certeza de cada noticia.',
  partial: 'Las noticias publicadas responden solo una parte de tu pregunta.',
} as const;

export function emptyResponse(mode: ChatResponse['mode'], notice: string): ChatResponse {
  return { mode, blocks: [], sources: [], notice, generatedBy: null, cached: false, costUsd: 0 };
}

export function joinNotices(...notices: (string | false | undefined)[]): string | undefined {
  const present = notices.filter((notice): notice is string => Boolean(notice));
  return present.length > 0 ? present.join(' ') : undefined;
}

function leadOf(entry: IndexEntry): string {
  return entry.lead.trim() || entry.excerpt.slice(0, CHAT_CONFIG.fallbackLeadLength).trim();
}

/** Without a model: one block per news, with its own certainty. */
export function retrievalOnlyResponse(entries: IndexEntry[], costUsd: number): ChatResponse {
  const uncertain = entries.some(({ certainty }) => UNCERTAIN_CERTAINTIES.includes(certainty));

  return {
    mode: 'retrieval_only',
    blocks: entries.map((entry) => ({
      text: leadOf(entry),
      newsIds: [entry.id],
      certainty: entry.certainty,
    })),
    sources: entries.map((entry) => ({
      newsId: entry.id,
      title: entry.title,
      certainty: entry.certainty,
      publishedAt: entry.publishedAt,
      outlets: [...new Set(entry.sources.map(({ name }) => name))],
    })),
    notice: joinNotices(CHAT_NOTICES.retrievalOnly, uncertain && CHAT_NOTICES.uncertain),
    generatedBy: null,
    cached: false,
    costUsd,
  };
}

export interface AnswerRequest {
  question: string;
  history: ChatTurn[];
  context: IndexEntry[];
}

export type ModelAnswer =
  | {
      ok: true;
      /** Blocks, sources and notice already validated; empty blocks mean nothing was supported. */
      response: Pick<ChatResponse, 'blocks' | 'sources' | 'notice'>;
      generatedBy: { provider: string; model: string };
      costUsd: number;
    }
  | { ok: false; costUsd: number };

/**
 * CHAT-RAG.md §2 steps 8–10: one model call through the gateway, a single retry with a format
 * reminder when the output is not the requested JSON, then validation in code. Provider and budget
 * errors and a second broken output return `ok: false`; the gateway writes one ledger row per call.
 */
export async function askModel(
  task: Extract<AiTask, 'chat_answer' | 'digest'>,
  request: AnswerRequest,
  ctx: GatewayContext,
): Promise<ModelAnswer> {
  let costUsd = 0;
  let last: GatewayResult | undefined;
  let output: ChatModelOutput | null = null;

  try {
    for (const formatReminder of [false, true]) {
      const { system, prompt } = buildChatPrompt({
        question: request.question,
        history: request.history,
        news: request.context,
        excerptLength: CHAT_CONFIG.contextExcerptLength,
        formatReminder,
      });
      last = await gateway.run(
        task,
        { kind: 'text', system, prompt, maxTokens: CHAT_MAX_TOKENS },
        ctx,
      );
      costUsd += last.costUsd;
      output = last.output.kind === 'text' ? parseChatOutput(last.output.text) : null;
      if (output) break;
    }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, costUsd };
    throw error;
  }

  if (!output || !last) return { ok: false, costUsd };

  const answer = validateAnswer(output, request.context);
  return {
    ok: true,
    response: {
      blocks: answer.blocks,
      sources: answer.sources,
      notice: joinNotices(
        answer.uncertain && CHAT_NOTICES.uncertain,
        answer.partial && CHAT_NOTICES.partial,
      ),
    },
    generatedBy: { provider: last.provider, model: last.model },
    costUsd,
  };
}
