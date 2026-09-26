export interface Topic {
  key: string;
  label: string;
  color: string;
}

export const TOPICS: Topic[] = [
  { key: 'politica', label: 'Política', color: '#8E44AD' },
  { key: 'economia', label: 'Economía', color: '#27AE60' },
  { key: 'seguridad', label: 'Seguridad', color: '#C0392B' },
  { key: 'salud', label: 'Salud', color: '#E74C3C' },
  { key: 'educacion', label: 'Educación', color: '#2980B9' },
  { key: 'tecnologia', label: 'Tecnología', color: '#16A085' },
  { key: 'ciencia', label: 'Ciencia', color: '#2C3E50' },
  { key: 'medio-ambiente', label: 'Medio ambiente', color: '#1ABC9C' },
  { key: 'deportes', label: 'Deportes', color: '#D35400' },
  { key: 'cultura', label: 'Cultura', color: '#F39C12' },
  { key: 'sociedad', label: 'Sociedad', color: '#7F8C8D' },
  { key: 'migracion', label: 'Migración', color: '#2874A6' },
  { key: 'clima-desastres', label: 'Clima y desastres', color: '#B03A2E' },
];

export function findTopic(key: string): Topic | undefined {
  return TOPICS.find((topic) => topic.key === key);
}
