import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { assessStockoutRisk, recommendedPurchaseQuantity, type StockoutAssessment, type DailyForecastPoint } from "@/lib/domain/inventory";
import { rankSuppliers, type SupplierOption, type RankedSupplier } from "@/lib/domain/suppliers";
import { recordAudit } from "@/lib/auth";

const DEFAULT_HORIZON_DAYS = 30;
const DEFAULT_LEAD_TIME_DAYS = 14;

/**
 * Aggregates the stored product-level demand forecast into raw-material
 * demand via the BOM, then runs it through the §10.2/§12.2 risk engine.
 * This is the numeric core behind §6 steps 4-7 of the end-to-end workflow.
 */
export async function computeRiskForMaterial(rawMaterialId: string, horizonDays = DEFAULT_HORIZON_DAYS): Promise<{
  assessment: StockoutAssessment;
  rawMaterial: { id: string; name: string; unit: string; safetyStock: number };
  supplierOptions: SupplierOption[];
}> {
  const rawMaterial = await prisma.rawMaterial.findUniqueOrThrow({
    where: { id: rawMaterialId },
    include: {
      bomLines: { include: { product: true } },
      inventory: true,
      suppliers: { include: { supplier: true } },
      poLines: { include: { purchaseOrder: true } },
    },
  });

  const today = startOfDay(new Date());
  const horizonEnd = addDays(today, horizonDays);

  // Product forecast rows in the horizon, for every product whose BOM uses this material.
  const productIds = rawMaterial.bomLines.map((b) => b.productId);
  const forecasts = productIds.length
    ? await prisma.forecast.findMany({
        where: { productId: { in: productIds }, forecastDate: { gte: today, lt: horizonEnd } },
      })
    : [];

  const qtyPerUnitByProduct = new Map(rawMaterial.bomLines.map((b) => [b.productId, b.quantityPerUnit]));

  const demandByDay = new Map<string, number>();
  for (let i = 0; i < horizonDays; i++) {
    demandByDay.set(addDays(today, i).toISOString().slice(0, 10), 0);
  }
  for (const f of forecasts) {
    const key = f.forecastDate.toISOString().slice(0, 10);
    const perUnit = qtyPerUnitByProduct.get(f.productId) ?? 0;
    demandByDay.set(key, (demandByDay.get(key) ?? 0) + f.quantity * perUnit);
  }
  const dailyForecastConsumption: DailyForecastPoint[] = Array.from(demandByDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, quantity]) => ({ date: new Date(date), quantity }));

  const currentOnHand = rawMaterial.inventory.reduce((s, i) => s + i.quantityOnHand, 0);
  const reservedForProduction = rawMaterial.inventory.reduce((s, i) => s + i.quantityReserved, 0);

  const confirmedIncoming = rawMaterial.poLines
    .filter((line) => line.purchaseOrder.status === "ORDERED")
    .map((line) => ({ date: startOfDay(line.purchaseOrder.expectedDate), quantity: line.quantity }));

  const supplierOptions: SupplierOption[] = rawMaterial.suppliers.map((sm) => ({
    supplierId: sm.supplierId,
    supplierName: sm.supplier.name,
    unitPrice: sm.unitPrice,
    leadTimeDays: sm.leadTimeDays,
    reliability: sm.supplier.reliability,
    qualityScore: sm.supplier.qualityScore,
    minOrderQty: sm.minOrderQty,
  }));

  const avgSupplierLeadTime = supplierOptions.length
    ? supplierOptions.reduce((s, o) => s + o.leadTimeDays, 0) / supplierOptions.length
    : DEFAULT_LEAD_TIME_DAYS;

  const assessment = assessStockoutRisk({
    currentOnHand,
    reservedForProduction,
    safetyStock: rawMaterial.safetyStock,
    supplierLeadTimeDays: avgSupplierLeadTime,
    dailyForecastConsumption,
    confirmedIncoming,
  });

  return {
    assessment,
    rawMaterial: { id: rawMaterial.id, name: rawMaterial.name, unit: rawMaterial.unit, safetyStock: rawMaterial.safetyStock },
    supplierOptions,
  };
}

