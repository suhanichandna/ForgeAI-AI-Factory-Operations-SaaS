import { prisma } from "../lib/prisma";
import { computeRiskForMaterial } from "../lib/domain/workflow";

async function main() {
  const materials = await prisma.rawMaterial.findMany();
  for (const m of materials) {
    const { assessment } = await computeRiskForMaterial(m.id);
    console.log(
      m.code.padEnd(14),
      assessment.riskLevel.padEnd(8),
      "avgDailyDemand=" + assessment.averageDailyDemand.toFixed(1),
      "daysUntilStockout=" + assessment.daysUntilStockout,
      "stockoutDate=" + (assessment.stockoutDate?.toISOString().slice(0, 10) ?? "-"),
    );
  }
  await prisma.$disconnect();
}
main();
