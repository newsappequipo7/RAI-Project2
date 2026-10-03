import { findCountry } from '../catalogs/countries-es';
import { findLocation } from '../catalogs/locations';
import { findTopic } from '../catalogs/topics';
import type { NewsGeo } from '../types';

/**
 * Visual spec of the typographic cover (ADR-007, IMAGENES.md §2). The portal preview and the mobile
 * app (F3-05) both render from `buildCoverSpec`, so the same news always gets the same cover.
 */
export const COVER_CAPTION = 'Portada generada · no es foto';
export const GENERATED_COVER_CREDIT = 'Portada generada por la app (no es una fotografía)';

export const COVER_ASPECT = { width: 16, height: 9 } as const;

/** Sizes are fractions of the cover height, so any renderer scales them the same way. */
export const COVER_LAYOUT = {
  padding: 0.07,
  kickerSize: 0.06,
  titleSize: 0.12,
  titleLineHeight: 1.15,
  titleMaxLines: 4,
  titleMaxChars: 90,
  placeSize: 0.05,
  captionSize: 0.045,
} as const;

export const COVER_NEUTRAL_COLOR = '#34495E';
const LIGHT_TEXT = '#FFFFFF';
const DARK_TEXT = '#111111';
const PLACE_MAX_NAMES = 2;

export interface CoverInput {
  title: string;
  topics: string[];
  geo: NewsGeo;
}

export interface CoverSpec {
  background: string;
  foreground: string;
  kicker: string | null;
  title: string;
  place: string | null;
  caption: typeof COVER_CAPTION;
  aspect: typeof COVER_ASPECT;
  layout: typeof COVER_LAYOUT;
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return (
    0.2126 * channel((value >> 16) & 255) +
    0.7152 * channel((value >> 8) & 255) +
    0.0722 * channel(value & 255)
  );
}

/** WCAG contrast ratio between two `#RRGGBB` colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextColor(background: string): string {
  return contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT)
    ? LIGHT_TEXT
    : DARK_TEXT;
}

function fitTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= COVER_LAYOUT.titleMaxChars) return clean;

  const cut = clean.slice(0, COVER_LAYOUT.titleMaxChars - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

function placeLabel(geo: NewsGeo): string | null {
  if (geo.scope === 'global') return 'Global';

  const names =
    geo.scope === 'local' && geo.cityIds.length > 0
      ? geo.cityIds.map((id) => findLocation(id)?.city)
      : geo.countries.map((iso) => findCountry(iso)?.name);
  const known = names.filter((name): name is string => Boolean(name));
  if (known.length === 0) return null;

  const shown = known.slice(0, PLACE_MAX_NAMES).join(' · ');
  return known.length > PLACE_MAX_NAMES
    ? `${shown} y ${known.length - PLACE_MAX_NAMES} más`
    : shown;
}

export function buildCoverSpec(input: CoverInput): CoverSpec {
  const topic = findTopic(input.topics[0] ?? '');
  const background = topic?.color ?? COVER_NEUTRAL_COLOR;

  return {
    background,
    foreground: readableTextColor(background),
    kicker: topic ? topic.label.toUpperCase() : null,
    title: fitTitle(input.title),
    place: placeLabel(input.geo),
    caption: COVER_CAPTION,
    aspect: COVER_ASPECT,
    layout: COVER_LAYOUT,
  };
}

/** Greedy word wrap of the cover title, capped at `titleMaxLines` (the last line gets an ellipsis). */
export function wrapCoverTitle(title: string, maxCharsPerLine = 24): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current === '' ? word : `${current} ${word}`;
    if (candidate.length <= maxCharsPerLine || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== '') lines.push(current);

  if (lines.length <= COVER_LAYOUT.titleMaxLines) return lines;

  const kept = lines.slice(0, COVER_LAYOUT.titleMaxLines);
  const last = kept[COVER_LAYOUT.titleMaxLines - 1] ?? '';
  kept[COVER_LAYOUT.titleMaxLines - 1] = `${last.replace(/…$/, '').slice(0, maxCharsPerLine - 1)}…`;
  return kept;
}
