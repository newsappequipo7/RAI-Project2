export interface CountryInfo {
  iso: string;
  name: string;
  demonym: string;
}

export const COUNTRIES_ES: CountryInfo[] = [
  { iso: 'GT', name: 'Guatemala', demonym: 'guatemalteco' },
  { iso: 'SV', name: 'El Salvador', demonym: 'salvadoreño' },
  { iso: 'HN', name: 'Honduras', demonym: 'hondureño' },
  { iso: 'NI', name: 'Nicaragua', demonym: 'nicaragüense' },
  { iso: 'CR', name: 'Costa Rica', demonym: 'costarricense' },
  { iso: 'PA', name: 'Panamá', demonym: 'panameño' },
  { iso: 'BZ', name: 'Belice', demonym: 'beliceño' },
  { iso: 'MX', name: 'México', demonym: 'mexicano' },
  { iso: 'US', name: 'Estados Unidos', demonym: 'estadounidense' },
  { iso: 'CA', name: 'Canadá', demonym: 'canadiense' },
  { iso: 'CO', name: 'Colombia', demonym: 'colombiano' },
  { iso: 'VE', name: 'Venezuela', demonym: 'venezolano' },
  { iso: 'EC', name: 'Ecuador', demonym: 'ecuatoriano' },
  { iso: 'PE', name: 'Perú', demonym: 'peruano' },
  { iso: 'BO', name: 'Bolivia', demonym: 'boliviano' },
  { iso: 'CL', name: 'Chile', demonym: 'chileno' },
  { iso: 'AR', name: 'Argentina', demonym: 'argentino' },
  { iso: 'UY', name: 'Uruguay', demonym: 'uruguayo' },
  { iso: 'PY', name: 'Paraguay', demonym: 'paraguayo' },
  { iso: 'BR', name: 'Brasil', demonym: 'brasileño' },
  { iso: 'ES', name: 'España', demonym: 'español' },
  { iso: 'FR', name: 'Francia', demonym: 'francés' },
  { iso: 'DE', name: 'Alemania', demonym: 'alemán' },
  { iso: 'IT', name: 'Italia', demonym: 'italiano' },
  { iso: 'GB', name: 'Reino Unido', demonym: 'británico' },
  { iso: 'PT', name: 'Portugal', demonym: 'portugués' },
  { iso: 'RU', name: 'Rusia', demonym: 'ruso' },
  { iso: 'UA', name: 'Ucrania', demonym: 'ucraniano' },
  { iso: 'CN', name: 'China', demonym: 'chino' },
  { iso: 'JP', name: 'Japón', demonym: 'japonés' },
  { iso: 'KR', name: 'Corea del Sur', demonym: 'surcoreano' },
  { iso: 'IN', name: 'India', demonym: 'indio' },
  { iso: 'IL', name: 'Israel', demonym: 'israelí' },
  { iso: 'PS', name: 'Palestina', demonym: 'palestino' },
  { iso: 'IR', name: 'Irán', demonym: 'iraní' },
  { iso: 'SA', name: 'Arabia Saudita', demonym: 'saudí' },
  { iso: 'EG', name: 'Egipto', demonym: 'egipcio' },
  { iso: 'ZA', name: 'Sudáfrica', demonym: 'sudafricano' },
  { iso: 'NG', name: 'Nigeria', demonym: 'nigeriano' },
  { iso: 'AU', name: 'Australia', demonym: 'australiano' },
  { iso: 'HT', name: 'Haití', demonym: 'haitiano' },
  { iso: 'DO', name: 'República Dominicana', demonym: 'dominicano' },
  { iso: 'CU', name: 'Cuba', demonym: 'cubano' },
];

export function findCountry(iso: string): CountryInfo | undefined {
  return COUNTRIES_ES.find((country) => country.iso === iso.toUpperCase());
}
