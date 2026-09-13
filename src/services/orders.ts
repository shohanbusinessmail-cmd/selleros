/** ORDER ENGINE — lifecycle with correct stock + financial side-effects. */
import { db, type ID, type Order, type OrderStatus, type PayMethod, type Channel } from '../db/db';
import { addTxn, applyStock, audit } from './ledger';
import { uid, orderCode } from '../lib/id';
import { ymd } from '../lib/dates';

const STOCK_STAGES: OrderStatus[] = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];
const holdsStock = (s: OrderStatus) => STOCK_STAGES.includes(s);

export interface NewOrderItem { productId: ID; variantId?: ID; qty: number; unitPrice?: number; discount?: number }
export interface NewOrder {
  customerId: ID; items: NewOrderItem[]; channel: Channel; date?: string;
  discount?: number; deliveryCharge?: number; advance?: number; payMethod?: PayMethod;
  courierId?: ID; trackingId?: string; courierFee?: number; codFee?: number; notes?: string; status?: OrderStatus;
}

async function nextCode(bid: ID): Promise<string> {
  const b = await db.businesses.get(bid);
  const seq = (b?.seq ?? 0) + 1;
  await db.businesses.update(bid, { seq });
  return orderCode(seq);
}

export async function createOrder(bid: ID, input: NewOrder): Promise<ID> {
  if (!input.items.length) throw new Error('order-empty');
  const date = input.date ?? ymd();
  const status: OrderStatus = input.status ?? 'pending';
  // freeze costs + validate stock
  let subtotal = 0;
  const lines: { productId: ID; variantId?: ID; productName: string; qty: number; unitPrice: number; unitCost: number; discount: number }[] = [];
  for (const it of input.items) {
    const p = await db.products.get(it.productId);
    if (!p || p.businessId !== bid) throw new Error('product-missing');
    let unitCost = p.avgCost, unitPrice = it.unitPrice ?? p.sellPrice - (p.discount ?? 0), name = p.name, stock = p.stockQty;
    if (it.variantId) {
      const v = await db.variants.get(it.variantId);
      if (!v) throw new Error('variant-missing');
      unitCost = v.avgCost; stock = v.stockQty; name = `${p.name} · ${v.name}`;
      if (it.unitPrice === undefined && v.sellPrice) unitPrice = v.sellPrice;
    }
    if (!Number.isInteger(it.qty) || it.qty <= 0) throw new Error('qty-invalid');
    if (holdsStock(status) && stock < it.qty) throw new Error(`stock-short:${p.name}`);
    subtotal += it.qty * unitPrice;
    lines.push({ productId: p.id, variantId: it.variantId, productName: name, qty: it.qty, unitPrice, unitCost, discount: it.discount ?? 0 });
  }
  const lineDisc = lines.reduce((a, l) => a + l.discount, 0);
  const discount = (input.discount ?? 0) + lineDisc;
  const deliveryCharge = input.deliveryCharge ?? 0;
  const total = Math.max(0, subtotal - discount + deliveryCharge);
  const advance = Math.min(input.advance ?? 0, total);
  const id = uid('or');
  const code = await nextCode(bid);
  await db.transaction('rw', [db.orders, db.orderItems, db.products, db.variants, db.moves, db.txns, db.payments], async () => {
    const order: Order = {
      id, businessId: bid, code, customerId: input.customerId, status, channel: input.channel,
      courierId: input.courierId, trackingId: input.trackingId, date,
      subtotal, discount, deliveryCharge, total, paid: advance,
      payMethod: input.payMethod ?? 'cod', advance, courierFee: input.courierFee ?? 0, codFee: input.codFee ?? 0,
      notes: input.notes, createdAt: Date.now(), updatedAt: Date.now(),
    };
    await db.orders.add(order);
    for (const l of lines) {
      await db.orderItems.add({ id: uid('oi'), businessId: bid, orderId: id, ...l });
      if (holdsStock(status)) await applyStock(bid, l.productId, l.variantId, -l.qty, date, 'sale', { refType: 'order', refId: id, notes: code });
    }
    if (advance > 0) {
      await db.payments.add({ id: uid('py'), businessId: bid, orderId: id, customerId: input.customerId, date, amount: advance, method: order.payMethod, direction: 'in', kind: 'advance', createdAt: Date.now() });
      await addTxn({ businessId: bid, date, type: 'customer_payment', direction: 'in', amount: advance, category: 'sales', refType: 'order', refId: id, orderId: id, customerId: input.customerId, notes: `Advance ${code}` });
    }
    if (status === 'delivered') await recognizeDelivery(bid, order, lines.map((l) => ({ qty: l.qty, unitCost: l.unitCost })));
  });
  await audit(bid, 'create', 'order', id, code);
  return id;
}

