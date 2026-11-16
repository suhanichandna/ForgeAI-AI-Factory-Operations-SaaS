"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/client";
import { Button, ErrorBanner } from "@/components/ui";

const DEMO_LOGINS = [
  { role: "Factory Admin", email: "admin@forgeai.demo" },
  { role: "Production Manager", email: "production@forgeai.demo" },
  { role: "Inventory Manager", email: "inventory@forgeai.demo" },
  { role: "Procurement Manager", email: "procurement@forgeai.demo" },
  { role: "Management", email: "management@forgeai.demo" },
  { role: "Employee", email: "employee@forgeai.demo" },
];
const DEMO_PASSWORD = "ForgeAI123!";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("management@forgeai.demo");
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiPost("/api/auth/login", { email, password });
      router.push(params.get("next") ?? "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg md:grid-cols-2">
        <div className="flex flex-col justify-center bg-slate-900 p-10 text-white">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">ForgeAI</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">AI Factory Operations</h1>
          <p className="mt-4 text-sm text-slate-300">
            Inventory → production → procurement → supplier selection → approval → purchase, with AI continuously
            watching for stockout risk.
          </p>
          <div className="mt-8 rounded-lg bg-white/5 p-4 text-xs text-slate-300">
            <p className="font-medium text-slate-200">Demo accounts (password: {DEMO_PASSWORD})</p>
            <ul className="mt-2 space-y-1">
              {DEMO_LOGINS.map((d) => (
                <li key={d.email} className="flex justify-between gap-3">
                  <span>{d.role}</span>
                  <button type="button" className="font-mono text-slate-100 underline decoration-dotted" onClick={() => setEmail(d.email)}>
                    {d.email}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col justify-center gap-4 p-10">
          <h2 className="text-lg font-semibold text-slate-900">Sign in</h2>
          {error && <ErrorBanner message={error} />}
          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </label>
          <Button type="submit" disabled={loading} className="mt-2 w-full justify-center">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
