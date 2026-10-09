import { findTopic, type Certainty, type GeoScope, type News } from '@repo/shared';

const scopeLabels: Record<GeoScope, string> = {
  local: 'Local',
  nacional: 'Nacional',
  regional: 'Regional',
  internacional: 'Internacional',
  global: 'Global',
};

const certaintyLabels: Record<Certainty, string> = {
  confirmada: 'Confirmada',
  en_desarrollo: 'En desarrollo',
  disputada: 'En disputa',
  retractada: 'Retractada',
};

export function newsLabels(news: News): {
  scope: string;
  topic: string;
  certainty: string | null;
} {
  return {
    scope: scopeLabels[news.geo.scope],
    topic: findTopic(news.topics[0] ?? '')?.label ?? 'Actualidad',
    certainty: news.certainty === 'confirmada' ? null : certaintyLabels[news.certainty],
  };
}

export function relativePublishedAt(publishedAt: string | undefined, now: Date): string {
  const published = Date.parse(publishedAt ?? '');
  if (!Number.isFinite(published)) return 'Fecha no disponible';
  const minutes = Math.max(0, Math.floor((now.getTime() - published) / 60_000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  if (hours < 48) return 'Ayer';
  if (hours < 72) return `Hace ${Math.floor(hours / 24)} días`;
  return new Intl.DateTimeFormat('es-GT', {
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Guatemala',
  }).format(new Date(published));
}
