export interface ImportanceLevel {
  value: 0 | 1 | 2 | 3;
  key: 'rutina' | 'relevante' | 'importante' | 'esencial';
  label: string;
  description: string;
}

export const IMPORTANCE_LEVELS: ImportanceLevel[] = [
  {
    value: 0,
    key: 'rutina',
    label: 'Rutina',
    description: 'Informativa, bajo impacto. Solo compite por relevancia personal.',
  },
  {
    value: 1,
    key: 'relevante',
    label: 'Relevante',
    description: 'Interés amplio en su zona.',
  },
  {
    value: 2,
    key: 'importante',
    label: 'Importante',
    description: 'Afecta a mucha gente en su zona. Peso alto.',
  },
  {
    value: 3,
    key: 'esencial',
    label: 'Esencial',
    description:
      'Toda persona afectada debería saberlo (emergencias, salud pública, elecciones, desastres). Entra al bloque "Lo que debes saber".',
  },
];

export function findImportance(value: 0 | 1 | 2 | 3): ImportanceLevel {
  const level = IMPORTANCE_LEVELS.find((item) => item.value === value);
  if (!level) {
    throw new Error(`Unknown importance value: ${value}`);
  }
  return level;
}
