import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

/** §6 step 12 / §16: full decision and action history. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireUser(["FACTORY_ADMIN", "MANAGEMENT"]);
  const url = new URL(req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: true },
  });
  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      summary: l.summary,
      actor: l.actor?.name ?? "System",
      createdAt: l.createdAt,
    })),
  });
});
