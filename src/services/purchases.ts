/** PURCHASE ENGINE — batches, landed cost, weighted-average valuation. */
import { db, type ID } from '../db/db';
import { addTxn, addMove, wavg, audit } from './ledger';
import { uid } from '../lib/id';
import { ymd } from '../lib/dates';

export interface NewPurchaseItem { productId: ID; variantId?: ID; qty: number; unitCost: number }
export interface NewPurchase { supplierId?: ID; date?: string; items: NewPurchaseItem[]; extraCost?: number; paid?: number; notes?: string }

export async function createPurchase(bid: ID, input: NewPurchase): Promise<ID> {
  if (!input.items.length) throw new Error('purchase-empty');
  const date = input.date ?? ymd();
  const subtotal = input.items.reduce((a, i) => a + i.qty * i.unitCost, 0);
  const extra = input.extraCost ?? 0;
  const total = subtotal + extra;
  const paid = Math.min(input.paid ?? total, total);
  const id = uid('pu');
  const count = await db.purchases.where('businessId').equals(bid).count();
  const code = `PO-${String(count + 1).padStart(4, '0')}`;
  await db.transaction('rw', [db.purchases, db.purchaseItems, db.batches, db.products, db.variants, db.moves, db.txns], async () => {
    await db.purchases.add({ id, businessId: bid, supplierId: input.supplierId, code, date, subtotal, extraCost: extra, total, paid, status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid', notes: input.notes, createdAt: Date.now() });
    for (const it of input.items) {
      // allocate extra cost proportionally (largest-remainder via rounding on last line)
      const share = subtotal > 0 ? Math.round((extra * it.qty * it.unitCost) / subtotal) : 0;
      const effUnit = Math.round((it.qty * it.unitCost + share) / it.qty);
      const batchId = uid('bt');
      await db.purchaseItems.add({ id: uid('pi'), businessId: bid, purchaseId: id, productId: it.productId, variantId: it.variantId, qty: it.qty, unitCost: effUnit, batchId });
      await db.batches.add({ id: batchId, businessId: bid, productId: it.productId, variantId: it.variantId, purchaseId: id, date, qty: it.qty, remaining: it.qty, unitCost: effUnit, supplierId: input.supplierId });
      if (it.variantId) {
        const v = await db.variants.get(it.variantId);
        if (!v) throw new Error('variant-missing');
        const avg = wavg(v.stockQty, v.avgCost, it.qty, effUnit);
        const bal = v.stockQty + it.qty;
        await db.variants.update(it.variantId, { stockQty: bal, avgCost: avg });
        await addMove({ businessId: bid, productId: it.productId, variantId: it.variantId, date, type: 'purchase', qty: it.qty, balance: bal, refType: 'purchase', refId: id, notes: code });
        const p = await db.products.get(it.productId);
        if (p) {
          const vs = await db.variants.where('[businessId+productId]').equals([bid, it.productId]).toArray();
          const tq = vs.reduce((a, x) => a + (x.id === it.variantId ? bal : x.stockQty), 0);
          const tv = vs.reduce((a, x) => a + (x.id === it.variantId ? bal * avg : x.stockQty * x.avgCost), 0);
          await db.products.update(it.productId, { stockQty: tq, avgCost: tq ? Math.round(tv / tq) : avg, updatedAt: Date.now() });
        }
      } else {
        const p = await db.products.get(it.productId);
        if (!p) throw new Error('product-missing');
        const avg = wavg(p.stockQty, p.avgCost, it.qty, effUnit);
        const bal = p.stockQty + it.qty;
        await db.products.update(it.productId, { stockQty: bal, avgCost: avg, updatedAt: Date.now() });
        await addMove({ businessId: bid, productId: it.productId, date, type: 'purchase', qty: it.qty, balance: bal, refType: 'purchase', refId: id, notes: code });
      }
    }
    if (paid > 0) await addTxn({ businessId: bid, date, type: 'purchase', direction: 'out', amount: paid, category: 'inventory', refType: 'purchase', refId: id, supplierId: input.supplierId, notes: `Purchase ${code}` });
  });
  await audit(bid, 'create', 'purchase', id, code);
  return id;
}

export async function paySupplier(bid: ID, purchaseId: ID, amount: number, date = ymd()): Promise<number> {
  const p = await db.purchases.get(purchaseId);
  if (!p || p.businessId !== bid) throw new Error('purchase-missing');
  const due = Math.max(0, p.total - p.paid);
  const applied = Math.min(amount, due);
  if (applied <= 0) throw new Error('amount-invalid');
  await db.transaction('rw', [db.purchases, db.txns], async () => {
    const paid = p.paid + applied;
    await db.purchases.update(purchaseId, { paid, status: paid >= p.total ? 'paid' : 'partial' });
    await addTxn({ businessId: bid, date, type: 'supplier_payment', direction: 'out', amount: applied, category: 'inventory', refType: 'purchase', refId: purchaseId, supplierId: p.supplierId, notes: `Supplier payment ${p.code}` });
  });
  await audit(bid, 'payment', 'purchase', purchaseId, `+${applied}`);
  return applied;
}
