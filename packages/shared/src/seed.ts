import type { Certainty, Claim, IndexInput, News, NewsGeo, NewsImage, Source } from './types';

export interface SeedSourceRef {
  key: string;
  supports: Source['supports'];
  note?: string;
}

export interface SeedNews {
  id: string;
  title: string;
  lead: string;
  body: string;
  topics: string[];
  geo: NewsGeo;
  importance: 0 | 1 | 2 | 3;
  certainty: Certainty;
  certaintyNote?: string;
  publishedHoursAgo: number;
  sources: SeedSourceRef[];
  image?: NewsImage;
  correction?: string;
}

interface SourceProfile {
  name: string;
  type: Source['type'];
}

const MS_PER_HOUR = 3_600_000;
const SEED_EDITOR_UID = 'seed-script';
const SEED_SOURCE_BASE_URL = 'https://example.org/fuentes';
const GENERATED_COVER_CREDIT = 'Portada generada por la app (no es una fotografía)';

// Every outlet and institution below is fictional; the corpus is test data.
export const SEED_SOURCES: Record<string, SourceProfile> = {
  agn: { name: 'Agencia Nacional de Prensa', type: 'agencia' },
  ali: { name: 'Agencia Latina Internacional', type: 'agencia' },
  aib: { name: 'Agencia Ibérica de Noticias', type: 'agencia' },
  dal: { name: 'Diario del Altiplano', type: 'medio' },
  cro: { name: 'La Crónica Metropolitana', type: 'medio' },
  vol: { name: 'Voz del Volcán', type: 'medio' },
  anh: { name: 'Anáhuac Hoy', type: 'medio' },
  and: { name: 'El Andino de Bogotá', type: 'medio' },
  hud: { name: 'Hudson Latino', type: 'medio' },
  rio: { name: 'Río de la Plata Noticias', type: 'medio' },
  cap: { name: 'El Diario de la Capital', type: 'medio' },
  mun: { name: 'Mundo Global Noticias', type: 'medio' },
  sgd: { name: 'Coordinación Nacional de Gestión de Desastres', type: 'primaria' },
  ssm: { name: 'Servicio Sismológico Regional', type: 'primaria' },
  mig: { name: 'Autoridad Migratoria de Guatemala', type: 'primaria' },
  aer: { name: 'Autoridad de Aviación Civil', type: 'primaria' },
  acu: { name: 'Empresa de Acueducto de Bogotá', type: 'primaria' },
  lig: { name: 'Liga de Fútbol Profesional', type: 'primaria' },
  fed: { name: 'Federación de Fútbol', type: 'primaria' },
  sat: { name: 'Sistema de Monitoreo Satelital', type: 'primaria' },
  emj: { name: 'Empresa de Semiconductores del Japón', type: 'primaria' },
  esp: { name: 'Agencia Espacial de la India', type: 'primaria' },
  gob1: { name: 'Gobierno de China', type: 'primaria' },
  gob2: { name: 'Gobierno de Alemania', type: 'primaria' },
  oms: { name: 'Organismo Sanitario Internacional', type: 'primaria' },
  onu: { name: 'Secretaría de la Cumbre Climática', type: 'primaria' },
  sin: { name: 'Sindicato Ferroviario Unido', type: 'otro' },
  red: { name: 'Publicaciones en redes sociales', type: 'redes' },
  uni: { name: 'Universidad señalada en el estudio', type: 'primaria' },
  'uni-ar': { name: 'Instituto Científico Patagónico', type: 'primaria' },
  'alc-gt': { name: 'Municipalidad de Ciudad de Guatemala', type: 'primaria' },
  'alc-sv': { name: 'Alcaldía de San Salvador', type: 'primaria' },
  'alc-mx': { name: 'Gobierno de la Ciudad de México', type: 'primaria' },
  'alc-us': { name: 'Oficina de la Alcaldía de Nueva York', type: 'primaria' },
  'alc-es': { name: 'Ayuntamiento de Madrid', type: 'primaria' },
  'bcn-gt': { name: 'Banco Central de Guatemala', type: 'primaria' },
  'bcn-sv': { name: 'Banco Central de El Salvador', type: 'primaria' },
  'bcn-mx': { name: 'Banco Central de México', type: 'primaria' },
  'bcn-ar': { name: 'Banco Central de Argentina', type: 'primaria' },
  'cam-gt': { name: 'Congreso de Guatemala', type: 'primaria' },
  'cam-us': { name: 'Congreso de Estados Unidos', type: 'primaria' },
  'cam-co': { name: 'Congreso de Colombia', type: 'primaria' },
  'cam-fr': { name: 'Parlamento de Francia', type: 'primaria' },
  'cam-ca': { name: 'Reunión Ministerial Centroamericana', type: 'primaria' },
  'cul-gt': { name: 'Instituto de Cultura de Guatemala', type: 'primaria' },
  'cul-us': { name: 'Organización del Festival de Cine Latino', type: 'primaria' },
  'cul-eg': { name: 'Ministerio de Antigüedades de Egipto', type: 'primaria' },
  'dsp-gt': { name: 'Dirección de Salud Pública de Guatemala', type: 'primaria' },
  'dsp-es': { name: 'Autoridad Sanitaria de España', type: 'primaria' },
  'edu-sv': { name: 'Autoridad Educativa de El Salvador', type: 'primaria' },
  'edu-ar': { name: 'Consejo de Universidades de Buenos Aires', type: 'primaria' },
  'sme-mx': { name: 'Servicio Meteorológico de México', type: 'primaria' },
  'sme-es': { name: 'Servicio Meteorológico de España', type: 'primaria' },
};

