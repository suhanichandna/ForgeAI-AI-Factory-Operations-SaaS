"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, formatDate } from "@/lib/client";
import { Card, PageHeader, StatusBadge, ErrorBanner, Spinner } from "@/components/ui";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Machine = {
  id: string;
  code: string;
  name: string;
  status: string;
  healthScore: number;
  maintenanceRecommended: boolean;
  latest: { temperature: number; vibration: number; pressure: number; rpm: number; powerDraw: number; recordedAt: string } | null;
};
type Reading = { recordedAt: string; anomalyScore: number; temperature: number; vibration: number };

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [readings, setReadings] = useState<Reading[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ machines: Machine[] }>("/api/machines");
      setMachines(data.machines);
      if (!selected && data.machines.length > 0) setSelected(data.machines[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load machines");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;
    apiGet<{ readings: Reading[] }>(`/api/machines/${selected}/health`)
      .then((d) => setReadings(d.readings))
      .catch(() => setReadings(null));
  }, [selected]);

  if (error) return <ErrorBanner message={error} />;
  if (!machines)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div>
      <PageHeader title="Machines" description="Machine status, telemetry and maintenance risk (§14 — statistical anomaly detector standing in for Isolation Forest)." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {machines.map((m) => (
          <button key={m.id} onClick={() => setSelected(m.id)} className="text-left">
            <Card className={selected === m.id ? "ring-2 ring-slate-900" : ""}>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{m.name}</h3>
                <StatusBadge status={m.status} />
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{m.healthScore}</p>
              <p className="text-xs text-slate-400">Health score</p>
              {m.maintenanceRecommended && <p className="mt-2 text-xs font-medium text-red-600">Maintenance recommended</p>}
              {m.latest && <p className="mt-2 text-xs text-slate-400">Last reading {formatDate(m.latest.recordedAt)}</p>}
            </Card>
          </button>
        ))}
      </div>

      {readings && readings.length > 0 && (
        <Card className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Anomaly score — last 7 days ({machines.find((m) => m.id === selected)?.name})</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={readings.filter((_, i) => i % 4 === 0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="recordedAt" tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" })} fontSize={11} />
              <YAxis domain={[0, 1]} fontSize={11} />
              <Tooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} />
              <Line type="monotone" dataKey="anomalyScore" stroke="#dc2626" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
