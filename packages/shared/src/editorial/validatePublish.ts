import type { Certainty, ChecklistItem, News, NewsImage } from '../types';
import { validateNewsFields, type NewsFieldName } from './fieldRules';
import { computeClaimStatus, countConfirmingOrganizations, isValidSourceUrl } from './sources';

export type PublishField = NewsFieldName | 'image' | 'certainty' | 'certaintyNote' | 'checklist';

export interface PublishError {
  code: string;
  message: string;
  field: PublishField;
}

export interface PublishValidation {
  ok: boolean;
  errors: PublishError[];
}

/** What the editor reads in the certainty selector; mirrors VERIFICACION-Y-FUENTES.md §2. */
export const CERTAINTY_RULES: Record<
  Certainty,
  { label: string; requirement: string; reader: string }
> = {
  confirmada: {
    label: 'Confirmada',
    requirement:
      'Al menos 2 fuentes que confirman de organizaciones distintas (las de redes sociales no cuentan), una de ellas primaria o agencia, y todas las afirmaciones respaldadas.',
    reader: 'Chip verde «Confirmada · N fuentes».',
  },
  en_desarrollo: {
    label: 'En desarrollo',
    requirement:
      'Al menos 1 fuente que confirma y una nota que diga qué falta confirmar. Es la única opción con una sola fuente.',
    reader: 'Banner ámbar «Información en desarrollo» con tu nota.',
  },
  disputada: {
    label: 'Disputada',
    requirement:
      'Al menos 1 fuente que confirma y 1 que contradice, y una nota que describa ambas versiones.',
    reader: 'Banner naranja «Las fuentes no coinciden» con las versiones lado a lado.',
  },
  retractada: {
    label: 'Retractada',
    requirement:
      'Solo desde una noticia ya publicada, y con una entrada de corrección de tipo retractación.',
    reader: 'Banner rojo con el texto tachado y la explicación; sale del feed y del chat.',
  },
};

export const CHECKLIST_LABELS: Record<ChecklistItem, string> = {
  fuentes_revisadas: 'Abrí cada enlace y la fuente dice lo que registré.',
  afirmaciones_con_respaldo: 'Cada afirmación verificable tiene fuente, o la eliminé.',
  titulo_no_sensacionalista: 'El título no exagera lo que dicen las fuentes.',
  imagen_etiquetada: 'Tipo, crédito y licencia de la imagen están registrados.',
  alcance_geo_revisado: 'El alcance y los países corresponden a quién afecta la noticia.',
  certeza_justificada: 'La certeza elegida cumple los requisitos de su tabla.',
};

const CHECKLIST_ORDER = Object.keys(CHECKLIST_LABELS) as ChecklistItem[];

function issue(field: PublishField, code: string, message: string): PublishError {
  return { field, code, message };
}

/**
 * Can this news be published with the given certainty? Implements the certainty table and the
 * editorial checklist (VERIFICACION-Y-FUENTES.md §2–3), plus the field and image rules, so the
 * portal and the tests share the same editorial rules. The model never decides certainty: it only
 * reads what an editor chose and recorded.
 */
export function validatePublish(
  news: News,
  desired: Certainty = news.certainty,
): PublishValidation {
  const errors: PublishError[] = [
    ...validateNewsFields(news)
      .filter((fieldIssue) => fieldIssue.severity === 'error')
      .map(({ field, code, message }) => issue(field, code, message)),
    ...validateCertainty(news, desired),
    ...validateImage(news.image),
    ...validateChecklist(news),
  ];

  return { ok: errors.length === 0, errors };
}

