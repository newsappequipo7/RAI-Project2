import type { RankedItem } from '../types';

export function assignTiers(items: RankedItem[]): RankedItem[] {
  let large = 0;
  return items.map((item, index) => {
    let tier: RankedItem['tier'] =
      index === 0 ? 'hero' : index < 3 ? 'grande' : index < 9 ? 'mediana' : 'compacta';
    if (index >= 3 && index < 9 && item.score >= 0.85 && large < 3) tier = 'grande';
    if (tier === 'grande') large++;
    return { ...item, tier };
  });
}
