/** THE BUSINESS COMMAND CENTER — explains the business, not just numbers. */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { periodRange, prevRange, type PeriodKey } from '../lib/dates';
import { periodSummary, dailySeries, productProfits, channelStats, courierStats, cashPosition, receivables, payables, inventoryValue, type PeriodSummary } from '../services/finance';
import { buildInsights, healthScore, type Insight, type Health } from '../services/insights';
import { Card, Stat, PeriodBar, Badge, Modal, Avatar, StatusBadge, PageSkeleton, Progress, Empty } from '../components/ui';
import { TrendChart, Donut, HBars } from '../components/charts';

const WIDGETS = [
  { id: 'trend', en: 'Revenue trend', bn: 'আয়ের ধারা' }, { id: 'split', en: 'Money split', bn: 'টাকার ভাগ' },
  { id: 'cashprofit', en: 'Cash vs profit', bn: 'নগদ বনাম লাভ' }, { id: 'health', en: 'Business health', bn: 'ব্যবসার স্বাস্থ্য' },
  { id: 'insights', en: 'Insights', bn: 'পরামর্শ' }, { id: 'top', en: 'Top products', bn: 'সেরা পণ্য' },
  { id: 'channels', en: 'Channels', bn: 'মাধ্যম' }, { id: 'couriers', en: 'Couriers', bn: 'কুরিয়ার' },
  { id: 'recent', en: 'Recent orders', bn: 'সাম্প্রতিক অর্ডার' }, { id: 'low', en: 'Low stock', bn: 'কম স্টক' },
];

