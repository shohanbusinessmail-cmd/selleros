/** REPORT CENTER — every report: summary + chart + table + filters + export. Same engine as dashboard. */
import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { periodRange, prevRange, type PeriodKey, fmtDate } from '../lib/dates';
import { periodSummary, dailySeries, productProfits, channelStats, courierStats, customerStats, cashPosition, inventoryValue, txnsIn, type PeriodSummary } from '../services/finance';
import { Card, Tabs, PeriodBar, Badge, Select, Stat } from '../components/ui';
import { TrendChart, Donut, HBars } from '../components/charts';
import { toCSV, download } from '../lib/csv';
import { ymd } from '../lib/dates';

type RTab = 'sales' | 'pl' | 'cash' | 'expenses' | 'products' | 'inventory' | 'customers' | 'couriers' | 'returns' | 'ads';

export function Reports() {
  const { t } = useApp();
  const [tab, setTab] = useState<RTab>('sales');
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const range = useMemo(() => periodRange(period, custom.from && custom.to ? custom : undefined), [period, custom]);
  const tabs: { k: RTab; label: string }[] = [
    { k: 'sales', label: t('rp.sales') }, { k: 'pl', label: t('rp.pl') }, { k: 'cash', label: t('rp.cashflow') },
    { k: 'expenses', label: t('rp.expenses') }, { k: 'products', label: t('rp.products') }, { k: 'inventory', label: t('rp.inventory') },
    { k: 'customers', label: t('rp.customers') }, { k: 'couriers', label: t('rp.couriers') }, { k: 'returns', label: t('rp.returns') }, { k: 'ads', label: t('rp.ads') },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-[21px] font-extrabold tracking-tight">{t('rp.title')}</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PeriodBar value={period} onChange={setPeriod} onCustom={setCustom} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'sales' && <SalesR range={range} />}
      {tab === 'pl' && <PLR range={range} />}
      {tab === 'cash' && <CashR range={range} />}
      {tab === 'expenses' && <ExpR range={range} />}
      {tab === 'products' && <ProdR range={range} />}
      {tab === 'inventory' && <InvR />}
      {tab === 'customers' && <CustR />}
      {tab === 'couriers' && <CourR range={range} />}
      {tab === 'returns' && <RetR range={range} />}
      {tab === 'ads' && <AdsR range={range} />}
    </div>
  );
}

function useSummary(range: { from: string; to: string }) {
  const { businessId } = useApp();
  const [s, setS] = useState<PeriodSummary | null>(null);
  const txns = useLiveQuery(() => businessId ? db.txns.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => { if (businessId) periodSummary(businessId, range).then(setS); }, [businessId, range, txns.length]);
  return s;
}
function ExpBtn({ name, rows }: { name: string; rows: (string | number)[][] }) {
  const { t, toast } = useApp();
  return <button onClick={() => { download(`${name}-${ymd()}.csv`, toCSV(rows), 'text/csv'); toast(t('t.exported')); }} className="rounded-full border border-ink-200 bg-white px-3 py-[7px] text-[12.5px] font-bold text-ink-700">⇩ {t('c.export')}</button>;
}

