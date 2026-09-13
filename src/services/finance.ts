/**
 * FINANCIAL ENGINE — single source of truth.
 * Dashboard, reports and analytics MUST all use these functions (never ad-hoc formulas).
 *
 * Recognition rules (documented, consistent):
 * - REVENUE: recognized when an order is DELIVERED (accrual). order.total (items - discount + delivery charge).
 * - COGS: recognized on delivery from each item's frozen unitCost (weighted-average at sale time).
 * - CASH: only real money movement (payments, expenses paid, purchases paid, refunds, capital).
 *   Accrual txns (sale/cogs + reversals) never touch cash.  →  Profit ≠ Cash, always visible.
 * - RETURNS: revenue reversal + cogs reversal + return fee expense + refund outflow.
 * - Rounding: integer paisa everywhere; splits use largest-remainder.
 */
import { db, type ID, type Txn } from '../db/db';
import { add } from '../lib/money';

export interface Range { from: string; to: string }
export interface PeriodSummary {
  revenue: number; cogs: number; gross: number;
  adSpend: number; delivery: number; operating: number; refunds: number; otherIncome: number;
  net: number; margin: number;
  inflow: number; outflow: number; netCash: number;
  orders: number; delivered: number; returned: number; cancelled: number;
  units: number; discounts: number; deliveryCharged: number;
}

const CASH_IN = new Set(['customer_payment', 'capital', 'other_income']);
const CASH_OUT = new Set(['purchase', 'expense', 'supplier_payment', 'courier_fee', 'return_fee', 'refund']);

export async function txnsIn(bid: ID, r: Range): Promise<Txn[]> {
  return db.txns.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray();
}

export function summarizeTxns(list: Txn[]): Omit<PeriodSummary, 'orders' | 'delivered' | 'returned' | 'cancelled' | 'units' | 'discounts' | 'deliveryCharged'> {
  let revenue = 0, cogs = 0, adSpend = 0, delivery = 0, operating = 0, refunds = 0, otherIncome = 0, inflow = 0, outflow = 0;
  for (const t of list) {
    if (t.voided) continue;
    const a = t.amount;
    switch (t.type) {
      case 'sale': revenue += a; break;
      case 'sale_reversal': revenue -= a; break;
      case 'cogs': cogs += a; break;
      case 'cogs_reversal': cogs -= a; break;
      case 'refund': refunds += a; break;
      case 'courier_fee': case 'return_fee': delivery += a; break;
      case 'other_income': otherIncome += a; break;
      case 'expense':
        if (t.category === 'advertising' || t.category === 'marketing') adSpend += a;
        else if (t.category === 'courier' || t.category === 'delivery') delivery += a;
        else operating += a;
        break;
      default: break;
    }
    if (t.direction === 'in' && CASH_IN.has(t.type)) inflow += a;
    if (t.direction === 'out' && CASH_OUT.has(t.type)) outflow += a;
  }
  const gross = revenue - cogs;
  const net = gross - adSpend - delivery - operating - refunds + otherIncome;
  const margin = revenue > 0 ? (net / revenue) * 100 : 0;
  return { revenue, cogs, gross, adSpend, delivery, operating, refunds, otherIncome, net, margin, inflow, outflow, netCash: inflow - outflow };
}

export async function periodSummary(bid: ID, r: Range): Promise<PeriodSummary> {
  const [list, orders] = await Promise.all([
    txnsIn(bid, r),
    db.orders.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray(),
  ]);
  const fin = summarizeTxns(list);
  let delivered = 0, returned = 0, cancelled = 0, units = 0, discounts = 0, deliveryCharged = 0;
  for (const o of orders) {
    if (o.status === 'delivered') delivered++;
    if (o.status === 'returned') returned++;
    if (o.status === 'cancelled' || o.status === 'failed') cancelled++;
  }
  const items = await db.orderItems.where('businessId').equals(bid).toArray();
  const ids = new Set(orders.filter((o) => o.status === 'delivered').map((o) => o.id));
  for (const it of items) if (ids.has(it.orderId)) { units += it.qty; discounts += it.discount; }
  for (const o of orders) if (o.status === 'delivered') deliveryCharged += o.deliveryCharge;
  return { ...fin, orders: orders.length, delivered, returned, cancelled, units, discounts, deliveryCharged };
}

