import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { completeProductionOrder, releaseReservationsForOrder, explodeMaterialRequirements } from "@/lib/domain/requirements";

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await params;
  const order = await prisma.productionOrder.findUniqueOrThrow({ where: { id }, include: { product: true } });
  const requirements = await explodeMaterialRequirements(order.productId, order.quantity);
  return NextResponse.json({ order, requirements });
});

export const PATCH = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireUser(["FACTORY_ADMIN", "PRODUCTION_MANAGER"]);
  const { id } = await params;
  const body = await req.json();
  const status = body?.status as string;

  if (status === "COMPLETED") {
    const order = await completeProductionOrder(id);
    await recordAudit({ actorId: session.userId, action: "PRODUCTION_ORDER_COMPLETED", entityType: "ProductionOrder", entityId: id, summary: `Completed production order ${order.orderNumber}: materials issued, finished goods stock increased.` });
    return NextResponse.json({ ok: true });
  }
  if (status === "CANCELLED") {
    const order = await releaseReservationsForOrder(id);
    await recordAudit({ actorId: session.userId, action: "PRODUCTION_ORDER_CANCELLED", entityType: "ProductionOrder", entityId: id, summary: `Cancelled production order ${order.orderNumber}, reservations released.` });
    return NextResponse.json({ ok: true });
  }
  if (status === "IN_PROGRESS") {
    await prisma.productionOrder.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unsupported status transition" }, { status: 400 });
});
