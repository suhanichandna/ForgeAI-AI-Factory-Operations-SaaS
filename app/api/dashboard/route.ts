import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { computeRiskForMaterial } from "@/lib/domain/workflow";
import { healthScoreFromAnomalyScores } from "@/lib/domain/anomaly";

/** Executive Dashboard (§15): KPIs, alerts, risks, production status in one call. */
export const GET = withErrorHandling(async () => {
  await requireUser();

  const [materials, productionOrders, pendingRecommendations, machines, recentAudit] = await Promise.all([
    prisma.rawMaterial.findMany({ include: { inventory: true } }),
    prisma.productionOrder.findMany(),
    prisma.recommendation.findMany({ where: { status: "PENDING" }, include: { rawMaterial: true, supplier: true } }),
    prisma.machine.findMany({ include: { readings: { orderBy: { recordedAt: "desc" }, take: 24 } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: true } }),
  ]);

  const risks = await Promise.all(
    materials.map(async (m) => {
      const { assessment } = await computeRiskForMaterial(m.id);
      return { id: m.id, name: m.name, riskLevel: assessment.riskLevel, daysUntilStockout: assessment.daysUntilStockout };
    }),
  );

  const inventoryValue = materials.reduce((s, m) => s + m.inventory.reduce((s2, i) => s2 + i.quantityOnHand, 0) * m.standardCost, 0);

  const machinesNeedingAttention = machines.filter((m) => {
    const score = healthScoreFromAnomalyScores(m.readings.map((r) => r.anomalyScore));
    return score < 60;
  });

  return NextResponse.json({
    kpis: {
      materialCount: materials.length,
      inventoryValue: Math.round(inventoryValue * 100) / 100,
      openProductionOrders: productionOrders.filter((o) => o.status === "PLANNED" || o.status === "RELEASED" || o.status === "IN_PROGRESS").length,
      pendingApprovals: pendingRecommendations.length,
      machinesNeedingAttention: machinesNeedingAttention.length,
    },
    riskBreakdown: {
      high: risks.filter((r) => r.riskLevel === "HIGH").length,
      medium: risks.filter((r) => r.riskLevel === "MEDIUM").length,
      low: risks.filter((r) => r.riskLevel === "LOW").length,
    },
    topRisks: risks
      .filter((r) => r.riskLevel !== "LOW")
      .sort((a, b) => (a.daysUntilStockout ?? 999) - (b.daysUntilStockout ?? 999))
      .slice(0, 6),
    pendingRecommendations: pendingRecommendations.map((r) => ({
      id: r.id,
      material: r.rawMaterial.name,
      supplier: r.supplier.name,
      quantity: r.quantity,
      estimatedCost: r.estimatedCost,
      riskLevel: r.riskLevel,
      reason: r.reason,
    })),
    recentActivity: recentAudit.map((a) => ({ id: a.id, action: a.action, summary: a.summary, actor: a.actor?.name ?? "System", createdAt: a.createdAt })),
  });
});