function SalesR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money, num, lang } = useApp();
  const s = useSummary(range);
  const [series, setSeries] = useState<{ date: string; revenue: number; orders: number; prevRevenue: number }[]>([]);
  const [chans, setChans] = useState<Awaited<ReturnType<typeof channelStats>>>([]);
  const [channel, setChannel] = useState('all');
  useEffect(() => {
    if (!businessId) return;
    dailySeries(businessId, range, prevRange(range)).then((x) => setSeries(x.days));
    channelStats(businessId, range).then(setChans);
  }, [businessId, range, s]);
  if (!s) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('c.revenue')} value={money(s.revenue)} /><Stat label={t('c.orders')} value={num(s.delivered)} sub={`${t('c.total')} ${num(s.orders)}`} />
        <Stat label={t('ord.aov')} value={money(s.delivered ? Math.round(s.revenue / s.delivered) : 0)} /><Stat label={t('c.units')} value={num(s.units)} />
      </div>
      <Card><div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.chart')}</h3>
        <ExpBtn name="sales-daily" rows={[['Date', 'Revenue (BDT)', 'Orders'], ...series.map((d) => [d.date, (d.revenue / 100).toFixed(2), d.orders])]} /></div>
        <TrendChart days={series} money={money} /></Card>
      <Card><div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('dash.channels')}</h3>
        <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="!h-9 !w-auto !text-[13px]"><option value="all">{t('c.all')}</option>{chans.map((c) => <option key={c.channel} value={c.channel}>{t(`ch.${c.channel}` as never)}</option>)}</Select></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase text-ink-400"><th className="py-2 font-bold">{t('ord.channel')}</th><th className="text-right font-bold">{t('c.orders')}</th><th className="text-right font-bold">{t('c.revenue')}</th><th className="text-right font-bold">{t('c.profit')}</th><th className="text-right font-bold">{t('cu.returnRate')}</th></tr></thead>
          <tbody className="divide-y divide-ink-50">{chans.filter((c) => channel === 'all' || c.channel === channel).map((c) => (
            <tr key={c.channel}><td className="py-2.5 font-bold">{t(`ch.${c.channel}` as never)}</td><td className="tnum py-2.5 text-right">{num(c.orders)}</td>
            <td className="tnum py-2.5 text-right font-bold">{money(c.revenue)}</td><td className={`tnum py-2.5 text-right font-bold ${c.profit < 0 ? 'text-red-600' : 'text-brand-700'}`}>{money(c.profit)}</td>
            <td className="tnum py-2.5 text-right">{c.returnRate.toFixed(1)}%</td></tr>
          ))}</tbody>
        </table></div></Card>
    </div>
  );
}

function PLR({ range }: { range: { from: string; to: string } }) {
  const { t, money, num } = useApp();
  const s = useSummary(range);
  if (!s) return null;
  const rows: (string | number)[][] = [['Line', 'Amount (BDT)'], ['Revenue', (s.revenue / 100).toFixed(2)], ['COGS', (-s.cogs / 100).toFixed(2)], ['Gross', (s.gross / 100).toFixed(2)], ['Ads', (-s.adSpend / 100).toFixed(2)], ['Delivery', (-s.delivery / 100).toFixed(2)], ['Refunds', (-s.refunds / 100).toFixed(2)], ['Operating', (-s.operating / 100).toFixed(2)], ['Other income', (s.otherIncome / 100).toFixed(2)], ['NET', (s.net / 100).toFixed(2)]];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.pl')} · {t('fin.actual')}</h3><ExpBtn name="profit-loss" rows={rows} /></div>
        <div className="space-y-1 text-[14px]">
          {[[t('c.revenue'), s.revenue], [t('fin.cogs'), -s.cogs]].map(([k, v]) => <Line key={k as string} k={k as string} v={v as number} money={money} />)}
          <Line k={t('fin.gross')} v={s.gross} money={money} bold sub />
          {[[t('fin.ads'), -s.adSpend], [t('fin.delivery'), -s.delivery], [t('fin.refunds'), -s.refunds], [t('fin.operating'), -s.operating], [t('fin.other'), s.otherIncome]].map(([k, v]) => <Line key={k as string} k={k as string} v={v as number} money={money} />)}
          <Line k={t('fin.net')} v={s.net} money={money} bold big />
        </div>
        <p className="tnum mt-2 text-[12.5px] text-ink-400">{t('c.margin')}: {s.margin.toFixed(1)}% · {t('c.orders')}: {num(s.delivered)}</p>
      </Card>
      <Card><h3 className="mb-3 text-[15px] font-bold">{t('dash.profitSplit')}</h3>
        <Donut money={money} parts={[{ label: t('fin.cogs'), value: s.cogs }, { label: t('fin.ads'), value: s.adSpend }, { label: t('fin.delivery'), value: s.delivery }, { label: t('fin.operating'), value: s.operating }, { label: t('fin.refunds'), value: s.refunds }, { label: t('fin.net'), value: Math.max(0, s.net), color: '#1f6a57' }]} /></Card>
    </div>
  );
}
function Line({ k, v, money, bold, big, sub }: { k: string; v: number; money: (n: number) => string; bold?: boolean; big?: boolean; sub?: boolean }) {
  return <div className={`flex items-center justify-between py-[5px] ${big ? 'mt-1 rounded-xl bg-brand-50 px-3 py-2.5' : ''} ${sub ? 'border-y border-dashed border-ink-200' : ''}`}>
    <span className={bold ? 'font-bold' : 'text-ink-600'}>{k}</span>
    <span className={`tnum ${big ? 'text-[18px]' : ''} font-extrabold ${v < 0 ? 'text-red-600' : ''}`}>{v < 0 ? '−' : ''}{money(Math.abs(v))}</span></div>;
}

