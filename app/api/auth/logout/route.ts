import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async () => {
  const session = await getSession();
  if (session) {
    await recordAudit({ actorId: session.userId, action: "LOGOUT", entityType: "User", entityId: session.userId, summary: `${session.name} logged out` });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
});
