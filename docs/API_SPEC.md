# ForgeAI — API Specification (Prototype)

Base URL: `http://localhost:3000/api`. All endpoints require the
`forgeai_session` cookie (set by `/auth/login`) except `/auth/login` itself.
Roles shown are the ones `requireUser([...])` enforces; omitted = any
authenticated user.

## Auth

| Method | Path | Roles | Body / Query | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | — | `{ email, password }` | Sets session cookie |
| POST | `/auth/logout` | any | — | Clears session cookie |
| GET | `/auth/me` | any | — | Current user, or `{ user: null }` |

## Products & BOM

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| GET | `/products` | any | — |
| POST | `/products` | Admin, Production Mgr | `{ sku, name, unit?, unitPrice?, bom: [{ rawMaterialId, quantityPerUnit }] }` |

## Inventory

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| GET | `/inventory` | any | Returns every material with risk level, reorder point, per-warehouse breakdown |
| GET | `/inventory/transactions` | any | `?rawMaterialId=` optional |
| POST | `/inventory/transactions` | Admin, Inventory Mgr | `{ rawMaterialId, warehouseId, quantity, note? }` — manual ledgered adjustment |

## Production

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| GET | `/production/orders` | any | — |
| POST | `/production/orders` | Admin, Production Mgr | `{ productId, quantity, dueDate }` — explodes BOM, reserves material |
| GET | `/production/orders/:id` | any | Requirements breakdown |
| PATCH | `/production/orders/:id` | Admin, Production Mgr | `{ status: "IN_PROGRESS" \| "COMPLETED" \| "CANCELLED" }` |

## Suppliers & Procurement

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| GET | `/suppliers` | any | — |
| POST | `/suppliers` | Admin, Procurement Mgr | `{ code, name, reliability?, qualityScore? }` |
| GET | `/suppliers/:id/materials` | any | — |
| GET | `/purchase-orders` | any | — |
| POST | `/purchase-orders/:id/receive` | Admin, Inventory Mgr, Procurement Mgr | Marks RECEIVED, ledgers RECEIPT, updates on-hand, recomputes risk |

## AI / Recommendations

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| POST | `/ai/stockout-risk` | any | `{ rawMaterialId }` → full risk assessment + ranked suppliers |
| GET | `/ai/forecast` | any | `?productId=` → stored forecast + history |
| POST | `/ai/forecast` | any | `{ productId, horizonDays? }` → regenerates + persists forecast, returns backtest accuracy |
| POST | `/ai/assistant` | any | `{ message, context? }` → `{ reply, toolTrace, context }` |
| GET | `/recommendations` | any | `?status=PENDING\|APPROVED\|REJECTED` |
| POST | `/recommendations` | Admin, Procurement/Inventory Mgr, Management | `{ rawMaterialId }` — manually (re)run the recommendation engine |
| POST | `/recommendations/:id/approve` | Admin, Management, Procurement Mgr | `{ comment? }` — generates the Purchase Order |
| POST | `/recommendations/:id/reject` | Admin, Management, Procurement Mgr | `{ comment? }` |

## Machines

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| GET | `/machines` | any | Latest reading, health score, maintenance flag per machine |
| GET | `/machines/:id/health` | any | Last 7 days of readings + health score |

## Analytics & Dashboard

| Method | Path | Roles |
|---|---|---|
| GET | `/dashboard` | any |
| GET | `/analytics/inventory` | any |
| GET | `/analytics/production` | any |

## Demo & Audit

| Method | Path | Roles | Body / Query |
|---|---|---|---|
| POST | `/demo/trigger` | Admin, Management, Production Mgr | `{ productId, upliftPercent? }` — §20 demand-shock scenario |
| GET | `/audit-logs` | Admin, Management | `?limit=` |
| GET | `/users` | any | Company users, factories, warehouses (read-only Settings data) |

## Error shape

Every route returns `{ error: string }` with a 4xx/5xx status on failure
(`lib/api.ts:withErrorHandling`). Auth failures are 401 (not authenticated) or
403 (wrong role); validation failures are 400.
