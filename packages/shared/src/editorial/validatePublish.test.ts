import { describe, expect, it } from 'vitest';
import seedJson from '../../fixtures/news.json';
import { buildSeedNews, type SeedNews } from '../seed';
import type { Certainty, Claim, News, NewsImage, Source } from '../types';
import { createEmptyDraft } from './draft';
import { CERTAINTY_RULES, validatePublish } from './validatePublish';

const NOW = new Date('2026-10-02T15:00:00.000Z');

function source(id: string, patch: Partial<Source> = {}): Source {
  return {
    id,
    name: `Fuente ${id}`,
    organization: `Org ${id}`,
    url: `https://example.org/${id}`,
    type: 'medio',
    accessedAt: NOW.toISOString(),
    supports: 'confirma',
    ...patch,
  };
}

function claim(sourceIds: string[], patch: Partial<Claim> = {}): Claim {
  return {
    id: 'c1',
    text: 'Afirmación',
    sourceIds,
    status: 'respaldada',
    suggestedByAi: false,
    ...patch,
  };
}

const COVER: NewsImage = {
  kind: 'portada_generada',
  url: '',
  credit: 'Portada generada por la app (no es una fotografía)',
  altText: 'Portada generada para: Titular',
};

/** A news that can be published as `confirmada`; each test breaks one thing. */
function ready(patch: Partial<News> = {}): News {
  return {
    ...createEmptyDraft('n1', 'uid-1', NOW),
    title: 'Titular',
    lead: 'Entradilla.',
    body: 'Cuerpo.',
    topics: ['salud'],
    geo: { scope: 'nacional', countries: ['GT'], cityIds: [], regions: ['centroamerica'] },
    importance: 1,
    certainty: 'confirmada',
    sources: [
      source('a', { organization: 'Ministerio de Salud', type: 'primaria' }),
      source('b', { organization: 'Prensa Libre' }),
    ],
    claims: [claim(['a', 'b'])],
    image: COVER,
    checklist: {
      fuentes_revisadas: true,
      afirmaciones_con_respaldo: true,
      titulo_no_sensacionalista: true,
      imagen_etiquetada: true,
      alcance_geo_revisado: true,
      certeza_justificada: true,
    },
    ...patch,
  };
}

const codes = (news: News, desired?: Certainty) =>
  validatePublish(news, desired).errors.map((error) => error.code);

describe('validatePublish: baseline', () => {
  it('accepts a fully verified news as confirmada', () => {
    expect(validatePublish(ready())).toEqual({ ok: true, errors: [] });
  });

  it('uses the news certainty when none is given', () => {
    expect(codes(ready({ certainty: 'en_desarrollo' }))).toEqual(['certainty_note_required']);
  });

  it('documents every certainty for the selector', () => {
    expect(Object.keys(CERTAINTY_RULES).sort()).toEqual([
      'confirmada',
      'disputada',
      'en_desarrollo',
      'retractada',
    ]);
  });

  it('blocks an empty draft and reports where each problem is', () => {
    const result = validatePublish(createEmptyDraft('n1', 'uid-1', NOW), 'en_desarrollo');
    expect(result.ok).toBe(false);
    expect(new Set(result.errors.map((error) => error.field))).toEqual(
      new Set([
        'title',
        'lead',
        'body',
        'topics',
        'geo',
        'sources',
        'certaintyNote',
        'image',
        'checklist',
      ]),
    );
  });
});

