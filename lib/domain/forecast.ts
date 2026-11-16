/**
 * Demand forecasting — §12 / §12.1 of the blueprint.
 *
 * The blueprint recommends XGBoost / a time-series baseline for demand
 * forecasting and is explicit that an LLM should not be used for numerical
 * forecasting. This prototype ships the "baseline" half of that pipeline —
 * a seasonal-naive model with a trend adjustment — computed directly in
 * TypeScript so the whole stack runs without a separate Python ML service.
 * Swapping in a trained XGBoost model later only means replacing the body
 * of `forecastDailyDemand`; callers and storage (`Forecast` table) don't change.
 */

export type HistoryPoint = { date: Date; quantity: number };
export type ForecastPoint = { date: Date; quantity: number };

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function dayOfWeek(d: Date): number {
  return d.getUTCDay();
}

/**
 * Seasonal-naive forecast with trend correction:
 *  1. Group historical demand by weekday, take a recency-weighted average
 *     per weekday (captures weekly seasonality, e.g. weekday vs weekend).
 *  2. Compare the mean of the most recent 4 weeks against the mean of the
 *     4 weeks before that to derive a simple trend multiplier.
 *  3. Apply weekday average × trend multiplier for each future day.
 */
export function forecastDailyDemand(history: HistoryPoint[], horizonDays: number): ForecastPoint[] {
  if (history.length === 0) {
    return [];
  }
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const lastDate = sorted[sorted.length - 1].date;

  const byWeekday: number[][] = Array.from({ length: 7 }, () => []);
  for (const point of sorted) {
    byWeekday[dayOfWeek(point.date)].push(point.quantity);
  }

  const weekdayAverage = byWeekday.map((values) => {
    if (values.length === 0) return 0;
    // Recency-weighted: most recent observations count more.
    let weightedSum = 0;
    let weightTotal = 0;
    values.forEach((v, i) => {
      const weight = i + 1; // later entries (more recent, since sorted asc within weekday) weigh more
      weightedSum += v * weight;
      weightTotal += weight;
    });
    return weightTotal > 0 ? weightedSum / weightTotal : 0;
  });

  const recentWindow = sorted.slice(-28);
  const priorWindow = sorted.slice(-56, -28);
  const recentMean = mean(recentWindow.map((p) => p.quantity));
  const priorMean = mean(priorWindow.map((p) => p.quantity));
  const trendMultiplier = priorMean > 0 ? clamp(recentMean / priorMean, 0.5, 2.0) : 1;

  const points: ForecastPoint[] = [];
  for (let i = 1; i <= horizonDays; i++) {
    const date = addDays(lastDate, i);
    const base = weekdayAverage[dayOfWeek(date)] || mean(sorted.map((p) => p.quantity));
    points.push({ date, quantity: Math.max(0, base * trendMultiplier) });
  }
  return points;
}

/**
 * Applies a manual demand-shock multiplier to an already-computed forecast —
 * used by the §20 demo scenario ("trigger a 30% demand increase").
 */
export function applyDemandShock(forecast: ForecastPoint[], multiplier: number): ForecastPoint[] {
  return forecast.map((p) => ({ date: p.date, quantity: p.quantity * multiplier }));
}

export type ForecastAccuracy = { mae: number; rmse: number; mape: number; r2: number; n: number };

/** §21 Evaluation Metrics: MAE, RMSE, MAPE, R² via a hold-out backtest. */
export function evaluateForecast(actual: number[], predicted: number[]): ForecastAccuracy {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return { mae: 0, rmse: 0, mape: 0, r2: 0, n: 0 };

  let absErrSum = 0;
  let sqErrSum = 0;
  let pctErrSum = 0;
  let pctCount = 0;

  for (let i = 0; i < n; i++) {
    const err = actual[i] - predicted[i];
    absErrSum += Math.abs(err);
    sqErrSum += err * err;
    if (actual[i] !== 0) {
      pctErrSum += Math.abs(err / actual[i]);
      pctCount++;
    }
  }

  const actualMean = mean(actual.slice(0, n));
  const ssTot = actual.slice(0, n).reduce((s, v) => s + (v - actualMean) ** 2, 0);
  const ssRes = sqErrSum;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return {
    mae: absErrSum / n,
    rmse: Math.sqrt(sqErrSum / n),
    mape: pctCount > 0 ? (pctErrSum / pctCount) * 100 : 0,
    r2,
    n,
  };
}

/** Backtest the model: train on all but the last `holdoutDays`, forecast that window, score it. */
export function backtestForecast(history: HistoryPoint[], holdoutDays: number): ForecastAccuracy {
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  if (sorted.length <= holdoutDays + 7) return { mae: 0, rmse: 0, mape: 0, r2: 0, n: 0 };

  const train = sorted.slice(0, sorted.length - holdoutDays);
  const holdout = sorted.slice(sorted.length - holdoutDays);

  const predicted = forecastDailyDemand(train, holdoutDays);
  const actualByDate = new Map(holdout.map((p) => [p.date.toISOString().slice(0, 10), p.quantity]));
  const predictedAligned: number[] = [];
  const actualAligned: number[] = [];
  for (const p of predicted) {
    const key = p.date.toISOString().slice(0, 10);
    if (actualByDate.has(key)) {
      predictedAligned.push(p.quantity);
      actualAligned.push(actualByDate.get(key)!);
    }
  }
  return evaluateForecast(actualAligned, predictedAligned);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
