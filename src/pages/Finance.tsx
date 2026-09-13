/** FINANCE — P&L, cash flow, money ledger, expenses, capital. */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, EXPENSE_CATEGORIES } from '../db/db';
const exLabel = (t: (k: never) => string, c: string) => (EXPENSE_CATEGORIES as readonly string[]).includes(c) ? t(`ex.${c}` as never) : c;
import { periodRange, type PeriodKey } from '../lib/dates';
import { fmtDate, ymd } from '../lib/dates';
import { periodSummary, cashPosition, receivables, payables, type PeriodSummary } from '../services/finance';
import { createExpense, deleteExpense, recordCapital } from '../services/expenses';
import { toPaisa } from '../lib/money';
import { Btn, Card, Field, Input, Select, MoneyInput, Modal, Badge, Empty, Tabs, PeriodBar, Stat, Confirm, SearchInput } from '../components/ui';
import { Donut, CashBars } from '../components/charts';
import { toCSV, download } from '../lib/csv';

export function Finance() {
  const { t } = useApp();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') ?? 'overview';
  const setTab = (v: string) => setSp((p) => { p.set('tab', v); return p; }, { replace: true });
  return (
    <div className="space-y-4">
      <h1 className="text-[21px] font-extrabold tracking-tight">{t('fi.title')}</h1>
      <Tabs value={tab} onChange={setTab} tabs={[
        { k: 'overview', label: `▤ ${t('fi.pl')}` }, { k: 'ledger', label: `📒 ${t('fi.ledger')}` },
        { k: 'expenses', label: `− ${t('fi.expenses')}` },
      ]} />
      {tab === 'overview' && <Overview />}
      {tab === 'ledger' && <Ledger />}
      {tab === 'expenses' && <Expenses />}
    </div>
  );
}