async function recognizeDelivery(bid: ID, o: Order, lines: { qty: number; unitCost: number }[]): Promise<void> {
  const cogs = lines.reduce((a, l) => a + l.qty * l.unitCost, 0);
  await addTxn({ businessId: bid, date: o.deliveredAt ?? o.date, type: 'sale', direction: 'in', amount: o.total, category: 'sales', refType: 'order', refId: o.id, orderId: o.id, customerId: o.customerId, notes: `Revenue ${o.code}` });
  if (cogs > 0) await addTxn({ businessId: bid, date: o.deliveredAt ?? o.date, type: 'cogs', direction: 'out', amount: cogs, category: 'cogs', refType: 'order', refId: o.id, orderId: o.id, notes: `COGS ${o.code}` });
  const fee = (o.courierFee ?? 0) + (o.codFee ?? 0);
  if (fee > 0) await addTxn({ businessId: bid, date: o.deliveredAt ?? o.date, type: 'courier_fee', direction: 'out', amount: fee, category: 'courier', refType: 'order', refId: o.id, orderId: o.id, courierId: o.courierId, notes: `Courier ${o.code}` });
}

/** Transition an order; applies reversals/recognition. Returns void. Throws on illegal transition. */
export async function setOrderStatus(bid: ID, orderId: ID, to: OrderStatus, opts?: { date?: string }): Promise<void> {
  const o = await db.orders.get(orderId);
  if (!o || o.businessId !== bid) throw new Error('order-missing');
  const from = o.status;
  if (from === to) return;
  if (from === 'returned') throw new Error('transition-illegal');
  if (from === 'delivered' && !['returned'].includes(to)) throw new Error('transition-illegal');
  if ((from === 'cancelled' || from === 'failed') && to !== 'draft' && to !== 'pending') throw new Error('transition-illegal');
  const date = opts?.date ?? ymd();
  const items = await db.orderItems.where('[businessId+orderId]').equals([bid, orderId]).toArray();
  await db.transaction('rw', [db.orders, db.orderItems, db.products, db.variants, db.moves, db.txns], async () => {
    const wasHeld = holdsStock(from), willHold = holdsStock(to);
    if (wasHeld && !willHold) {
      for (const it of items) await applyStock(bid, it.productId, it.variantId, it.qty, date, 'sale_reversal', { refType: 'order', refId: o.id, notes: `${o.code} ${from}→${to}` });
    }
    if (!wasHeld && willHold) {
      for (const it of items) {
        const stock = it.variantId ? (await db.variants.get(it.variantId))?.stockQty ?? 0 : (await db.products.get(it.productId))?.stockQty ?? 0;
        if (stock < it.qty) throw new Error('stock-short');
        await applyStock(bid, it.productId, it.variantId, -it.qty, date, 'sale', { refType: 'order', refId: o.id, notes: o.code });
      }
    }
    const patch: Partial<Order> = { status: to, updatedAt: Date.now() };
    if (to === 'delivered') {
      patch.deliveredAt = date;
      await recognizeDelivery(bid, { ...o, ...patch }, items);
    }
    await db.orders.update(orderId, patch);
  });
  await audit(bid, 'status', 'order', orderId, `${o.code}: ${from} → ${to}`);
}

/** Record a payment against an order (in = collect, out = refund-ish manual). Clamps overpay. */
export async function addOrderPayment(bid: ID, orderId: ID, amountTaka100: number, method: PayMethod, kind: 'order' | 'advance' | 'other' = 'order', notes?: string, date = ymd()): Promise<{ applied: number; over: number }> {
  const o = await db.orders.get(orderId);
  if (!o || o.businessId !== bid) throw new Error('order-missing');
  if (amountTaka100 <= 0) throw new Error('amount-invalid');
  const due = Math.max(0, o.total - o.paid);
  const applied = Math.min(amountTaka100, due);
  const over = amountTaka100 - applied;
  await db.transaction('rw', [db.orders, db.payments, db.txns], async () => {
    await db.orders.update(orderId, { paid: o.paid + applied, updatedAt: Date.now() });
    await db.payments.add({ id: uid('py'), businessId: bid, orderId, customerId: o.customerId, date, amount: applied, method, direction: 'in', kind, notes, createdAt: Date.now() });
    await addTxn({ businessId: bid, date, type: 'customer_payment', direction: 'in', amount: applied, category: 'sales', refType: 'order', refId: orderId, orderId, customerId: o.customerId, notes: notes ?? `Payment ${o.code}` });
  });
  await audit(bid, 'payment', 'order', orderId, `${o.code} +${applied}`);
  return { applied, over };
}

export async function updateOrderMeta(bid: ID, orderId: ID, patch: Partial<Pick<Order, 'courierId' | 'trackingId' | 'notes' | 'channel' | 'courierFee' | 'codFee' | 'payMethod'>>): Promise<void> {
  await db.orders.update(orderId, { ...patch, updatedAt: Date.now() });
  await audit(bid, 'update', 'order', orderId, 'meta');
}
