"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, formatDate } from "@/lib/client";
import { Card, PageHeader, Table, THead, Th, Td, ErrorBanner, Spinner } from "@/components/ui";

type SettingsData = {
  company: { name: string };
  factories: { id: string; name: string; location: string; warehouseCount: number; machineCount: number }[];
  users: { id: string; name: string; email: string; role: string }[];
};
type AuditLog = { id: string; action: string; summary: string; actor: string; createdAt: string };

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<SettingsData>("/api/users"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    }
    try {
      const logData = await apiGet<{ logs: AuditLog[] }>("/api/audit-logs?limit=25");
      setLogs(logData.logs);
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : "Audit log unavailable");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorBanner message={error} />;
  if (!data)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Users, roles and factory configuration (§16: RBAC + tenant isolation)." />

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">{data.company.name}</h2>
        {data.factories.map((f) => (
          <p key={f.id} className="text-xs text-slate-500">
            {f.name} — {f.location} · {f.warehouseCount} warehouses · {f.machineCount} machines
          </p>
        ))}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Users</h2>
        <Table>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {data.users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium text-slate-900">{u.name}</Td>
                <Td className="font-mono text-xs">{u.email}</Td>
                <Td>{u.role.replace(/_/g, " ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Audit log</h2>
        {logsError ? (
          <p className="text-xs text-slate-400">{logsError} (visible to Factory Admin and Management)</p>
        ) : !logs ? (
          <Spinner />
        ) : (
          <ul className="space-y-2 text-xs">
            {logs.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 border-b border-slate-50 pb-2">
                <span className="text-slate-700">{l.summary}</span>
                <span className="shrink-0 text-slate-400">
                  {l.actor} · {formatDate(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
