import { describe, expect, it } from 'vitest';
import {
  classifyIntent,
  demonymForms,
  detectCountries,
  normalizeText,
  type ChatIntent,
} from './intent';

interface Phrase {
  message: string;
  locationId: string;
  intent: ChatIntent;
  countries?: string[];
}

const GT = 'gt-guatemala';
const MX = 'mx-cdmx';
const ES = 'es-madrid';

// F4-01 CA1: 30 phrases a reader could type, covering the four cases of the brief.
const PHRASES: Phrase[] = [
  { message: 'Resume lo más importante de hoy', locationId: GT, intent: 'resumen' },
  { message: '¿Qué pasó hoy?', locationId: GT, intent: 'resumen' },
  { message: 'Dame un resumen de las noticias', locationId: MX, intent: 'resumen' },
  { message: 'Ponme al día, por favor', locationId: ES, intent: 'resumen' },
  { message: '¿Cuáles son las principales noticias?', locationId: GT, intent: 'resumen' },
  { message: 'resumeme los titulares', locationId: GT, intent: 'resumen' },
  { message: '¿Qué ha pasado en las últimas horas?', locationId: MX, intent: 'resumen' },
  { message: '¿Qué pasa en mi zona?', locationId: GT, intent: 'mi_region' },
  { message: 'Noticias de mi ciudad', locationId: MX, intent: 'mi_region' },
  { message: '¿Qué está pasando en mi país?', locationId: ES, intent: 'mi_region' },
  { message: '¿Pasó algo cerca?', locationId: GT, intent: 'mi_region' },
  { message: 'Qué hay de nuevo aquí', locationId: GT, intent: 'mi_region' },
  { message: '¿Qué pasa en Guatemala?', locationId: GT, intent: 'mi_region' },
  { message: 'Resume las noticias locales', locationId: ES, intent: 'mi_region' },
  {
    message: 'Explícame lo más importante de Argentina',
    locationId: GT,
    intent: 'otro_pais',
    countries: ['AR'],
  },
  { message: '¿Qué pasa en México?', locationId: GT, intent: 'otro_pais', countries: ['MX'] },
  {
    message: 'Noticias de Estados Unidos sobre el presupuesto',
    locationId: MX,
    intent: 'otro_pais',
    countries: ['US'],
  },
  {
    message: '¿Qué dicen de los españoles?',
    locationId: GT,
    intent: 'otro_pais',
    countries: ['ES'],
  },
  { message: 'Lo último en Bogotá', locationId: GT, intent: 'otro_pais', countries: ['CO'] },
  {
    message: '¿Qué pasó en EE. UU. y en Canadá?',
    locationId: GT,
    intent: 'otro_pais',
    countries: ['US', 'CA'],
  },
  {
    message: 'Explícame la situación en Haití',
    locationId: ES,
    intent: 'otro_pais',
    countries: ['HT'],
  },
  {
    message: 'Compara Guatemala con El Salvador',
    locationId: GT,
    intent: 'otro_pais',
    countries: ['SV'],
  },
  { message: '¿Qué hay de nuevo sobre economía?', locationId: GT, intent: 'tema' },
  { message: '¿Qué se sabe de la variante de influenza?', locationId: MX, intent: 'tema' },
  { message: 'Cuéntame sobre el cambio climático', locationId: ES, intent: 'tema' },
  { message: 'Novedades de tecnología', locationId: GT, intent: 'tema' },
  { message: '¿Hubo un sismo?', locationId: GT, intent: 'tema' },
  { message: 'Explícame la reforma de pensiones', locationId: GT, intent: 'tema' },
  { message: 'Dame noticias de deportes en español', locationId: MX, intent: 'tema' },
  { message: '¿Qué pasa con el dengue?', locationId: GT, intent: 'tema' },
];

describe('classifyIntent', () => {
  it('has 30 phrases covering every intent', () => {
    expect(PHRASES).toHaveLength(30);
    expect(new Set(PHRASES.map(({ intent }) => intent)).size).toBe(4);
  });

  it('classifies at least 90 % of the phrases correctly (F4-01 CA1)', () => {
    const misses = PHRASES.filter(
      ({ message, locationId, intent }) => classifyIntent(message, locationId).intent !== intent,
    );
    const accuracy = (PHRASES.length - misses.length) / PHRASES.length;

    expect(misses.map(({ message }) => message)).toEqual([]);
    expect(accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it('returns the other countries for otro_pais', () => {
    PHRASES.filter(({ countries }) => countries).forEach(({ message, locationId, countries }) => {
      expect(classifyIntent(message, locationId).countries).toEqual(countries);
    });
  });

  it('gives other countries priority over summary words', () => {
    expect(classifyIntent('Resume lo más importante de Madrid', GT)).toEqual({
      intent: 'otro_pais',
      countries: ['ES'],
    });
  });

  it('treats the reader country as their region in any location', () => {
    expect(classifyIntent('¿Qué pasa en España?', ES).intent).toBe('mi_region');
    expect(classifyIntent('¿Qué pasa en España?', GT).intent).toBe('otro_pais');
  });

  it('falls back to tema for an unknown location', () => {
    expect(classifyIntent('¿Qué hay de nuevo sobre economía?', 'xx-nowhere').intent).toBe('tema');
  });
});

describe('detectCountries', () => {
  it('matches names, demonyms in any gender and number, cities and aliases', () => {
    expect(detectCountries('Las guatemaltecas en Nueva York')).toEqual(['GT', 'US']);
    expect(detectCountries('Elecciones francesas')).toEqual(['FR']);
    expect(detectCountries('Turistas alemanes en la CDMX')).toEqual(['DE', 'MX']);
    expect(detectCountries('Ciudad de Guatemala')).toEqual(['GT']);
  });

  it('only matches whole words', () => {
    expect(detectCountries('Peruanidad y mexicanidad')).toEqual([]);
    expect(detectCountries('chinchilla')).toEqual([]);
  });

  it('ignores the Spanish language', () => {
    expect(detectCountries('Respóndeme en español')).toEqual([]);
  });
});

describe('demonymForms', () => {
  it('builds the forms for each ending', () => {
    expect(demonymForms('mexicano')).toEqual(['mexicano', 'mexicana', 'mexicanos', 'mexicanas']);
    expect(demonymForms('francés')).toEqual(['frances', 'francesa', 'franceses', 'francesas']);
    expect(demonymForms('estadounidense')).toEqual(['estadounidense', 'estadounidenses']);
    expect(demonymForms('israelí')).toEqual(['israeli', 'israelies', 'israelis']);
  });
});

describe('normalizeText', () => {
  it('removes accents, case and punctuation', () => {
    expect(normalizeText('¿Qué PASÓ   en Bogotá?')).toBe('que paso en bogota');
  });
});
