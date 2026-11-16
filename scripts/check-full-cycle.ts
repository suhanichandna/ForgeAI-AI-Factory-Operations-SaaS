import { prisma } from "../lib/prisma";
import { computeRiskForMaterial, decideRecommendation, receivePurchaseOrder } from "../lib/domain/workflow";
import { triggerDemandShock } from "../lib/domain/demo";

async function main() {
  const product = await prisma.product.findUniqueOrThrow({ where: { sku: "FG-PANEL-P300" } });
  const pcb = await prisma.rawMaterial.findUniqueOrThrow({ where: { code: "RM-PCB" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "management@forgeai.demo" } });

  console.log("1. BEFORE:", (await computeRiskForMaterial(pcb.id)).assessment.riskLevel);

  await triggerDemandShock({ productId: product.id, upliftPercent: 30, actorId: admin.id });
  console.log("2. AFTER SHOCK:", (await computeRiskForMaterial(pcb.id)).assessment.riskLevel);

  const rec = await prisma.recommendation.findFirstOrThrow({ where: { rawMaterialId: pcb.id, status: "PENDING" } });
  console.log("3. Recommendation:", rec.reason);

  const { updatedPO } = await decideRecommendation({ recommendationId: rec.id, approvedById: admin.id, decision: "APPROVED" }).then((r) => ({ updatedPO: r.purchaseOrderId }));
  console.log("4. PO created:", updatedPO);

  await receivePurchaseOrder(updatedPO!, admin.id);
  console.log("5. PO received.");

  console.log("6. AFTER RECEIPT:", (await computeRiskForMaterial(pcb.id)).assessment.riskLevel);

  const auditCount = await prisma.auditLog.count();
  console.log("7. Total audit log entries:", auditCount);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
