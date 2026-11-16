import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const materials = await prisma.rawMaterial.findMany({ include: { inventory: true, bomLines: { include: { product: true } } } });
for (const m of materials) {
  const onHand = m.inventory.reduce((s, i) => s + i.quantityOnHand, 0);
  console.log(m.code, m.name, "onHand=" + onHand, "safetyStock=" + m.safetyStock, "usedBy=" + m.bomLines.map((b) => b.product.name).join(","));
}
await prisma.$disconnect();
