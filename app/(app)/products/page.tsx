"use client";

import { useEffect, useState, useCallback } from "react";
import { apiGet, formatCurrency, formatNumber } from "@/lib/client";
import { Card, PageHeader, Table, THead, Th, Td, ErrorBanner, Spinner } from "@/components/ui";

type Product = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  onHand: number;
  bom: { rawMaterialId: string; rawMaterialName: string; unit: string; quantityPerUnit: number }[];
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ products: Product[] }>("/api/products");
      setProducts(data.products);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorBanner message={error} />;
  if (!products)
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div>
      <PageHeader title="Products & BOM" description="Finished products and the raw materials each unit requires (§7 Production Management)." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-400">
                  {p.sku} · {formatCurrency(p.unitPrice)} / {p.unit}
                </p>
              </div>
              <span className="text-xs text-slate-500">{formatNumber(p.onHand)} in stock</span>
            </div>
            <Table>
              <THead>
                <tr>
                  <Th>Material</Th>
                  <Th>Qty per unit</Th>
                </tr>
              </THead>
              <tbody className="divide-y divide-slate-100">
                {p.bom.map((b) => (
                  <tr key={b.rawMaterialId}>
                    <Td>{b.rawMaterialName}</Td>
                    <Td>
                      {formatNumber(b.quantityPerUnit, 2)} {b.unit}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
    </div>
  );
}
