import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { runAssistant, type AssistantContext } from "@/lib/domain/assistant";

/** §13 AI Agent and Automation Workflow. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await requireUser();
  const body = await req.json();
  const message = body?.message as string;
  const context = (body?.context as AssistantContext) ?? {};
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const result = await runAssistant(message, context, session.userId);
  return NextResponse.json(result);
});
