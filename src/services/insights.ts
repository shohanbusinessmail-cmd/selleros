/**
 * BUSINESS INSIGHTS — local rules engine (NOT "AI"). Every insight cites real numbers.
 * Health score: transparent 0–100 with weighted inputs + explanations.
 */
import { db, type ID } from '../db/db';
import { periodSummary, productProfits, cashPosition, inventoryValue, receivables, type Range } from './finance';
import { prevRange } from '../lib/dates';

export interface Insight { id: string; level: 'good' | 'warn' | 'bad' | 'info'; title: string; body: string; link?: string }
export interface Health { score: number; grade: string; parts: { label: string; score: number; weight: number; note: string }[] }

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function buildInsights(bid: ID, r: Range): Promise<Insight[]> {
  const out: Insight[] = [];
  const [cur, prv, prods, cash, inv] = await Promise.all([
    periodSummary(bid, r), periodSummary(bid, prevRange(r)), productProfits(bid, r), cashPosition(bid), inventoryValue(bid),
  ]);
  const push = (id: string, level: Insight['level'], title: string, body: string, link?: string) => out.push({ id, level, title, body, link });
  if (cur.orders === 0) {
    push('empty', 'info', 'insights.empty.t', 'insights.empty.b', '/products');
    return out;
  }
  // return rate
  const rr = cur.delivered + cur.returned > 0 ? (cur.returned / (cur.delivered + cur.returned)) * 100 : 0;
  const prr = prv.delivered + prv.returned > 0 ? (prv.returned / (prv.delivered + prv.returned)) * 100 : 0;
  if (rr >= 15) push('ret-high', 'bad', 'insights.retHigh.t', `insights.retHigh.b|${rr.toFixed(1)}`, '/returns');
  else if (rr > prr + 3 && cur.returned > 0) push('ret-up', 'warn', 'insights.retUp.t', `insights.retUp.b|${prr.toFixed(1)}|${rr.toFixed(1)}`, '/returns');
  else if (cur.delivered >= 5 && rr < 5) push('ret-good', 'good', 'insights.retGood.t', `insights.retGood.b|${rr.toFixed(1)}`);
  // margin
  if (cur.margin < 0) push('margin-neg', 'bad', 'insights.marginNeg.t', `insights.marginNeg.b|${cur.margin.toFixed(1)}`, '/reports');
  else if (cur.margin < 10 && cur.revenue > 0) push('margin-low', 'warn', 'insights.marginLow.t', `insights.marginLow.b|${cur.margin.toFixed(1)}`, '/reports');
  else if (cur.margin >= 25) push('margin-good', 'good', 'insights.marginGood.t', `insights.marginGood.b|${cur.margin.toFixed(1)}`);
  // ROAS
  const roas = cur.adSpend > 0 ? cur.revenue / cur.adSpend : 0;
  const proas = prv.adSpend > 0 ? prv.revenue / prv.adSpend : 0;
  if (cur.adSpend > 0 && roas < 2) push('roas-low', 'bad', 'insights.roasLow.t', `insights.roasLow.b|${roas.toFixed(2)}`, '/marketing');
  else if (cur.adSpend > prv.adSpend * 1.3 && roas < proas && proas > 0) push('roas-down', 'warn', 'insights.roasDown.t', `insights.roasDown.b|${proas.toFixed(2)}|${roas.toFixed(2)}`, '/marketing');
  else if (cur.adSpend > 0 && roas >= 4) push('roas-good', 'good', 'insights.roasGood.t', `insights.roasGood.b|${roas.toFixed(2)}`);
  // AOV
  const aov = cur.delivered ? cur.revenue / cur.delivered : 0;
  const paov = prv.delivered ? prv.revenue / prv.delivered : 0;
  if (paov > 0 && aov > paov * 1.1) push('aov-up', 'good', 'insights.aovUp.t', `insights.aovUp.b|${Math.round(((aov - paov) / paov) * 100)}`);
  // product losers / winners
  const losers = prods.filter((p) => p.units >= 3 && p.net < 0);
  if (losers.length) push('loser', 'bad', 'insights.loser.t', `insights.loser.b|${losers[0].name}`, '/products');
  const winners = prods.filter((p) => p.units >= 3).sort((a, b) => b.net - a.net);
  if (winners.length && winners[0].net > 0) push('winner', 'good', 'insights.winner.t', `insights.winner.b|${winners[0].name}`, '/products');
  // low stock
  const low = await db.products.where('[businessId+status]').equals([bid, 'active']).toArray().then((ps) => ps.filter((p) => p.stockQty <= (p.reorderLevel ?? 5)));
  if (low.length) push('lowstock', 'warn', 'insights.lowstock.t', `insights.lowstock.b|${low.length}|${low[0].name}`, '/inventory');
  // inventory share
  const capital = cash.balance + inv.value;
  if (capital > 0 && inv.value / capital > 0.7 && inv.value > 0) push('inv-heavy', 'warn', 'insights.invHeavy.t', `insights.invHeavy.b|${Math.round((inv.value / capital) * 100)}`, '/inventory');
  // cash negative
  if (cash.balance < 0) push('cash-neg', 'bad', 'insights.cashNeg.t', 'insights.cashNeg.b', '/finance');
  else if (cur.netCash < 0 && cur.orders > 0) push('cash-down', 'warn', 'insights.cashDown.t', 'insights.cashDown.b', '/finance');
  // receivables
  const recv = await receivables(bid);
  if (recv > cur.revenue * 0.3 && recv > 0) push('recv-high', 'warn', 'insights.recvHigh.t', 'insights.recvHigh.b', '/customers');
  return out.slice(0, 10);
}