/** Daily series for charts — includes prev-period revenue for comparison. */
export async function dailySeries(bid: ID, r: Range, prev: Range): Promise<{ days: { date: string; revenue: number; orders: number; profit: number; prevRevenue: number }[] }> {
  const [cur, old, orders] = await Promise.all([txnsIn(bid, r), txnsIn(bid, prev),
    db.orders.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray()]);
  const days: string[] = [];
  { let c = r.from; while (c <= r.to) { days.push(c); const d = new Date(c + 'T00:00:00'); d.setDate(d.getDate() + 1); c = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (days.length > 400) break; } }
  const byDay = new Map<string, Txn[]>(); const byPrev = new Map<string, number>();
  for (const t of cur) { if (!byDay.has(t.date)) byDay.set(t.date, []); byDay.get(t.date)!.push(t); }
  for (const t of old) if (t.type === 'sale') byPrev.set(t.date, (byPrev.get(t.date) ?? 0) + t.amount);
  const orderCount = new Map<string, number>();
  for (const o of orders) if (o.status === 'delivered') orderCount.set(o.date, (orderCount.get(o.date) ?? 0) + 1);
  const len = days.length;
  const prevDays: string[] = [];
  { let c = prev.from; while (c <= prev.to) { prevDays.push(c); const d = new Date(c + 'T00:00:00'); d.setDate(d.getDate() + 1); c = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (prevDays.length > 400) break; } }
  return {
    days: days.map((d, i) => {
      const s = summarizeTxns(byDay.get(d) ?? []);
      const pd = prevDays[Math.min(i, prevDays.length - 1)] ?? '';
      return { date: d, revenue: s.revenue, orders: orderCount.get(d) ?? 0, profit: s.net, prevRevenue: pd ? (byPrev.get(pd) ?? 0) : 0 };
    }).filter((_, i) => len <= 62 || i % Math.ceil(len / 62) === 0 || i === len - 1),
  };
}

/** Cash position: opening + all-time cash in/out. */
export async function cashPosition(bid: ID): Promise<{ opening: number; inflow: number; outflow: number; balance: number }> {
  const b = await db.businesses.get(bid);
  const opening = b?.openingCash ?? 0;
  const all = await db.txns.where('businessId').equals(bid).toArray();
  let inflow = 0, outflow = 0;
  for (const t of all) {
    if (t.voided) continue;
    if (t.direction === 'in' && CASH_IN.has(t.type)) inflow += t.amount;
    if (t.direction === 'out' && CASH_OUT.has(t.type)) outflow += t.amount;
  }
  return { opening, inflow, outflow, balance: add(opening, inflow, -outflow) };
}

export async function receivables(bid: ID): Promise<number> {
  const os = await db.orders.where('businessId').equals(bid).toArray();
  return os.filter((o) => !['draft', 'cancelled', 'returned', 'failed'].includes(o.status))
    .reduce((a, o) => a + Math.max(0, o.total - o.paid), 0);
}
export async function payables(bid: ID): Promise<number> {
  const [ps, es] = await Promise.all([
    db.purchases.where('businessId').equals(bid).toArray(),
    db.expenses.where('businessId').equals(bid).toArray(),
  ]);
  return ps.reduce((a, p) => a + Math.max(0, p.total - p.paid), 0) + es.reduce((a, e) => a + Math.max(0, e.amount - e.paid), 0);
}
export async function inventoryValue(bid: ID): Promise<{ value: number; units: number }> {
  const ps = await db.products.where('[businessId+status]').equals([bid, 'active']).toArray();
  return { value: ps.reduce((a, p) => a + p.stockQty * p.avgCost, 0), units: ps.reduce((a, p) => a + p.stockQty, 0) };
}