function CashR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money } = useApp();
  const s = useSummary(range);
  const [cash, setCash] = useState({ opening: 0, inflow: 0, outflow: 0, balance: 0 });
  const [byType, setByType] = useState<{ label: string; value: number }[]>([]);
  useEffect(() => {
    if (!businessId) return;
    cashPosition(businessId).then(setCash);
    txnsIn(businessId, range).then((list) => {
      const m = new Map<string, number>();
      for (const x of list) {
        if (x.voided) continue;
        if (!['customer_payment', 'capital', 'other_income', 'purchase', 'expense', 'supplier_payment', 'courier_fee', 'return_fee', 'refund'].includes(x.type)) continue;
        const k = `${x.direction === 'in' ? '+' : '−'} ${x.type}`;
        m.set(k, (m.get(k) ?? 0) + x.amount);
      }
      setByType([...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value));
    });
  }, [businessId, range, s]);
  if (!s) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h3 className="mb-3 text-[15px] font-bold">{t('rp.cashflow')}</h3>
        <div className="space-y-1 text-[14px]">
          <Line k={t('fin.opening')} v={cash.opening} money={money} />
          <Line k={t('fin.inflow')} v={s.inflow} money={money} />
          <Line k={t('fin.outflow')} v={-s.outflow} money={money} />
          <Line k={t('fin.closing')} v={cash.balance} money={money} bold big />
        </div></Card>
      <Card><div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.table')}</h3>
        <ExpBtn name="cashflow" rows={[['Flow', 'Amount (BDT)'], ...byType.map((r) => [r.label, (r.value / 100).toFixed(2)])]} /></div>
        <HBars money={money} rows={byType} maxRows={10} /></Card>
    </div>
  );
}

function ExpR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money } = useApp();
  const [byCat, setByCat] = useState<{ label: string; value: number }[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!businessId) return;
    db.expenses.where('[businessId+date]').between([businessId, range.from], [businessId, range.to], true, true).toArray().then((list) => {
      const m = new Map<string, number>();
      for (const e of list) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
      setByCat([...m.entries()].map(([label, value]) => ({ label: (t(`ex.${label}` as never) !== `ex.${label}` ? t(`ex.${label}` as never) : label), value })).sort((a, b) => b.value - a.value));
      setTotal(list.reduce((a, e) => a + e.amount, 0));
    });
  }, [businessId, range, t]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h3 className="mb-1 text-[15px] font-bold">{t('rp.expenses')}</h3><p className="tnum mb-3 text-[22px] font-extrabold">{money(total)}</p>
        {byCat.length ? <Donut money={money} parts={byCat} size={150} /> : <p className="py-6 text-center text-[13px] text-ink-400">—</p>}</Card>
      <Card><div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.table')}</h3>
        <ExpBtn name="expenses" rows={[['Category', 'Amount (BDT)'], ...byCat.map((r) => [r.label, (r.value / 100).toFixed(2)])]} /></div>
        <HBars money={money} rows={byCat} maxRows={12} /></Card>
    </div>
  );
}

