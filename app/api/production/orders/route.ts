import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { explodeMaterialRequirements, reserveMaterialsForOrder } from "@/lib/domain/requirements";

/** §7 Production Management + §6 step 3: create an order, explode the BOM, check/reserve inventory. */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const orders = await prisma.productionOrder.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      productId: o.productId,
      productName: o.product.name,
      quantity: o.quantity,
      status: o.status,
      dueDate: o.dueDate,
      createdAt: o.createdAt,
    })),
  });
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "PRODUCTION_MANAGER"]);
  const body = await req.json();
  const { productId, quantity, dueDate } = body as { productId: string; quantity: number; dueDate: string };

  if (!productId || !quantity || quantity <= 0 || !dueDate) {
    return NextResponse.json({ error: "productId, a positive quantity, and dueDate are required" }, { status: 400 });
  }

  const requirements = await explodeMaterialRequirements(productId, quantity);
  const orderNumber = `PROD-${Date.now().toString(36).toUpperCase()}`;

  const order = await prisma.productionOrder.create({
    data: { orderNumber, productId, quantity, dueDate: new Date(dueDate), status: "PLANNED" },
  });

  const reservation = await reserveMaterialsForOrder(order.id, productId, quantity);
  if (reservation.ok) {
    await prisma.productionOrder.update({ where: { id: order.id }, data: { status: "RELEASED" } });
  }

  await recordAudit({
    actorId: session.userId,
    action: "PRODUCTION_ORDER_CREATED",
    entityType: "ProductionOrder",
    entityId: order.id,
    summary: `Created production order ${orderNumber} for ${quantity} units${reservation.ok ? " (materials reserved)" : " (material shortage — order held at PLANNED)"}`,
    metadata: { requirements },
  });

  return NextResponse.json({ order, requirements, reservationOk: reservation.ok, shortages: reservation.shortages }, { status: 201 });
});
