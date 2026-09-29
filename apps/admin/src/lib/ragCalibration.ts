import type { IndexInput } from '@repo/shared';

const BASE = {
	importance: 2 as const,
	certainty: 'confirmada' as const,
	sources: [{ name: 'Fuente de prueba', url: 'https://example.org' }],
	publishedAt: '2026-09-20T12:00:00.000Z'
};

const GT_GEO = { scope: 'nacional' as const, countries: ['GT'], cityIds: [], regions: [] };
const MX_GEO = { scope: 'nacional' as const, countries: ['MX'], cityIds: [], regions: [] };
const ES_GEO = { scope: 'nacional' as const, countries: ['ES'], cityIds: [], regions: [] };
const GLOBAL_GEO = { scope: 'global' as const, countries: [], cityIds: [], regions: [] };

export const CALIBRATION_NEWS: IndexInput[] = [
	{
		...BASE,
		id: 'cal-gt-lluvias',
		title: 'Lluvias intensas dejan cientos de familias afectadas en Guatemala',
		lead: 'La Conred reporta deslizamientos y calles inundadas en varios departamentos.',
		body: 'Las lluvias de la temporada han provocado deslizamientos de tierra y desbordes de ríos. Autoridades habilitaron albergues temporales.',
		topics: ['clima'],
		geo: GT_GEO
	},
	{
		...BASE,
		id: 'cal-mx-inflacion',
		title: 'La inflación anual en México baja por tercer mes consecutivo',
		lead: 'El banco central atribuye la caída a menores precios de alimentos.',
		body: 'El índice de precios al consumidor mostró una desaceleración. Analistas esperan que el banco central mantenga su tasa de referencia.',
		topics: ['economia'],
		geo: MX_GEO
	},
	{
		...BASE,
		id: 'cal-es-huelga',
		title: 'Sindicatos convocan huelga de trenes en España por recortes de personal',
		lead: 'La medida afectaría a miles de pasajeros durante el fin de semana.',
		body: 'Los sindicatos ferroviarios rechazan la reducción de plantillas y piden negociar. La empresa asegura que garantizará servicios mínimos.',
		topics: ['sociedad'],
		geo: ES_GEO
	},
	{
		...BASE,
		id: 'cal-global-cumbre-clima',
		title: 'Líderes mundiales acuerdan nuevas metas para reducir emisiones',
		lead: 'La cumbre climática cerró con compromisos para recortar gases de efecto invernadero.',
		body: 'Más de cien países firmaron un acuerdo para reducir emisiones y financiar la transición energética en naciones en desarrollo.',
		topics: ['clima', 'politica'],
		geo: GLOBAL_GEO
	},
	{
		...BASE,
		id: 'cal-gt-salud',
		title: 'Ministerio de Salud lanza campaña de vacunación contra el sarampión',
		lead: 'La jornada busca inmunizar a niños menores de cinco años en todo el país.',
		body: 'Brigadas visitarán escuelas y centros de salud. Las autoridades piden a las familias verificar el carnet de vacunación.',
		topics: ['salud'],
		geo: GT_GEO
	},
	{
		...BASE,
		id: 'cal-gt-retractada',
		title: 'Falso cierre de aeropuerto en Ciudad de Guatemala',
		lead: 'Un mensaje viral aseguraba que el aeropuerto suspendía vuelos; la aeronáutica lo desmintió.',
		body: 'La información circuló en redes sin fuente oficial y fue retractada.',
		topics: ['sociedad'],
		geo: GT_GEO,
		certainty: 'retractada'
	}
];

export interface CalibrationQuery {
	query: string;
	expectedId: string;
}

export const CALIBRATION_QUERIES: CalibrationQuery[] = [
	{
		query: '¿Qué pasó con las inundaciones y los deslizamientos en mi país?',
		expectedId: 'cal-gt-lluvias'
	},
	{ query: 'precios y costo de la vida en México', expectedId: 'cal-mx-inflacion' },
	{ query: 'paro de trabajadores del ferrocarril español', expectedId: 'cal-es-huelga' },
	{
		query: 'acuerdo internacional contra el cambio climático',
		expectedId: 'cal-global-cumbre-clima'
	},
	{ query: 'vacunas para niños', expectedId: 'cal-gt-salud' }
];

export const RETRACTED_ID = 'cal-gt-retractada';
export const RETRACTED_QUERY = 'cierre del aeropuerto de Guatemala';
