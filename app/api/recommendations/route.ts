import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { generateRecommendationForMaterial } from "@/lib/domain/workflow";

/** §11 GET /api/recommendations — AI-generated, explainable purchase recommendations awaiting approval. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const recommendations = await prisma.recommendation.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : undefined,
    include: { rawMaterial: true, supplier: true, approval: { include: { approvedBy: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    recommendations: recommendations.map((r) => ({
      id: r.id,
      material: r.rawMaterial.name,
      unit: r.rawMaterial.unit,
      supplier: r.supplier.name,
      quantity: r.quantity,
      estimatedCost: r.estimatedCost,
      riskLevel: r.riskLevel,
      stockoutDate: r.stockoutDate,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      createdAt: r.createdAt,
      decidedBy: r.approval?.approvedBy.name ?? null,
      decidedAt: r.approval?.decidedAt ?? null,
    })),
  });
});

/** Manually trigger recommendation generation for a specific material (also runs automatically from the demo trigger and after PO receipt). */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "PROCUREMENT_MANAGER", "INVENTORY_MANAGER", "MANAGEMENT"]);
  const body = await req.json();
  const rawMaterialId = body?.rawMaterialId as string;
  if (!rawMaterialId) return NextResponse.json({ error: "rawMaterialId is required" }, { status: 400 });

  const result = await generateRecommendationForMaterial(rawMaterialId, session.userId);
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
