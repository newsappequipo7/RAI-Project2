import { describe, expect, it } from 'vitest';
import { newsSchema } from './schemas';
import type { News } from './types';

function baseNews(overrides: Partial<News> = {}): News {
  return {
    id: 'n-gt-001',
    title: 'Título de prueba',
    lead: 'Entradilla de prueba.',
    body: 'Cuerpo de la noticia. Noticia de prueba para el proyecto académico.',
    bodyOrigin: 'original_editorial',
    topics: ['sociedad'],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
    importance: 1,
    certainty: 'confirmada',
    sources: [
      {
        id: 's-1',
        name: 'Prensa Libre',
        organization: 'Prensa Libre',
        url: 'https://example.com',
        type: 'medio',
        accessedAt: '2026-01-01T00:00:00.000Z',
        supports: 'confirma',
      },
    ],
    claims: [],
    workflow: 'publicada',
    checklist: {
      fuentes_revisadas: true,
      afirmaciones_con_respaldo: true,
      titulo_no_sensacionalista: true,
      imagen_etiquetada: true,
      alcance_geo_revisado: true,
      certeza_justificada: true,
    },
    corrections: [],
    version: 1,
    createdBy: 'uid-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('newsSchema', () => {
  it('accepts a valid News object', () => {
    const result = newsSchema.safeParse(baseNews());
    expect(result.success).toBe(true);
  });

  it('accepts a confirmada News without sources (business rule is enforced elsewhere, not by the schema)', () => {
    const result = newsSchema.safeParse(baseNews({ sources: [], certainty: 'confirmada' }));
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = newsSchema.safeParse({ ...baseNews(), unexpectedField: 'nope' });
    expect(result.success).toBe(false);
  });
});
