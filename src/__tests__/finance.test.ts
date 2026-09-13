import { describe, it, expect } from 'vitest';
import { summarizeTxns } from '../services/finance';
import { wavg } from '../services/ledger';
import type { Txn } from '../db/db';

const tx = (p: Partial<Txn>): Txn => ({ id: 'x', businessId: 'b', date: '2026-09-01', ts: 1, direction: 'in', amount: 0, category: '', ...p } as Txn);

describe('financial engine', () => {
  it('computes P&L: revenue - cogs - ads - delivery - operating - refunds + other', () => {
    const list = [
      tx({ type: 'sale', direction: 'in', amount: 25000000, category: 'sales' }),
      tx({ type: 'cogs', direction: 'out', amount: 10000000, category: 'cogs' }),
      tx({ type: 'expense', direction: 'out', amount: 2500000, category: 'advertising' }),
      tx({ type: 'courier_fee', direction: 'out', amount: 1800000, category: 'courier' }),
      tx({ type: 'refund', direction: 'out', amount: 750000, category: 'refund' }),
      tx({ type: 'expense', direction: 'out', amount: 2410000, category: 'rent' }),
      tx({ type: 'other_income', direction: 'in', amount: 100000, category: 'other' }),
    ];
    const s = summarizeTxns(list);
    expect(s.revenue).toBe(25000000);
    expect(s.gross).toBe(15000000);
    expect(s.net).toBe(15000000 - 2500000 - 1800000 - 2410000 - 750000 + 100000);
    expect(s.margin).toBeCloseTo((s.net / s.revenue) * 100, 6);
  });
  it('reversals reduce revenue/cogs (returns)', () => {
    const s = summarizeTxns([
      tx({ type: 'sale', direction: 'in', amount: 90000 }),
      tx({ type: 'cogs', direction: 'out', amount: 57500 }),
      tx({ type: 'sale_reversal', direction: 'out', amount: 90000 }),
      tx({ type: 'cogs_reversal', direction: 'in', amount: 57500 }),
    ]);
    expect(s.revenue).toBe(0);
    expect(s.cogs).toBe(0);
    expect(s.net).toBe(0);
  });
  it('cash flow excludes accrual txns (profit != cash)', () => {
    const s = summarizeTxns([
      tx({ type: 'sale', direction: 'in', amount: 90000 }),
      tx({ type: 'cogs', direction: 'out', amount: 57500 }),
      tx({ type: 'customer_payment', direction: 'in', amount: 6000 }),
      tx({ type: 'expense', direction: 'out', amount: 6000, category: 'courier' }),
    ]);
    expect(s.inflow).toBe(6000);
    expect(s.outflow).toBe(6000);
    expect(s.netCash).toBe(0);
  });
  it('weighted average cost: 100u@500 + shipping allocation', () => {
    // 100 units x 500 = 50000 + 7500 extra => 575/unit
    expect(wavg(0, 0, 100, 57500)).toBe(57500);
    expect(wavg(100, 57500, 100, 60000)).toBe(58750);
  });
});
