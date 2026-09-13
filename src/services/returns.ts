/** RETURN + DAMAGE ENGINE — returns are financial + inventory events, not just a status. */
import { db, type ID, type ReturnCondition } from '../db/db';
import { addTxn, applyStock, audit } from './ledger';
import { uid } from '../lib/id';
import { ymd } from '../lib/dates';

export interface NewReturn { orderId: ID; date?: string; condition: ReturnCondition; refund?: number; returnFee?: number; notes?: string }

export async function processReturn(bid: ID, input: NewReturn): Promise<ID> {
  const o = await db.orders.get(input.orderId);
  if (!o || o.businessId !== bid) throw new Error('order-missing');
  if (o.status !== 'delivered' && o.status !== 'shipped') throw new Error('return-state');
  const date = input.date ?? ymd();
  const items = await db.orderItems.where('[businessId+orderId]').equals([bid, o.id]).toArray();
  const cogs = items.reduce((a, it) => a + it.qty * it.unitCost, 0);
  const refund = Math.min(input.refund ?? o.paid, Math.max(o.paid, o.total));
  const returnFee = input.returnFee ?? 0;
  const restock = input.condition === 'resellable' || input.condition === 'partial';
  const id = uid('rt');
  await db.transaction('rw', [db.orders, db.returns, db.products, db.variants, db.moves, db.txns, db.payments], async () => {
    await db.orders.update(o.id, { status: 'returned', updatedAt: Date.now() });
    let restockQty = 0;
    if (restock) {
      for (const it of items) {
        const q = input.condition === 'partial' ? Math.floor(it.qty / 2) : it.qty;
        if (q > 0) { await applyStock(bid, it.productId, it.variantId, q, date, 'return_in', { refType: 'return', refId: id, notes: o.code }); restockQty += q; }
      }
    }
    await db.returns.add({ id, businessId: bid, orderId: o.id, customerId: o.customerId, date, condition: input.condition, restocked: restock, restockQty, refund, returnFee, outboundLost: (o.courierFee ?? 0) + (o.codFee ?? 0), notes: input.notes, createdAt: Date.now() });
    // financial reversals
    await addTxn({ businessId: bid, date, type: 'sale_reversal', direction: 'out', amount: o.total, category: 'sales', refType: 'return', refId: id, orderId: o.id, customerId: o.customerId, notes: `Return reversal ${o.code}` });
    if (cogs > 0 && restock) await addTxn({ businessId: bid, date, type: 'cogs_reversal', direction: 'in', amount: cogs, category: 'cogs', refType: 'return', refId: id, orderId: o.id, notes: `COGS reversal ${o.code}` });
    if (cogs > 0 && !restock) await addTxn({ businessId: bid, date, type: 'expense', direction: 'out', amount: cogs, category: 'damage', refType: 'return', refId: id, orderId: o.id, notes: `Damaged goods ${o.code}` });
    if (returnFee > 0) await addTxn({ businessId: bid, date, type: 'return_fee', direction: 'out', amount: returnFee, category: 'courier', refType: 'return', refId: id, orderId: o.id, courierId: o.courierId, notes: `Return fee ${o.code}` });
    if (refund > 0) {
      await db.payments.add({ id: uid('py'), businessId: bid, orderId: o.id, customerId: o.customerId, date, amount: refund, method: o.payMethod, direction: 'out', kind: 'refund', notes: `Refund ${o.code}`, createdAt: Date.now() });
      await addTxn({ businessId: bid, date, type: 'refund', direction: 'out', amount: refund, category: 'refund', refType: 'return', refId: id, orderId: o.id, customerId: o.customerId, notes: `Refund ${o.code}` });
      await db.orders.update(o.id, { paid: Math.max(0, o.paid - refund) });
    }
  });
  await audit(bid, 'create', 'return', id, `${o.code} ${input.condition}`);
  return id;
}

export async function recordDamage(bid: ID, input: { productId: ID; variantId?: ID; qty: number; reason: string; date?: string; notes?: string }): Promise<ID> {
  const p = await db.products.get(input.productId);
  if (!p || p.businessId !== bid) throw new Error('product-missing');
  if (!Number.isInteger(input.qty) || input.qty <= 0) throw new Error('qty-invalid');
  const stock = input.variantId ? (await db.variants.get(input.variantId))?.stockQty ?? 0 : p.stockQty;
  if (stock < input.qty) throw new Error('stock-short');
  const date = input.date ?? ymd();
  const unitCost = input.variantId ? (await db.variants.get(input.variantId))?.avgCost ?? 0 : p.avgCost;
  const id = uid('dm');
  await db.transaction('rw', [db.damages, db.products, db.variants, db.moves, db.txns], async () => {
    await db.damages.add({ id, businessId: bid, productId: input.productId, variantId: input.variantId, date, qty: input.qty, unitCost, reason: input.reason, notes: input.notes, createdAt: Date.now() });
    await applyStock(bid, input.productId, input.variantId, -input.qty, date, 'damage', { refType: 'damage', refId: id, notes: input.reason });
    const loss = input.qty * unitCost;
    if (loss > 0) await addTxn({ businessId: bid, date, type: 'expense', direction: 'out', amount: loss, category: 'damage', refType: 'damage', refId: id, productId: input.productId, notes: `Damage: ${p.name} ×${input.qty}` });
  });
  await audit(bid, 'create', 'damage', id, `${p.name} ×${input.qty}`);
  return id;
}
