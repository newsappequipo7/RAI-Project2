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
  chat_answer: 'Respuesta simulada (AI_MODE=mock). No proviene de un modelo real.',
  digest: 'Resumen del día simulado (AI_MODE=mock). No proviene de un modelo real.',
};
