# HishabOS Architecture

## 1. System overview

HishabOS is a **static single-page application** (React + Vite) deployed to **GitHub Pages**. There is no backend. Persistence is **IndexedDB via Dexie**. PWA service worker caches the app shell for offline use.

```
Browser
 ├── React UI (13 route-split pages + shell + command palette)
 ├── Services (domain engines — UI never computes finance directly)
 ├── Dexie / IndexedDB (schema v2, indexed)
 └── Service worker + manifest (PWA, offline shell)
```

## 2. Money: integer paisa

- `src/lib/money.ts` — every amount stored as **integer paisa** (BDT×100).
- `toPaisa/toTaka/add/splitProportional` — splits use **largest-remainder** so allocated parts always sum exactly.
- Formatting: `৳` with `en-US`/`bn-BD` digits; rounding = half-up at input, integers thereafter.

## 3. Data model (Dexie v2)

Every business table carries **`businessId`** → multi-workspace ready (v1: single active workspace + isolated demo workspace).

Core tables: `businesses, products, variants, purchases, purchaseItems, batches, customers, suppliers, orders, orderItems, payments, expenses, campaigns, couriers, settlements, returns, damages, moves, txns, alerts, audit, settings`.

Indexes: `[businessId+date]`, `[businessId+status]`, `[businessId+customerId]`, `[businessId+phone]`, `[businessId+sku]`, `[businessId+type]`, `[businessId+category]`, `[businessId+courierId]`, `[businessId+productId]`, etc.

## 4. Order lifecycle

`draft → pending → confirmed → processing → packed → shipped → delivered`, plus `returned | cancelled | failed`.

- **Stock**: reserved when leaving `draft` (moves `sale`), restored on cancel/fail (`sale_reversal`).
- **Delivery** posts accrual entries: `sale` (order total) + `cogs` (Σ qty × frozen unitCost) + `courier_fee`.
- **Payments** are cash entries (`customer_payment`), separate from revenue. `receivable = Σ(active orders)(total − paid)`.
- Illegal transitions throw (`delivered → cancelled`, edits after `returned`, …). Stock-short blocks reservation.

## 5. Inventory valuation — weighted average

Purchases allocate extra costs (shipping/customs/packaging) proportionally into each line's **effective unit cost**, create a **batch** (`qty/remaining/unitCost`), then update `avgCost = (oldQty×oldAvg + newQty×newUnit)/(total)`. Order items **freeze** `unitCost` at sale time, so later purchases never rewrite history. Reconciliation: `stock = opening + purchases + returns-in − sales − damage ± adjustments` (see `moves` ledger).

## 6. Financial ledger (`txns`)

| type | meaning | cash? |
|---|---|---|
| `sale` / `sale_reversal` | revenue on delivery / return | no (accrual) |
| `cogs` / `cogs_reversal` | cost of delivered / restocked goods | no |
| `customer_payment` / `refund` | cash in / out | yes |
| `purchase` / `supplier_payment` | stock buying | yes |
| `expense` | categorized cost | yes |
| `courier_fee` / `return_fee` | delivery economics | yes |
| `capital` / `other_income` | injections | yes |

`services/finance.ts` (`summarizeTxns`, `periodSummary`) is the **single source of truth** — dashboard, finance page and all 10 reports call it, so totals always reconcile. Deletions **void** linked txns (never silently rewrite); mutations write to `audit`.

**P&L**: `net = (revenue − cogs) − ads − delivery − operating − refunds + other_income`.

## 7. Returns & damages

`processReturn` requires `delivered|shipped`: sets `returned`, optionally restocks (`return_in`), posts `sale_reversal` + (`cogs_reversal` if resellable else `damage` expense), `return_fee` expense, and `refund` cash-out + payment record. `recordDamage` posts stock-out + `damage` expense at current avg cost.

## 8. Campaigns & expenses

Campaign spend **posts to the expense ledger** (`advertising`, linked `refId`) so spend is counted once, in one place. ROAS uses manually attributed revenue (labeled *manual*). Per-product net subtracts ad allocation by revenue share — labeled **estimated** everywhere it appears.

## 9. Insights & health (rules, not “AI”)

`services/insights.ts` compares current vs previous period (return rate, margin, ROAS, AOV, losers/winners, low stock, inventory share, cash, dues). Health = weighted 0–100 (profit 25, returns 15, cash 15, inventory 10, ROAS 10, fulfillment 15, dues 10) with per-factor notes.

## 10. Backup / restore / import

- `backupVersion: 1` JSON: all workspace tables + counts. `validateBackup` checks app, version, shape.
- Restore: **replace** (deletes only target workspace rows) or **merge** (skips existing ids), with preview + confirmation.
- CSV import (products/customers) validates headers, previews, skips bad rows, reports counts.
- `wipeWorkspace` deletes one workspace only.

## 11. i18n

`src/i18n/dict.ts` — every UI string keyed in `en` + `bn`; `t(key, …params)` with `{0}` placeholders; compound `tx("key|p0|p1")` for engine-generated insights. Persisted; `<html lang>` synced.

## 12. PWA / offline

`manifest.webmanifest` + `sw.js` (cache-first same-origin, network-first navigations with `index.html` fallback). All core flows work offline; an offline banner is shown. PIN lock is a local gate (4–8 digits).

## 13. Deployment

`base: './'` + `HashRouter` → the same `dist/` works on any path. `.nojekyll` + `404.html` included. CI (PR): install → typecheck → test → build. CD (`main`): build → `upload-pages-artifact` → `deploy-pages`.
