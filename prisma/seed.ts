/**
 * Seed script — builds a complete, internally-consistent synthetic factory
 * dataset (§23 "Synthetic or anonymized manufacturing dataset" + "Database
 * seed data"): one company, one factory, six users (one per §5 role), raw
 * materials, products with BOMs, suppliers, warehouses, ~9 months of daily
 * sales history, machine telemetry, and an initial demand forecast.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, Role, TransactionType } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { forecastDailyDemand, type HistoryPoint } from "../lib/domain/forecast";
import { computeBaseline, scoreReading, type SensorReading } from "../lib/domain/anomaly";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// Deterministic PRNG (mulberry32) so re-seeding always produces the same demo data.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260101);
const randRange = (min: number, max: number) => min + rand() * (max - min);
const randInt = (min: number, max: number) => Math.floor(randRange(min, max + 1));

const DEMO_PASSWORD = "ForgeAI123!";
const TODAY = new Date();
TODAY.setUTCHours(0, 0, 0, 0);
const HISTORY_DAYS = 270; // ~9 months of daily sales history

function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Clearing existing data...");
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.recommendation.deleteMany(),
    prisma.forecast.deleteMany(),
    prisma.purchaseOrderLine.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.supplierMaterial.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.salesOrderLine.deleteMany(),
    prisma.salesOrder.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.inventoryTransaction.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.productionOrder.deleteMany(),
    prisma.productMaterial.deleteMany(),
    prisma.product.deleteMany(),
    prisma.rawMaterial.deleteMany(),
    prisma.machineSensorData.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.user.deleteMany(),
    prisma.factory.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  console.log("Creating company, factory, warehouses, users...");
  const company = await prisma.company.create({ data: { name: "ForgeAI Demo Manufacturing Co." } });
  const factory = await prisma.factory.create({
    data: { companyId: company.id, name: "Riverside Plant", location: "Riverside, IN" },
  });
  const rmWarehouse = await prisma.warehouse.create({
    data: { factoryId: factory.id, name: "Raw Materials Warehouse", code: "WH-RM" },
  });
  const fgWarehouse = await prisma.warehouse.create({
    data: { factoryId: factory.id, name: "Finished Goods Warehouse", code: "WH-FG" },
  });

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const usersByRole: Record<Role, { email: string; name: string }> = {
    FACTORY_ADMIN: { email: "admin@forgeai.demo", name: "Alex Rivera" },
    PRODUCTION_MANAGER: { email: "production@forgeai.demo", name: "Priya Nataraj" },
    INVENTORY_MANAGER: { email: "inventory@forgeai.demo", name: "Marcus Webb" },
    PROCUREMENT_MANAGER: { email: "procurement@forgeai.demo", name: "Elena Cho" },
    MANAGEMENT: { email: "management@forgeai.demo", name: "Sam Okafor" },
    EMPLOYEE: { email: "employee@forgeai.demo", name: "Jordan Lee" },
  };
  const users: Record<string, { id: string }> = {};
  for (const [role, info] of Object.entries(usersByRole) as [Role, { email: string; name: string }][]) {
    const user = await prisma.user.create({
      data: { companyId: company.id, email: info.email, name: info.name, passwordHash, role },
    });
    users[role] = user;
  }

  console.log("Creating raw materials...");
  const materialDefs = [
    { code: "RM-STEEL", name: "Steel Sheet", unit: "kg", safetyStock: 800, standardCost: 3.2 },
    { code: "RM-ALUM", name: "Aluminum Rod", unit: "kg", safetyStock: 400, standardCost: 5.1 },
    { code: "RM-COPWIRE", name: "Copper Wire", unit: "m", safetyStock: 1500, standardCost: 1.4 },
    { code: "RM-RESIN", name: "Plastic Resin", unit: "kg", safetyStock: 600, standardCost: 2.6 },
    { code: "RM-GASKET", name: "Rubber Gasket", unit: "pcs", safetyStock: 1000, standardCost: 0.8 },
    { code: "RM-PCB", name: "Circuit Board", unit: "pcs", safetyStock: 300, standardCost: 22.5 },
    { code: "RM-FASTENER", name: "Fastener Kit", unit: "kit", safetyStock: 1200, standardCost: 1.1 },
    { code: "RM-PAINT", name: "Paint Coating", unit: "L", safetyStock: 250, standardCost: 9.4 },
    { code: "RM-GLASS", name: "Glass Panel", unit: "pcs", safetyStock: 200, standardCost: 14.0 },
    { code: "RM-MOTOR", name: "Motor Unit", unit: "pcs", safetyStock: 150, standardCost: 48.0 },
  ];
  const materials: Record<string, { id: string; unit: string }> = {};
  for (const m of materialDefs) {
    const created = await prisma.rawMaterial.create({ data: m });
    materials[m.code] = { id: created.id, unit: created.unit };
  }

  console.log("Creating products and BOMs...");
  const productDefs = [
    {
      sku: "FG-PUMP-A100",
      name: "Industrial Pump A100",
      unit: "pcs",
      unitPrice: 420,
      baseDemand: 8,
      bom: [
        { code: "RM-STEEL", qty: 6 },
        { code: "RM-MOTOR", qty: 1 },
        { code: "RM-GASKET", qty: 4 },
        { code: "RM-FASTENER", qty: 10 },
      ],
    },
    {
      sku: "FG-MOTOR-C200",
      name: "Conveyor Motor C200",
      unit: "pcs",
      unitPrice: 610,
      baseDemand: 5,
      bom: [
        { code: "RM-COPWIRE", qty: 25 },
        { code: "RM-STEEL", qty: 4 },
        { code: "RM-ALUM", qty: 3 },
        { code: "RM-FASTENER", qty: 8 },
      ],
    },
    {
      sku: "FG-PANEL-P300",
      name: "Control Panel P300",
      unit: "pcs",
      unitPrice: 260,
      baseDemand: 12,
      bom: [
        { code: "RM-PCB", qty: 3 },
        { code: "RM-FASTENER", qty: 8 },
        { code: "RM-RESIN", qty: 1.5 },
        { code: "RM-PAINT", qty: 0.3 },
      ],
    },
    {
      sku: "FG-VALVE-H400",
      name: "Hydraulic Valve H400",
      unit: "pcs",
      unitPrice: 180,
      baseDemand: 15,
      bom: [
        { code: "RM-STEEL", qty: 2 },
        { code: "RM-GASKET", qty: 3 },
        { code: "RM-FASTENER", qty: 4 },
      ],
    },
    {
      sku: "FG-SENSOR-S500",
      name: "Sensor Module S500",
      unit: "pcs",
      unitPrice: 95,
      baseDemand: 20,
      bom: [
        { code: "RM-PCB", qty: 1 },
        { code: "RM-RESIN", qty: 0.4 },
        { code: "RM-GLASS", qty: 1 },
      ],
    },
  ];

  const products: Record<string, { id: string; baseDemand: number }> = {};
  for (const p of productDefs) {
    const created = await prisma.product.create({
      data: { sku: p.sku, name: p.name, unit: p.unit, unitPrice: p.unitPrice },
    });
    products[p.sku] = { id: created.id, baseDemand: p.baseDemand };
    for (const line of p.bom) {
      await prisma.productMaterial.create({
        data: { productId: created.id, rawMaterialId: materials[line.code].id, quantityPerUnit: line.qty },
      });
    }
  }

  console.log("Creating suppliers...");
  const supplierDefs = [
    { code: "SUP-A", name: "Northbridge Metals", reliability: 0.95, qualityScore: 0.92 },
    { code: "SUP-B", name: "Delta Components", reliability: 0.88, qualityScore: 0.9 },
    { code: "SUP-C", name: "Pacific Fabrication", reliability: 0.97, qualityScore: 0.85 },
    { code: "SUP-D", name: "Union Electronics", reliability: 0.9, qualityScore: 0.94 },
    { code: "SUP-E", name: "Rapid Supply Co.", reliability: 0.8, qualityScore: 0.8 },
    { code: "SUP-F", name: "Keystone Materials Group", reliability: 0.93, qualityScore: 0.88 },
  ];
  const suppliers: Record<string, { id: string }> = {};
  for (const s of supplierDefs) {
    const created = await prisma.supplier.create({ data: s });
    suppliers[s.code] = { id: created.id };
  }

  // Every material gets 2-3 supplier offers with varied price/lead-time so
  // the ranking engine has something real to choose between.
  const supplierCodes = Object.keys(suppliers);
  for (const m of materialDefs) {
    const offerCount = randInt(2, 3);
    const chosen = shuffle(supplierCodes, rand).slice(0, offerCount);
    for (const supCode of chosen) {
      await prisma.supplierMaterial.create({
        data: {
          supplierId: suppliers[supCode].id,
          rawMaterialId: materials[m.code].id,
          unitPrice: round2(m.standardCost * randRange(0.85, 1.25)),
          leadTimeDays: randInt(3, 21),
          minOrderQty: Math.round(m.safetyStock * randRange(0.1, 0.3)),
        },
      });
    }
  }

  console.log("Seeding starting inventory...");
  // Raw materials: sized so the dashboard opens "healthy" (§20 step 1) —
  // most materials carry enough buffer to clear the 30-day risk horizon
  // (LOW), with Circuit Board deliberately tight (MEDIUM) so it's the one
  // ready to tip into HIGH when the demo's demand shock lands on it, and
  // Fastener Kit — used by every product, so its aggregate daily demand is
  // the highest of any material — left moderately tight too (MEDIUM) for
  // dashboard realism. Buffer is computed from each material's actual BOM
  // demand (weekday-seasonality-adjusted), not a flat multiplier of safety
  // stock, because a shared material like Fastener Kit needs a far larger
  // absolute buffer than a single-product material like Glass Panel to
  // cover the same number of days.
  const AVG_WEEKDAY_FACTOR = (5 * 1 + 2 * 0.35) / 7; // matches the weekendFactor used below when generating sales
  const dailyDemandByMaterial: Record<string, number> = {};
  for (const m of materialDefs) dailyDemandByMaterial[m.code] = 0;
  for (const p of productDefs) {
    const approxDailyDemand = p.baseDemand * AVG_WEEKDAY_FACTOR;
    for (const line of p.bom) {
      dailyDemandByMaterial[line.code] += approxDailyDemand * line.qty;
    }
  }
  const BUFFER_DAYS_OVERRIDE: Record<string, number> = { "RM-PCB": 14, "RM-FASTENER": 25 };
  const DEFAULT_BUFFER_DAYS = 40; // comfortably clears the 30-day risk horizon -> LOW

  for (const m of materialDefs) {
    const bufferDays = (BUFFER_DAYS_OVERRIDE[m.code] ?? DEFAULT_BUFFER_DAYS) * randRange(0.9, 1.1);
    const onHand = Math.round(m.safetyStock + bufferDays * dailyDemandByMaterial[m.code]);
    await prisma.inventory.create({
      data: { warehouseId: rmWarehouse.id, rawMaterialId: materials[m.code].id, quantityOnHand: onHand, quantityReserved: 0 },
    });
    await prisma.inventoryTransaction.create({
      data: {
        rawMaterialId: materials[m.code].id,
        warehouseId: rmWarehouse.id,
        type: TransactionType.ADJUSTMENT,
        quantity: onHand,
        reference: "SEED",
        note: "Initial stock load",
      },
    });
  }
  // Finished goods: a couple weeks of typical sales as starting stock.
  for (const p of productDefs) {
    const onHand = Math.round(p.baseDemand * randRange(10, 18));
    await prisma.inventory.create({
      data: { warehouseId: fgWarehouse.id, productId: products[p.sku].id, quantityOnHand: onHand, quantityReserved: 0 },
    });
  }

  console.log(`Generating ${HISTORY_DAYS} days of sales history...`);
  const customerDefs = ["Meridian Industrial", "Coastal Assembly Corp.", "Highline Manufacturing", "Vertex Fabricators"];
  const customers: { id: string }[] = [];
  for (const name of customerDefs) {
    customers.push(await prisma.customer.create({ data: { name } }));
  }

  // history[sku] = HistoryPoint[] — kept in memory and reused directly by
  // the forecaster below instead of re-querying the DB.
  const history: Record<string, HistoryPoint[]> = {};
  const salesOrderRows: { id: string; customerId: string; orderDate: Date }[] = [];
  const salesOrderLineRows: { id: string; salesOrderId: string; productId: string; quantity: number }[] = [];

  for (const p of productDefs) {
    history[p.sku] = [];
    for (let dayIndex = HISTORY_DAYS; dayIndex >= 1; dayIndex--) {
      const date = daysAgo(dayIndex);
      const weekday = date.getUTCDay();
      const weekendFactor = weekday === 0 || weekday === 6 ? 0.35 : 1;
      // gentle upward trend over the whole window (older days slightly lower)
      const trendFactor = 0.85 + 0.3 * (1 - dayIndex / HISTORY_DAYS);
      const noise = randRange(0.75, 1.25);
      const quantity = Math.max(0, Math.round(p.baseDemand * weekendFactor * trendFactor * noise));

      history[p.sku].push({ date, quantity });

      if (quantity > 0) {
        const orderId = randomUUID();
        const customer = customers[randInt(0, customers.length - 1)];
        salesOrderRows.push({ id: orderId, customerId: customer.id, orderDate: date });
        salesOrderLineRows.push({ id: randomUUID(), salesOrderId: orderId, productId: products[p.sku].id, quantity });
      }
    }
  }
  // Batch-insert in chunks (Postgres/Prisma createMany handles large arrays fine).
  await chunkedCreateMany(prisma.salesOrder, salesOrderRows.map((r) => ({ id: r.id, customerId: r.customerId, orderDate: r.orderDate })));
  await chunkedCreateMany(
    prisma.salesOrderLine,
    salesOrderLineRows.map((r) => ({ id: r.id, salesOrderId: r.salesOrderId, productId: r.productId, quantity: r.quantity })),
  );
  console.log(`  -> ${salesOrderRows.length} sales orders`);

  console.log("Generating initial 30-day demand forecast...");
  const HORIZON = 30;
  for (const p of productDefs) {
    const points = forecastDailyDemand(history[p.sku], HORIZON);
    await chunkedCreateMany(
      prisma.forecast,
      points.map((pt) => ({
        id: randomUUID(),
        productId: products[p.sku].id,
        forecastDate: pt.date,
        quantity: round2(pt.quantity),
        model: "seasonal-naive",
      })),
    );
  }

  console.log("Creating machines and telemetry...");
  const machineDefs = [
    { code: "MC-01", name: "Injection Molding Press M1" },
    { code: "MC-02", name: "CNC Lathe M2" },
    { code: "MC-03", name: "Assembly Robot M3" },
    { code: "MC-04", name: "Paint Booth M4" },
  ];
  const TELEMETRY_DAYS = 14;
  for (const md of machineDefs) {
    const machine = await prisma.machine.create({ data: { factoryId: factory.id, code: md.code, name: md.name } });

    const baselineReading = (): SensorReading => ({
      temperature: randRange(55, 65),
      vibration: randRange(0.2, 0.5),
      pressure: randRange(95, 105),
      rpm: randRange(1400, 1600),
      powerDraw: randRange(8, 12),
    });

    // Build history first so we can compute a per-machine baseline for scoring.
    const readings: { recordedAt: Date; reading: SensorReading; injected: boolean }[] = [];
    const totalHours = TELEMETRY_DAYS * 24;
    for (let h = totalHours; h >= 1; h--) {
      const recordedAt = new Date(TODAY.getTime() - h * 60 * 60 * 1000);
      readings.push({ recordedAt, reading: baselineReading(), injected: false });
    }
    // MC-03 (Assembly Robot) drifts into an anomalous state over its last 12
    // hours so the Machines page has a real, non-hardcoded maintenance alert.
    if (md.code === "MC-03") {
      for (let i = readings.length - 12; i < readings.length; i++) {
        const severity = (i - (readings.length - 12)) / 12; // 0 -> 1 ramp
        readings[i] = {
          ...readings[i],
          injected: true,
          reading: {
            temperature: randRange(55, 65) + severity * 35,
            vibration: randRange(0.2, 0.5) + severity * 2.2,
            pressure: randRange(95, 105) + severity * 20,
            rpm: randRange(1400, 1600) - severity * 300,
            powerDraw: randRange(8, 12) + severity * 6,
          },
        };
      }
    }

    const baseline = computeBaseline(readings.filter((r) => !r.injected).map((r) => r.reading));
    const rows = readings.map((r) => ({
      id: randomUUID(),
      machineId: machine.id,
      recordedAt: r.recordedAt,
      temperature: round2(r.reading.temperature),
      vibration: round2(r.reading.vibration),
      pressure: round2(r.reading.pressure),
      rpm: round2(r.reading.rpm),
      powerDraw: round2(r.reading.powerDraw),
      anomalyScore: round2(scoreReading(r.reading, baseline)),
    }));
    await chunkedCreateMany(prisma.machineSensorData, rows);

    const latestAnomaly = rows[rows.length - 1].anomalyScore;
    await prisma.machine.update({
      where: { id: machine.id },
      data: { status: latestAnomaly >= 0.6 ? "ATTENTION" : "RUNNING" },
    });
  }

  console.log("Writing seed audit entry...");
  await prisma.auditLog.create({
    data: {
      action: "SEED_LOADED",
      entityType: "System",
      summary: `Synthetic dataset loaded: ${productDefs.length} products, ${materialDefs.length} materials, ${supplierDefs.length} suppliers, ${salesOrderRows.length} sales orders, ${machineDefs.length} machines.`,
    },
  });

  console.log("\nSeed complete.");
  console.log("Demo logins (password for all: " + DEMO_PASSWORD + "):");
  for (const info of Object.values(usersByRole)) {
    console.log(`  ${info.email}`);
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function chunkedCreateMany<T>(delegate: { createMany: (args: { data: T[] }) => Promise<unknown> }, rows: T[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await delegate.createMany({ data: rows.slice(i, i + size) });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