function ProdR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money, num } = useApp();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof productProfits>>>([]);
  useEffect(() => { if (businessId) productProfits(businessId, range).then(setRows); }, [businessId, range]);
  const cats = [...new Set(rows.map(() => ''))];
  void cats;
  const list = rows.filter((r) => r.units > 0);
  return (
    <div className="space-y-4">
      <Card><h3 className="mb-3 text-[15px] font-bold">{t('rp.products')} — {t('c.revenue')}</h3>
        <HBars money={money} rows={list.slice(0, 8).map((r) => ({ label: r.name, value: r.revenue, sub: `×${num(r.units)}` }))} /></Card>
      <Card className="p-0"><div className="flex items-center justify-between p-4 pb-2"><h3 className="text-[15px] font-bold">{t('rp.table')}</h3>
        <ExpBtn name="products" rows={[['Product', 'SKU', 'Units', 'Revenue', 'COGS', 'Net(est)', 'Stock'], ...list.map((r) => [r.name, r.sku, r.units, (r.revenue / 100).toFixed(2), (r.cogs / 100).toFixed(2), (r.net / 100).toFixed(2), r.stock])]} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[13px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase text-ink-400">
            <th className="px-4 py-2.5 font-bold">{t('c.name')}</th><th className="px-2 py-2.5 text-right font-bold">{t('c.units')}</th>
            <th className="px-2 py-2.5 text-right font-bold">{t('c.revenue')}</th><th className="px-2 py-2.5 text-right font-bold">COGS</th>
            <th className="px-2 py-2.5 text-right font-bold">{t('fin.ads')}*</th><th className="px-2 py-2.5 text-right font-bold">{t('fin.net')}*</th>
            <th className="px-4 py-2.5 text-right font-bold">{t('pr.stock')}</th></tr></thead>
          <tbody className="divide-y divide-ink-50">{list.map((r) => (
            <tr key={r.productId}><td className="max-w-[220px] truncate px-4 py-2.5 font-bold">{r.name}</td>
            <td className="tnum px-2 py-2.5 text-right">{num(r.units)}</td><td className="tnum px-2 py-2.5 text-right font-bold">{money(r.revenue)}</td>
            <td className="tnum px-2 py-2.5 text-right">{money(r.cogs)}</td><td className="tnum px-2 py-2.5 text-right text-ink-500">{money(r.adSpend)}</td>
            <td className={`tnum px-2 py-2.5 text-right font-bold ${r.net < 0 ? 'text-red-600' : 'text-brand-700'}`}>{money(r.net)}</td>
            <td className="tnum px-4 py-2.5 text-right">{num(r.stock)}</td></tr>
          ))}</tbody>
        </table></div>
        <p className="p-4 pt-2 text-[12px] text-ink-400">* {t('fin.allocated')}</p></Card>
    </div>
  );
}

function InvR() {
  const { t, businessId, money, num } = useApp();
  const [val, setVal] = useState({ value: 0, units: 0 });
  const products = useLiveQuery(() => businessId ? db.products.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => { if (businessId) inventoryValue(businessId).then(setVal); }, [businessId, products.length]);
  const rows = products.filter((p) => p.status === 'active').map((p) => ({ label: p.name, value: p.stockQty * p.avgCost, sub: `×${num(p.stockQty)}` })).sort((a, b) => b.value - a.value);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3"><Stat label={t('inv.value')} value={money(val.value)} /><Stat label={t('inv.units')} value={num(val.units)} /></div>
      <Card><div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.inventory')}</h3>
        <ExpBtn name="inventory" rows={[['Product', 'SKU', 'Stock', 'AvgCost', 'Value'], ...products.filter((p) => p.status === 'active').map((p) => [p.name, p.sku, p.stockQty, (p.avgCost / 100).toFixed(2), ((p.stockQty * p.avgCost) / 100).toFixed(2)])]} /></div>
        <HBars money={money} rows={rows} maxRows={12} /></Card>
    </div>
  );
}

