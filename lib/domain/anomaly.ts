/**
 * Machine anomaly detection — §12 lists Isolation Forest / a supervised
 * model over sensor telemetry. This prototype stands in a statistical
 * multivariate z-score detector: no ML dependency required, same inputs
 * (temperature, vibration, pressure, rpm, power draw) and output shape
 * (a 0..1 anomaly score) as the blueprint's `MachineSensorData.anomalyScore`.
 * Swapping in a trained Isolation Forest later is a drop-in replacement for
 * `scoreReading`.
 */

export type SensorReading = {
  temperature: number;
  vibration: number;
  pressure: number;
  rpm: number;
  powerDraw: number;
};

export type SensorBaseline = Record<keyof SensorReading, { mean: number; stdDev: number }>;

export function computeBaseline(history: SensorReading[]): SensorBaseline {
  const fields: (keyof SensorReading)[] = ["temperature", "vibration", "pressure", "rpm", "powerDraw"];
  const baseline = {} as SensorBaseline;
  for (const field of fields) {
    const values = history.map((h) => h[field]);
    const m = mean(values);
    const sd = Math.max(stdDev(values, m), 1e-6); // avoid divide-by-zero on constant series
    baseline[field] = { mean: m, stdDev: sd };
  }
  return baseline;
}

/**
 * Scores a reading against a machine's healthy baseline using the max
 * absolute z-score across sensors, squashed into 0..1 via a logistic curve
 * centered at z = 3 (the conventional "notable outlier" threshold).
 */
export function scoreReading(reading: SensorReading, baseline: SensorBaseline): number {
  const fields = Object.keys(reading) as (keyof SensorReading)[];
  const zScores = fields.map((f) => Math.abs((reading[f] - baseline[f].mean) / baseline[f].stdDev));
  const maxZ = Math.max(...zScores);
  return 1 / (1 + Math.exp(-(maxZ - 3)));
}

export function healthScoreFromAnomalyScores(recentScores: number[]): number {
  if (recentScores.length === 0) return 100;
  const avg = mean(recentScores);
  return Math.round(clamp(100 - avg * 100, 0, 100));
}

export function maintenanceRecommended(recentScores: number[], threshold = 0.6): boolean {
  const highCount = recentScores.filter((s) => s >= threshold).length;
  return highCount >= Math.max(2, Math.ceil(recentScores.length * 0.2));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stdDev(values: number[], m: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
