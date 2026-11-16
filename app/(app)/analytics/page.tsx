"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPost, formatCurrency, formatNumber } from "@/lib/client";
import { Card, PageHeader, StatCard, RiskBadge, Button, ErrorBanner, Spinner } from "@/components/ui";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type InventoryAnalytics = { materialCount: number; riskBreakdown: { high: number; medium: number; low: number }; inventoryValue: number; excessInventoryValue: number; issuedLast90Days: number };
type ProductionAnalytics = { totalOrders: number; byStatus: Record<string, number>; onTimeCompletionRate: number | null };
type Product = { id: string; name: string };
type ForecastPoint = { date: string; quantity: number };
type Accuracy = { mae: number; rmse: number; mape: number; r2: number; n: number };
type DemoResult = {
  product: { name: string };
  productionOrder: { orderNumber: string; quantity: number };
  reservationOk: boolean;
  materialResults: { rawMaterialName: string; riskBefore: string; riskAfter: string }[];
};

export default function AnalyticsPage() {
  const [inv, setInv] = useState<InventoryAnalytics | null>(null);
  const [prod, setProd] = useState<ProductionAnalytics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [history, setHistory] = useState<ForecastPoint[]>([]);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [accuracy, setAccuracy] = useState<Accuracy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [demoProduct, setDemoProduct] = useState("");
  const [uplift, setUplift] = useState(30);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, p, prods] = await Promise.all([
        apiGet<InventoryAnalytics>("/api/analytics/inventory"),
        apiGet<ProductionAnalytics>("/api/analytics/production"),
        apiGet<{ products: Product[] }>("/api/products"),
      ]);
      setInv(i);
      setProd(p);
      setProducts(prods.products);
      if (prods.products.length > 0) {
        setSelectedProduct((s) => s || prods.products[0].id);
        setDemoProduct((s) => s || prods.products[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadForecast = useCallback(async (productId: string) => {
    if (!productId) return;
    const data = await apiGet<{ forecast: ForecastPoint[]; history: ForecastPoint[] }>(`/api/ai/forecast?productId=${productId}`);
    setForecast(data.forecast);
    setHistory(data.history.slice(-60));
  }, []);

  useEffect(() => {
    loadForecast(selectedProduct);
  }, [selectedProduct, loadForecast]);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ forecast: ForecastPoint[]; accuracy: Accuracy }>("/api/ai/forecast", { productId: selectedProduct });
      setForecast(result.forecast);
      setAccuracy(result.accuracy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate forecast");
    } finally {
      setBusy(false);
    }
  }

  async function runDemo() {
    setDemoBusy(true);
    setError(null);
    setDemoResult(null);
    try {
      const result = await apiPost<DemoResult>("/api/demo/trigger", { productId: demoProduct, upliftPercent: uplift });
      setDemoResult(result);
      await load();
      await loadForecast(selectedProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo trigger failed");
    } finally {
      setDemoBusy(false);
    }
  }

  const chartData = [...history.map((h) => ({ date: h.date.slice(0, 10), actual: h.quantity })), ...forecast.map((f) => ({ date: f.date.slice(0, 10), forecast: f.quantity }))];

  if (error) return <ErrorBanner message={error} />;
  if (!inv || !prod)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Forecasts, trends, inventory and production metrics (§21 Evaluation Metrics)." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Inventory value" value={formatCurrency(inv.inventoryValue)} />
        <StatCard label="Excess inventory value" value={formatCurrency(inv.excessInventoryValue)} />
        <StatCard label="Issued (last 90d)" value={formatNumber(inv.issuedLast90Days)} />
        <StatCard label="On-time production" value={prod.onTimeCompletionRate != null ? `${prod.onTimeCompletionRate}%` : "—"} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Demand forecast</h2>
          <div className="flex items-center gap-2">
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" disabled={busy} onClick={regenerate}>
              {busy ? "Running..." : "Regenerate + backtest"}
            </Button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" fontSize={10} minTickGap={30} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="actual" name="Historical sales" stroke="#0f172a" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#2563eb" dot={false} strokeWidth={2} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
        {accuracy && accuracy.n > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <span className="text-slate-400">MAE</span> <span className="font-medium">{accuracy.mae.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400">RMSE</span> <span className="font-medium">{accuracy.rmse.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-400">MAPE</span> <span className="font-medium">{accuracy.mape.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-slate-400">R²</span> <span className="font-medium">{accuracy.r2.toFixed(2)}</span>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Demo scenario: simulate a demand shock</h2>
        <p className="mb-3 text-xs text-slate-500">
          §20 demonstration scenario — books a real production order for the uplift, reruns the forecast, and recomputes stockout risk and supplier
          recommendations for every material this product uses.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            Product
            <select value={demoProduct} onChange={(e) => setDemoProduct(e.target.value)} className="mt-1 block w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm">
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Demand uplift %
            <input type="number" value={uplift} onChange={(e) => setUplift(Number(e.target.value))} className="mt-1 block w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <Button disabled={demoBusy} onClick={runDemo}>
            {demoBusy ? "Running scenario..." : "Trigger demand shock"}
          </Button>
        </div>
        {demoResult && (
          <div className="mt-4 rounded-lg border border-slate-200 p-3 text-xs">
            <p className="font-medium text-slate-700">
              {demoResult.product.name}: production order {demoResult.productionOrder.orderNumber} for {demoResult.productionOrder.quantity} units{" "}
              {demoResult.reservationOk ? "(fully reserved)" : "(short — see inventory)"}
            </p>
            <ul className="mt-2 space-y-1">
              {demoResult.materialResults.map((m, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-40 text-slate-600">{m.rawMaterialName}</span>
                  <RiskBadge level={m.riskBefore} /> <span className="text-slate-400">→</span> <RiskBadge level={m.riskAfter} />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-slate-500">Check the Approvals page — a manager can now review and approve the resulting purchase recommendation.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