export interface ProductProfit { productId: ID; name: string; sku: string; units: number; revenue: number; cogs: number; gross: number; adSpend: number; net: number; margin: number; returns: number; stock: number; avgCost: number; sellPrice: number; }
export async function productProfits(bid: ID, r: Range): Promise<ProductProfit[]> {
  const [orders, items, products, returns, campaigns] = await Promise.all([
    db.orders.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray(),
    db.orderItems.where('businessId').equals(bid).toArray(),
    db.products.where('businessId').equals(bid).toArray(),
    db.returns.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray(),
    db.campaigns.where('businessId').equals(bid).toArray(),
  ]);
  const inRange = new Map(orders.map((o) => [o.id, o]));
  const agg = new Map<ID, { units: number; revenue: number; cogs: number; returns: number }>();
  for (const it of items) {
    const o = inRange.get(it.orderId);
    if (!o || (o.status !== 'delivered' && o.status !== 'returned')) continue;
    const g = agg.get(it.productId) ?? { units: 0, revenue: 0, cogs: 0, returns: 0 };
    g.units += it.qty;
    g.revenue += it.qty * it.unitPrice - it.discount;
    g.cogs += it.qty * it.unitCost;
    if (o.status === 'returned') g.returns += 1;
    agg.set(it.productId, g);
  }
  // Ad allocation (ESTIMATED): allocate campaign spend in range by product revenue share. Marked estimated in UI.
  const campIn = campaigns.filter((c) => c.startDate <= r.to && (c.endDate ?? c.startDate) >= r.from);
  const totalAd = campIn.reduce((a, c) => a + c.spend, 0);
  const totalRev = [...agg.values()].reduce((a, g) => a + Math.max(0, g.revenue), 0);
  return products.filter((p) => p.status === 'active' || agg.has(p.id)).map((p) => {
    const g = agg.get(p.id) ?? { units: 0, revenue: 0, cogs: 0, returns: 0 };
    const gross = g.revenue - g.cogs;
    const adSpend = totalRev > 0 && totalAd > 0 ? Math.round((totalAd * Math.max(0, g.revenue)) / totalRev) : 0;
    const net = gross - adSpend;
    return { productId: p.id, name: p.name, sku: p.sku, units: g.units, revenue: g.revenue, cogs: g.cogs, gross, adSpend, net, margin: g.revenue > 0 ? (net / g.revenue) * 100 : 0, returns: returns.length ? g.returns : g.returns, stock: p.stockQty, avgCost: p.avgCost, sellPrice: p.sellPrice };
  }).sort((a, b) => b.revenue - a.revenue);
}

export interface CourierStat { courierId: ID; name: string; orders: number; delivered: number; returned: number; failed: number; successRate: number; returnRate: number; fees: number; revenue: number; }
export async function courierStats(bid: ID, r: Range): Promise<CourierStat[]> {
  const [orders, couriers, txns] = await Promise.all([
    db.orders.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray(),
    db.couriers.where('businessId').equals(bid).toArray(),
    txnsIn(bid, r),
  ]);
  const fees = new Map<ID, number>();
  for (const t of txns) if ((t.type === 'courier_fee' || t.type === 'return_fee') && t.courierId) fees.set(t.courierId, (fees.get(t.courierId) ?? 0) + t.amount);
  const by = new Map<string, { orders: number; delivered: number; returned: number; failed: number; revenue: number }>();
  for (const o of orders) {
    const k = o.courierId ?? 'none';
    const g = by.get(k) ?? { orders: 0, delivered: 0, returned: 0, failed: 0, revenue: 0 };
    g.orders++;
    if (o.status === 'delivered') { g.delivered++; g.revenue += o.total; }
    if (o.status === 'returned') g.returned++;
    if (o.status === 'failed' || o.status === 'cancelled') g.failed++;
    by.set(k, g);
  }
  const nameOf = (id: string) => id === 'none' ? '—' : couriers.find((c) => c.id === id)?.name ?? '—';
  return [...by.entries()].map(([courierId, g]) => ({
    courierId, name: nameOf(courierId), ...g,
    successRate: g.orders ? (g.delivered / g.orders) * 100 : 0,
    returnRate: g.orders ? (g.returned / g.orders) * 100 : 0,
    fees: fees.get(courierId) ?? 0,
  })).sort((a, b) => b.orders - a.orders);
}

