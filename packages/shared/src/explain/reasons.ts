import { findCountry } from '../catalogs/countries-es';
import type { Location, Region } from '../catalogs/locations';
import { findTopic } from '../catalogs/topics';
import type { RankedItem, RankingWeights, Reason, UserProfile } from '../types';

const REGION_LABELS: Record<Region, string> = {
  centroamerica: 'Centroamérica',
  norteamerica: 'Norteamérica',
  sudamerica: 'Sudamérica',
  caribe: 'Caribe',
  europa: 'Europa',
  asia: 'Asia',
  africa: 'África',
  oceania: 'Oceanía',
  'medio-oriente': 'Medio Oriente',
};

export const REASON_TEXT: Readonly<Record<Reason['code'], string>> = Object.freeze({
  essential: 'Información esencial para tu zona: se muestra a todas las personas',
  city: 'Ocurre en tu ciudad ({value})',
  country: 'Afecta a tu país ({value})',
  region: 'Es relevante para tu región ({value})',
  global: 'Tiene alcance global',
  affinity: 'Sueles leer sobre {value}',
  international_quota: 'Para que no te pierdas lo que pasa fuera de tu país',
  national_quota: 'Para que no te pierdas lo que pasa en tu país',
  recent: 'Publicada hace poco',
  important: 'El equipo editorial la marcó como importante',
  importance_score: 'Su nivel de importancia editorial contribuye a su relevancia',
  proximity_score: 'Su cercanía a la ubicación seleccionada contribuye a su relevancia',
  affinity_score: 'Su afinidad temática contribuye a su relevancia',
  recency_score: 'Su fecha de publicación contribuye a su relevancia',
  available: 'Forma parte de las noticias publicadas disponibles',
});

function reason(code: Reason['code'], contribution: number, value = ''): Reason {
  return { code, text: REASON_TEXT[code].replace('{value}', () => value), contribution };
}

function strongestTopic(topics: string[], profile: UserProfile): string {
  let strongest = topics[0];
  let maximum = -1;
  for (const topic of topics) {
    const raw = profile.interests[topic] ?? 0;
    const interest = Number.isFinite(raw) ? Math.min(10, Math.max(0, raw)) : 0;
    if (interest > maximum) {
      strongest = topic;
      maximum = interest;
    }
  }
  return (
    (strongest ? findTopic(strongest)?.label.toLowerCase() : undefined) ??
    'los temas de esta noticia'
  );
}

/** Receives the same effective, normalized weights used to score this item. */
export function buildReasons(
  item: RankedItem,
  location: Location,
  profile: UserProfile,
  weights: RankingWeights,
): Reason[] {
  const { components: c } = item;
  const contribution = {
    importance: weights.wI * c.importance * c.penalties,
    proximity: weights.wG * c.proximity * c.penalties,
    affinity: weights.wA * c.affinity * c.penalties,
    recency: weights.wR * c.recency * c.penalties,
  };
  const candidates: Reason[] = [];
  if (contribution.proximity > 0) {
    if (c.proximity === 1) candidates.push(reason('city', contribution.proximity, location.city));
    if (c.proximity === 0.75)
      candidates.push(
        reason(
          'country',
          contribution.proximity,
          findCountry(location.countryIso)?.name ?? location.countryIso,
        ),
      );
    if (c.proximity === 0.4)
      candidates.push(reason('region', contribution.proximity, REGION_LABELS[location.region]));
    if (c.proximity === 0.6) candidates.push(reason('global', contribution.proximity));
  }
  if (
    profile.personalization &&
    c.affinity >= 0.6 &&
    contribution.affinity > 0 &&
    item.news.topics.length > 0 &&
    !item.news.topics.some((topic) => profile.mutedTopics.includes(topic))
  ) {
    candidates.push(
      reason('affinity', contribution.affinity, strongestTopic(item.news.topics, profile)),
    );
  }
  if (c.recency >= 0.8 && contribution.recency > 0)
    candidates.push(reason('recent', contribution.recency));
  if (item.news.importance >= 2 && contribution.importance > 0)
    candidates.push(reason('important', contribution.importance));

  let guarantee: Reason | undefined;
  if (item.guaranteedBy === 'esencial') guarantee = reason('essential', 0);
  if (item.guaranteedBy === 'cuota_nacional') guarantee = reason('national_quota', 0);
  if (item.guaranteedBy === 'cuota_internacional') guarantee = reason('international_quota', 0);
  if (!guarantee && candidates.length === 0) {
    // Threshold-free descriptions cover older/low-score news without claiming recent/local/important.
    const fallback = [
      reason('importance_score', contribution.importance),
      reason('proximity_score', contribution.proximity),
      reason('affinity_score', contribution.affinity),
      reason('recency_score', contribution.recency),
    ].sort((a, b) => b.contribution - a.contribution)[0]!;
    candidates.push(fallback.contribution > 0 ? fallback : reason('available', 0));
  }
  // Stable sort preserves catalogue order on ties. A policy reserves a slot but adds no score.
  const selected = candidates
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, guarantee ? 2 : 3);
  if (guarantee) selected.push(guarantee);
  return selected;
}
