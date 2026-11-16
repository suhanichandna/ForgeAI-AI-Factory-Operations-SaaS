# ForgeAI — User Manual (Prototype)

## Getting started

1. Start PostgreSQL: `docker compose up -d` (from the repo root — this brings up
   Postgres on `localhost:5434`, not the default 5432, to avoid clashing with
   other local projects).
2. Install dependencies: `npm install`.
3. Apply the schema and load the demo dataset:
   ```bash
   npx prisma migrate dev --name init
   npm run db:seed
   ```
4. Start the app: `npm run dev`, then open `http://localhost:3000`.

## Signing in

The login page lists all six demo accounts. Password for every account is
`ForgeAI123!`. Click an email to fill it in, or type your own.

| Role | Email | What they can do here |
|---|---|---|
| Factory Admin | admin@forgeai.demo | Everything |
| Production Manager | production@forgeai.demo | Create/complete production orders, view everything |
| Inventory Manager | inventory@forgeai.demo | Adjust inventory, receive purchase orders |
| Procurement Manager | procurement@forgeai.demo | Manage suppliers, approve/reject recommendations, receive POs |
| Management | management@forgeai.demo | Approve/reject recommendations, view analytics + audit log, run the demo scenario |
| Employee | employee@forgeai.demo | Read-only across the app |

## Pages

- **Dashboard** — KPIs, top stockout risks, pending AI recommendations, recent
  audit activity. Start here.
- **Inventory** — every raw material with on-hand/reserved/available quantity,
  safety stock, reorder point, and live risk level. Click a row to see the
  per-warehouse breakdown. "Generate recommendation" manually reruns the risk
  engine for a material.
- **Products & BOM** — each finished product and the raw materials/quantities
  its Bill of Materials requires.
- **Production** — create a production order (this explodes the BOM and
  reserves material immediately); mark orders Complete (issues material,
  adds finished-goods stock) or Cancel (releases the reservation).
- **Procurement** — suppliers and their price/lead-time offers per material;
  purchase orders with a "Receive goods" action once a supplier ships.
- **Machines** — telemetry-derived health score per machine, with an anomaly
  score chart for the selected machine. `MC-03` (Assembly Robot) is seeded
  with a genuine anomaly ramp so there's something real to see.
- **AI Assistant** — chat with the operations assistant. It only uses the
  tool set described in blueprint §13 — try "Check whether we need to buy
  Circuit Board", "Give me a risk summary", "Check machine health", or
  "Create the purchase request" as a follow-up.
- **Approvals** — every pending (and, toggled, historical) AI recommendation
  with its full reasoning: ranked suppliers and the inventory projection that
  triggered it. Approve or reject here — approval auto-generates the PO.
- **Analytics** — inventory/production KPIs, the demand-forecast chart with a
  "Regenerate + backtest" button (reports MAE/RMSE/MAPE/R²), and the
  **demo scenario trigger** (see below).
- **Settings** — company/factory info, the user directory, and (Admin/
  Management only) the audit log.

## Running the §20 demonstration scenario

0. Log in as **admin@forgeai.demo** — Factory Admin is the only role that can
   do all three steps below (trigger, approve, receive) in one session; see
   [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) for why.
1. Go to **Analytics** → "Demo scenario: simulate a demand shock".
2. Pick a product (e.g. *Control Panel P300*) and leave the uplift at 30%.
3. Click **Trigger demand shock**. This is not a scripted animation — it:
   - books a real production order sized to the uplift and reserves material
     for it now,
   - regenerates that product's demand forecast under the higher demand,
   - recomputes stockout risk for every material in the product's BOM,
   - (re)generates purchase recommendations where risk is now MEDIUM/HIGH.
4. Go to **Approvals** — review the new recommendation's reasoning (ranked
   suppliers, projected inventory) and **Approve** it. A Purchase Order is
   created automatically.
5. Go to **Procurement** → **Receive goods** on that PO. Inventory updates,
   and risk recalculates — check **Inventory** to see it drop back to LOW.
6. Go to **Settings** (as Admin/Management) to see the whole sequence in the
   audit log.

See [DEMO_RUNBOOK.md](DEMO_RUNBOOK.md) for the scripted walkthrough matching
blueprint §20 step-by-step.

## Resetting the demo data

`npm run db:seed` clears and reloads the whole dataset (deterministic —
running it again produces the same starting numbers).
