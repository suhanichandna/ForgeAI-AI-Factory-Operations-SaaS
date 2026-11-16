import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { healthScoreFromAnomalyScores, maintenanceRecommended } from "@/lib/domain/anomaly";

/** §7 Machine Monitoring / §14: machine registry, latest telemetry, health score, maintenance flag. */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const machines = await prisma.machine.findMany({
    include: { readings: { orderBy: { recordedAt: "desc" }, take: 24 } },
    orderBy: { code: "asc" },
  });
  return NextResponse.json({
    machines: machines.map((m) => {
      const scores = m.readings.map((r) => r.anomalyScore);
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        status: m.status,
        latest: m.readings[0] ?? null,
        healthScore: healthScoreFromAnomalyScores(scores),
        maintenanceRecommended: maintenanceRecommended(scores),
      };
    }),
  });
});
