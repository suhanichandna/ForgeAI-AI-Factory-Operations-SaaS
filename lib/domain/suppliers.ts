/**
 * Supplier ranking — §12 "Supplier ranking": weighted scoring over cost,
 * lead time, reliability and quality.
 */

export type SupplierOption = {
  supplierId: string;
  supplierName: string;
  unitPrice: number;
  leadTimeDays: number;
  reliability: number; // 0..1
  qualityScore: number; // 0..1
  minOrderQty: number;
};

export type RankedSupplier = SupplierOption & {
  score: number;
  costScore: number;
  leadTimeScore: number;
};

export type SupplierWeights = { cost: number; leadTime: number; reliability: number; quality: number };

export const DEFAULT_SUPPLIER_WEIGHTS: SupplierWeights = {
  cost: 0.35,
  leadTime: 0.25,
  reliability: 0.25,
  quality: 0.15,
};

/**
 * Min-max normalizes cost and lead time across the candidate set (lower is
 * better → inverted), then combines with reliability/quality (already 0..1,
 * higher is better) using the supplied weights.
 */
export function rankSuppliers(options: SupplierOption[], weights: SupplierWeights = DEFAULT_SUPPLIER_WEIGHTS): RankedSupplier[] {
  if (options.length === 0) return [];

  const costs = options.map((o) => o.unitPrice);
  const leadTimes = options.map((o) => o.leadTimeDays);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const minLead = Math.min(...leadTimes);
  const maxLead = Math.max(...leadTimes);

  const ranked = options.map((o) => {
    const costScore = maxCost > minCost ? 1 - (o.unitPrice - minCost) / (maxCost - minCost) : 1;
    const leadTimeScore = maxLead > minLead ? 1 - (o.leadTimeDays - minLead) / (maxLead - minLead) : 1;
    const score =
      weights.cost * costScore +
      weights.leadTime * leadTimeScore +
      weights.reliability * o.reliability +
      weights.quality * o.qualityScore;
    return { ...o, costScore, leadTimeScore, score };
  });

  return ranked.sort((a, b) => b.score - a.score);
}
