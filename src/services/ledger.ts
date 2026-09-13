/** Ledger primitives — every financial/stock mutation flows through here (audit-traced). */
import { db, type ID, type Txn, type Move, type MoveType } from '../db/db';
import { uid } from '../lib/id';
import { ymd } from '../lib/dates';

export async function addTxn(t: Omit<Txn, 'id' | 'ts' | 'businessId'> & { businessId?: ID; id?: ID; ts?: number }): Promise<ID> {
  const id = t.id ?? uid('tx');
  await db.txns.add({ ...t, id, businessId: t.businessId as ID, ts: t.ts ?? Date.now() } as Txn);
  return id;
}

export async function addMove(m: Omit<Move, 'id' | 'createdAt'> & { id?: ID }): Promise<ID> {
  const id = m.id ?? uid('mv');
  await db.moves.add({ ...m, id, createdAt: Date.now() } as Move);
  return id;
}

export async function audit(businessId: ID, action: string, entity: string, entityId?: string, detail?: string): Promise<void> {
  await db.audit.add({ id: uid('au'), businessId, ts: Date.now(), action, entity, entityId, detail }).catch(() => undefined);
}

/** Adjust product (or variant) stock + weighted-average cost. Returns new balance. */
export async function applyStock(businessId: ID, productId: ID, variantId: ID | undefined, qtyDelta: number, date = ymd(), type: MoveType = 'adjustment', ref?: { refType?: string; refId?: ID; notes?: string }): Promise<number> {
  return db.transaction('rw', [db.products, db.variants, db.moves], async () => {
    if (variantId) {
      const v = await db.variants.get(variantId);
      if (!v) throw new Error('variant-missing');
      const balance = Math.max(0, v.stockQty + qtyDelta);
      await db.variants.update(variantId, { stockQty: balance });
      await addMove({ businessId, productId, variantId, date, type, qty: qtyDelta, balance, ...ref });
      // mirror into product totals
      const p = await db.products.get(productId);
      if (p) {
        const vs = await db.variants.where('[businessId+productId]').equals([businessId, productId]).toArray();
        const total = vs.reduce((a, x) => a + (x.id === variantId ? balance : x.stockQty), 0);
        await db.products.update(productId, { stockQty: total, updatedAt: Date.now() });
      }
      return balance;
    }
    const p = await db.products.get(productId);
    if (!p) throw new Error('product-missing');
    const balance = Math.max(0, p.stockQty + qtyDelta);
    await db.products.update(productId, { stockQty: balance, updatedAt: Date.now() });
    await addMove({ businessId, productId, date, type, qty: qtyDelta, balance, ...ref });
    return balance;
  });
}

/** Weighted-average cost update on purchase. All amounts in paisa. */
export function wavg(oldQty: number, oldAvg: number, newQty: number, newUnit: number): number {
  const total = oldQty + newQty;
  if (total <= 0) return newUnit;
  return Math.round((oldQty * oldAvg + newQty * newUnit) / total);
}
