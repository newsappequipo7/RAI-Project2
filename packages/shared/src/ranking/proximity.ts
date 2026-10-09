import type { Location } from '../catalogs/locations';
import type { NewsGeo } from '../types';

export function proximity(geo: NewsGeo, location: Location): number {
  if (geo.scope === 'local' && geo.cityIds.includes(location.id)) return 1;
  if (geo.scope === 'local' && geo.countries.includes(location.countryIso)) return 0.45;
  if (geo.scope === 'global') return 0.6;
  if (geo.countries.includes(location.countryIso)) return 0.75;
  if (geo.regions.includes(location.region)) return 0.4;
  return geo.scope === 'internacional' ? 0.2 : 0.1;
}
