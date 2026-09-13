/** End-to-end: onboarding → purchase → order → payment → delivery → profit → return → refund.
 *  Runs against fake IndexedDB. Verifies ledger + inventory consistency. */
import { describe, it, expect, beforeAll } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/db';
import { uid } from '../lib/id';
import { toPaisa } from '../lib/money';
import { createPurchase } from '../services/purchases';
import { createOrder, setOrderStatus, addOrderPayment } from '../services/orders';
import { processReturn } from '../services/returns';
import { createExpense } from '../services/expenses';
import { periodSummary, cashPosition, receivables, inventoryValue } from '../services/finance';

const D = '2026-09-10';
const R = { from: '2026-09-01', to: '2026-09-13' };
let BID = '', PID = '', CID = '', OID = '';

beforeAll(async () => {
  BID = uid('bi');
  await db.businesses.add({ id: BID, name: 'Test Shop', openingCash: toPaisa(10000), createdAt: 1, seq: 0 });
  PID = uid('pr');
  await db.products.add({ id: PID, businessId: BID, name: 'Test Hijab', sku: 'T-1', sellPrice: toPaisa(900), stockQty: 0, avgCost: 0, status: 'active', createdAt: 1, updatedAt: 1 });
  CID = uid('cu');
  await db.customers.add({ id: CID, businessId: BID, name: 'Test Customer', phone: '01700000000', status: 'active', createdAt: 1 });
});

describe('full business lifecycle', () => {
  it('purchase: 100u x 500 + 7500 extra => 575/unit, stock 100', async () => {
    await createPurchase(BID, { date: D, items: [{ productId: PID, qty: 100, unitCost: toPaisa(500) }], extraCost: toPaisa(7500), paid: toPaisa(57500) });
    const p = await db.products.get(PID);
    expect(p?.stockQty).toBe(100);
    expect(p?.avgCost).toBe(57500);
  });
  it('order: 2u @900 + 60 delivery, advance 60 => stock 98, due = total-60', async () => {
    OID = await createOrder(BID, { customerId: CID, items: [{ productId: PID, qty: 2 }], channel: 'facebook', date: D, deliveryCharge: toPaisa(60), advance: toPaisa(60) });
    const o = await db.orders.get(OID);
    expect(o?.total).toBe(toPaisa(1860));
    expect(o?.paid).toBe(toPaisa(60));
    expect((await db.products.get(PID))?.stockQty).toBe(98);
  });
  it('delivery: revenue 1860, cogs 1150; cash still only 60 in', async () => {
    await setOrderStatus(BID, OID, 'delivered', { date: D });
    const s = await periodSummary(BID, R);
    expect(s.revenue).toBe(toPaisa(1860));
    expect(s.cogs).toBe(2 * 57500);
    const c = await cashPosition(BID);
    // opening 10000 + advance 60 - purchase 57500... wait purchase paid 57500 = 57500 taka? No: toPaisa(57500 taka) = 5750000 paisa
    expect(c.inflow).toBe(toPaisa(60));
  });
  it('collect due: receivable cleared, overpay reported', async () => {
    const due = toPaisa(1800);
    const r = await addOrderPayment(BID, OID, due + 5000, 'cash');
    expect(r.applied).toBe(due);
    expect(r.over).toBe(5000);
    expect(await receivables(BID)).toBe(0);
  });
  it('expense reduces net profit', async () => {
    await createExpense(BID, { date: D, category: 'rent', amount: toPaisa(5000) });
    const s = await periodSummary(BID, R);
    // gross = 186000 - 115000 = 71000; net = 71000 - 500000 = -429000
    expect(s.gross).toBe(toPaisa(1860) - 2 * 57500);
    expect(s.net).toBe(s.gross - toPaisa(5000));
  });
  it('return (resellable): stock back, revenue+cogs reversed, refund out', async () => {
    await processReturn(BID, { orderId: OID, date: D, condition: 'resellable', refund: toPaisa(1860), returnFee: toPaisa(60) });
    expect((await db.products.get(PID))?.stockQty).toBe(100);
    const s = await periodSummary(BID, R);
    expect(s.revenue).toBe(0);
    expect(s.cogs).toBe(0);
    expect(s.refunds).toBe(toPaisa(1860));
    expect(s.delivery).toBe(toPaisa(60));
    const iv = await inventoryValue(BID);
    expect(iv.value).toBe(100 * 57500);
  });
  it('cash reconciles: opening + in - out = balance', async () => {
    const c = await cashPosition(BID);
    expect(c.balance).toBe(c.opening + c.inflow - c.outflow);
    // in: 60 + 1800 = 1860; out: 57500 + 5000 + 1860 + 60
    expect(c.inflow).toBe(toPaisa(1860));
    expect(c.outflow).toBe(toPaisa(57500 + 5000 + 1860 + 60));
  });
});
