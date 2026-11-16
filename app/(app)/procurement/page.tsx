"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, formatCurrency, formatDate, formatNumber } from "@/lib/client";
import { Card, PageHeader, StatusBadge, Table, THead, Th, Td, ErrorBanner, Spinner, Button, EmptyState } from "@/components/ui";

type Supplier = {
  id: string;
  code: string;
  name: string;
  reliability: number;
  qualityScore: number;
  materials: { rawMaterialId: string; rawMaterialName: string; unitPrice: number; leadTimeDays: number; minOrderQty: number }[];
};
type PurchaseOrder = {
  id: string;
  poNumber: string;
  supplier: string;
  status: string;
  totalCost: number;
  expectedDate: string;
  receivedAt: string | null;
  lines: { material: string; quantity: number; unitPrice: number }[];
};

export default function ProcurementPage() {
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([apiGet<{ suppliers: Supplier[] }>("/api/suppliers"), apiGet<{ purchaseOrders: PurchaseOrder[] }>("/api/purchase-orders")]);
      setSuppliers(s.suppliers);
      setOrders(o.purchaseOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load procurement data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function receive(id: string) {
    setBusyId(id);
    try {
      await apiPost(`/api/purchase-orders/${id}/receive`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive order");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!suppliers || !orders)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Procurement" description="Suppliers, purchase orders and receiving (§7 Procurement)." />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Purchase orders</h2>
        {orders.length === 0 ? (
          <EmptyState>No purchase orders yet — approve a recommendation on the Approvals page to generate one.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>PO #</Th>
                <Th>Supplier</Th>
                <Th>Lines</Th>
                <Th>Total cost</Th>
                <Th>Status</Th>
                <Th>Expected</Th>
                <Th />
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((po) => (
                <tr key={po.id}>
                  <Td className="font-mono text-xs">{po.poNumber}</Td>
                  <Td className="font-medium text-slate-900">{po.supplier}</Td>
                  <Td className="text-xs">{po.lines.map((l) => `${formatNumber(l.quantity)} × ${l.material}`).join(", ")}</Td>
                  <Td>{formatCurrency(po.totalCost)}</Td>
                  <Td>
                    <StatusBadge status={po.status} />
                  </Td>
                  <Td>{formatDate(po.expectedDate)}</Td>
                  <Td>
                    {po.status === "ORDERED" && (
                      <Button variant="secondary" disabled={busyId === po.id} onClick={() => receive(po.id)}>
                        {busyId === po.id ? "..." : "Receive goods"}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Suppliers</h2>
        <Table>
          <THead>
            <tr>
              <Th>Supplier</Th>
              <Th>Reliability</Th>
              <Th>Quality</Th>
              <Th>Materials supplied</Th>
            </tr>
          </THead>
          <tbody className="divide-y divide-slate-100">
            {suppliers.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium text-slate-900">
                  {s.name} <span className="text-xs text-slate-400">({s.code})</span>
                </Td>
                <Td>{Math.round(s.reliability * 100)}%</Td>
                <Td>{Math.round(s.qualityScore * 100)}%</Td>
                <Td className="text-xs">{s.materials.map((m) => `${m.rawMaterialName} ($${m.unitPrice}, ${m.leadTimeDays}d)`).join(", ")}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
