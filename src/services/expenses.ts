/** EXPENSE + AD-CAMPAIGN services. Campaign spend posts to the expense ledger (single source). */
import { db, type ID, type Campaign } from '../db/db';
import { addTxn, audit } from './ledger';
import { uid } from '../lib/id';
import { ymd } from '../lib/dates';

export async function createExpense(bid: ID, input: { date?: string; category: string; amount: number; paid?: number; notes?: string }): Promise<ID> {
  if (input.amount <= 0) throw new Error('amount-invalid');
  const date = input.date ?? ymd();
  const paid = Math.min(input.paid ?? input.amount, input.amount);
  const id = uid('ex');
  await db.transaction('rw', [db.expenses, db.txns], async () => {
    await db.expenses.add({ id, businessId: bid, date, category: input.category, amount: input.amount, paid, notes: input.notes, createdAt: Date.now() });
    if (paid > 0) await addTxn({ businessId: bid, date, type: 'expense', direction: 'out', amount: paid, category: input.category, refType: 'expense', refId: id, notes: input.notes ?? `Expense ${input.category}` });
  });
  await audit(bid, 'create', 'expense', id, `${input.category} ${input.amount}`);
  return id;
}

export async function deleteExpense(bid: ID, expenseId: ID): Promise<void> {
  const e = await db.expenses.get(expenseId);
  if (!e || e.businessId !== bid) throw new Error('expense-missing');
  await db.transaction('rw', [db.expenses, db.txns], async () => {
    // void linked cash txns (never silently mutate history — mark voided)
    const linked = await db.txns.where('refId').equals(expenseId).toArray();
    for (const t of linked) await db.txns.update(t.id, { voided: true });
    await db.expenses.delete(expenseId);
  });
  await audit(bid, 'delete', 'expense', expenseId, `${e.category} ${e.amount} (txns voided)`);
}

export async function createCampaign(bid: ID, input: Omit<Campaign, 'id' | 'businessId' | 'createdAt'>): Promise<ID> {
  const id = uid('cp');
  await db.transaction('rw', [db.campaigns, db.expenses, db.txns], async () => {
    await db.campaigns.add({ ...input, id, businessId: bid, createdAt: Date.now() });
    if (input.spend > 0) {
      const exId = uid('ex');
      await db.expenses.add({ id: exId, businessId: bid, date: input.startDate, category: 'advertising', amount: input.spend, paid: input.spend, notes: `Ad: ${input.name}`, refType: 'campaign', refId: id, createdAt: Date.now() });
      await addTxn({ businessId: bid, date: input.startDate, type: 'expense', direction: 'out', amount: input.spend, category: 'advertising', refType: 'campaign', refId: id, notes: `Ad spend: ${input.name}` });
    }
  });
  await audit(bid, 'create', 'campaign', id, input.name);
  return id;
}

export async function updateCampaign(bid: ID, id: ID, patch: Partial<Campaign>): Promise<void> {
  const c = await db.campaigns.get(id);
  if (!c || c.businessId !== bid) throw new Error('campaign-missing');
  await db.transaction('rw', [db.campaigns, db.expenses, db.txns], async () => {
    await db.campaigns.update(id, patch);
    if (patch.spend !== undefined && patch.spend !== c.spend) {
      const linked = await db.expenses.where('refId').equals(id).first();
      const oldTxns = await db.txns.where('refId').equals(id).toArray();
      for (const t of oldTxns) await db.txns.update(t.id, { voided: true });
      if (linked) {
        await db.expenses.update(linked.id, { amount: patch.spend, paid: patch.spend, date: patch.startDate ?? linked.date });
        await addTxn({ businessId: bid, date: patch.startDate ?? linked.date, type: 'expense', direction: 'out', amount: patch.spend, category: 'advertising', refType: 'campaign', refId: id, notes: `Ad spend: ${c.name}` });
      }
    }
  });
  await audit(bid, 'update', 'campaign', id, c.name);
}

export async function recordCapital(bid: ID, amount: number, notes?: string, date = ymd()): Promise<void> {
  if (amount <= 0) throw new Error('amount-invalid');
  await addTxn({ businessId: bid, date, type: 'capital', direction: 'in', amount, category: 'capital', refType: 'manual', notes: notes ?? 'Capital added' });
  await audit(bid, 'create', 'capital', undefined, `${amount}`);
}
