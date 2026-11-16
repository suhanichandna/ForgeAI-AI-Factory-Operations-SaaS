import { prisma } from "@/lib/prisma";
import { forecastDailyDemand, type HistoryPoint } from "@/lib/domain/forecast";
import { reserveMaterialsForOrder } from "@/lib/domain/requirements";
import { generateRecommendationForMaterial, computeRiskForMaterial } from "@/lib/domain/workflow";
import { recordAudit } from "@/lib/auth";
import { randomUUID } from "crypto";

const FORECAST_HORIZON_DAYS = 30;

/**
 * §20 Demonstration Scenario, step 2-7, made real: books a genuine
 * production order sized at the demand uplift (which reserves material right
 * now, via the same code path a manager creating an order would use),
 * regenerates the product's demand forecast under the uplift, and reruns the
 * risk + supplier-ranking engine for every material in the product's BOM.
 * Nothing here is hardcoded — it's the same engine the rest of the app calls,
 * just fed a bigger number.
 */
export async function triggerDemandShock(params: { productId: string; upliftPercent: number; actorId?: string | null }) {
  const { productId, upliftPercent, actorId } = params;

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: { bom: { include: { rawMaterial: true } } },
  });

  // Snapshot risk for every affected material BEFORE any mutation — this is
  // the true baseline, not just "before the reservation loop" (which would
  // already reflect the shocked forecast and reservation below).
  const riskBefore = new Map<string, string>();
  for (const bomLine of product.bom) {
    const { assessment } = await computeRiskForMaterial(bomLine.rawMaterialId);
    riskBefore.set(bomLine.rawMaterialId, assessment.riskLevel);
  }

  // Rebuild the sales history the forecaster would see, from real SalesOrderLine rows.
  const lines = await prisma.salesOrderLine.findMany({
    where: { productId },
    include: { salesOrder: true },
  });
  const byDay = new Map<string, number>();
  for (const line of lines) {
    const key = line.salesOrder.orderDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + line.quantity);
  }
  const history: HistoryPoint[] = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, quantity]) => ({ date: new Date(date), quantity }));

  const baselineForecast = forecastDailyDemand(history, FORECAST_HORIZON_DAYS);
  const shockedForecast = baselineForecast.map((p) => ({ date: p.date, quantity: p.quantity * (1 + upliftPercent / 100) }));

  await prisma.$transaction(
    shockedForecast.map((p) =>
      prisma.forecast.upsert({
        where: { productId_forecastDate: { productId, forecastDate: p.date } },
        update: { quantity: round2(p.quantity), model: "demand-shock-demo" },
        create: {
          id: randomUUID(),
          productId,
          forecastDate: p.date,
          quantity: round2(p.quantity),
          model: "demand-shock-demo",
        },
      }),
    ),
  );

  // Book an immediate production order covering the near-term uplift — this
  // is what actually consumes/reserves material right now, giving the
  // dashboard an instant, honest before/after instead of a 30-day wait.
  // A 3-week window (rather than the 14-day risk-classification cutoff)
  // means the reservation alone is large enough to visibly move materials
  // that were sitting just inside the MEDIUM band.
  const nearTermDays = 21;
  const upliftUnits = baselineForecast
    .slice(0, nearTermDays)
    .reduce((sum, p) => sum + p.quantity * (upliftPercent / 100), 0);
  const orderQuantity = Math.max(1, Math.round(upliftUnits));

  const orderNumber = `PO-DEMAND-${Date.now().toString(36).toUpperCase()}`;
  const productionOrder = await prisma.productionOrder.create({
    data: {
      orderNumber,
      productId,
      quantity: orderQuantity,
      status: "RELEASED",
      dueDate: new Date(Date.now() + nearTermDays * 24 * 60 * 60 * 1000),
    },
  });
  const reservation = await reserveMaterialsForOrder(productionOrder.id, productId, orderQuantity);

  await recordAudit({
    actorId,
    action: "DEMO_DEMAND_SHOCK_TRIGGERED",
    entityType: "Product",
    entityId: productId,
    summary: `Simulated a ${upliftPercent}% demand increase for ${product.name}: forecast updated, production order ${orderNumber} for ${orderQuantity} units released and reserved.`,
    metadata: { upliftPercent, orderQuantity, shortages: reservation.shortages.map((s) => s.rawMaterialName) },
  });

  // Recompute risk and (re)generate recommendations for every material this product consumes.
  const materialResults = [];
  for (const bomLine of product.bom) {
    const result = await generateRecommendationForMaterial(bomLine.rawMaterialId, actorId);
    materialResults.push({
      rawMaterialId: bomLine.rawMaterialId,
      rawMaterialName: bomLine.rawMaterial.name,
      riskBefore: riskBefore.get(bomLine.rawMaterialId) ?? "LOW",
      riskAfter: result.riskLevel,
      recommendationId: result.recommendation?.id ?? null,
    });
  }

  return {
    product: { id: product.id, name: product.name },
    productionOrder: { id: productionOrder.id, orderNumber, quantity: orderQuantity },
    reservationOk: reservation.ok,
    materialResults,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
