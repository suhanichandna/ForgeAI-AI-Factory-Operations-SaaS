import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async () => {
  await requireUser();
  const suppliers = await prisma.supplier.findMany({
    include: { materials: { include: { rawMaterial: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      reliability: s.reliability,
      qualityScore: s.qualityScore,
      materials: s.materials.map((m) => ({ rawMaterialId: m.rawMaterialId, rawMaterialName: m.rawMaterial.name, unitPrice: m.unitPrice, leadTimeDays: m.leadTimeDays, minOrderQty: m.minOrderQty })),
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "PROCUREMENT_MANAGER"]);
  const body = await req.json();
  const { code, name, reliability, qualityScore } = body as { code: string; name: string; reliability?: number; qualityScore?: number };
  if (!code || !name) return NextResponse.json({ error: "code and name are required" }, { status: 400 });

  const supplier = await prisma.supplier.create({ data: { code, name, reliability: reliability ?? 0.9, qualityScore: qualityScore ?? 0.9 } });
  await recordAudit({ actorId: session.userId, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: supplier.id, summary: `Created supplier ${supplier.name}` });
  return NextResponse.json({ supplier }, { status: 201 });
});
