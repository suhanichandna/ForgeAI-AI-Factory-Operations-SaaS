import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { healthScoreFromAnomalyScores, maintenanceRecommended } from "@/lib/domain/anomaly";

/** §11 GET /api/machines/:id/health */
export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await params;
  const machine = await prisma.machine.findUniqueOrThrow({
    where: { id },
    include: { readings: { orderBy: { recordedAt: "desc" }, take: 168 } }, // last week hourly
  });
  const scores = machine.readings.map((r) => r.anomalyScore);
  return NextResponse.json({
    machine: { id: machine.id, code: machine.code, name: machine.name, status: machine.status },
    healthScore: healthScoreFromAnomalyScores(scores),
    maintenanceRecommended: maintenanceRecommended(scores),
    readings: [...machine.readings].reverse().map((r) => ({
      recordedAt: r.recordedAt,
      temperature: r.temperature,
      vibration: r.vibration,
      pressure: r.pressure,
      rpm: r.rpm,
      powerDraw: r.powerDraw,
      anomalyScore: r.anomalyScore,
    })),
  });
});
