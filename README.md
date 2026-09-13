# HishabOS — Business Operating System for Sellers

> *A seller should always know where their money is, where their stock is, where their orders are — and whether they are actually making money.*

**HishabOS** (হিসাব = "accounts") is a **local-first, offline-capable, bilingual (বাংলা + English) flagship web app** for e-commerce, F-commerce, retail, wholesale and reseller businesses. Products, inventory, purchases, suppliers, customers, orders, payments, couriers, returns, advertising, expenses, cash flow, profit/loss and analytics — in one unified app.

**100% free forever.** No server, no account, no ads, no subscriptions, no paid APIs. Your data lives in **your browser (IndexedDB)** — you own it, back it up, and take it anywhere.

- 🌐 **Live:** `https://<owner>.github.io/selleros/` (deployed from `main` via GitHub Actions → Pages)
- 📦 **Installable PWA** — works offline, installs on Android/iPhone/desktop
- 🌍 **বাংলা + English**, light-mode, responsive 320px → 2560px
- 👤 **Creator:** Shohan Khan · helloiamshohan@gmail.com

---

## ✨ Core modules

| Module | What it really does |
|---|---|
| **Dashboard** | Sales, net profit, expenses, cash, inventory, receivables, payables — with previous-period deltas, revenue trend vs previous period, profit drill-down (click any number), health score with “Why?”, cash-vs-profit explainer, rules-based insights, low stock, recent orders, customizable widgets |
| **Orders** | Full lifecycle Draft → Pending → Confirmed → Processing → Packed → Shipped → Delivered (+ Returned/Cancelled/Failed), each transition moving stock + ledger correctly. Live estimated profit, advances, COD, discounts, courier + tracking |
| **Products** | SKU, category, brand, supplier, photo (auto-compressed), variants, reorder levels, landed/avg cost, batches, archive (history preserved), profitability per product |
| **Purchases** | Multi-item POs, extra-cost allocation (shipping/customs/packaging) into unit cost, batch tracking, partial supplier payments |
| **Inventory** | Weighted-average valuation, complete stock ledger (purchase/sale/return/damage/adjustment), low/out-of-stock, damage & loss with financial impact |
| **Customers** | CRM profiles, lifetime value, AOV, repeat/return rates, outstanding, segmentation (new/returning/high-value/high-return) |
| **Suppliers** | Payables, purchase history |
| **Finance** | Accrual P&L + cash flow (profit ≠ cash, always visible), money ledger, expenses (20 categories + custom), capital |
| **Marketing** | Campaigns (Meta/Google/TikTok/…) with manual attribution, spend → revenue, ROAS, cost/order |
| **Couriers** | Pathao, Steadfast, RedX, CareeBee, Sundarban, own, custom — success/return rates, fees, COD settlement tracking (manual, no fake APIs) |
| **Returns** | Financial + inventory event: revenue/COGS reversal, refund, return fee, restock-or-loss by condition |
| **Reports** | Sales, P&L, Cash Flow, Expenses, Products, Inventory, Customers, Couriers, Returns, Ads — each with summary + chart + table + filters + CSV export. Same engine as dashboard, so numbers always reconcile |
| **Command center** | `Ctrl/Cmd+K` instant search across products/orders/customers/suppliers/expenses + quick actions |
| **Backup** | Versioned JSON backup/restore (replace or merge, validated), CSV import/export, full data wipe with typed confirmation |
| ** extras** | Demo business explorer, optional PIN app-lock, onboarding, offline banner, toasts, audit trail |

## 🧮 Financial model (the important part)

- **All money = integer paisa** (`৳1 = 100`). No float errors, ever. Splits use largest-remainder.
- **Revenue recognized on delivery** (accrual). COGS from each item's frozen weighted-average cost at sale time.
- **Cash ≠ profit**: advances, COD dues, courier settlements and stock are tracked separately from P&L.
- **Actual vs estimated is labeled**: P&L, cash, ledger = *actual*; per-product ad allocation = *estimated* (clearly marked).
- Every state change writes to the **financial ledger** and **inventory ledger**; nothing is silently mutated (voids, audit trail).

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full domain, ledger, inventory, backup and deployment documentation.

## 🛠 Tech stack

- **React 18 + TypeScript + Vite** (static build, HashRouter for GitHub Pages deep links)
- **Tailwind CSS** design system (light-mode enforced, `color-scheme: light`)
- **Dexie (IndexedDB)** — versioned schema, indexed queries, multi-workspace-ready (`businessId` on every table)
- **Hand-rolled SVG charts** (no chart lib bloat), **zero paid deps**
- **Vitest**: 20 tests — money, P&L, returns, cash reconciliation + full lifecycle on fake IndexedDB
- **PWA**: manifest, SVG icons, offline-first service worker (app-shell caching)

## 🚀 Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 20 tests
npm run typecheck
npm run build      # static production build → dist/
npm run preview
```

## 🌍 Deployment (GitHub Pages, free)

1. Push to `main` → **Deploy to GitHub Pages** workflow builds, tests and publishes `dist/` automatically.
2. In repo settings → **Pages** → Source: **GitHub Actions** (first time only).
3. Live URL: `https://<owner>.github.io/selleros/`

The build uses **relative asset paths** (`base: './'`), so it also works on custom domains or any sub-path with zero config. PRs run the **CI** workflow (install → typecheck → test → build).

## 📁 Repository layout

```
src/
  lib/        money (paisa engine), dates, csv, validation, ids
  db/         Dexie schema v1, types, settings
  services/   ledger, finance (P&L), orders, purchases, returns, expenses, insights, backup, seed
  i18n/       en + bn dictionaries (no hardcoded UI strings)
  state/      language, workspace, toasts, PIN, demo
  components/ UI kit, SVG charts, shell, command palette
  pages/      13 modules (route-split)
  __tests__/  unit + lifecycle tests
public/       manifest, service worker, icons, 404 fallback
docs/         ARCHITECTURE.md
.github/      CI + Pages deploy workflows
```

## 🔒 Privacy

All business data stays in your browser's IndexedDB. Nothing is uploaded, tracked or synced anywhere. Clearing browser data erases local data — **keep backups** (Settings → Backup).

## 📄 Changelog

See [`CHANGELOG.md`](CHANGELOG.md). Current version: **1.0.0**.
