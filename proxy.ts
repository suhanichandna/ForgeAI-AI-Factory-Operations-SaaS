import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";

// Proxy (formerly "middleware") always runs on the Node.js runtime — no
// runtime opt-in needed, unlike the old middleware convention. That matters
// here because lib/auth.ts signs sessions with Node's crypto module.
// §16: route-level gate. API routes still do their own requireUser/RBAC
// checks (defense in depth); this middleware protects the app pages so an
// unauthenticated visitor is bounced to /login before any page renders.
const PUBLIC_PATHS = ["/login"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next") || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