function CustR() {
  const { t, businessId, money, num } = useApp();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof customerStats>>>([]);
  useEffect(() => { if (businessId) customerStats(businessId).then(setRows); }, [businessId]);
  const top = rows.filter((r) => r.spent > 0).slice(0, 8);
  return (
    <div className="space-y-4">
      <Card><h3 className="mb-3 text-[15px] font-bold">{t('rp.customers')} — {t('cu.spent')}</h3><HBars money={money} rows={top.map((r) => ({ label: r.name, value: r.spent, sub: `×${num(r.orders)}` }))} /></Card>
      <Card className="p-0"><div className="flex items-center justify-between p-4 pb-2"><h3 className="text-[15px] font-bold">{t('rp.table')}</h3>
        <ExpBtn name="customers" rows={[['Name', 'Phone', 'Orders', 'Spent', 'Outstanding', 'Segment'], ...rows.map((r) => [r.name, r.phone, r.orders, (r.spent / 100).toFixed(2), (r.outstanding / 100).toFixed(2), r.segment])]} /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-[13px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase text-ink-400"><th className="px-4 py-2.5 font-bold">{t('c.name')}</th><th className="px-2 py-2.5 text-right font-bold">{t('cu.orders')}</th><th className="px-2 py-2.5 text-right font-bold">{t('cu.spent')}</th><th className="px-2 py-2.5 text-right font-bold">{t('cu.outstanding')}</th><th className="px-4 py-2.5 text-right font-bold">{t('cu.segment')}</th></tr></thead>
          <tbody className="divide-y divide-ink-50">{rows.slice(0, 100).map((r) => (
            <tr key={r.customerId}><td className="px-4 py-2.5 font-bold">{r.name} <span className="tnum font-medium text-ink-400">{r.phone}</span></td>
            <td className="tnum px-2 py-2.5 text-right">{num(r.orders)}</td><td className="tnum px-2 py-2.5 text-right font-bold">{money(r.spent)}</td>
            <td className={`tnum px-2 py-2.5 text-right font-bold ${r.outstanding ? 'text-amber-700' : ''}`}>{money(r.outstanding)}</td>
            <td className="px-4 py-2.5 text-right"><Badge>{t(`sg.${r.segment}` as never)}</Badge></td></tr>
          ))}</tbody>
        </table></div></Card>
    </div>
  );
}

function CourR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money, num } = useApp();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof courierStats>>>([]);
  useEffect(() => { if (businessId) courierStats(businessId, range).then(setRows); }, [businessId, range]);
  const list = rows.filter((r) => r.courierId !== 'none');
  return (
    <Card className="p-0"><div className="flex items-center justify-between p-4 pb-2"><h3 className="text-[15px] font-bold">{t('rp.couriers')}</h3>
      <ExpBtn name="couriers" rows={[['Courier', 'Orders', 'Delivered', 'Returned', 'Success%', 'Fees'], ...list.map((r) => [r.name, r.orders, r.delivered, r.returned, r.successRate.toFixed(1), (r.fees / 100).toFixed(2)])]} /></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-[13px]">
        <thead><tr className="border-b border-ink-100 text-[12px] uppercase text-ink-400"><th className="px-4 py-2.5 font-bold">{t('ord.courier')}</th><th className="px-2 py-2.5 text-right font-bold">{t('c.orders')}</th><th className="px-2 py-2.5 text-right font-bold">✓%</th><th className="px-2 py-2.5 text-right font-bold">↩%</th><th className="px-4 py-2.5 text-right font-bold">{t('co.fees')}</th></tr></thead>
        <tbody className="divide-y divide-ink-50">{list.map((r) => (
          <tr key={r.courierId}><td className="px-4 py-2.5 font-bold">{r.name}</td><td className="tnum px-2 py-2.5 text-right">{num(r.orders)}</td>
          <td className="tnum px-2 py-2.5 text-right font-bold text-brand-700">{r.successRate.toFixed(1)}%</td>
          <td className="tnum px-2 py-2.5 text-right text-amber-700">{r.returnRate.toFixed(1)}%</td>
          <td className="tnum px-4 py-2.5 text-right font-bold">{money(r.fees)}</td></tr>
        ))}</tbody>
      </table></div></Card>
  );
}

