"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, apiPatch, formatDate, formatNumber } from "@/lib/client";
import { Card, PageHeader, StatusBadge, Table, THead, Th, Td, ErrorBanner, Spinner, Button, EmptyState } from "@/components/ui";

type Order = { id: string; orderNumber: string; productId: string; productName: string; quantity: number; status: string; dueDate: string; createdAt: string };
type Product = { id: string; name: string; sku: string };

export default function ProductionPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: "", quantity: 10, dueDate: "" });
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([apiGet<{ orders: Order[] }>("/api/production/orders"), apiGet<{ products: Product[] }>("/api/products")]);
      setOrders(ordersRes.orders);
      setProducts(productsRes.products);
      if (!form.productId && productsRes.products.length > 0) setForm((f) => ({ ...f, productId: productsRes.products[0].id }));
      if (!form.dueDate) {
        const d = new Date();
        d.setDate(d.getDate() + 14);
        setForm((f) => ({ ...f, dueDate: d.toISOString().slice(0, 10) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load production data");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiPost<{ reservationOk: boolean; shortages: { rawMaterialName: string; shortfall: number; unit?: string }[] }>("/api/production/orders", form);
      setNotice(result.reservationOk ? "Production order created and materials reserved." : `Order created but held: shortage of ${result.shortages.map((s) => s.rawMaterialName).join(", ")}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  async function transition(id: string, status: string) {
    setBusyId(id);
    try {
      await apiPatch(`/api/production/orders/${id}`, { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!orders)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div>
      <PageHeader title="Production" description="Production orders, BOM-based material requirements, and reservation (§6 step 3)." />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">New production order</h2>
        <form onSubmit={createOrder} className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Product
            <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Quantity
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
              className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            Due date
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create order"}
          </Button>
        </form>
        {notice && <p className="mt-3 text-xs text-slate-500">{notice}</p>}
      </Card>

      <Card>
        {orders.length === 0 ? (
          <EmptyState>No production orders yet.</EmptyState>
        ) : (
          <Table>
            <THead>
              <tr>
                <Th>Order #</Th>
                <Th>Product</Th>
                <Th>Quantity</Th>
                <Th>Status</Th>
                <Th>Due date</Th>
                <Th />
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.orderNumber}</Td>
                  <Td className="font-medium text-slate-900">{o.productName}</Td>
                  <Td>{formatNumber(o.quantity)}</Td>
                  <Td>
                    <StatusBadge status={o.status} />
                  </Td>
                  <Td>{formatDate(o.dueDate)}</Td>
                  <Td>
                    <div className="flex gap-2">
                      {(o.status === "RELEASED" || o.status === "IN_PROGRESS") && (
                        <Button variant="secondary" disabled={busyId === o.id} onClick={() => transition(o.id, "COMPLETED")}>
                          Complete
                        </Button>
                      )}
                      {(o.status === "PLANNED" || o.status === "RELEASED") && (
                        <Button variant="ghost" disabled={busyId === o.id} onClick={() => transition(o.id, "CANCELLED")}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
