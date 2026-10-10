import { normalizeWeights, type RankedItem, type RankingWeights } from '@repo/shared';

export interface ContributionBar {
  key: 'importance' | 'proximity' | 'affinity' | 'recency';
  label: string;
  value: number;
}

/** Reconstructs the four effective terms of rankFeed's score, including the read penalty. */
export function contributionBars(
  item: RankedItem,
  weights: RankingWeights,
  personalization: boolean,
): ContributionBar[] {
  const effective = normalizeWeights(
    weights,
    item.guaranteedBy === 'esencial' ? false : personalization,
  );
  const { components } = item;
  return [
    {
      key: 'importance',
      label: 'Importancia editorial',
      value: effective.wI * components.importance * components.penalties,
    },
    {
      key: 'proximity',
      label: 'Cercanía a tu ubicación',
      value: effective.wG * components.proximity * components.penalties,
    },
    {
      key: 'affinity',
      label: 'Afinidad con tus temas',
      value: effective.wA * components.affinity * components.penalties,
    },
    {
      key: 'recency',
      label: 'Recencia',
      value: effective.wR * components.recency * components.penalties,
    },
  ];
}