describe('validatePublish: confirmada', () => {
  it('a single source can only be published as en_desarrollo', () => {
    const single = ready({
      sources: [source('a', { type: 'primaria' })],
      claims: [claim(['a'])],
      certaintyNote: 'Falta una segunda fuente.',
    });

    expect(codes(single, 'confirmada')).toEqual(['confirmada_needs_two_organizations']);
    expect(validatePublish(single, 'en_desarrollo').ok).toBe(true);
  });

  it('two sources from the same organization do not make it confirmada', () => {
    const sameOrg = ready({
      sources: [
        source('a', { organization: 'Ministerio de Salud', type: 'primaria' }),
        source('b', { organization: ' ministerio de salud ' }),
      ],
    });
    expect(codes(sameOrg)).toEqual(['confirmada_needs_two_organizations']);
  });

  it('a social network source does not count as one of the two', () => {
    const withSocial = ready({
      sources: [
        source('a', { organization: 'Ministerio de Salud', type: 'primaria' }),
        source('b', { organization: 'Cuenta X', type: 'redes' }),
      ],
    });
    expect(codes(withSocial)).toEqual(['confirmada_needs_two_organizations']);
  });

  it('needs at least one primary or agency source among the confirming ones', () => {
    const onlyMedia = ready({
      sources: [source('a', { organization: 'Medio A' }), source('b', { organization: 'Medio B' })],
    });
    expect(codes(onlyMedia)).toEqual(['confirmada_needs_primary_or_agency']);

    const agency = ready({
      sources: [
        source('a', { organization: 'Medio A' }),
        source('b', { organization: 'EFE', type: 'agencia' }),
      ],
    });
    expect(validatePublish(agency).ok).toBe(true);
  });

  it('a primary source that only gives context does not satisfy the primary requirement', () => {
    const contextOnly = ready({
      sources: [
        source('a', { organization: 'Ministerio', type: 'primaria', supports: 'contexto' }),
        source('b', { organization: 'Medio B' }),
        source('c', { organization: 'Medio C' }),
      ],
    });
    expect(codes(contextOnly)).toEqual(['confirmada_needs_primary_or_agency']);
  });

  it('an unsupported claim blocks confirmada', () => {
    const unsupported = ready({ claims: [claim(['a', 'b']), claim([], { id: 'c2' })] });
    expect(codes(unsupported)).toEqual(['confirmada_claims_unsupported']);
  });

  it('judges claims by their links, not by a stale stored status', () => {
    const stale = ready({ claims: [claim([], { status: 'respaldada' })] });
    expect(codes(stale)).toEqual(['confirmada_claims_unsupported']);
  });
});

describe('validatePublish: contradiction', () => {
  const contradicted = (patch: Partial<News> = {}) =>
    ready({
      sources: [
        source('a', { organization: 'Ministerio', type: 'primaria' }),
        source('b', { organization: 'Medio B' }),
        source('c', { organization: 'Medio C', supports: 'contradice' }),
      ],
      claims: [claim(['a'])],
      certaintyNote: 'Medio C da otra cifra.',
      ...patch,
    });

  it('a contradicting source only allows disputada', () => {
    expect(codes(contradicted(), 'confirmada')).toEqual(['contradiction_requires_disputada']);
    expect(codes(contradicted(), 'en_desarrollo')).toEqual(['contradiction_requires_disputada']);
    expect(validatePublish(contradicted(), 'disputada').ok).toBe(true);
  });

  it('disputada needs both a confirming and a contradicting source', () => {
    const onlyConfirming = ready({ certaintyNote: 'Nota.' });
    expect(codes(onlyConfirming, 'disputada')).toEqual(['disputada_needs_contradicting_source']);

    const onlyContradicting = ready({
      sources: [source('c', { supports: 'contradice' })],
      claims: [],
      certaintyNote: 'Nota.',
    });
    expect(codes(onlyContradicting, 'disputada')).toEqual(['disputada_needs_confirming_source']);
  });
});

describe('validatePublish: certainty note', () => {
  it('is mandatory for en_desarrollo and disputada, and blank does not count', () => {
    const single = ready({ sources: [source('a', { type: 'primaria' })], claims: [claim(['a'])] });
    expect(codes(single, 'en_desarrollo')).toEqual(['certainty_note_required']);
    expect(codes({ ...single, certaintyNote: '   ' }, 'en_desarrollo')).toEqual([
      'certainty_note_required',
    ]);

    const both = ready({
      sources: [source('a'), source('c', { supports: 'contradice' })],
      claims: [],
    });
    expect(codes(both, 'disputada')).toEqual(['certainty_note_required']);
  });

  it('is not required for confirmada', () => {
    expect(validatePublish(ready({ certaintyNote: undefined })).ok).toBe(true);
  });
});

