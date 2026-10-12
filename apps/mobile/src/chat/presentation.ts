import {
  CHAT_MAX_HISTORY,
  classifyIntent,
  findCountry,
  findLocation,
  findTopic,
  lowestCertainty,
  type ChatBlock,
  type ChatIntent,
  type ChatResponse,
  type ChatTurn,
  type News,
} from '@repo/shared';

import { certaintyLabels } from '../feed/presentation';

export type ChatEntry =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; question: string; response: ChatResponse };

const FALLBACK_COUNTRY = 'España';
const FALLBACK_TOPIC = 'economía';

function mostFrequent(values: string[]): string | undefined {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0]?.[0];
}

/**
 * The four suggestions of CHAT-RAG §4, one per case of the brief. The other country and the
 * frequent topic come from the published news, so each suggestion can actually be answered.
 */
export function buildSuggestions(news: News[], locationId: string): string[] {
  const ownCountry = findLocation(locationId)?.countryIso;
  const otherIso = mostFrequent(
    news.flatMap(({ geo }) => geo.countries).filter((iso) => iso !== ownCountry),
  );
  const topicKey = mostFrequent(news.flatMap(({ topics }) => topics.slice(0, 1)));
  const country = (otherIso && findCountry(otherIso)?.name) || FALLBACK_COUNTRY;
  const topic = (topicKey && findTopic(topicKey)?.label.toLowerCase()) || FALLBACK_TOPIC;

  return [
    'Resume lo más importante de hoy',
    '¿Qué pasa en mi zona?',
    `Explícame lo más importante de ${country}`,
    `¿Qué hay de nuevo sobre ${topic}?`,
  ];
}

/** Plain text of an assistant answer, as it is sent back as history. */
export function responseText(response: ChatResponse): string {
  if (response.blocks.length > 0) return response.blocks.map(({ text }) => text).join('\n');
  return response.notice ?? '';
}

/** The last turns, text only, within the limit the API accepts. */
export function toHistory(entries: ChatEntry[]): ChatTurn[] {
  return entries
    .map<ChatTurn>((entry) =>
      entry.role === 'user'
        ? { role: 'user', content: entry.text }
        : { role: 'assistant', content: responseText(entry.response).slice(0, 2000) },
    )
    .filter(({ content }) => content.trim().length > 0)
    .slice(-CHAT_MAX_HISTORY);
}

/** Certainty chip of a block: inherited from its news; `mixta` shows the least certain one. */
export function blockCertaintyLabel(block: ChatBlock, response: ChatResponse): string {
  if (block.certainty !== 'mixta') return certaintyLabels[block.certainty];
  const cited = response.sources
    .filter(({ newsId }) => block.newsIds.includes(newsId))
    .map(({ certainty }) => certainty);
  const lowest = lowestCertainty(cited);
  return lowest
    ? `Certeza mixta · incluye ${certaintyLabels[lowest].toLowerCase()}`
    : 'Certeza mixta';
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Provenance footer of an answer (VERIFICACION-Y-FUENTES §4, origin `respuesta_ia`). */
export function provenanceFooter(response: ChatResponse): string {
  const news = plural(response.sources.length, 'noticia publicada', 'noticias publicadas');
  switch (response.mode) {
    case 'answer':
      return `Respuesta generada con IA a partir de ${news} · ${response.generatedBy?.model ?? 'modelo'}`;
    case 'digest':
      return `Resumen generado con IA a partir de ${news} · ${response.generatedBy?.model ?? 'modelo'}`;
    case 'retrieval_only':
      return `Sin IA: resultado de búsqueda (${news})`;
    case 'abstain':
      return 'Sin IA: no se encontraron noticias publicadas que respondan esto';
    case 'blocked':
      return 'Sin IA: el chat está pausado';
  }
}

const intentLabels: Record<ChatIntent, string> = {
  resumen: 'Resumen de lo reciente',
  mi_region: 'Noticias de tu zona',
  otro_pais: 'Noticias de otro país',
  tema: 'Novedades sobre un tema',
};

export interface GenerationTrace {
  intent: string;
  news: string[];
  origin: string;
  cost: string;
}

/**
 * "¿Cómo se generó?": the intent comes from `debug` in dev and otherwise from the same rules the
 * Worker runs (`classifyIntent` is shared), so the panel works in demo too.
 */
export function generationTrace(
  response: ChatResponse,
  question: string,
  locationId: string,
): GenerationTrace {
  const intent =
    (response.debug?.intent as ChatIntent | undefined) ??
    classifyIntent(question, locationId).intent;
  const origin =
    response.mode === 'digest'
      ? response.cached
        ? 'Resumen del día de tu ubicación, ya generado (caché)'
        : 'Resumen del día de tu ubicación, generado ahora'
      : response.cached
        ? 'Respuesta guardada de una pregunta igual (caché)'
        : response.generatedBy
          ? `Generada ahora con ${response.generatedBy.model}`
          : 'Sin modelo de IA';

  return {
    intent: intentLabels[intent] ?? intent,
    news: response.sources.map(({ title }) => title),
    origin,
    cost: response.costUsd > 0 ? `≈ USD ${response.costUsd.toFixed(4)}` : 'USD 0',
  };
}

/** Topic of an answer for the `chat_topic` signal: the most cited topic among its news. */
export function chatTopic(response: ChatResponse, newsById: Map<string, News>): string | undefined {
  if (response.mode !== 'answer' && response.mode !== 'digest') return undefined;
  return mostFrequent(
    response.sources.flatMap(({ newsId }) => newsById.get(newsId)?.topics.slice(0, 1) ?? []),
  );
}

export type ChatFailure = 'network' | 'rate_limited' | 'unauthorized' | 'server';

export const failureMessages: Record<ChatFailure, string> = {
  network: 'No hay conexión con el servidor. Revisa tu red e intenta de nuevo.',
  rate_limited:
    'Llegaste al límite de 20 mensajes por hora. Puedes seguir leyendo el feed y volver más tarde.',
  unauthorized: 'Tu sesión expiró. Vuelve a iniciar sesión para usar el chat.',
  server: 'El chat tuvo un problema al responder. Intenta de nuevo.',
};

export function greeting(locationId: string): string {
  const location = findLocation(locationId);
  const country = location ? findCountry(location.countryIso)?.name : undefined;
  const place = location ? [location.city, country].filter(Boolean).join(', ') : 'tu ubicación';
  return `Hola. Te cuento lo que pasa en las noticias publicadas, viendo desde ${place}.`;
}
