import type { News } from '../types';

/**
 * Empty draft created by the "Nueva noticia" button. It satisfies `newsSchema`, but it is not
 * publishable: `validatePublish` (F2-05) rejects it until title, sources and checklist are complete.
 */
export function createEmptyDraft(id: string, createdBy: string, now: Date): News {
  const timestamp = now.toISOString();

  return {
    id,
    title: '',
    lead: '',
    body: '',
    bodyOrigin: 'original_editorial',
    topics: [],
    geo: { scope: 'nacional', countries: [], cityIds: [], regions: [] },
    importance: 0,
    certainty: 'en_desarrollo',
    sources: [],
    claims: [],
    workflow: 'borrador',
    checklist: {
      fuentes_revisadas: false,
      afirmaciones_con_respaldo: false,
      titulo_no_sensacionalista: false,
      imagen_etiquetada: false,
      alcance_geo_revisado: false,
      certeza_justificada: false,
    },
    corrections: [],
    version: 0,
    createdBy,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
