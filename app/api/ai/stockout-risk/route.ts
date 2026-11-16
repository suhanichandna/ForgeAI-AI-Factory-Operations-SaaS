import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { computeRiskForMaterial } from "@/lib/domain/workflow";
import { rankSuppliers } from "@/lib/domain/suppliers";

/** §11 POST /api/ai/stockout-risk */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireUser();
  const body = await req.json();
  const rawMaterialId = body?.rawMaterialId as string;
  if (!rawMaterialId) return NextResponse.json({ error: "rawMaterialId is required" }, { status: 400 });

  const { assessment, rawMaterial, supplierOptions } = await computeRiskForMaterial(rawMaterialId);
  return NextResponse.json({
    material: rawMaterial,
    riskLevel: assessment.riskLevel,
    stockoutDate: assessment.stockoutDate,
    daysUntilStockout: assessment.daysUntilStockout,
    reorderPoint: assessment.reorderPoint,
    leadTimeDemand: assessment.leadTimeDemand,
    averageDailyDemand: assessment.averageDailyDemand,
    projection: assessment.projection.map((p) => ({ date: p.date, projectedInventory: Math.round(p.projectedInventory * 100) / 100, belowSafetyStock: p.belowSafetyStock })),
    rankedSuppliers: rankSuppliers(supplierOptions),
  });
});