function RetR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money, num, lang } = useApp();
  const returns = useLiveQuery(() => businessId ? db.returns.where('[businessId+date]').between([businessId, range.from], [businessId, range.to], true, true).toArray() : [], [businessId, range]) ?? [];
  const cost = returns.reduce((a, r) => a + r.refund + r.returnFee + r.outboundLost, 0);
  const byCond = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of returns) m.set(r.condition, (m.get(r.condition) ?? 0) + 1);
    return [...m.entries()].map(([k, v]) => ({ label: t(`rc.${k}` as never), value: v * 100 }));
  }, [returns, t]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3"><Stat label={t('rt.title')} value={num(returns.length)} /><Stat label={lang === 'bn' ? 'মোট খরচ' : 'Total cost'} value={money(cost)} warn={cost > 0} /></div>
      <Card><h3 className="mb-3 text-[15px] font-bold">{t('rt.condition')}</h3><HBars money={(n) => num(Math.round(n / 100))} rows={byCond} /></Card>
      <Card><div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.table')}</h3>
        <ExpBtn name="returns" rows={[['Date', 'Order', 'Condition', 'Refund', 'Fee', 'Restocked'], ...returns.map((r) => [r.date, r.orderId, r.condition, (r.refund / 100).toFixed(2), (r.returnFee / 100).toFixed(2), r.restockQty])]} /></div>
        <ul className="divide-y divide-ink-100 text-[13px]">{returns.slice(0, 60).map((r) => (
          <li key={r.id} className="tnum flex justify-between py-2"><span>{fmtDate(r.date, lang)} · {t(`rc.${r.condition}` as never)}</span><span className="font-bold text-red-600">−{money(r.refund + r.returnFee + r.outboundLost)}</span></li>
        ))}{!returns.length && <li className="py-5 text-center text-ink-400">—</li>}</ul></Card>
    </div>
  );
}

function AdsR({ range }: { range: { from: string; to: string } }) {
  const { t, businessId, money, num } = useApp();
  const campaigns = useLiveQuery(() => businessId ? db.campaigns.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const list = campaigns.filter((c) => c.startDate <= range.to && (c.endDate ?? c.startDate) >= range.from);
  const spend = list.reduce((a, c) => a + c.spend, 0);
  const rev = list.reduce((a, c) => a + (c.revenue ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('mk.spend')} value={money(spend)} /><Stat label={t('mk.revenue')} value={money(rev)} sub={t('mk.manual')} /><Stat label={t('mk.roas')} value={`${spend ? (rev / spend).toFixed(2) : '0.00'}×`} />
      </div>
      <Card><div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('rp.ads')} · {t('mk.manual')}</h3>
        <ExpBtn name="ads" rows={[['Campaign', 'Platform', 'Spend', 'Orders', 'Revenue', 'ROAS'], ...list.map((c) => [c.name, c.platform, (c.spend / 100).toFixed(2), c.orders ?? 0, ((c.revenue ?? 0) / 100).toFixed(2), c.spend ? (((c.revenue ?? 0) / c.spend).toFixed(2)) : '0'])]} /></div>
        <HBars money={money} rows={list.map((c) => ({ label: c.name, value: c.spend, sub: `ROAS ${c.spend ? (((c.revenue ?? 0) / c.spend).toFixed(2)) : '0'}×` }))} maxRows={12} /></Card>
    </div>
  );
}
