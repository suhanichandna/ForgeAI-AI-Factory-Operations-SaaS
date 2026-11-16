/**
 * Inventory risk engine — §10.2 and §12.2 of the blueprint, implemented
 * exactly as specified:
 *
 *   Lead-Time Demand        = Average Daily Demand × Supplier Lead Time
 *   Reorder Point            = Lead-Time Demand + Safety Stock
 *   Projected Inventory(t)   = Current Stock
 *                             + Confirmed Incoming Quantity
 *                             − Forecasted Consumption
 *                             − Reserved Production Quantity
 *   Stockout risk exists when Projected Inventory(t) < Safety Stock
 *   within the planning horizon.
 */

export type DailyForecastPoint = { date: Date; quantity: number };

export type ProjectionPoint = {
  date: Date;
  onHand: number;
  incoming: number;
  forecastedConsumption: number;
  reserved: number;
  projectedInventory: number;
  belowSafetyStock: boolean;
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type StockoutAssessment = {
  riskLevel: RiskLevel;
  stockoutDate: Date | null;
  daysUntilStockout: number | null;
  reorderPoint: number;
  leadTimeDemand: number;
  averageDailyDemand: number;
  projection: ProjectionPoint[];
};

export function leadTimeDemand(averageDailyDemand: number, supplierLeadTimeDays: number): number {
  return averageDailyDemand * supplierLeadTimeDays;
}

export function reorderPoint(averageDailyDemand: number, supplierLeadTimeDays: number, safetyStock: number): number {
  return leadTimeDemand(averageDailyDemand, supplierLeadTimeDays) + safetyStock;
}

/**
 * Walks the planning horizon day by day, applying forecasted consumption
 * (from the material-demand forecast, i.e. BOM-exploded product forecast)
 * and any confirmed incoming purchase-order quantities that land on that day.
 * Reserved production quantity is treated as an immediate reduction (material
 * already committed to an open production order).
 */
export function projectInventory(params: {
  currentOnHand: number;
  reservedForProduction: number;
  dailyForecastConsumption: DailyForecastPoint[]; // one entry per day of horizon
  confirmedIncoming: { date: Date; quantity: number }[]; // PO expected-receipt dates
  safetyStock: number;
}): ProjectionPoint[] {
  const { currentOnHand, reservedForProduction, dailyForecastConsumption, confirmedIncoming, safetyStock } = params;

  let running = currentOnHand - reservedForProduction;
  const incomingByDay = new Map<string, number>();
  for (const inc of confirmedIncoming) {
    const key = inc.date.toISOString().slice(0, 10);
    incomingByDay.set(key, (incomingByDay.get(key) ?? 0) + inc.quantity);
  }

  const points: ProjectionPoint[] = [];
  for (const day of dailyForecastConsumption) {
    const key = day.date.toISOString().slice(0, 10);
    const incoming = incomingByDay.get(key) ?? 0;
    running = running + incoming - day.quantity;
    points.push({
      date: day.date,
      onHand: currentOnHand,
      incoming,
      forecastedConsumption: day.quantity,
      reserved: reservedForProduction,
      projectedInventory: running,
      belowSafetyStock: running < safetyStock,
    });
  }
  return points;
}

export function assessStockoutRisk(params: {
  currentOnHand: number;
  reservedForProduction: number;
  safetyStock: number;
  supplierLeadTimeDays: number;
  dailyForecastConsumption: DailyForecastPoint[];
  confirmedIncoming: { date: Date; quantity: number }[];
}): StockoutAssessment {
  const { currentOnHand, reservedForProduction, safetyStock, supplierLeadTimeDays, dailyForecastConsumption, confirmedIncoming } = params;

  const horizonDays = dailyForecastConsumption.length || 1;
  const totalDemand = dailyForecastConsumption.reduce((sum, d) => sum + d.quantity, 0);
  const averageDailyDemand = totalDemand / horizonDays;

  const projection = projectInventory({
    currentOnHand,
    reservedForProduction,
    dailyForecastConsumption,
    confirmedIncoming,
    safetyStock,
  });

  // Classify purely on how soon projected inventory first crosses the safety
  // line — a breach 25 days out is normal reorder-cycle territory (MEDIUM),
  // not urgent. Note this necessarily also covers true depletion
  // (projectedInventory < 0), since negative stock is always below safety
  // stock too; there's no separate "goes negative eventually" override, or
  // a slow multi-week drift would falsely read as HIGH on day one.
  const firstBreach = projection.find((p) => p.belowSafetyStock) ?? null;

  let riskLevel: RiskLevel = "LOW";
  let daysUntilStockout: number | null = null;
  let stockoutDate: Date | null = null;

  if (firstBreach) {
    const days = differenceInDays(firstBreach.date, dailyForecastConsumption[0].date);
    riskLevel = days <= 7 ? "HIGH" : "MEDIUM";
    stockoutDate = firstBreach.date;
    daysUntilStockout = days;
  }

  return {
    riskLevel,
    stockoutDate,
    daysUntilStockout,
    reorderPoint: reorderPoint(averageDailyDemand, supplierLeadTimeDays, safetyStock),
    leadTimeDemand: leadTimeDemand(averageDailyDemand, supplierLeadTimeDays),
    averageDailyDemand,
    projection,
  };
}

function differenceInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/**
 * How much to buy so projected inventory clears the safety stock line again
 * for the rest of the horizon. Rounds up to a whole unit.
 */
export function recommendedPurchaseQuantity(assessment: StockoutAssessment, safetyStock: number): number {
  const worst = assessment.projection.reduce(
    (min, p) => (p.projectedInventory < min ? p.projectedInventory : min),
    Infinity,
  );
  if (!Number.isFinite(worst)) return 0;
  const shortfall = safetyStock - worst;
  return Math.max(0, Math.ceil(shortfall));
}