export async function healthScore(bid: ID, r: Range): Promise<Health> {
  const [cur, prv, inv, cash] = await Promise.all([periodSummary(bid, r), periodSummary(bid, prevRange(r)), inventoryValue(bid), cashPosition(bid)]);
  const parts: Health['parts'] = [];
  // profitability (25)
  const mScore = cur.revenue === 0 ? 50 : clamp(50 + cur.margin * 2);
  parts.push({ label: 'health.profit', score: mScore, weight: 25, note: cur.revenue === 0 ? 'health.noSales' : `health.margin|${cur.margin.toFixed(1)}` });
  // returns (15)
  const tot = cur.delivered + cur.returned;
  const rr = tot ? (cur.returned / tot) * 100 : 0;
  parts.push({ label: 'health.returns', score: tot ? clamp(100 - rr * 5) : 70, weight: 15, note: `health.returnRate|${rr.toFixed(1)}` });
  // cash trend (15)
  const cashScore = cur.netCash >= 0 ? 85 : clamp(85 + (cur.netCash / Math.max(1, cur.inflow || cur.revenue || 1)) * 100);
  parts.push({ label: 'health.cash', score: clamp(cashScore), weight: 15, note: cur.netCash >= 0 ? 'health.cashPos' : 'health.cashNeg' });
  // inventory (10)
  const ps = await db.products.where('[businessId+status]').equals([bid, 'active']).toArray();
  const oos = ps.filter((p) => p.stockQty <= 0).length;
  const invScore = ps.length ? clamp(100 - (oos / ps.length) * 100) : 60;
  parts.push({ label: 'health.inventory', score: invScore, weight: 10, note: `health.stockout|${oos}|${ps.length}` });
  // ROAS (10)
  const roas = cur.adSpend ? cur.revenue / cur.adSpend : 0;
  parts.push({ label: 'health.roas', score: cur.adSpend === 0 ? 70 : clamp(roas * 22), weight: 10, note: cur.adSpend === 0 ? 'health.noAds' : `health.roasV|${roas.toFixed(2)}` });
  // fulfillment (15)
  const all = cur.orders || 1;
  const bad = cur.cancelled + cur.returned;
  parts.push({ label: 'health.fulfill', score: clamp(100 - (bad / all) * 120), weight: 15, note: `health.fulfillV|${cur.delivered}|${cur.orders}` });
  // receivables (10)
  const recv = await receivables(bid);
  const recvRatio = cur.revenue ? (recv / cur.revenue) * 100 : 0;
  parts.push({ label: 'health.recv', score: clamp(100 - recvRatio * 2), weight: 10, note: `health.recvV|${recvRatio.toFixed(0)}` });
  void prv; void inv; void cash;
  const score = Math.round(parts.reduce((a, p) => a + (p.score * p.weight) / 100, 0));
  const grade = score >= 80 ? 'health.excellent' : score >= 60 ? 'health.good' : score >= 40 ? 'health.fair' : 'health.risk';
  return { score, grade, parts };
}
