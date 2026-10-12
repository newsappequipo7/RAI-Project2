import type { AiTask } from '@repo/shared';

export const MOCK_EMBEDDING_DIMENSION = 1024;

const ENRICH_FIXTURE = {
  topics: [{ key: 'sociedad', confidence: 0.8 }],
  geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
  importance: { value: 1, rationale: 'Respuesta simulada (AI_MODE=mock).' },
  claims: [{ text: 'Afirmación de ejemplo generada por el mock.', needsSource: true }],
  summary: 'Resumen simulado. No proviene de un modelo real.',
  sensationalismFlag: { flagged: false },
};

export const MOCK_TEXT_BY_TASK: Record<Exclude<AiTask, 'embed' | 'image_generate'>, string> = {
  enrich: JSON.stringify(ENRICH_FIXTURE),
  chat_answer: JSON.stringify({ blocks: [], insufficient: true }),
  digest: 'Resumen del día simulado (AI_MODE=mock). No proviene de un modelo real.',
};

const MOCK_CHAT_TEXT =
  'Respuesta simulada (AI_MODE=mock), no proviene de un modelo real. Resume la noticia citada';

/**
 * Mock chat answer that cites the news actually sent as context (the `<noticia id="…">` tags of
 * chat.v1), so the app can exercise the whole answer flow without spending credits.
 */
export function mockChatAnswer(prompt: string): string {
  const ids = [...prompt.matchAll(/<noticia id="([^"]+)">/g)].map((match) => match[1]);
  if (ids.length === 0) return MOCK_TEXT_BY_TASK.chat_answer;

  return JSON.stringify({
    blocks: ids.slice(0, 2).map((id) => ({ text: `${MOCK_CHAT_TEXT}.`, newsIds: [id] })),
    insufficient: false,
  });
}
