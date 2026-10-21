export interface EntranceFeeBudgetSummary {
  knownFeesTotal: number;
  unknownFeeCount: number;
  exceedsBudget: boolean;
}

/** Returns the conservative fee estimate stored in the trusted place catalog. */
export function getCatalogEntranceFeeEstimate(
  priceMin: number | null | undefined,
  priceMax: number | null | undefined
): number | null {
  if (priceMax != null && Number.isFinite(priceMax) && priceMax >= 0) return priceMax;
  if (priceMin != null && Number.isFinite(priceMin) && priceMin >= 0) return priceMin;
  return null;
}

/** Summarizes catalog-backed entrance fees without treating missing prices as zero. */
export function summarizeEntranceFeeBudget(
  budget: number | null | undefined,
  activityFees: Array<number | null | undefined>
): EntranceFeeBudgetSummary {
  let knownFeesTotal = 0;
  let unknownFeeCount = 0;

  for (const fee of activityFees) {
    if (fee === null || fee === undefined || !Number.isFinite(fee) || fee < 0) {
      unknownFeeCount++;
      continue;
    }
    knownFeesTotal += fee;
  }

  const hasBudget = budget !== null && budget !== undefined && Number.isFinite(budget) && budget >= 0;

  return {
    knownFeesTotal,
    unknownFeeCount,
    exceedsBudget: hasBudget && knownFeesTotal > budget,
  };
}
