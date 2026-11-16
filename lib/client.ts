"use client";

/** Thin fetch wrapper for client components: same-origin, cookie session, JSON in/out, error surfacing. */
export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : null;
  if (!res.ok) {
    const message = (body && typeof body === "object" && "error" in body ? (body as { error: string }).error : null) ?? `Request failed (${res.status})`;
    if (res.status === 401 && typeof window !== "undefined") {
      // Session is gone or stale (e.g. the database was reset/reseeded under
      // an active login) — bounce to login instead of leaving the page
      // stuck on a raw error banner every subsequent request would repeat.
      window.location.href = "/login";
    }
    throw new Error(message);
  }
  return body as T;
}

export function apiGet<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "GET" });
}

export function apiPost<T = unknown>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiPatch<T = unknown>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(value);
}
