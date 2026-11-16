# ForgeAI — Demonstration Runbook

Maps blueprint §20 step-by-step to actual UI actions. Total time: ~5 minutes.
Log in as **admin@forgeai.demo** (password `ForgeAI123!`) — Factory Admin is
the one role authorized for every step below (trigger the shock, approve the
recommendation, *and* receive the purchase order), so one login covers the
whole script. Management can trigger and approve but not receive goods; that
last step needs Admin, Inventory Manager, or Procurement Manager.

| # | Blueprint step | What to do | What you'll see |
|---|---|---|---|
| 1 | Start with a healthy inventory dashboard | Open **Dashboard** | KPIs, mostly LOW/MEDIUM risk materials, no HIGH alerts by default |
| 2 | Trigger a 30% demand increase for a key finished product | **Analytics** → Demo scenario → pick *Control Panel P300* → **Trigger demand shock** | A real production order is booked and reserved; response lists risk before/after per material |
| 3 | Recalculate material requirements | (done automatically by step 2 — `reserveMaterialsForOrder`) | The production order's material lines are visible on **Production** |
| 4 | Run the demand forecast | (done automatically by step 2 — forecast regenerated with the uplift) | **Analytics** forecast chart for the product now shows the higher curve |
| 5 | Show projected inventory falling below safety stock | Open **Inventory**, find the affected material (e.g. Circuit Board) | Risk badge has moved to MEDIUM/HIGH |
| 6 | Display the predicted stockout date | Same row | "Stockout ETA" column shows a date + days |
| 7 | Rank suppliers by cost, lead time, quality, reliability | **Approvals** → open the new recommendation → "Why this recommendation?" | Ranked supplier table with per-supplier score |
| 8 | Generate an explainable purchase recommendation | (already created by step 2/5) | Recommendation card shows quantity, supplier, cost, and a plain-English reason |
| 9 | Open the approval screen | **Approvals** | Pending recommendation listed |
| 10 | Approve the recommendation | Click **Approve** | Recommendation status flips to APPROVED |
| 11 | Generate the purchase order automatically | (automatic on approve) | New PO visible on **Procurement**, status ORDERED |
| 12 | Update expected inventory | **Procurement** → **Receive goods** on that PO | Inventory transaction RECEIPT ledgered, on-hand increases |
| 13 | Show the risk changing from HIGH to LOW | Back to **Inventory** | Risk badge for the material has dropped |
| 14 | Display the complete audit trail | **Settings** (Admin/Management) | Every step above appears as an AuditLog row, in order, with actor and timestamp |

## Talking points while running it

- Nothing above is scripted output — the demo-trigger endpoint books a genuine
  `ProductionOrder`, reserves real `Inventory` rows, regenerates the forecast
  from the actual seeded sales history, and reruns the same risk/ranking
  functions every other page calls.
- The risk thresholds (§10.2: `Projected Inventory(t) < Safety Stock`) and the
  reorder-point formula are implemented verbatim in
  [`lib/domain/inventory.ts`](../lib/domain/inventory.ts).
- The AI assistant (Assistant page) can answer "Check whether we need to buy
  Circuit Board" using the same engine, live, if you want a second, more
  conversational path through the same numbers.
