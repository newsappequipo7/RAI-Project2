export const feedSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const feedType = {
  masthead: 38,
  hero: 28,
  large: 22,
  medium: 18,
  compact: 16,
  section: 21,
  body: 14,
  label: 11,
} as const;

export const feedPalette = {
  light: {
    background: '#F6F4EF',
    surface: '#FFFFFF',
    ink: '#192332',
    secondary: '#4A5868',
    subtle: '#687584',
    line: '#D8DDE3',
    accent: '#B72838',
    accentInk: '#FFFFFF',
    chip: '#E9EDF1',
    essential: '#142C43',
    essentialInk: '#FFFFFF',
    warning: '#8B4600',
    warningSurface: '#FFF1DC',
  },
  dark: {
    background: '#0D1520',
    surface: '#182332',
    ink: '#F5F7F9',
    secondary: '#D0D8E0',
    subtle: '#ACB8C5',
    line: '#354456',
    accent: '#EF6B76',
    accentInk: '#101820',
    chip: '#2A3A4B',
    essential: '#243E57',
    essentialInk: '#FFFFFF',
    warning: '#FFD598',
    warningSurface: '#65401D',
  },
} as const;

export type FeedPalette = (typeof feedPalette)['light'] | (typeof feedPalette)['dark'];
