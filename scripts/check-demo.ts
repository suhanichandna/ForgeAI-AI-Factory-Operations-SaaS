import { prisma } from "../lib/prisma";
import { computeRiskForMaterial } from "../lib/domain/workflow";
import { triggerDemandShock } from "../lib/domain/demo";

async function main() {
  const product = await prisma.product.findUniqueOrThrow({ where: { sku: "FG-PANEL-P300" } });
  const pcb = await prisma.rawMaterial.findUniqueOrThrow({ where: { code: "RM-PCB" } });

  const before = await computeRiskForMaterial(pcb.id);
  console.log("BEFORE:", before.assessment.riskLevel, "days=" + before.assessment.daysUntilStockout);

  const result = await triggerDemandShock({ productId: product.id, upliftPercent: 30 });
  console.log("Demo trigger result:", JSON.stringify(result, null, 2));

  const after = await computeRiskForMaterial(pcb.id);
  console.log("AFTER:", after.assessment.riskLevel, "days=" + after.assessment.daysUntilStockout);

  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
