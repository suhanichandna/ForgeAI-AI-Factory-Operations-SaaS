import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 200 });
  return NextResponse.json({ user: { id: session.userId, name: session.name, email: session.email, role: session.role } });
});
