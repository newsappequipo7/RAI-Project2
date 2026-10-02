export type Region =
  | 'centroamerica'
  | 'norteamerica'
  | 'sudamerica'
  | 'caribe'
  | 'europa'
  | 'asia'
  | 'africa'
  | 'oceania'
  | 'medio-oriente';

export const REGIONS: Region[] = [
  'centroamerica',
  'norteamerica',
  'sudamerica',
  'caribe',
  'europa',
  'asia',
  'africa',
  'oceania',
  'medio-oriente',
];

export interface Location {
  id: string;
  city: string;
  countryIso: string;
  region: Region;
}

export const LOCATIONS: Location[] = [
  { id: 'gt-guatemala', city: 'Ciudad de Guatemala', countryIso: 'GT', region: 'centroamerica' },
  { id: 'gt-quetzaltenango', city: 'Quetzaltenango', countryIso: 'GT', region: 'centroamerica' },
  { id: 'sv-san-salvador', city: 'San Salvador', countryIso: 'SV', region: 'centroamerica' },
  { id: 'mx-cdmx', city: 'Ciudad de México', countryIso: 'MX', region: 'norteamerica' },
  { id: 'us-nueva-york', city: 'Nueva York', countryIso: 'US', region: 'norteamerica' },
  { id: 'co-bogota', city: 'Bogotá', countryIso: 'CO', region: 'sudamerica' },
  { id: 'ar-buenos-aires', city: 'Buenos Aires', countryIso: 'AR', region: 'sudamerica' },
  { id: 'es-madrid', city: 'Madrid', countryIso: 'ES', region: 'europa' },
];

export function findLocation(id: string): Location | undefined {
  return LOCATIONS.find((location) => location.id === id);
}
