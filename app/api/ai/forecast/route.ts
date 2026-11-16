import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { withErrorHandling } from "@/lib/api";
import { forecastDailyDemand, backtestForecast, type HistoryPoint } from "@/lib/domain/forecast";

/** §12.1 Forecasting Pipeline / §11 GET+POST /api/ai/forecast */
export const GET = withErrorHandling(async (req: NextRequest) => {
  await requireUser();
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const forecasts = await prisma.forecast.findMany({ where: { productId }, orderBy: { forecastDate: "asc" } });
  const history = await getHistory(productId);
  return NextResponse.json({
    forecast: forecasts.map((f) => ({ date: f.forecastDate, quantity: f.quantity, model: f.model })),
    history: history.map((h) => ({ date: h.date, quantity: h.quantity })),
  });
});

/** Regenerates and persists the 30-day demand forecast, and reports a backtest accuracy score (§21: MAE/RMSE/MAPE/R²). */
export const POST = withErrorHandling(async (req: NextRequest) => {
  await requireUser();
  const body = await req.json();
  const productId = body?.productId as string;
  const horizonDays = (body?.horizonDays as number) ?? 30;
  if (!productId) return NextResponse.json({ error: "productId is required" }, { status: 400 });

  const history = await getHistory(productId);
  const points = forecastDailyDemand(history, horizonDays);
  const accuracy = backtestForecast(history, 30);

  await prisma.$transaction(
    points.map((p) =>
      prisma.forecast.upsert({
        where: { productId_forecastDate: { productId, forecastDate: p.date } },
        update: { quantity: round2(p.quantity), model: "seasonal-naive" },
        create: { productId, forecastDate: p.date, quantity: round2(p.quantity), model: "seasonal-naive" },
      }),
    ),
  );

  return NextResponse.json({ forecast: points.map((p) => ({ date: p.date, quantity: round2(p.quantity) })), accuracy });
});

async function getHistory(productId: string): Promise<HistoryPoint[]> {
  const lines = await prisma.salesOrderLine.findMany({ where: { productId }, include: { salesOrder: true } });
  const byDay = new Map<string, number>();
  for (const line of lines) {
    const key = line.salesOrder.orderDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + line.quantity);
  }
  return Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, quantity]) => ({ date: new Date(date), quantity }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
