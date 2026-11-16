import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { computeRiskForMaterial } from "@/lib/domain/workflow";

/** §21 Inventory metrics: stockout rate, inventory turnover, excess inventory (approximated from the synthetic dataset). */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const materials = await prisma.rawMaterial.findMany({ include: { inventory: true } });

  let high = 0;
  let medium = 0;
  let low = 0;
  let excessValue = 0;
  let totalValue = 0;

  for (const m of materials) {
    const onHand = m.inventory.reduce((s, i) => s + i.quantityOnHand, 0);
    totalValue += onHand * m.standardCost;
    if (onHand > m.safetyStock * 3) excessValue += (onHand - m.safetyStock * 3) * m.standardCost;
    const { assessment } = await computeRiskForMaterial(m.id);
    if (assessment.riskLevel === "HIGH") high++;
    else if (assessment.riskLevel === "MEDIUM") medium++;
    else low++;
  }

  // Turnover ≈ (annualized consumption) / (average on-hand value) — a standard
  // approximation given a single current snapshot rather than a full ledger history.
  const last90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const consumption = await prisma.inventoryTransaction.aggregate({
    where: { type: "ISSUE", createdAt: { gte: last90 } },
    _sum: { quantity: true },
  });

  return NextResponse.json({
    materialCount: materials.length,
    riskBreakdown: { high, medium, low },
    inventoryValue: Math.round(totalValue * 100) / 100,
    excessInventoryValue: Math.round(excessValue * 100) / 100,
    issuedLast90Days: consumption._sum.quantity ?? 0,
  });
});
