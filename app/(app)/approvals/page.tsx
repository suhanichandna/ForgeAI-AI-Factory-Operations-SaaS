"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, formatCurrency, formatDate, formatNumber } from "@/lib/client";
import { Card, PageHeader, RiskBadge, StatusBadge, ErrorBanner, Spinner, Button, EmptyState } from "@/components/ui";

type Recommendation = {
  id: string;
  material: string;
  unit: string;
  supplier: string;
  quantity: number;
  estimatedCost: number;
  riskLevel: string;
  stockoutDate: string | null;
  reason: string;
  status: string;
  createdAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  detail: {
    rankedSuppliers?: { supplierName: string; score: number; unitPrice: number; leadTimeDays: number; reliability: number; qualityScore: number }[];
    projectionSample?: { date: string; projectedInventory: number; belowSafetyStock: boolean }[];
  } | null;
};

export default function ApprovalsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ recommendations: Recommendation[] }>("/api/recommendations");
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recommendations");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      await apiPost(`/api/recommendations/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action}`);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!recommendations)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  const visible = showAll ? recommendations : recommendations.filter((r) => r.status === "PENDING");

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="AI-generated purchase recommendations awaiting human approval (§13: high-impact actions stay behind explicit approval)."
        actions={
          <Button variant="secondary" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show pending only" : "Show all history"}
          </Button>
        }
      />
      {visible.length === 0 ? (
        <EmptyState>{showAll ? "No recommendations yet." : "Nothing pending approval right now."}</EmptyState>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {formatNumber(r.quantity)} × {r.material} from {r.supplier}
                    </h3>
                    <RiskBadge level={r.riskLevel} />
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Estimated cost {formatCurrency(r.estimatedCost)} · Created {formatDate(r.createdAt)}
                    {r.decidedBy && ` · Decided by ${r.decidedBy} on ${formatDate(r.decidedAt)}`}
                  </p>
                  <button className="mt-2 text-xs font-medium text-slate-500 underline decoration-dotted" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    {expanded === r.id ? "Hide reasoning" : "Why this recommendation?"}
                  </button>
                </div>
                {r.status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Button disabled={busyId === r.id} onClick={() => decide(r.id, "approve")}>
                      Approve
                    </Button>
                    <Button variant="secondary" disabled={busyId === r.id} onClick={() => decide(r.id, "reject")}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              {expanded === r.id && r.detail && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-xs md:grid-cols-2">
                  {r.detail.rankedSuppliers && (
                    <div>
                      <p className="mb-1 font-semibold text-slate-700">Supplier ranking</p>
                      <ul className="space-y-1">
                        {r.detail.rankedSuppliers.map((s, i) => (
                          <li key={i} className="flex justify-between text-slate-500">
                            <span>
                              {i + 1}. {s.supplierName}
                            </span>
                            <span>
                              score {s.score.toFixed(2)} · ${s.unitPrice} · {s.leadTimeDays}d
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {r.detail.projectionSample && (
                    <div>
                      <p className="mb-1 font-semibold text-slate-700">Projected inventory (next 14 days)</p>
                      <ul className="space-y-0.5">
                        {r.detail.projectionSample.map((p, i) => (
                          <li key={i} className={`flex justify-between ${p.belowSafetyStock ? "text-red-600" : "text-slate-500"}`}>
                            <span>{p.date}</span>
                            <span>{formatNumber(p.projectedInventory, 1)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