describe('validatePublish: retractada', () => {
  const retraction = {
    at: NOW.toISOString(),
    kind: 'retractacion' as const,
    summary: 'Se retira la nota.',
    editorUid: 'uid-1',
  };

  it('only applies to an already published news with a retraction entry', () => {
    expect(codes(ready({ workflow: 'borrador' }), 'retractada')).toEqual([
      'retraction_requires_published',
      'retraction_requires_correction',
    ]);
    expect(codes(ready({ workflow: 'publicada' }), 'retractada')).toEqual([
      'retraction_requires_correction',
    ]);
    expect(
      validatePublish(ready({ workflow: 'publicada', corrections: [retraction] }), 'retractada').ok,
    ).toBe(true);
  });

  it('an ordinary correction is not a retraction', () => {
    const update = { ...retraction, kind: 'correccion' as const };
    expect(codes(ready({ workflow: 'publicada', corrections: [update] }), 'retractada')).toEqual([
      'retraction_requires_correction',
    ]);
  });
});

describe('validatePublish: checklist', () => {
  it('reports each unchecked item', () => {
    const news = ready();
    const result = validatePublish({
      ...news,
      checklist: { ...news.checklist, fuentes_revisadas: false, certeza_justificada: false },
    });
    expect(result.errors.map((error) => error.code)).toEqual([
      'checklist_fuentes_revisadas',
      'checklist_certeza_justificada',
    ]);
    expect(result.errors.every((error) => error.field === 'checklist')).toBe(true);
  });
});

describe('validatePublish: image', () => {
  const withImage = (image: NewsImage | undefined) => ready({ image });

  it('is required', () => {
    expect(codes(withImage(undefined))).toEqual(['image_required']);
  });

  it('an image without credit blocks publication', () => {
    expect(codes(withImage({ ...COVER, credit: ' ' }))).toEqual(['image_credit_required']);
  });

  it('alt text is mandatory in every case', () => {
    expect(codes(withImage({ ...COVER, altText: '' }))).toEqual(['image_alt_required']);
  });

  it('a generated cover carries no URL', () => {
    expect(codes(withImage({ ...COVER, url: 'https://example.org/c.png' }))).toEqual([
      'image_cover_has_url',
    ]);
  });

  it('a real photo or free-license image needs URL, license and origin link', () => {
    const photo: NewsImage = {
      kind: 'licencia_libre',
      url: 'https://upload.example.org/foto.jpg',
      credit: 'Autora X',
      license: 'CC BY 4.0',
      sourceUrl: 'https://commons.example.org/foto',
      altText: 'Edificio',
    };
    expect(validatePublish(withImage(photo)).ok).toBe(true);
    expect(codes(withImage({ ...photo, url: 'foto.jpg' }))).toEqual(['image_url_invalid']);
    expect(codes(withImage({ ...photo, license: undefined }))).toEqual(['image_license_required']);
    expect(codes(withImage({ ...photo, sourceUrl: 'origen' }))).toEqual(['image_source_required']);
    expect(codes(withImage({ ...photo, kind: 'foto_real', sourceUrl: undefined }))).toEqual([
      'image_source_required',
    ]);
  });

  it('an AI illustration needs its disclosure', () => {
    const illustration: NewsImage = {
      kind: 'ilustracion_ia',
      url: 'https://example.org/ia.png',
      credit: 'Generada por IA (modelo X)',
      altText: 'Ilustración conceptual',
    };
    expect(codes(withImage(illustration))).toEqual(['image_ai_disclosure_required']);
    expect(
      validatePublish(
        withImage({
          ...illustration,
          aiDisclosure: 'Ilustración generada con IA. No documenta el hecho.',
        }),
      ).ok,
    ).toBe(true);
  });
});

describe('validatePublish: field rules', () => {
  it('a news with invalid content fields cannot be published', () => {
    const result = validatePublish(ready({ title: '', topics: [] }));
    expect(result.errors.map((error) => error.code)).toEqual(['title_required', 'topics_count']);
    expect(result.errors.map((error) => error.field)).toEqual(['title', 'topics']);
  });

  it('a title warning does not block', () => {
    expect(validatePublish(ready({ title: 'x'.repeat(150) })).ok).toBe(true);
  });
});

describe('validatePublish: seed corpus', () => {
  it('every confirmada seed news with an image meets the confirmada requirements', () => {
    const confirmed = buildSeedNews(seedJson as SeedNews[], NOW).filter(
      (item) => item.certainty === 'confirmada',
    );
    expect(confirmed.length).toBeGreaterThan(0);

    for (const item of confirmed) {
      const result = validatePublish(item);
      expect(
        result.errors.map((error) => error.code),
        item.id,
      ).toEqual([]);
    }
  });
});
