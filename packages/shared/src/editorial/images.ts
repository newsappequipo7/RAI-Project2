import { COVER_CAPTION, GENERATED_COVER_CREDIT } from '../cover/spec';
import type { ImageSearchResult, NewsImage } from '../types';
import { isValidSourceUrl } from './sources';

export const AI_ILLUSTRATION_DISCLOSURE = 'Ilustración generada con IA. No documenta el hecho.';
export const ARCHIVE_IMAGE_NOTICE = 'Imagen de archivo, no corresponde al hecho';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Fixed rules appended to every illustration prompt; the editor cannot edit them (IMAGENES.md §4). */
export const IMAGE_PROMPT_RULES = [
  'Estilo de ilustración plana o editorial, nunca fotorrealista.',
  'Sin personas identificables ni rostros reales.',
  'Sin logotipos, marcas ni texto legible.',
  'Sin recrear el hecho: nada de escenas de accidentes, protestas, víctimas ni desastres.',
  'Representa el tema de forma conceptual y abstracta.',
] as const;

export function wrapImagePrompt(editorPrompt: string): string {
  const rules = IMAGE_PROMPT_RULES.map((rule) => `- ${rule}`).join('\n');
  return `Ilustración para una noticia. Tema pedido por el editor: ${editorPrompt.trim()}\n\nReglas obligatorias:\n${rules}`;
}

export function buildCoverImage(title: string): NewsImage {
  return {
    kind: 'portada_generada',
    url: '',
    credit: GENERATED_COVER_CREDIT,
    altText: `Portada generada para: ${title.trim() || 'noticia sin título'}`,
  };
}

export interface PhotoDetails {
  url: string;
  credit: string;
  license: string;
  sourceUrl: string;
  altText: string;
}

export type PhotoField = keyof PhotoDetails;

export interface PhotoIssue {
  field: PhotoField;
  code: string;
  message: string;
}

/** Everything a real photo needs before it is accepted (IMAGENES.md §1, option 1). */
export function validatePhotoDetails(details: PhotoDetails): PhotoIssue[] {
  const issues: PhotoIssue[] = [];
  const missing = (value: string) => value.trim() === '';

  if (!isValidSourceUrl(details.url)) {
    issues.push({
      field: 'url',
      code: 'photo_url_invalid',
      message: 'Sube un archivo o pega una URL http(s) válida.',
    });
  }
  if (missing(details.credit)) {
    issues.push({
      field: 'credit',
      code: 'photo_credit_required',
      message: 'El crédito del autor es obligatorio.',
    });
  }
  if (missing(details.license)) {
    issues.push({
      field: 'license',
      code: 'photo_license_required',
      message: 'Indica la licencia o el permiso de uso.',
    });
  }
  if (!isValidSourceUrl(details.sourceUrl)) {
    issues.push({
      field: 'sourceUrl',
      code: 'photo_source_invalid',
      message: 'La fuente debe ser un enlace http(s) válido.',
    });
  }
  if (missing(details.altText)) {
    issues.push({
      field: 'altText',
      code: 'photo_alt_required',
      message: 'El texto alternativo es obligatorio.',
    });
  }

  return issues;
}

export function buildPhotoImage(details: PhotoDetails): NewsImage {
  return {
    kind: 'foto_real',
    url: details.url.trim(),
    credit: details.credit.trim(),
    license: details.license.trim(),
    sourceUrl: details.sourceUrl.trim(),
    altText: details.altText.trim(),
  };
}

/** A free-license search result becomes an archive image: it never claims to document the event. */
export function buildFreeLicenseImage(result: ImageSearchResult, altText: string): NewsImage {
  return {
    kind: 'licencia_libre',
    url: result.url,
    credit: result.creator.trim() || 'Autor no indicado',
    license: result.license,
    licenseUrl: result.licenseUrl,
    sourceUrl: result.sourceUrl,
    altText: altText.trim(),
  };
}

export function buildAiIllustration(url: string, model: string, altText: string): NewsImage {
  return {
    kind: 'ilustracion_ia',
    url,
    credit: `Generada por IA (${model})`,
    altText: altText.trim(),
    aiDisclosure: AI_ILLUSTRATION_DISCLOSURE,
  };
}

/** Caption shown under the image, by kind (the app renders the same text). */
export function imageCaption(image: NewsImage): string {
  switch (image.kind) {
    case 'foto_real':
      return `Foto: ${image.credit}`;
    case 'licencia_libre':
      return `${ARCHIVE_IMAGE_NOTICE}. ${image.credit}, ${image.license ?? 'licencia libre'}`;
    case 'portada_generada':
      return COVER_CAPTION;
    case 'ilustracion_ia':
      return image.aiDisclosure ?? AI_ILLUSTRATION_DISCLOSURE;
  }
}
