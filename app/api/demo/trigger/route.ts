import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { triggerDemandShock } from "@/lib/domain/demo";

/** §20 Demonstration Scenario, step 2: "Trigger a 30% demand increase for a key finished product." */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser(["FACTORY_ADMIN", "MANAGEMENT", "PRODUCTION_MANAGER"]);
  const body = await req.json();
  const productId = body?.productId as string;
  const upliftPercent = (body?.upliftPercent as number) ?? 30;
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const result = await triggerDemandShock({ productId, upliftPercent, actorId: session.userId });
  return NextResponse.json(result);
});
