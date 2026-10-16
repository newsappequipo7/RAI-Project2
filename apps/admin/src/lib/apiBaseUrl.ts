const DEFAULT_API_BASE_URL = 'https://news-api.diegovalenzuela.workers.dev';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL;
