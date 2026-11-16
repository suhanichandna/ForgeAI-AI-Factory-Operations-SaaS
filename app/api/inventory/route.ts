import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { computeRiskForMaterial } from "@/lib/domain/workflow";

/** §7 Inventory Management: materials, warehouses, stock balances, risk. */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const materials = await prisma.rawMaterial.findMany({
    include: { inventory: { include: { warehouse: true } } },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    materials.map(async (m) => {
      const onHand = m.inventory.reduce((s, i) => s + i.quantityOnHand, 0);
      const reserved = m.inventory.reduce((s, i) => s + i.quantityReserved, 0);
      const { assessment } = await computeRiskForMaterial(m.id);
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        unit: m.unit,
        safetyStock: m.safetyStock,
        standardCost: m.standardCost,
        onHand,
        reserved,
        available: onHand - reserved,
        riskLevel: assessment.riskLevel,
        stockoutDate: assessment.stockoutDate,
        daysUntilStockout: assessment.daysUntilStockout,
        reorderPoint: Math.round(assessment.reorderPoint * 100) / 100,
        byWarehouse: m.inventory.map((i) => ({ warehouse: i.warehouse.name, onHand: i.quantityOnHand, reserved: i.quantityReserved })),
      };
    }),
  );

  return NextResponse.json({ materials: rows });
});
