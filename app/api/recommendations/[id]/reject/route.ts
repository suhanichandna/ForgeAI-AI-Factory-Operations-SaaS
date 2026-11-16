import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { decideRecommendation } from "@/lib/domain/workflow";

export const POST = withErrorHandling(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireUser(["FACTORY_ADMIN", "MANAGEMENT", "PROCUREMENT_MANAGER"]);
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await decideRecommendation({ recommendationId: id, approvedById: session.userId, decision: "REJECTED", comment: body?.comment });
  return NextResponse.json(result);
});
