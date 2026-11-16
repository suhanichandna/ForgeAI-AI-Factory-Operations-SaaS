import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async () => {
  await requireUser();
  const products = await prisma.product.findMany({
    include: { bom: { include: { rawMaterial: true } }, inventory: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
      unitPrice: p.unitPrice,
      onHand: p.inventory.reduce((s, i) => s + i.quantityOnHand, 0),
      bom: p.bom.map((b) => ({ rawMaterialId: b.rawMaterialId, rawMaterialName: b.rawMaterial.name, unit: b.rawMaterial.unit, quantityPerUnit: b.quantityPerUnit })),
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "PRODUCTION_MANAGER"]);
  const body = await req.json();
  const { sku, name, unit, unitPrice, bom } = body as {
    sku: string;
    name: string;
    unit?: string;
    unitPrice?: number;
    bom: { rawMaterialId: string; quantityPerUnit: number }[];
  };

  if (!sku || !name) {
    return NextResponse.json({ error: "sku and name are required" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      sku,
      name,
      unit: unit ?? "pcs",
      unitPrice: unitPrice ?? 0,
      bom: { create: (bom ?? []).map((b) => ({ rawMaterialId: b.rawMaterialId, quantityPerUnit: b.quantityPerUnit })) },
    },
    include: { bom: true },
  });

  await recordAudit({ actorId: session.userId, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id, summary: `Created product ${product.name} (${product.sku})` });

  return NextResponse.json({ product }, { status: 201 });
});
