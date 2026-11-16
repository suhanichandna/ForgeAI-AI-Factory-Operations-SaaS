import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie, recordAudit } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await setSessionCookie({ userId: user.id, companyId: user.companyId, role: user.role, email: user.email, name: user.name });
  await recordAudit({ actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, summary: `${user.name} logged in` });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