function validateCertainty(news: News, desired: Certainty): PublishError[] {
  const errors: PublishError[] = [];
  const confirming = news.sources.filter((source) => source.supports === 'confirma');
  const contradicting = news.sources.filter((source) => source.supports === 'contradice');
  const note = news.certaintyNote?.trim() ?? '';
  const noteRequired = (): PublishError =>
    issue(
      'certaintyNote',
      'certainty_note_required',
      desired === 'disputada'
        ? 'Describe en la nota las dos versiones en conflicto.'
        : 'Escribe en la nota qué falta confirmar.',
    );

  switch (desired) {
    case 'confirmada': {
      const organizations = countConfirmingOrganizations(news.sources);
      if (organizations < 2) {
        errors.push(
          issue(
            'sources',
            'confirmada_needs_two_organizations',
            `Confirmada necesita 2 organizaciones distintas que confirmen y hay ${organizations} (las fuentes de redes sociales no cuentan). Con menos, publícala como «en desarrollo».`,
          ),
        );
      }
      if (!confirming.some((source) => source.type === 'primaria' || source.type === 'agencia')) {
        errors.push(
          issue(
            'sources',
            'confirmada_needs_primary_or_agency',
            'Confirmada necesita que al menos una fuente que confirma sea primaria o agencia.',
          ),
        );
      }
      if (contradicting.length > 0) {
        errors.push(
          issue(
            'certainty',
            'contradiction_requires_disputada',
            'Hay fuentes que contradicen: solo puede publicarse como «disputada».',
          ),
        );
      }
      const unsupported = news.claims.filter(
        (claim) => computeClaimStatus(claim.sourceIds, news.sources) !== 'respaldada',
      );
      if (unsupported.length > 0) {
        errors.push(
          issue(
            'claims',
            'confirmada_claims_unsupported',
            `${unsupported.length} afirmación(es) no están respaldadas: vincúlalas a una fuente que confirme o elimínalas.`,
          ),
        );
      }
      break;
    }

    case 'en_desarrollo':
      if (confirming.length === 0) {
        errors.push(
          issue(
            'sources',
            'en_desarrollo_needs_confirming_source',
            'Hace falta al menos 1 fuente que confirme la noticia.',
          ),
        );
      }
      if (contradicting.length > 0) {
        errors.push(
          issue(
            'certainty',
            'contradiction_requires_disputada',
            'Hay fuentes que contradicen: solo puede publicarse como «disputada».',
          ),
        );
      }
      if (note === '') errors.push(noteRequired());
      break;

    case 'disputada':
      if (confirming.length === 0) {
        errors.push(
          issue(
            'sources',
            'disputada_needs_confirming_source',
            'Disputada necesita al menos 1 fuente que confirme.',
          ),
        );
      }
      if (contradicting.length === 0) {
        errors.push(
          issue(
            'sources',
            'disputada_needs_contradicting_source',
            'Disputada necesita al menos 1 fuente que contradiga.',
          ),
        );
      }
      if (note === '') errors.push(noteRequired());
      break;

    case 'retractada':
      if (news.workflow !== 'publicada') {
        errors.push(
          issue(
            'certainty',
            'retraction_requires_published',
            'Solo se puede retractar una noticia que ya fue publicada.',
          ),
        );
      }
      if (!news.corrections.some((correction) => correction.kind === 'retractacion')) {
        errors.push(
          issue(
            'certainty',
            'retraction_requires_correction',
            'Una retractación necesita una entrada de corrección de tipo retractación.',
          ),
        );
      }
      break;
  }

  return errors;
}

function validateImage(image: NewsImage | undefined): PublishError[] {
  if (!image) {
    return [issue('image', 'image_required', 'Elige una imagen o la portada generada por la app.')];
  }

  const errors: PublishError[] = [];
  const missing = (value: string | undefined) => (value ?? '').trim() === '';

  if (missing(image.credit)) {
    errors.push(issue('image', 'image_credit_required', 'La imagen necesita un crédito.'));
  }
  if (missing(image.altText)) {
    errors.push(issue('image', 'image_alt_required', 'La imagen necesita texto alternativo.'));
  }

  switch (image.kind) {
    case 'foto_real':
    case 'licencia_libre':
      if (!isValidSourceUrl(image.url)) {
        errors.push(
          issue(
            'image',
            'image_url_invalid',
            'La URL de la imagen debe ser un enlace http(s) válido.',
          ),
        );
      }
      if (missing(image.license)) {
        errors.push(
          issue('image', 'image_license_required', 'La imagen necesita licencia o permiso de uso.'),
        );
      }
      if (missing(image.sourceUrl) || !isValidSourceUrl(image.sourceUrl ?? '')) {
        errors.push(
          issue(
            'image',
            'image_source_required',
            'La imagen necesita el enlace de origen (http o https).',
          ),
        );
      }
      break;
    case 'portada_generada':
      if (image.url !== '') {
        errors.push(
          issue(
            'image',
            'image_cover_has_url',
            'La portada generada no lleva URL: la app la dibuja.',
          ),
        );
      }
      break;
    case 'ilustracion_ia':
      if (missing(image.aiDisclosure)) {
        errors.push(
          issue(
            'image',
            'image_ai_disclosure_required',
            'Una ilustración con IA necesita su aviso de que no documenta el hecho.',
          ),
        );
      }
      break;
  }

  return errors;
}

function validateChecklist(news: News): PublishError[] {
  return CHECKLIST_ORDER.filter((item) => news.checklist[item] !== true).map((item) =>
    issue('checklist', `checklist_${item}`, `Falta marcar: ${CHECKLIST_LABELS[item]}`),
  );
}
