import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { decideRecommendation } from "@/lib/domain/workflow";

/** §6 step 9-10 / §13: a manager approves — the workflow engine generates the purchase order automatically. */
export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireUser(["FACTORY_ADMIN", "MANAGEMENT", "PROCUREMENT_MANAGER"]);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await decideRecommendation({ recommendationId: id, approvedById: session.userId, decision: "APPROVED", comment: body?.comment });
  return NextResponse.json(result);
});
