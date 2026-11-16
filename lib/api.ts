import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth";

/** Wraps a route handler so AuthError and unexpected errors become consistent JSON responses (§16: input validation on every endpoint). */
export function withErrorHandling<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      const message = err instanceof Error ? err.message : "Internal server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
