import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async () => {
  await requireUser();
  const orders = await prisma.purchaseOrder.findMany({
    include: { supplier: true, lines: { include: { rawMaterial: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    purchaseOrders: orders.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      supplier: po.supplier.name,
      status: po.status,
      totalCost: po.totalCost,
      expectedDate: po.expectedDate,
      receivedAt: po.receivedAt,
      createdAt: po.createdAt,
      lines: po.lines.map((l) => ({ material: l.rawMaterial.name, quantity: l.quantity, unitPrice: l.unitPrice })),
    })),
  });
});
