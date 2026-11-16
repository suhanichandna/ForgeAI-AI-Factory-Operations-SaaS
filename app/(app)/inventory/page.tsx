"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { apiGet, apiPost, formatCurrency, formatDate, formatNumber } from "@/lib/client";
import { Card, PageHeader, RiskBadge, Table, THead, Th, Td, ErrorBanner, Spinner, Button } from "@/components/ui";

type Material = {
  id: string;
  code: string;
  name: string;
  unit: string;
  safetyStock: number;
  standardCost: number;
  onHand: number;
  reserved: number;
  available: number;
  riskLevel: string;
  stockoutDate: string | null;
  daysUntilStockout: number | null;
  reorderPoint: number;
  byWarehouse: { warehouse: string; onHand: number; reserved: number }[];
};

export default function InventoryPage() {
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ materials: Material[] }>("/api/inventory");
      setMaterials(data.materials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function generateRecommendation(id: string) {
    setBusyId(id);
    try {
      await apiPost("/api/recommendations", { rawMaterialId: id });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate recommendation");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!materials)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels, warehouses, transactions and stockout risk (§10.2 risk engine)." />
      <Card>
        <Table>
          <THead>
            <tr>
              <Th>Material</Th>
              <Th>On hand</Th>
              <Th>Reserved</Th>
              <Th>Available</Th>
              <Th>Safety stock</Th>
              <Th>Reorder point</Th>
              <Th>Risk</Th>
              <Th>Stockout ETA</Th>
              <Th />
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {materials.map((m) => (
              <Fragment key={m.id}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  <Td className="font-medium text-slate-900">
                    {m.name} <span className="text-xs text-slate-400">({m.code})</span>
                  </Td>
                  <Td>
                    {formatNumber(m.onHand)} {m.unit}
                  </Td>
                  <Td>{formatNumber(m.reserved)}</Td>
                  <Td>{formatNumber(m.available)}</Td>
                  <Td>{formatNumber(m.safetyStock)}</Td>
                  <Td>{formatNumber(m.reorderPoint)}</Td>
                  <Td>
                    <RiskBadge level={m.riskLevel} />
                  </Td>
                  <Td>{m.stockoutDate ? `${formatDate(m.stockoutDate)} (${m.daysUntilStockout}d)` : "—"}</Td>
                  <Td>
                    {m.riskLevel !== "LOW" && (
                      <Button
                        variant="secondary"
                        disabled={busyId === m.id}
                        onClick={() => generateRecommendation(m.id)}
                      >
                        {busyId === m.id ? "..." : "Generate recommendation"}
                      </Button>
                    )}
                  </Td>
                </tr>
                {expanded === m.id && (
                  <tr className="bg-slate-50">
                    <Td className="text-xs text-slate-500" colSpan={9}>
                      <div className="flex flex-wrap gap-4 py-1">
                        {m.byWarehouse.map((w, i) => (
                          <span key={i}>
                            <strong className="text-slate-700">{w.warehouse}:</strong> {formatNumber(w.onHand)} on hand, {formatNumber(w.reserved)} reserved
                          </span>
                        ))}
                        <span>
                          <strong className="text-slate-700">Standard cost:</strong> {formatCurrency(m.standardCost)}/{m.unit}
                        </span>
                      </div>
                    </Td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
