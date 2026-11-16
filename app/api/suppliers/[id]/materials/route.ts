import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await params;
  const materials = await prisma.supplierMaterial.findMany({ where: { supplierId: id }, include: { rawMaterial: true } });
  return NextResponse.json({
    materials: materials.map((m) => ({ rawMaterialId: m.rawMaterialId, name: m.rawMaterial.name, unitPrice: m.unitPrice, leadTimeDays: m.leadTimeDays, minOrderQty: m.minOrderQty })),
  });
});