export function Dashboard() {
  const { t, tx, lang, businessId, money, num } = useApp();
  const nav = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>(() => (localStorage.getItem('hishab.period') as PeriodKey) || '30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [sum, setSum] = useState<PeriodSummary | null>(null);
  const [prev, setPrev] = useState<PeriodSummary | null>(null);
  const [series, setSeries] = useState<{ date: string; revenue: number; prevRevenue: number }[]>([]);
  const [ins, setIns] = useState<Insight[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [tops, setTops] = useState<Awaited<ReturnType<typeof productProfits>>>([]);
  const [chans, setChans] = useState<Awaited<ReturnType<typeof channelStats>>>([]);
  const [cours, setCours] = useState<Awaited<ReturnType<typeof courierStats>>>([]);
  const [cash, setCash] = useState({ opening: 0, inflow: 0, outflow: 0, balance: 0 });
  const [recv, setRecv] = useState(0); const [pay, setPay] = useState(0);
  const [inv, setInv] = useState({ value: 0, units: 0 });
  const [drill, setDrill] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [order, setOrder] = useState<string[]>(() => JSON.parse(localStorage.getItem('hishab.widgets') || 'null') ?? WIDGETS.map((w) => w.id));
  const [hidden, setHidden] = useState<string[]>(() => JSON.parse(localStorage.getItem('hishab.widgetsHidden') || '[]'));

  const range = useMemo(() => periodRange(period, custom.from && custom.to ? custom : undefined), [period, custom]);
  const counts = useLiveQuery(async () => {
    if (!businessId) return { orders: 0, products: 0, customers: 0 };
    const [orders, products, customers] = await Promise.all([
      db.orders.where('businessId').equals(businessId).count(),
      db.products.where('businessId').equals(businessId).count(),
      db.customers.where('businessId').equals(businessId).count(),
    ]);
    return { orders, products, customers };
  }, [businessId]);
  const recent = useLiveQuery(() => businessId ? db.orders.where('businessId').equals(businessId).reverse().limit(6).toArray() : [], [businessId]) ?? [];
  const lowStock = useLiveQuery(async () => {
    if (!businessId) return [];
    const ps = await db.products.where('[businessId+status]').equals([businessId, 'active']).toArray();
    return ps.filter((p) => p.stockQty <= (p.reorderLevel ?? 5)).slice(0, 6);
  }, [businessId]) ?? [];
  const custMap = useLiveQuery(async () => {
    if (!businessId) return new Map<string, string>();
    const cs = await db.customers.where('businessId').equals(businessId).toArray();
    return new Map(cs.map((c) => [c.id, c.name]));
  }, [businessId]) ?? new Map<string, string>();

  useEffect(() => { localStorage.setItem('hishab.period', period); }, [period]);
  useEffect(() => { localStorage.setItem('hishab.widgets', JSON.stringify(order)); localStorage.setItem('hishab.widgetsHidden', JSON.stringify(hidden)); }, [order, hidden]);

  useEffect(() => {
    if (!businessId) return;
    let dead = false;
    (async () => {
      const r = range, p = prevRange(r);
      const [s, pr, se, i, h, tp, ch, co, ca, re, pa, iv] = await Promise.all([
        periodSummary(businessId, r), periodSummary(businessId, p), dailySeries(businessId, r, p),
        buildInsights(businessId, r), healthScore(businessId, r), productProfits(businessId, r),
        channelStats(businessId, r), courierStats(businessId, r), cashPosition(businessId),
        receivables(businessId), payables(businessId), inventoryValue(businessId),
      ]);
      if (dead) return;
      setSum(s); setPrev(pr); setSeries(se.days); setIns(i); setHealth(h);
      setTops(tp.filter((x) => x.units > 0)); setChans(ch); setCours(co.filter((c) => c.courierId !== 'none'));
      setCash(ca); setRecv(re); setPay(pa); setInv(iv);
    })();
    return () => { dead = true; };
  }, [businessId, range]);

  if (!businessId || !counts) return <PageSkeleton />;
  if (counts.orders === 0 && counts.products === 0) return <SetupState counts={counts} />;

  const d = (cur: number, old: number, invert = false) => {
    if (!old) return undefined;
    const pct = ((cur - old) / Math.abs(old)) * 100;
    if (!isFinite(pct)) return undefined;
    const up = pct >= 0;
    return { v: `${Math.abs(pct).toFixed(1)}%`, up, good: invert ? !up : up };
  };
  const vis = (id: string) => !hidden.includes(id);
  const move = (id: string, dir: -1 | 1) => {
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; setOrder(o);
  };

  const blocks: Record<string, React.ReactNode> = {
    trend: vis('trend') && (
      <Card className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">{t('dash.revenueTrend')}</h3>
          <Link to="/reports" className="text-[12.5px] font-semibold text-brand-700">{t('dash.viewAll')}</Link>
        </div>
        <TrendChart days={series} money={money} />
      </Card>
    ),
    split: vis('split') && (
      <Card>
        <button onClick={() => setDrill(true)} className="mb-1 w-full text-left">
          <h3 className="text-[15px] font-bold">{t('dash.profitSplit')}</h3>
          <p className="text-[12px] text-ink-400">{t('fin.drill')}</p>
        </button>
        {sum && <Donut money={money} parts={[
          { label: t('fin.cogs'), value: sum.cogs }, { label: t('fin.ads'), value: sum.adSpend },
          { label: t('fin.delivery'), value: sum.delivery }, { label: t('fin.operating'), value: sum.operating },
          { label: t('fin.refunds'), value: sum.refunds }, { label: t('fin.net'), value: Math.max(0, sum.net), color: '#1f6a57' },
        ]} />}
      </Card>
    ),
    cashprofit: vis('cashprofit') && sum && (
      <Card className={sum.net >= 0 && cash.balance < sum.net ? 'border-amber-300' : ''}>
        <h3 className="text-[15px] font-bold">{t('dash.cashVsProfit')}</h3>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-brand-50 p-3.5"><div className="text-[12px] font-medium text-brand-700">{t('dash.netProfit')}</div><div className="tnum mt-0.5 text-[19px] font-extrabold text-brand-800">{money(sum.net)}</div></div>
          <div className="rounded-xl bg-ink-100 p-3.5"><div className="text-[12px] font-medium text-ink-500">{t('dash.cash')}</div><div className="tnum mt-0.5 text-[19px] font-extrabold">{money(cash.balance)}</div></div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">💡 {t('dash.profitNote')}</p>
        <div className="mt-3 space-y-2 text-[13px]">
          <FlowRow k={t('fin.inflow')} v={money(sum.inflow)} c="text-brand-700" />
          <FlowRow k={t('fin.outflow')} v={money(sum.outflow)} c="text-red-600" />
          <FlowRow k={t('dash.recv')} v={money(recv)} c="text-amber-700" />
        </div>
      </Card>
    ),
    health: vis('health') && health && (
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold">{t('dash.health')}</h3>
          <button onClick={() => setWhyOpen((v) => !v)} className="rounded-full bg-brand-50 px-3 py-1 text-[12.5px] font-bold text-brand-700">{t('dash.why')}</button>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Ring score={health.score} />
          <div><div className="text-[17px] font-extrabold">{t(health.grade as never)}</div>
          <div className="text-[12.5px] text-ink-500">{health.parts.slice().sort((a, b) => a.score - b.score).slice(0, 2).map((p) => t(p.label as never)).join(' · ')}</div></div>
        </div>
        {whyOpen && (
          <ul className="mt-4 space-y-2.5 border-t border-ink-100 pt-3">
            {health.parts.map((p) => (
              <li key={p.label} className="flex items-center gap-2.5 text-[13px]">
                <span className="w-28 shrink-0 font-medium text-ink-600">{t(p.label as never)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${p.score}%` }} /></div>
                <span className="tnum w-8 text-right font-bold">{p.score}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    ),
    insights: vis('insights') && (
      <Card className="lg:col-span-2">
        <h3 className="mb-3 text-[15px] font-bold">{t('dash.insights')}</h3>
        <ul className="space-y-2.5">
          {ins.map((x) => (
            <li key={x.id}>
              <button onClick={() => x.link && nav(x.link)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${lvlBorder(x.level)} hover:shadow-sm`}>
                <span className="mt-[1px] text-[16px]">{x.level === 'good' ? '✅' : x.level === 'bad' ? '🔴' : x.level === 'warn' ? '🟡' : 'ℹ️'}</span>
                <span><span className="block text-[13.5px] font-bold">{tx(x.title)}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-500">{tx(x.body)}</span></span>
              </button>
            </li>
          ))}
          {!ins.length && <li className="py-4 text-center text-[13px] text-ink-400">—</li>}
        </ul>
      </Card>
    ),
    top: vis('top') && (
      <Card>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('dash.topProducts')}</h3><Link to="/products" className="text-[12.5px] font-semibold text-brand-700">{t('dash.viewAll')}</Link></div>
        <HBars money={money} rows={tops.slice(0, 5).map((p) => ({ label: p.name, value: p.revenue, sub: `×${num(p.units)}` }))} />
      </Card>
    ),
    channels: vis('channels') && (
      <Card>
        <h3 className="mb-3 text-[15px] font-bold">{t('dash.channels')}</h3>
        <HBars money={money} rows={chans.slice(0, 6).map((c) => ({ label: t(`ch.${c.channel}` as never), value: c.revenue, sub: `${num(c.orders)}` }))} />
      </Card>
    ),
    couriers: vis('couriers') && (
      <Card>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('dash.couriers')}</h3><Link to="/couriers" className="text-[12.5px] font-semibold text-brand-700">{t('dash.viewAll')}</Link></div>
        <ul className="space-y-2.5">
          {cours.slice(0, 4).map((c) => (
            <li key={c.courierId} className="flex items-center gap-2.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
              <span className="tnum text-ink-500">{num(c.delivered)}/{num(c.orders)}</span>
              <Badge color={c.successRate >= 80 ? 'green' : c.successRate >= 60 ? 'amber' : 'red'}>{c.successRate.toFixed(0)}%</Badge>
            </li>
          ))}
          {!cours.length && <li className="py-4 text-center text-[13px] text-ink-400">—</li>}
        </ul>
      </Card>
    ),
    recent: vis('recent') && (
      <Card className="lg:col-span-2">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('dash.recent')}</h3><Link to="/orders" className="text-[12.5px] font-semibold text-brand-700">{t('dash.viewAll')}</Link></div>
        <ul className="divide-y divide-ink-100">
          {recent.map((o) => (
            <li key={o.id}><Link to={`/orders?view=${o.id}`} className="flex items-center gap-3 py-2.5">
              <Avatar name={custMap.get(o.customerId) ?? '?'} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13.5px] font-bold">{o.code}</span>
              <span className="block truncate text-[12px] text-ink-400">{custMap.get(o.customerId) ?? ''}</span></span>
              <span className="tnum text-[13.5px] font-bold">{money(o.total)}</span>
              <StatusBadge status={o.status} />
            </Link></li>
          ))}
          {!recent.length && <li className="py-4 text-center text-[13px] text-ink-400">—</li>}
        </ul>
      </Card>
    ),
    low: vis('low') && (
      <Card className={lowStock.length ? 'border-amber-300' : ''}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-bold">{t('dash.lowStock')}</h3><Link to="/inventory" className="text-[12.5px] font-semibold text-brand-700">{t('dash.viewAll')}</Link></div>
        <ul className="space-y-2.5">
          {lowStock.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <Badge color={p.stockQty <= 0 ? 'red' : 'amber'}>{num(p.stockQty)} {t('c.units').toLowerCase()}</Badge>
            </li>
          ))}
          {!lowStock.length && <li className="py-4 text-center text-[13px] text-ink-400">✅</li>}
        </ul>
      </Card>
    ),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-[21px] font-extrabold tracking-tight">{t('dash.greet')}</h1></div>
        <div className="flex items-center gap-2">
          <PeriodBar value={period} onChange={setPeriod} onCustom={setCustom} />
          <button onClick={() => setCustomize((v) => !v)} className="rounded-full border border-ink-200 bg-white px-3 py-[7px] text-[12.5px] font-semibold text-ink-600" aria-label="Customize">⚙</button>
        </div>
      </div>

      {customize && (
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[14px] font-bold">⚙ Widgets</h3>
            <button className="text-[12.5px] font-bold text-brand-700" onClick={() => { setOrder(WIDGETS.map((w) => w.id)); setHidden([]); }}>{t('c.reset')}</button>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {order.map((id) => {
              const w = WIDGETS.find((x) => x.id === id)!;
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-[13px] font-medium">
                  <button onClick={() => setHidden((h) => h.includes(id) ? h.filter((x) => x !== id) : [...h, id])}
                    className={`flex h-6 w-6 items-center justify-center rounded-md border ${hidden.includes(id) ? 'border-ink-200 text-transparent' : 'border-brand-500 bg-brand-500 text-white'}`} aria-label="toggle">✓</button>
                  <span className="flex-1">{lang === 'bn' ? w.bn : w.en}</span>
                  <button onClick={() => move(id, -1)} className="px-1 text-ink-400" aria-label="up">↑</button>
                  <button onClick={() => move(id, 1)} className="px-1 text-ink-400" aria-label="down">↓</button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {sum && prev ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('dash.sales')} value={money(sum.revenue)} delta={d(sum.revenue, prev.revenue)} sub={t('dash.vsPrev')} />
            <div className="relative"><Stat label={`${t('dash.netProfit')} · ${t('fin.actual')}`} value={money(sum.net)} delta={d(sum.net, prev.net)} sub={t('dash.profitAfter')} onClick={() => setDrill(true)} />
            <span className="absolute right-3 top-3 text-[11px] font-bold text-brand-500">◈</span></div>
            <Stat label={t('dash.expenses')} value={money(sum.adSpend + sum.delivery + sum.operating + sum.refunds)} delta={d(sum.adSpend + sum.delivery + sum.operating + sum.refunds, prev.adSpend + prev.delivery + prev.operating + prev.refunds, true)} />
            <Stat label={t('dash.cash')} value={money(cash.balance)} sub={`${t('fin.inflow')} ${money(sum.inflow)}`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label={t('dash.inventory')} value={money(inv.value)} sub={`${num(inv.units)} ${t('c.units').toLowerCase()}`} />
            <MiniStat label={t('dash.recv')} value={money(recv)} warn={recv > 0} />
            <MiniStat label={t('dash.pay')} value={money(pay)} warn={pay > 0} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {order.map((id) => <React.Fragment key={id}>{blocks[id]}</React.Fragment>)}
          </div>
        </>
      ) : <PageSkeleton />}

      {/* Profit drill-down */}
      <Modal open={drill} onClose={() => setDrill(false)} title={`${t('fin.net')} — ${sum ? money(sum.net) : ''}`}>
        {sum && (
          <div className="space-y-1 text-[14px]">
            <DrillRow k={t('c.revenue')} v={sum.revenue} money={money} />
            <DrillRow k={t('fin.cogs')} v={-sum.cogs} money={money} />
            <div className="my-2 border-t border-dashed border-ink-200" />
            <DrillRow k={t('fin.gross')} v={sum.gross} money={money} bold />
            <DrillRow k={t('fin.ads')} v={-sum.adSpend} money={money} />
            <DrillRow k={t('fin.delivery')} v={-sum.delivery} money={money} />
            <DrillRow k={t('fin.refunds')} v={-sum.refunds} money={money} />
            <DrillRow k={t('fin.operating')} v={-sum.operating} money={money} />
            <DrillRow k={t('fin.other')} v={sum.otherIncome} money={money} />
            <div className="my-2 border-t border-ink-200" />
            <DrillRow k={t('fin.net')} v={sum.net} money={money} bold big />
            <p className="pt-2 text-[12px] text-ink-400">{t('fin.actual')} · {t('dash.profitAfter')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SetupState({ counts }: { counts: { orders: number; products: number; customers: number } }) {
  const { t } = useApp();
  const nav = useNavigate();
  const steps = [
    { done: counts.products > 0, label: t('dash.step1'), to: '/products?new=1' },
    { done: counts.customers > 0, label: t('dash.step2'), to: '/customers?new=1' },
    { done: false, label: t('dash.step3'), to: '/orders?new=1' },
    { done: false, label: t('dash.step4'), to: '/finance?tab=overview' },
  ];
  const doneN = steps.filter((s) => s.done).length;
  return (
    <div className="mx-auto max-w-xl space-y-4 pt-6">
      <div className="text-center">
        <div className="text-[44px]">🌱</div>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight">{t('dash.setup')}</h1>
        <p className="mt-1 text-[14px] text-ink-500">{t('dash.setupSub')}</p>
      </div>
      <Card>
        <Progress v={(doneN / 4) * 100} />
        <ul className="mt-4 space-y-2">
          {steps.map((s, i) => (
            <li key={i}><button onClick={() => nav(s.to)} className="flex w-full items-center gap-3 rounded-xl border border-ink-200 p-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-bold ${s.done ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500'}`}>{s.done ? '✓' : i + 1}</span>
              <span className="flex-1 text-[14.5px] font-bold">{s.label}</span><span className="text-ink-300">→</span>
            </button></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`card p-3.5 ${warn ? 'border-amber-300' : ''}`}>
      <div className="text-[12px] font-medium text-ink-500">{label}</div>
      <div className="tnum mt-0.5 text-[17px] font-extrabold">{value}</div>
      {sub && <div className="text-[11.5px] text-ink-400">{sub}</div>}
    </div>
  );
}
function FlowRow({ k, v, c }: { k: string; v: string; c: string }) {
  return <div className="flex items-center justify-between"><span className="text-ink-500">{k}</span><span className={`tnum font-bold ${c}`}>{v}</span></div>;
}
function DrillRow({ k, v, money, bold, big }: { k: string; v: number; money: (n: number) => string; bold?: boolean; big?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${big ? 'rounded-xl bg-brand-50 px-3' : ''}`}>
      <span className={bold ? 'font-bold' : 'text-ink-600'}>{k}</span>
      <span className={`tnum ${big ? 'text-[19px]' : ''} font-extrabold ${v < 0 ? 'text-red-600' : ''}`}>{v < 0 ? '−' : ''}{money(Math.abs(v))}</span>
    </div>
  );
}
function Ring({ score }: { score: number }) {
  const R = 30, CIRC = 2 * Math.PI * R;
  const color = score >= 80 ? '#1f6a57' : score >= 60 ? '#4da087' : score >= 40 ? '#dd9b26' : '#d64545';
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`Health ${score}`}>
      <circle cx="42" cy="42" r={R} fill="none" stroke="#eceef2" strokeWidth="9" />
      <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * CIRC} ${CIRC}`} transform="rotate(-90 42 42)" />
      <text x="42" y="47" textAnchor="middle" fontSize="19" fontWeight="800" fill="#23272f" className="tnum">{score}</text>
    </svg>
  );
}
function lvlBorder(l: string) { return l === 'good' ? 'border-emerald-200 bg-emerald-50/40' : l === 'bad' ? 'border-red-200 bg-red-50/40' : l === 'warn' ? 'border-amber-200 bg-amber-50/40' : 'border-ink-200 bg-white'; }
export function EmptyBox() { const { t } = useApp(); return <Empty title={t('empty.generic.t')} body={t('empty.generic.b')} />; }