/**
 * §6 steps 7-8 / §12.2: if risk is MEDIUM or HIGH, rank suppliers and create
 * (or refresh) an explainable pending Recommendation. Idempotent per
 * material — reuses the existing PENDING recommendation if one exists.
 */
export async function generateRecommendationForMaterial(rawMaterialId: string, actorId?: string | null) {
  const { assessment, rawMaterial, supplierOptions } = await computeRiskForMaterial(rawMaterialId);

  if (assessment.riskLevel === "LOW" || supplierOptions.length === 0) {
    return { created: false, riskLevel: assessment.riskLevel, recommendation: null as null | Awaited<ReturnType<typeof prisma.recommendation.create>> };
  }

  const ranked: RankedSupplier[] = rankSuppliers(supplierOptions);
  const best = ranked[0];
  const quantity = Math.max(recommendedPurchaseQuantity(assessment, rawMaterial.safetyStock), best.minOrderQty);
  const estimatedCost = quantity * best.unitPrice;

  const reason = buildReason({
    materialName: rawMaterial.name,
    riskLevel: assessment.riskLevel,
    stockoutDate: assessment.stockoutDate,
    daysUntilStockout: assessment.daysUntilStockout,
    supplierName: best.supplierName,
    quantity,
    unit: rawMaterial.unit,
  });

  const existing = await prisma.recommendation.findFirst({
    where: { rawMaterialId, status: "PENDING" },
  });

  const detail = {
    reorderPoint: assessment.reorderPoint,
    leadTimeDemand: assessment.leadTimeDemand,
    averageDailyDemand: assessment.averageDailyDemand,
    projectionSample: assessment.projection.slice(0, 14).map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      projectedInventory: Math.round(p.projectedInventory * 100) / 100,
      belowSafetyStock: p.belowSafetyStock,
    })),
    rankedSuppliers: ranked.map((r) => ({
      supplierId: r.supplierId,
      supplierName: r.supplierName,
      score: Math.round(r.score * 1000) / 1000,
      unitPrice: r.unitPrice,
      leadTimeDays: r.leadTimeDays,
      reliability: r.reliability,
      qualityScore: r.qualityScore,
    })),
  };

  const recommendation = existing
    ? await prisma.recommendation.update({
        where: { id: existing.id },
        data: {
          supplierId: best.supplierId,
          quantity,
          estimatedCost,
          riskLevel: assessment.riskLevel,
          stockoutDate: assessment.stockoutDate,
          reason,
          detail,
        },
      })
    : await prisma.recommendation.create({
        data: {
          rawMaterialId,
          supplierId: best.supplierId,
          quantity,
          estimatedCost,
          riskLevel: assessment.riskLevel,
          stockoutDate: assessment.stockoutDate,
          reason,
          detail,
        },
      });

  await recordAudit({
    actorId,
    action: existing ? "RECOMMENDATION_REFRESHED" : "RECOMMENDATION_CREATED",
    entityType: "Recommendation",
    entityId: recommendation.id,
    summary: reason,
    metadata: { rawMaterialId, riskLevel: assessment.riskLevel },
  });

  return { created: !existing, riskLevel: assessment.riskLevel, recommendation };
}

function buildReason(p: {
  materialName: string;
  riskLevel: string;
  stockoutDate: Date | null;
  daysUntilStockout: number | null;
  supplierName: string;
  quantity: number;
  unit: string;
}): string {
  const when = p.stockoutDate
    ? `within ${p.daysUntilStockout} day${p.daysUntilStockout === 1 ? "" : "s"} (around ${p.stockoutDate.toISOString().slice(0, 10)})`
    : "within the planning horizon";
  return `${p.riskLevel} stockout risk for ${p.materialName} ${when}. Recommend purchasing ${round2(p.quantity)} ${p.unit} from ${p.supplierName} — the top-ranked supplier on cost, lead time, reliability and quality.`;
}

/**
 * §6 step 9-10 / §13: human approves or rejects. On approval, generates the
 * purchase order automatically and records the decision + full audit trail.
 */
