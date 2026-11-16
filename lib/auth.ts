import { cookies } from "next/headers";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

export { hashPassword, verifyPassword } from "@/lib/password";

// ---------------------------------------------------------------------------
// Session cookie: a signed, HMAC'd JSON payload. No external JWT dependency,
// same security shape §16 asks for (signed session token, not a raw db id).
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "forgeai_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

type SessionPayload = {
  userId: string;
  companyId: string;
  role: Role;
  email: string;
  name: string;
};

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function encodeSession(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = sign(json);
  return `${json}.${sig}`;
}

export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [json, sig] = token.split(".");
  if (!json || !sig) return null;
  if (sign(json) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(json, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { SESSION_COOKIE };

// ---------------------------------------------------------------------------
// RBAC helpers (§16: role-based access control, company-level tenant isolation)
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/**
 * Require a valid session, optionally restricted to a set of roles.
 *
 * Also confirms the session's userId still exists in the database — a
 * cookie signed before a database reset/reseed (or a deleted user) would
 * otherwise pass signature verification but reference rows that no longer
 * exist, and every downstream query keyed on that id (recordAudit's actorId
 * FK, company-scoped lookups, ...) would fail with a raw "record not found"
 * error instead of a clean "please log in again".
 */
export async function requireUser(allowedRoles?: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError("Not authenticated", 401);

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    await clearSessionCookie();
    throw new AuthError("Session expired — please log in again.", 401);
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AuthError("Not authorized for this action", 403);
  }
  return session;
}

export async function recordAudit(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata as never,
    },
  });
}
