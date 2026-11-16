import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

/** §21 Production metrics: on-time completion, order mix by status. */
export const GET = withErrorHandling(async () => {
  await requireUser();
  const orders = await prisma.productionOrder.findMany();
  const completed = orders.filter((o) => o.status === "COMPLETED");
  const onTime = completed.filter((o) => o.dueDate >= o.createdAt); // synthetic proxy: due date wasn't already in the past at creation

  const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    totalOrders: orders.length,
    byStatus,
    onTimeCompletionRate: completed.length > 0 ? Math.round((onTime.length / completed.length) * 1000) / 10 : null,
  });
});
