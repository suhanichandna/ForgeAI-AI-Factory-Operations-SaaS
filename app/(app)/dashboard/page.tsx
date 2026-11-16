"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { apiGet, formatCurrency, formatDate } from "@/lib/client";
import { Card, PageHeader, RiskBadge, StatCard, Table, THead, Th, Td, EmptyState, ErrorBanner, Spinner } from "@/components/ui";

type Dashboard = {
  kpis: { materialCount: number; inventoryValue: number; openProductionOrders: number; pendingApprovals: number; machinesNeedingAttention: number };
  riskBreakdown: { high: number; medium: number; low: number };
  topRisks: { id: string; name: string; riskLevel: string; daysUntilStockout: number | null }[];
  pendingRecommendations: { id: string; material: string; supplier: string; quantity: number; estimatedCost: number; riskLevel: string; reason: string }[];
  recentActivity: { id: string; action: string; summary: string; actor: string; createdAt: string }[];
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<Dashboard>("/api/dashboard"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
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
    <div>
      <PageHeader title="Executive Dashboard" description="KPIs, alerts, stockout risk and production status across the factory." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Raw Materials" value={data.kpis.materialCount} />
        <StatCard label="Inventory Value" value={formatCurrency(data.kpis.inventoryValue)} />
        <StatCard label="Open Production Orders" value={data.kpis.openProductionOrders} />
        <StatCard label="Pending Approvals" value={data.kpis.pendingApprovals} tone={data.kpis.pendingApprovals > 0 ? "warn" : "good"} />
        <StatCard label="Machines Needing Attention" value={data.kpis.machinesNeedingAttention} tone={data.kpis.machinesNeedingAttention > 0 ? "danger" : "good"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Materials at risk</h2>
            <Link href="/inventory" className="text-xs font-medium text-slate-500 hover:text-slate-800">
              View inventory →
            </Link>
          </div>
          {data.topRisks.length === 0 ? (
            <EmptyState>No material is above safety-stock risk right now.</EmptyState>
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Material</Th>
                  <Th>Risk</Th>
                  <Th>Days to stockout</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {data.topRisks.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium text-slate-900">{r.name}</Td>
                    <Td>
                      <RiskBadge level={r.riskLevel} />
                    </Td>
                    <Td>{r.daysUntilStockout ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
          </div>
          {data.recentActivity.length === 0 ? (
            <EmptyState>No activity yet.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="text-xs">
                  <p className="text-slate-700">{a.summary}</p>
                  <p className="mt-0.5 text-slate-400">
                    {a.actor} · {formatDate(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Pending AI recommendations</h2>
          <Link href="/approvals" className="text-xs font-medium text-slate-500 hover:text-slate-800">
            Go to approvals →
          </Link>
        </div>
        {data.pendingRecommendations.length === 0 ? (
          <EmptyState>Nothing is waiting on approval.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.pendingRecommendations.map((r) => (
              <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900">
                    {r.quantity} × {r.material} from {r.supplier}
                  </p>
                  <RiskBadge level={r.riskLevel} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{r.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
