import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { receivePurchaseOrder } from "@/lib/domain/workflow";

/** §6 step 11 / §11 goods receipt: mark a PO received, update inventory, recalc risk. */
export const POST = withErrorHandling(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireUser(["FACTORY_ADMIN", "INVENTORY_MANAGER", "PROCUREMENT_MANAGER"]);
  const { id } = await params;
  const po = await receivePurchaseOrder(id, session.userId);
  return NextResponse.json({ purchaseOrder: po });
});