export async function decideRecommendation(params: {
  recommendationId: string;
  approvedById: string;
  decision: "APPROVED" | "REJECTED";
  comment?: string;
}) {
  const { recommendationId, approvedById, decision, comment } = params;

  const recommendation = await prisma.recommendation.findUniqueOrThrow({
    where: { id: recommendationId },
    include: { rawMaterial: true, supplier: true },
  });
  if (recommendation.status !== "PENDING") {
    throw new Error(`Recommendation ${recommendationId} is already ${recommendation.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.approval.create({
      data: { recommendationId, approvedById, decision, comment },
    });

    let purchaseOrderId: string | null = null;

    if (decision === "APPROVED") {
      const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;
      const leadMs = await materialLeadTimeMs(tx, recommendation.supplierId, recommendation.rawMaterialId);
      const expectedDate = new Date(Date.now() + leadMs);
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: recommendation.supplierId,
          status: "ORDERED",
          totalCost: recommendation.estimatedCost,
          expectedDate,
          lines: {
            create: [
              {
                rawMaterialId: recommendation.rawMaterialId,
                quantity: recommendation.quantity,
                unitPrice: recommendation.quantity > 0 ? recommendation.estimatedCost / recommendation.quantity : 0,
              },
            ],
          },
        },
      });
      purchaseOrderId = po.id;
    }

    const updated = await tx.recommendation.update({
      where: { id: recommendationId },
      data: { status: decision, purchaseOrderId },
    });

    return { updated, purchaseOrderId };
  });

  await recordAudit({
    actorId: approvedById,
    action: decision === "APPROVED" ? "RECOMMENDATION_APPROVED" : "RECOMMENDATION_REJECTED",
    entityType: "Recommendation",
    entityId: recommendationId,
    summary: `${decision} recommendation for ${recommendation.rawMaterial.name} (${recommendation.quantity} ${recommendation.rawMaterial.unit} from ${recommendation.supplier.name})${comment ? ` — ${comment}` : ""}`,
    metadata: { purchaseOrderId: result.purchaseOrderId },
  });

  return result;
}

async function materialLeadTimeMs(tx: Prisma.TransactionClient, supplierId: string, rawMaterialId: string): Promise<number> {
  const row = await tx.supplierMaterial.findUnique({ where: { supplierId_rawMaterialId: { supplierId, rawMaterialId } } });
  const days = row?.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

/** §6 step 11: goods received → inventory updated → prediction recalculated. */
export async function receivePurchaseOrder(purchaseOrderId: string, actorId?: string | null) {
  const po = await prisma.purchaseOrder.findUniqueOrThrow({
    where: { id: purchaseOrderId },
    include: { lines: true, supplier: true },
  });
  if (po.status !== "ORDERED") {
    throw new Error(`Purchase order ${purchaseOrderId} is not in ORDERED status`);
  }

  await prisma.$transaction(async (tx) => {
    for (const line of po.lines) {
      // Receive into the first warehouse holding this material, or create a
      // default-warehouse row if none exists yet.
      let inv = await tx.inventory.findFirst({ where: { rawMaterialId: line.rawMaterialId } });
      if (!inv) {
        const anyWarehouse = await tx.warehouse.findFirstOrThrow();
        inv = await tx.inventory.create({
          data: { warehouseId: anyWarehouse.id, rawMaterialId: line.rawMaterialId, quantityOnHand: 0, quantityReserved: 0 },
        });
      }
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantityOnHand: { increment: line.quantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          rawMaterialId: line.rawMaterialId,
          warehouseId: inv.warehouseId,
          type: "RECEIPT",
          quantity: line.quantity,
          reference: po.poNumber,
          note: `Goods receipt from ${po.supplier.name}`,
        },
      });
    }
    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
  });

  await recordAudit({
    actorId,
    action: "PURCHASE_ORDER_RECEIVED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrderId,
    summary: `Received ${po.poNumber} from ${po.supplier.name}`,
  });

  // Recalculate risk for every material on this PO so the dashboard reflects
  // the new (presumably lower) risk immediately.
  for (const line of po.lines) {
    await generateRecommendationForMaterial(line.rawMaterialId, actorId).catch(() => undefined);
  }

  return po;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