export interface ChannelStat { channel: string; orders: number; revenue: number; profit: number; margin: number; returnRate: number }
export async function channelStats(bid: ID, r: Range): Promise<ChannelStat[]> {
  const orders = await db.orders.where('[businessId+date]').between([bid, r.from], [bid, r.to], true, true).toArray();
  const items = await db.orderItems.where('businessId').equals(bid).toArray();
  const byOrder = new Map<string, { rev: number; cost: number }>();
  for (const it of items) {
    const g = byOrder.get(it.orderId) ?? { rev: 0, cost: 0 };
    g.rev += it.qty * it.unitPrice - it.discount; g.cost += it.qty * it.unitCost;
    byOrder.set(it.orderId, g);
  }
  const by = new Map<string, { orders: number; revenue: number; profit: number; returned: number }>();
  for (const o of orders) {
    const g = by.get(o.channel) ?? { orders: 0, revenue: 0, profit: 0, returned: 0 };
    g.orders++;
    if (o.status === 'delivered') { const c = byOrder.get(o.id) ?? { rev: 0, cost: 0 }; g.revenue += o.total; g.profit += (c.rev - c.cost) + o.deliveryCharge - o.courierFee - o.codFee; }
    if (o.status === 'returned') g.returned++;
    by.set(o.channel, g);
  }
  return [...by.entries()].map(([channel, g]) => ({ channel, orders: g.orders, revenue: g.revenue, profit: g.profit, margin: g.revenue ? (g.profit / g.revenue) * 100 : 0, returnRate: g.orders ? (g.returned / g.orders) * 100 : 0 })).sort((a, b) => b.revenue - a.revenue);
}

export interface CustomerStat { customerId: ID; name: string; phone: string; orders: number; delivered: number; returned: number; cancelled: number; spent: number; outstanding: number; aov: number; lastDate: string; returnRate: number; segment: string }
export async function customerStats(bid: ID): Promise<CustomerStat[]> {
  const [orders, customers] = await Promise.all([
    db.orders.where('businessId').equals(bid).toArray(),
    db.customers.where('businessId').equals(bid).toArray(),
  ]);
  const by = new Map<ID, { orders: number; delivered: number; returned: number; cancelled: number; spent: number; outstanding: number; lastDate: string }>();
  for (const o of orders) {
    if (o.status === 'draft') continue;
    const g = by.get(o.customerId) ?? { orders: 0, delivered: 0, returned: 0, cancelled: 0, spent: 0, outstanding: 0, lastDate: '' };
    g.orders++;
    if (o.status === 'delivered') { g.delivered++; g.spent += o.total; }
    if (o.status === 'returned') g.returned++;
    if (o.status === 'cancelled' || o.status === 'failed') g.cancelled++;
    if (!['cancelled', 'returned', 'failed', 'draft'].includes(o.status)) g.outstanding += Math.max(0, o.total - o.paid);
    if (o.date > g.lastDate) g.lastDate = o.date;
    by.set(o.customerId, g);
  }
  return customers.filter((c) => c.status === 'active').map((c) => {
    const g = by.get(c.id) ?? { orders: 0, delivered: 0, returned: 0, cancelled: 0, spent: 0, outstanding: 0, lastDate: '' };
    const aov = g.delivered ? g.spent / g.delivered : 0;
    const returnRate = g.orders ? (g.returned / g.orders) * 100 : 0;
    const segment = g.orders === 0 ? 'new' : returnRate >= 30 && g.orders >= 3 ? 'high-return' : g.delivered >= 5 || g.spent >= 5000000 ? 'high-value' : g.delivered >= 2 ? 'returning' : 'new';
    return { customerId: c.id, name: c.name, phone: c.phone, ...g, aov, returnRate, segment };
  }).sort((a, b) => b.spent - a.spent);
}