function toIso(now: Date, hoursAgo: number): string {
  return new Date(now.getTime() - hoursAgo * MS_PER_HOUR).toISOString();
}

function buildSources(seed: SeedNews, accessedAt: string): Source[] {
  return seed.sources.map(({ key, supports, note }) => {
    const profile = SEED_SOURCES[key];
    if (!profile) throw new Error(`Unknown seed source key: ${key} (news ${seed.id})`);

    return {
      id: `${seed.id}:${key}`,
      name: profile.name,
      organization: key,
      url: `${SEED_SOURCE_BASE_URL}/${key}/${seed.id}`,
      type: profile.type,
      accessedAt,
      supports,
      ...(note ? { note } : {}),
    };
  });
}

const CLAIM_STATUS: Record<Certainty, Claim['status']> = {
  confirmada: 'respaldada',
  en_desarrollo: 'sin_respaldo',
  disputada: 'en_disputa',
  retractada: 'sin_respaldo',
};

function buildClaim(seed: SeedNews, sources: Source[]): Claim {
  return {
    id: `${seed.id}:claim-1`,
    text: seed.lead,
    sourceIds: sources
      .filter((source) => source.supports === 'confirma')
      .map((source) => source.id),
    status: CLAIM_STATUS[seed.certainty],
    suggestedByAi: false,
  };
}

function buildImage(seed: SeedNews): NewsImage {
  return (
    seed.image ?? {
      kind: 'portada_generada',
      url: '',
      credit: GENERATED_COVER_CREDIT,
      altText: `Portada generada para: ${seed.title}`,
    }
  );
}

export function buildSeedNews(seeds: SeedNews[], now: Date = new Date()): News[] {
  return seeds.map((seed) => {
    const publishedAt = toIso(now, seed.publishedHoursAgo);
    const sources = buildSources(seed, publishedAt);
    const correctionAt = toIso(now, Math.max(seed.publishedHoursAgo - 1, 0));

    return {
      id: seed.id,
      title: seed.title,
      lead: seed.lead,
      body: seed.body,
      bodyOrigin: 'original_editorial',
      topics: seed.topics,
      geo: seed.geo,
      importance: seed.importance,
      certainty: seed.certainty,
      ...(seed.certaintyNote ? { certaintyNote: seed.certaintyNote } : {}),
      sources,
      claims: [buildClaim(seed, sources)],
      image: buildImage(seed),
      workflow: 'publicada',
      checklist: {
        fuentes_revisadas: true,
        afirmaciones_con_respaldo: true,
        titulo_no_sensacionalista: true,
        imagen_etiquetada: true,
        alcance_geo_revisado: true,
        certeza_justificada: true,
      },
      corrections: seed.correction
        ? [
            {
              at: correctionAt,
              kind: 'retractacion',
              summary: seed.correction,
              editorUid: SEED_EDITOR_UID,
            },
          ]
        : [],
      version: 1,
      createdBy: SEED_EDITOR_UID,
      publishedBy: SEED_EDITOR_UID,
      createdAt: publishedAt,
      publishedAt,
      updatedAt: publishedAt,
    };
  });
}

export function toIndexInput(news: News): IndexInput {
  return {
    id: news.id,
    title: news.title,
    lead: news.lead,
    body: news.body,
    ...(news.aiSummary ? { aiSummary: news.aiSummary.text } : {}),
    topics: news.topics,
    geo: news.geo,
    importance: news.importance,
    certainty: news.certainty,
    ...(news.certaintyNote ? { certaintyNote: news.certaintyNote } : {}),
    sources: news.sources.map(({ name, url }) => ({ name, url })),
    publishedAt: news.publishedAt ?? news.createdAt,
  };
}
