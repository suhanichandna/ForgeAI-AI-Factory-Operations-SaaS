# ForgeAI — Software Requirements Specification (Prototype)

Derived from the *AI Factory Operations SaaS — Technical Blueprint* (v1.0). This SRS
covers the working prototype only; deferred blueprint scope is listed at the end.

## 1. Purpose

ForgeAI is a manufacturing operations platform covering the workflow: raw-material
inventory → production planning → procurement → supplier selection → approval →
purchase execution → updated inventory, with an AI layer continuously identifying
stockout risk and recommending purchases.

## 2. Scope

In scope for this prototype (matches blueprint §4 "Build in MVP"):

- Authentication and role-based access control (6 roles)
- Products, Bill of Materials (BOM), raw materials
- Multi-warehouse inventory with an append-only transaction ledger
- Production orders with BOM explosion and material reservation
- Suppliers, supplier-material pricing/lead time, purchase orders, goods receipt
- Demand forecasting (seasonal-naive baseline, §12.1 pipeline)
- Stockout-risk engine (§10.2 / §12.2 formulas, implemented exactly as specified)
- Supplier ranking (weighted scoring: cost, lead time, reliability, quality)
- Explainable purchase recommendations → human approval → auto-generated PO
- Machine telemetry simulation + statistical anomaly detection + health score
- AI operations assistant (deterministic tool-calling agent, §13 tool set)
- Full audit log of AI decisions and human actions
- §20 demonstration scenario, runnable from the Analytics page

Out of scope (blueprint §4 "Defer to later", unchanged in this prototype):
payroll/HR, full accounting/tax, multi-country compliance, physical IoT hardware,
autonomous purchasing without approval, enterprise microservices decomposition.

## 3. User Roles (§5)

| Role | Responsibilities | Access |
|---|---|---|
| Factory Admin | Configure company, users, master data | Full administrative access |
| Production Manager | Production plans, BOMs, batches, schedules | Production + analytics |
| Inventory Manager | Stock, warehouses, movements, alerts | Inventory + procurement visibility |
| Procurement Manager | Suppliers, purchase requests/orders | Procurement actions |
| Management | KPIs, risks, forecasts, recommendations | Read + approve workflows |
| Employee | Assigned operational tasks | Limited operational access |

Enforced via `requireUser(roles?)` on every API route (`lib/auth.ts`) and via
`proxy.ts` for page-level session gating. Tenant isolation is scoped by
`companyId` on every user-visible query path that touches company-owned data.

## 4. Functional Requirements

### FR-1 Inventory Management
The system SHALL track on-hand and reserved quantity per material per warehouse,
and SHALL record every quantity change as an immutable `InventoryTransaction`
(RECEIPT, ISSUE, RESERVATION, RELEASE, ADJUSTMENT).

### FR-2 Production Management
The system SHALL explode a production order's Bill of Materials into per-material
requirements, compare against available (unreserved) inventory, and reserve
material FIFO across warehouses. Completing an order SHALL issue the reserved
material and increase finished-goods stock; cancelling SHALL release reservations
without consuming stock.

### FR-3 Demand Forecasting
The system SHALL forecast daily demand per product for a 30-day horizon from
historical sales, using a seasonal-naive model with a trend correction (§12:
"use a time-series baseline; do not use an LLM for numerical forecasting").
The system SHALL report backtested accuracy (MAE, RMSE, MAPE, R²).

### FR-4 Stockout Risk Engine
The system SHALL compute, for each raw material: lead-time demand, reorder
point, and a day-by-day inventory projection, using exactly the §10.2 formulas.
The system SHALL classify risk as LOW / MEDIUM / HIGH based on whether and how
soon projected inventory falls below safety stock.

### FR-5 Supplier Ranking
The system SHALL rank candidate suppliers for a material using a weighted score
over normalized cost, normalized lead time, reliability and quality.

### FR-6 Recommendations & Approval Workflow
When risk is MEDIUM or HIGH, the system SHALL generate an explainable purchase
recommendation (quantity, supplier, cost, reason, and the full reasoning detail).
The system SHALL NOT execute a purchase without an explicit human approval
decision. On approval, the system SHALL auto-generate a Purchase Order.

### FR-7 Procurement
The system SHALL support receiving a purchase order, which SHALL increase
on-hand inventory, ledger a RECEIPT transaction, and recompute risk/recommendations
for the affected material(s).

### FR-8 Machine Monitoring
The system SHALL ingest simulated machine telemetry, score each reading for
anomaly (0–1) against the machine's own healthy baseline, derive a 0–100 health
score, and flag machines needing maintenance.

### FR-9 AI Operations Assistant
The system SHALL answer natural-language operational questions using a fixed
set of read/tool operations (inventory, forecast, open POs, supplier options,
risk calculation) and SHALL be able to create a purchase recommendation on
request, but SHALL NOT approve it — approval remains a human action.

### FR-10 Audit Log
The system SHALL record every AI recommendation, approval/rejection, purchase
order lifecycle event, production order lifecycle event, and login/logout to
an append-only audit log.

### FR-11 Demonstration Scenario
The system SHALL provide an operator-triggered "demand shock" action that
books a real production order for the uplift, regenerates the forecast, and
recomputes risk end to end — reproducing blueprint §20 without any hardcoded
demo state.

## 5. Non-Functional Requirements

- **Security (§16):** hashed passwords (scrypt), signed session cookies,
  RBAC on every mutating endpoint, parameterized DB access via Prisma,
  no secrets exposed to the client bundle.
- **Auditability:** every state-changing workflow action writes an AuditLog row.
- **Explainability:** every recommendation persists the ranked-supplier table
  and a sample of the inventory projection that produced it.

## 6. Prototype Simplifications (see [ARCHITECTURE.md](ARCHITECTURE.md) for full detail)

| Blueprint spec | Prototype implementation |
|---|---|
| Separate Node/Express API + Python/FastAPI ML service | Single Next.js app; API routes + server-side TypeScript domain logic |
| XGBoost demand forecasting | Seasonal-naive + trend baseline, in TypeScript (§12 explicitly calls this out as an acceptable baseline) |
| Isolation Forest anomaly detection | Multivariate z-score statistical detector |
| OR-Tools production scheduling | Not implemented (deferred) |
| LLM-backed AI assistant | Deterministic tool-calling agent over the same tool set |
| Separate PurchaseRequest entity | Merged into `Recommendation` → `Approval` → `PurchaseOrder` |
