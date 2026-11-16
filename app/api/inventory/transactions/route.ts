import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

/** §11 POST /api/inventory/transactions — manual stock adjustments, always ledgered. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const rawMaterialId = url.searchParams.get("rawMaterialId") ?? undefined;
  const transactions = await prisma.inventoryTransaction.findMany({
    where: rawMaterialId ? { rawMaterialId } : undefined,
    include: { rawMaterial: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      material: t.rawMaterial.name,
      type: t.type,
      quantity: t.quantity,
      reference: t.reference,
      note: t.note,
      createdAt: t.createdAt,
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "INVENTORY_MANAGER"]);
  const body = await req.json();
  const { rawMaterialId, warehouseId, quantity, note } = body as { rawMaterialId: string; warehouseId: string; quantity: number; note?: string };

  if (!rawMaterialId || !warehouseId || typeof quantity !== "number" || quantity === 0) {
    return NextResponse.json({ error: "rawMaterialId, warehouseId and a non-zero quantity are required" }, { status: 400 });
  }

  const result = await prisma.$transaction(async (tx) => {
    let inv = await tx.inventory.findUnique({ where: { warehouseId_rawMaterialId: { warehouseId, rawMaterialId } } });
    if (!inv) {
      inv = await tx.inventory.create({ data: { warehouseId, rawMaterialId, quantityOnHand: 0, quantityReserved: 0 } });
    }
    if (inv.quantityOnHand + quantity < 0) {
      throw new Error("Adjustment would drive on-hand quantity negative");
    }
    await tx.inventory.update({ where: { id: inv.id }, data: { quantityOnHand: { increment: quantity } } });
    return tx.inventoryTransaction.create({
      data: { rawMaterialId, warehouseId, type: "ADJUSTMENT", quantity, note: note ?? "Manual adjustment" },
    });
  });

  await recordAudit({
    actorId: session.userId,
    action: "INVENTORY_ADJUSTED",
    entityType: "RawMaterial",
    entityId: rawMaterialId,
    summary: `Manual inventory adjustment of ${quantity} for material ${rawMaterialId}${note ? ` — ${note}` : ""}`,
  });

  return NextResponse.json({ transaction: result }, { status: 201 });
});