function Overview() {
  const { t, businessId, money, lang } = useApp();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [sum, setSum] = useState<PeriodSummary | null>(null);
  const [cash, setCash] = useState({ opening: 0, inflow: 0, outflow: 0, balance: 0 });
  const [recv, setRecv] = useState(0); const [pay, setPay] = useState(0);
  const [showCap, setShowCap] = useState(false);
  const range = useMemo(() => periodRange(period, custom.from && custom.to ? custom : undefined), [period, custom]);
  const txns = useLiveQuery(() => businessId ? db.txns.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => {
    if (!businessId) return;
    periodSummary(businessId, range).then(setSum);
    cashPosition(businessId).then(setCash);
    receivables(businessId).then(setRecv);
    payables(businessId).then(setPay);
  }, [businessId, range, txns.length]);
  if (!sum) return null;
  const expParts = [
    { label: t('fin.cogs'), value: sum.cogs }, { label: t('fin.ads'), value: sum.adSpend },
    { label: t('fin.delivery'), value: sum.delivery }, { label: t('fin.operating'), value: sum.operating }, { label: t('fin.refunds'), value: sum.refunds },
  ].filter((p) => p.value > 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodBar value={period} onChange={setPeriod} onCustom={setCustom} />
        <Btn size="sm" variant="secondary" onClick={() => setShowCap(true)}>＋ {t('fi.capital')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('fi.cashNow')} value={money(cash.balance)} warn={cash.balance < 0} />
        <Stat label={t('fi.recvDetail')} value={money(recv)} warn={recv > 0} />
        <Stat label={t('fi.payDetail')} value={money(pay)} warn={pay > 0} />
        <Stat label={`${t('fin.net')} · ${period === 'custom' ? '' : ''}${t('fin.actual')}`} value={money(sum.net)} sub={`${t('c.margin')} ${sum.margin.toFixed(1)}%`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-[15px] font-bold">{t('fi.pl')} <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">{t('fin.actual')}</span></h3>
          <div className="space-y-1 text-[14px]">
            <PL k={t('c.revenue')} v={sum.revenue} money={money} />
            <PL k={t('fin.cogs')} v={-sum.cogs} money={money} />
            <PL k={t('fin.gross')} v={sum.gross} money={money} bold sub />
            <PL k={t('fin.ads')} v={-sum.adSpend} money={money} />
            <PL k={t('fin.delivery')} v={-sum.delivery} money={money} />
            <PL k={t('fin.refunds')} v={-sum.refunds} money={money} />
            <PL k={t('fin.operating')} v={-sum.operating} money={money} />
            <PL k={t('fin.other')} v={sum.otherIncome} money={money} />
            <PL k={t('fin.net')} v={sum.net} money={money} bold big />
          </div>
          <div className="tnum mt-2 text-[12.5px] text-ink-400">{t('c.orders')}: {sum.orders} · {t('c.units')}: {sum.units} · {t('ord.aov')}: {money(sum.delivered ? Math.round(sum.revenue / sum.delivered) : 0)}</div>
        </Card>
        <div className="space-y-4">
          <Card>
            <h3 className="mb-3 text-[15px] font-bold">{t('fi.cashflow')}</h3>
            <div className="tnum mb-3 grid grid-cols-2 gap-2.5 text-center text-[13px]">
              <div className="rounded-xl bg-ink-50 p-2.5"><div className="font-extrabold">{money(cash.opening)}</div><div className="text-[11.5px] text-ink-500">{t('fin.opening')}</div></div>
              <div className="rounded-xl bg-brand-50 p-2.5"><div className="font-extrabold text-brand-800">{money(cash.balance)}</div><div className="text-[11.5px] text-brand-700">{t('fin.closing')}</div></div>
            </div>
            <CashBars inflow={sum.inflow} outflow={sum.outflow} money={money} />
            <p className="mt-2.5 text-[12px] leading-relaxed text-ink-400">💡 {t('dash.profitNote')}</p>
          </Card>
          <Card>
            <h3 className="mb-3 text-[15px] font-bold">{t('rp.expenses')}</h3>
            {expParts.length ? <Donut money={money} parts={expParts} size={150} /> : <p className="py-4 text-center text-[13px] text-ink-400">—</p>}
          </Card>
        </div>
      </div>
      {showCap && businessId && <CapitalModal onClose={() => setShowCap(false)} />}
    </div>
  );
}
function PL({ k, v, money, bold, big, sub }: { k: string; v: number; money: (n: number) => string; bold?: boolean; big?: boolean; sub?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-[5px] ${big ? 'mt-1 rounded-xl bg-brand-50 px-3 py-2.5' : ''} ${sub ? 'border-y border-dashed border-ink-200' : ''}`}>
      <span className={bold ? 'font-bold' : 'text-ink-600'}>{k}</span>
      <span className={`tnum ${big ? 'text-[18px]' : ''} font-extrabold ${v < 0 ? 'text-red-600' : ''}`}>{v < 0 ? '−' : ''}{money(Math.abs(v))}</span>
    </div>
  );
}

function Ledger() {
  const { t, businessId, money, lang, toast } = useApp();
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const txns = useLiveQuery(() => businessId ? db.txns.where('businessId').equals(businessId).reverse().limit(400).toArray() : [], [businessId]) ?? [];
  const list = txns.filter((x) => !x.voided && (type === 'all' || x.type === type) && (!q || `${x.notes ?? ''} ${x.category} ${x.type}`.toLowerCase().includes(q.toLowerCase())));
  const typeLabel: Record<string, string> = { sale: 'Sale', sale_reversal: 'Sale reversal', cogs: 'COGS', cogs_reversal: 'COGS reversal', customer_payment: 'Payment in', refund: 'Refund', purchase: 'Purchase', expense: 'Expense', supplier_payment: 'Supplier pay', courier_fee: 'Courier fee', return_fee: 'Return fee', capital: 'Capital', other_income: 'Other income', adjustment: 'Adjustment' };
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('c.search')}…`} /></div>
        <div className="flex gap-2">
          <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:!w-48"><option value="all">{t('c.all')}</option>{Object.keys(typeLabel).map((k) => <option key={k} value={k}>{typeLabel[k]}</option>)}</Select>
          <Btn variant="secondary" size="sm" className="!h-11" onClick={() => {
            download(`ledger-${ymd()}.csv`, toCSV([['Date', 'Type', 'Direction', 'Amount (BDT)', 'Category', 'Note'], ...list.map((x) => [x.date, x.type, x.direction, (x.amount / 100).toFixed(2), x.category, x.notes ?? ''])]), 'text/csv');
            toast(t('t.exported'));
          }}>⇩</Btn>
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">{t('c.date')}</th><th className="px-2 py-3 font-bold">Type</th>
            <th className="px-2 py-3 font-bold">{t('fi.category')}</th><th className="px-2 py-3 font-bold">Note</th>
            <th className="px-4 py-3 text-right font-bold">{t('c.amount')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {list.slice(0, 250).map((x) => (
              <tr key={x.id}>
                <td className="tnum whitespace-nowrap px-4 py-2.5 text-ink-500">{fmtDate(x.date, lang)}</td>
                <td className="px-2 py-2.5"><Badge color={x.direction === 'in' ? 'green' : 'red'}>{typeLabel[x.type] ?? x.type}</Badge></td>
                <td className="px-2 py-2.5 text-ink-500">{x.category}</td>
                <td className="max-w-[220px] truncate px-2 py-2.5">{x.notes ?? '—'}</td>
                <td className={`tnum px-4 py-2.5 text-right font-extrabold ${x.direction === 'in' ? 'text-brand-700' : 'text-red-600'}`}>{x.direction === 'in' ? '+' : '−'}{money(x.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>
    </div>
  );
}

function Expenses() {
  const { t, businessId, money, toast, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [showNew, setShowNew] = useState(sp.get('new') === '1');
  const [delId, setDelId] = useState<string | null>(null);
  const [cat, setCat] = useState('all');
  useEffect(() => { if (sp.get('new') === '1') { setShowNew(true); setSp((p) => { p.delete('new'); p.set('tab', 'expenses'); return p; }, { replace: true }); } }, [sp, setSp]);
  const expenses = useLiveQuery(() => businessId ? db.expenses.where('businessId').equals(businessId).reverse().toArray() : [], [businessId]) ?? [];
  const list = expenses.filter((e) => cat === 'all' || e.category === cat);
  const total = list.reduce((a, e) => a + e.amount, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto"><option value="all">{t('c.all')}</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`ex.${c}` as never)}</option>)}</Select>
          <span className="tnum text-[13.5px] font-bold">{t('c.total')}: {money(total)}</span>
        </div>
        <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('fi.newExpense')}</Btn>
      </div>
      <div className="card divide-y divide-ink-100 p-0">
        {list.slice(0, 250).map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[17px]">−</span>
            <span className="min-w-0 flex-1"><span className="block text-[14px] font-bold">{exLabel(t, e.category)}</span>
            <span className="tnum block truncate text-[12px] text-ink-400">{fmtDate(e.date, lang)}{e.notes ? ` · ${e.notes}` : ''}</span></span>
            <span className="tnum text-[15px] font-extrabold">{money(e.amount)}</span>
            <button onClick={() => setDelId(e.id)} className="rounded-lg px-2 py-1.5 text-[15px] text-ink-300 hover:bg-red-50 hover:text-red-600" aria-label={t('c.delete')}>🗑</button>
          </div>
        ))}
        {!list.length && <Empty icon="−" title={t('empty.expenses.t')} body={t('empty.expenses.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('fi.newExpense')}</Btn>} />}
      </div>
      {showNew && businessId && <ExpenseForm onClose={() => setShowNew(false)} />}
      <Confirm open={!!delId} onClose={() => setDelId(null)} danger
        title={t('c.confirmDelete')} body={t('fi.expenses')}
        onYes={() => { if (delId && businessId) deleteExpense(businessId, delId).then(() => toast(t('t.deleted'))).catch(() => toast(t('err.save'), 'err')); }} />
    </div>
  );
}

export function ExpenseForm({ onClose }: { onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [date, setDate] = useState(ymd());
  const [category, setCategory] = useState('rent');
  const [customCat, setCustomCat] = useState('');
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('fi.newExpense')}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('c.date')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('fi.category')}><Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{t(`ex.${c}` as never)}</option>)}<option value="__custom">＋ Custom…</option>
          </Select></Field>
        </div>
        {category === '__custom' && <Field label={t('fi.category')}><Input value={customCat} onChange={(e) => setCustomCat(e.target.value)} /></Field>}
        <Field label={`${t('c.amount')} *`}><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label={t('c.notes')} optional><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Btn className="w-full" loading={busy} onClick={async () => {
          if (!businessId || amount <= 0) { toast(t('err.money'), 'err'); return; }
          setBusy(true);
          try { await createExpense(businessId, { date, category: category === '__custom' ? (customCat.trim().toLowerCase() || 'misc') : category, amount: toPaisa(amount), notes: notes || undefined }); toast(t('t.saved')); onClose(); }
          catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
        }}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}

function CapitalModal({ onClose }: { onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [amt, setAmt] = useState(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('fi.capital')}>
      <div className="space-y-3.5">
        <Field label={`${t('c.amount')} *`}><MoneyInput value={amt} onChange={setAmt} /></Field>
        <Field label={t('c.notes')} optional><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Btn className="w-full" loading={busy} onClick={async () => {
          if (!businessId || amt <= 0) { toast(t('err.money'), 'err'); return; }
          setBusy(true);
          try { await recordCapital(businessId, toPaisa(amt), notes || undefined); toast(t('t.saved')); onClose(); }
          catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
        }}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}
