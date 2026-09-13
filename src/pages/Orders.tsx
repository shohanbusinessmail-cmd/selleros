/** ORDERS — list, filters, creation with live profit, detail drawer, payments, transitions. */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type Channel, type ID, type Order, type OrderStatus, type PayMethod } from '../db/db';
import { createOrder, setOrderStatus, addOrderPayment, updateOrderMeta } from '../services/orders';
import { processReturn } from '../services/returns';
import { toPaisa } from '../lib/money';
import { ymd, fmtDate } from '../lib/dates';
import { Btn, Field, Input, Select, MoneyInput, Modal, Drawer, Badge, StatusBadge, Empty, SearchInput, Avatar, Confirm, Tabs, useDebounced } from '../components/ui';
import { toCSV, download } from '../lib/csv';

const CHANNELS: Channel[] = ['facebook', 'instagram', 'tiktok', 'website', 'marketplace', 'whatsapp', 'store', 'direct'];
const METHODS: PayMethod[] = ['cod', 'cash', 'bkash', 'nagad', 'rocket', 'bank', 'card', 'other'];
const FLOW: OrderStatus[] = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered'];

export function Orders() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [channel, setChannel] = useState<string>('all');
  const [showNew, setShowNew] = useState(sp.get('new') === '1');
  const viewId = sp.get('view');

  useEffect(() => { if (sp.get('new') === '1') { setShowNew(true); setSp((p) => { p.delete('new'); return p; }, { replace: true }); } }, [sp, setSp]);

  const orders = useLiveQuery(() => businessId ? db.orders.where('businessId').equals(businessId).reverse().sortBy('createdAt').then((a) => a.reverse()) : [], [businessId]) ?? [];
  const customers = useLiveQuery(() => businessId ? db.customers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const dq = useDebounced(q, 200);
  const custName = (id: ID) => customers.find((c) => c.id === id)?.name ?? '—';

  const list = useMemo(() => orders.filter((o) => {
    if (status !== 'all' && o.status !== status) return false;
    if (channel !== 'all' && o.channel !== channel) return false;
    if (dq) {
      const s = `${o.code} ${custName(o.customerId)} ${o.trackingId ?? ''}`.toLowerCase();
      if (!s.includes(dq.toLowerCase())) return false;
    }
    return true;
  }), [orders, status, channel, dq, customers]);

  const exportCSV = () => {
    download(`orders-${ymd()}.csv`, toCSV([
      ['Code', 'Date', 'Customer', 'Channel', 'Status', 'Total (BDT)', 'Paid (BDT)', 'Due (BDT)'],
      ...list.map((o) => [o.code, o.date, custName(o.customerId), o.channel, o.status, (o.total / 100).toFixed(2), (o.paid / 100).toFixed(2), ((o.total - o.paid) / 100).toFixed(2)]),
    ]), 'text/csv');
    toast(t('t.exported'));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('ord.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(list.length)}</span></h1>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={exportCSV}>⇩ {t('c.export')}</Btn>
          <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('ord.new')}</Btn>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('c.search')}…`} /></div>
        <div className="flex gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-auto" aria-label={t('c.status')}>
            <option value="all">{t('c.all')}</option>
            {(['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'returned', 'cancelled', 'failed', 'draft'] as OrderStatus[]).map((s) => <option key={s} value={s}>{t(`st.${s}` as never)}</option>)}
          </Select>
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="!w-auto" aria-label={t('ord.channel')}>
            <option value="all">{t('c.all')}</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{t(`ch.${c}` as never)}</option>)}
          </Select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">{t('ord.code')}</th><th className="px-2 py-3 font-bold">{t('ord.customer')}</th>
            <th className="px-2 py-3 font-bold">{t('ord.channel')}</th><th className="px-2 py-3 font-bold">{t('c.date')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('c.total')}</th><th className="px-2 py-3 text-right font-bold">{t('c.due')}</th>
            <th className="px-4 py-3 text-right font-bold">{t('c.status')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {list.slice(0, 300).map((o) => (
              <tr key={o.id} className="cursor-pointer transition hover:bg-brand-50/50" onClick={() => setSp({ view: o.id })}>
                <td className="px-4 py-3 font-bold">{o.code}</td>
                <td className="max-w-[180px] truncate px-2 py-3">{custName(o.customerId)}</td>
                <td className="px-2 py-3"><Badge>{t(`ch.${o.channel}` as never)}</Badge></td>
                <td className="tnum whitespace-nowrap px-2 py-3 text-ink-500">{fmtDate(o.date, lang)}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{money(o.total)}</td>
                <td className={`tnum px-2 py-3 text-right font-bold ${o.total - o.paid > 0 ? 'text-amber-700' : 'text-ink-300'}`}>{money(Math.max(0, o.total - o.paid))}</td>
                <td className="px-4 py-3 text-right"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2.5 md:hidden">
        {list.slice(0, 300).map((o) => (
          <li key={o.id}>
            <button onClick={() => setSp({ view: o.id })} className="card w-full p-3.5 text-left">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold">{o.code}</span><StatusBadge status={o.status} />
              </div>
              <div className="mt-1 truncate text-[13px] text-ink-500">{custName(o.customerId)} · {t(`ch.${o.channel}` as never)} · {fmtDate(o.date, lang)}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="tnum text-[15px] font-extrabold">{money(o.total)}</span>
                {o.total - o.paid > 0 && <span className="tnum text-[12.5px] font-bold text-amber-700">{t('c.due')} {money(o.total - o.paid)}</span>}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <Empty icon="🧾" title={t('empty.orders.t')} body={t('empty.orders.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('ord.new')}</Btn>} />}

      {showNew && businessId && <OrderForm onClose={() => setShowNew(false)} />}
      {viewId && businessId && <OrderDetail id={viewId} onClose={() => setSp({})} />}
    </div>
  );
}

/* ================= Order creation ================= */
function OrderForm({ onClose }: { onClose: () => void }) {
  const { t, businessId, money, toast, lang } = useApp();
  const [customerId, setCustomerId] = useState('');
  const [newCust, setNewCust] = useState({ name: '', phone: '' });
  const [channel, setChannel] = useState<Channel>('facebook');
  const [date, setDate] = useState(ymd());
  const [courierId, setCourierId] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [courierFee, setCourierFee] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(60);
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [method, setMethod] = useState<PayMethod>('cod');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ productId: ID; qty: number }[]>([{ productId: '', qty: 1 }]);
  const [busy, setBusy] = useState(false);

  const products = useLiveQuery(() => businessId ? db.products.where('[businessId+status]').equals([businessId, 'active']).toArray() : [], [businessId]) ?? [];
  const customers = useLiveQuery(() => businessId ? db.customers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const couriers = useLiveQuery(() => businessId ? db.couriers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];

  const calc = useMemo(() => {
    let sub = 0, cost = 0;
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p) continue;
      sub += l.qty * (p.sellPrice - (p.discount ?? 0));
      cost += l.qty * p.avgCost;
    }
    const total = Math.max(0, sub - toPaisa(discount) + toPaisa(deliveryCharge));
    return { sub, cost, total, profit: sub - toPaisa(discount) - cost + toPaisa(deliveryCharge) - toPaisa(courierFee) };
  }, [lines, products, discount, deliveryCharge, courierFee]);

  const save = async () => {
    if (!businessId) return;
    try {
      let cid = customerId;
      if (!cid) {
        if (!newCust.name.trim() || !newCust.phone.trim()) { toast(t('err.required'), 'err'); return; }
        cid = `cu${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        await db.customers.add({ id: cid, businessId, name: newCust.name.trim(), phone: newCust.phone.trim(), status: 'active', createdAt: Date.now() });
      }
      const items = lines.filter((l) => l.productId && l.qty > 0).map((l) => ({ productId: l.productId, qty: Math.floor(l.qty) }));
      if (!items.length) { toast(t('err.required'), 'err'); return; }
      setBusy(true);
      await createOrder(businessId, {
        customerId: cid, items, channel, date, discount: toPaisa(discount), deliveryCharge: toPaisa(deliveryCharge),
        advance: toPaisa(advance), payMethod: method, courierId: courierId || undefined, trackingId: trackingId || undefined,
        courierFee: toPaisa(courierFee), notes: notes || undefined,
      });
      toast(t('t.saved'));
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      toast(m.startsWith('stock-short') ? t('err.stock', m.split(':')[1] ?? '') : t('err.save'), 'err');
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={t('ord.new')} wide>
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('ord.customer')}>
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">＋ {t('cu.new')}…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
              </Select>
            </Field>
            <Field label={t('c.date')}><Input type="date" value={date} max={ymd()} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          {!customerId && (
            <div className="grid gap-3 rounded-xl bg-ink-50 p-3 sm:grid-cols-2">
              <Field label={t('c.name')}><Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="Fatema Akter" /></Field>
              <Field label={t('c.phone')}><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
            </div>
          )}
          <div>
            <div className="mb-1.5 text-[13px] font-semibold text-ink-700">{t('ord.items')}</div>
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <Select value={l.productId} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, productId: e.target.value } : x))} className="flex-1">
                    <option value="">{t('ord.selectProduct')}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {money(p.sellPrice)} · {p.stockQty}⦿</option>)}
                  </Select>
                  <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x))} className="!w-20 tnum" aria-label={t('c.qty')} />
                  <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-ink-200 text-ink-400 hover:text-red-600" aria-label={t('c.delete')}>×</button>
                </li>
              ))}
            </ul>
            <button onClick={() => setLines((ls) => [...ls, { productId: '', qty: 1 }])} className="mt-2 text-[13.5px] font-bold text-brand-700">＋ {t('ord.addItem')}</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label={t('ord.discount')}><MoneyInput value={discount} onChange={setDiscount} /></Field>
            <Field label={t('ord.delivery')}><MoneyInput value={deliveryCharge} onChange={setDeliveryCharge} /></Field>
            <Field label={t('ord.advance')}><MoneyInput value={advance} onChange={setAdvance} /></Field>
            <Field label={t('ord.method')}><Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>{METHODS.map((m) => <option key={m} value={m}>{t(`pm.${m}` as never)}</option>)}</Select></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t('ord.channel')}><Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>{CHANNELS.map((c) => <option key={c} value={c}>{t(`ch.${c}` as never)}</option>)}</Select></Field>
            <Field label={t('ord.courier')} optional><Select value={courierId} onChange={(e) => setCourierId(e.target.value)}><option value="">—</option>{couriers.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label={t('ord.tracking')} optional><Input value={trackingId} onChange={(e) => setTrackingId(e.target.value)} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`${t('ord.courier')} ${t('c.cost').toLowerCase()}`} optional><MoneyInput value={courierFee} onChange={setCourierFee} /></Field>
            <Field label={t('c.notes')} optional><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        </div>
        <aside className="h-fit space-y-2 rounded-xl bg-ink-50 p-4 text-[13.5px] lg:sticky lg:top-4">
          <Row k={t('ord.subtotal')} v={money(calc.sub)} />
          <Row k={t('ord.discount')} v={`−${money(toPaisa(discount))}`} />
          <Row k={t('ord.delivery')} v={money(toPaisa(deliveryCharge))} />
          <div className="border-t border-ink-200 pt-2"><Row k={t('c.total')} v={money(calc.total)} big /></div>
          <Row k={t('ord.advance')} v={money(toPaisa(advance))} />
          <Row k={t('c.due')} v={money(Math.max(0, calc.total - toPaisa(advance)))} warn />
          <div className="rounded-lg bg-brand-100/60 p-2.5"><Row k={t('ord.estProfit')} v={money(calc.profit)} big /></div>
          <p className="text-[11.5px] text-ink-400">{t('fin.estimated')} · {lang === 'bn' ? 'ডেলিভারির পর প্রকৃত লাভ হিসাব হবে' : 'Actual profit is counted on delivery'}</p>
          <Btn className="w-full" loading={busy} onClick={save}>{t('c.save')}</Btn>
        </aside>
      </div>
    </Modal>
  );
}
function Row({ k, v, big, warn }: { k: string; v: string; big?: boolean; warn?: boolean }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-ink-500">{k}</span><span className={`tnum ${big ? 'text-[16px] font-extrabold' : 'font-bold'} ${warn ? 'text-amber-700' : ''}`}>{v}</span></div>;
}

/* ================= Order detail ================= */
function OrderDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, businessId, money, num, toast, lang } = useApp();
  const order = useLiveQuery(() => db.orders.get(id), [id]);
  const items = useLiveQuery(() => businessId ? db.orderItems.where('[businessId+orderId]').equals([businessId, id]).toArray() : [], [businessId, id]) ?? [];
  const customer = useLiveQuery(async () => order ? db.customers.get(order.customerId) : undefined, [order]) ?? undefined;
  const payments = useLiveQuery(() => businessId ? db.payments.where('[businessId+orderId]').equals([businessId, id]).toArray() : [], [businessId, id]) ?? [];
  const couriers = useLiveQuery(() => businessId ? db.couriers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const [payAmt, setPayAmt] = useState(0);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [busy, setBusy] = useState(false);
  const [confirmSt, setConfirmSt] = useState<OrderStatus | null>(null);
  const [showReturn, setShowReturn] = useState(false);

  if (!order) return <Drawer open onClose={onClose} title="…"><p className="text-sm text-ink-400">…</p></Drawer>;
  const due = Math.max(0, order.total - order.paid);
  const cogs = items.reduce((a, it) => a + it.qty * it.unitCost, 0);
  const estProfit = (order.subtotal - order.discount) - cogs + order.deliveryCharge - order.courierFee - order.codFee;
  const courierName = couriers.find((c) => c.id === order.courierId)?.name;

  const move = async (s: OrderStatus) => {
    if (!businessId) return;
    setBusy(true);
    try { await setOrderStatus(businessId, id, s); toast(t('t.statusUpdated')); }
    catch { toast(t('err.save'), 'err'); }
    finally { setBusy(false); setConfirmSt(null); }
  };
  const collect = async () => {
    if (!businessId || payAmt <= 0) return;
    setBusy(true);
    try {
      const { over } = await addOrderPayment(businessId, id, toPaisa(payAmt), payMethod);
      toast(over > 0 ? t('err.overpay') : t('t.paymentAdded'), over > 0 ? 'err' : 'ok');
      setPayAmt(0);
    } catch { toast(t('err.save'), 'err'); }
    finally { setBusy(false); }
  };

  const flowIdx = FLOW.indexOf(order.status);
  return (
    <Drawer open onClose={onClose} title={order.code}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <Badge>{t(`ch.${order.channel}` as never)}</Badge>
          <span className="tnum text-[12.5px] text-ink-400">{fmtDate(order.date, lang)}{order.deliveredAt ? ` → ${fmtDate(order.deliveredAt, lang)}` : ''}</span>
        </div>

        <section className="rounded-xl bg-ink-50 p-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={customer?.name ?? '?'} />
            <div className="min-w-0 flex-1"><div className="truncate text-[14.5px] font-bold">{customer?.name ?? '—'}</div><div className="tnum text-[12.5px] text-ink-500">{customer?.phone ?? ''}</div></div>
          </div>
          {customer?.address && <div className="mt-1.5 truncate text-[12.5px] text-ink-500">{customer.address}{customer.area ? `, ${customer.area}` : ''}{customer.district ? `, ${customer.district}` : ''}</div>}
        </section>

        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('ord.items')}</h3>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2.5 px-3 py-2.5 text-[13.5px]">
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{it.productName}</span>
                <span className="tnum text-[12px] text-ink-400">{num(it.qty)} × {money(it.unitPrice)}</span></span>
                <span className="tnum font-bold">{money(it.qty * it.unitPrice - it.discount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-1 text-[13.5px]">
            <Row k={t('ord.subtotal')} v={money(order.subtotal)} />
            <Row k={t('ord.discount')} v={`−${money(order.discount)}`} />
            <Row k={t('ord.delivery')} v={money(order.deliveryCharge)} />
            <Row k={t('c.total')} v={money(order.total)} big />
            <Row k={t('c.paid')} v={money(order.paid)} />
            <Row k={t('c.due')} v={money(due)} warn />
            <div className="rounded-lg bg-brand-50 px-2.5 py-1.5"><Row k={order.status === 'delivered' ? `${t('c.profit')} (${t('fin.actual')})` : t('ord.estProfit')} v={money(estProfit)} big /></div>
          </div>
        </section>

        {(flowIdx >= 0) && (
          <section>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('ord.timeline')}</h3>
            <div className="flex items-center gap-[3px]">
              {FLOW.map((s, i) => (
                <button key={s} disabled={busy || i < flowIdx} onClick={() => (i === flowIdx + 1 ? move(s) : setConfirmSt(s))}
                  className={`h-2.5 flex-1 rounded-full transition ${i <= flowIdx ? 'bg-brand-500' : 'bg-ink-200 hover:bg-ink-300'}`} title={t(`st.${s}` as never)} aria-label={t(`st.${s}` as never)} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {flowIdx < FLOW.length - 1 && <Btn size="sm" loading={busy} onClick={() => move(FLOW[flowIdx + 1])}>{t(`st.${FLOW[flowIdx + 1]}` as never)} →</Btn>}
              {['delivered', 'shipped'].includes(order.status) && <Btn size="sm" variant="secondary" onClick={() => setShowReturn(true)}>↩ {t('ord.return')}</Btn>}
              {!['delivered', 'returned'].includes(order.status) && (
                <>
                  <Btn size="sm" variant="secondary" onClick={() => setConfirmSt('cancelled')}>{t('st.cancelled')}</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => setConfirmSt('failed')}>{t('st.failed')}</Btn>
                </>
              )}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-ink-200 p-3.5">
          <h3 className="mb-2 text-[14px] font-bold">{t('ord.collect')} {due > 0 && <span className="tnum text-amber-700">· {t('c.due')} {money(due)}</span>}</h3>
          <div className="flex gap-2">
            <div className="flex-1"><MoneyInput value={payAmt} onChange={setPayAmt} /></div>
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod)} className="!w-[128px]">{METHODS.map((m) => <option key={m} value={m}>{t(`pm.${m}` as never)}</option>)}</Select>
            <Btn loading={busy} disabled={payAmt <= 0} onClick={collect}>{t('c.add')}</Btn>
          </div>
          {!!payments.length && (
            <ul className="mt-2.5 space-y-1 text-[12.5px]">
              {payments.map((p) => (
                <li key={p.id} className="tnum flex justify-between text-ink-500"><span>{fmtDate(p.date, lang)} · {t(`pm.${p.method}` as never)}</span><span className={p.direction === 'in' ? 'font-bold text-brand-700' : 'font-bold text-red-600'}>{p.direction === 'in' ? '+' : '−'}{money(p.amount)}</span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2.5 text-[13px]">
          <label className="block"><span className="mb-1 block font-semibold text-ink-500">{t('ord.courier')}</span>
            <Select value={order.courierId ?? ''} onChange={(e) => businessId && updateOrderMeta(businessId, id, { courierId: e.target.value || undefined }).then(() => toast(t('t.updated')))}>
              <option value="">—</option>{couriers.filter((c) => c.status === 'active').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></label>
          <label className="block"><span className="mb-1 block font-semibold text-ink-500">{t('ord.tracking')}</span>
            <Input defaultValue={order.trackingId ?? ''} onBlur={(e) => businessId && e.target.value !== (order.trackingId ?? '') && updateOrderMeta(businessId, id, { trackingId: e.target.value }).then(() => toast(t('t.updated')))} /></label>
        </section>
        {courierName && <p className="tnum text-[12.5px] text-ink-400">{t('ord.courier')}: {courierName} · {t('c.cost')} {money(order.courierFee + order.codFee)}</p>}
        {order.notes && <p className="rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900">📝 {order.notes}</p>}
      </div>

      <Confirm open={!!confirmSt} onClose={() => setConfirmSt(null)} onYes={() => confirmSt && move(confirmSt)}
        title={t('c.confirmDelete')} body={confirmSt ? `${order.code} → ${t(`st.${confirmSt}` as never)}` : ''} danger={confirmSt === 'cancelled' || confirmSt === 'failed'} />
      {showReturn && businessId && <QuickReturn orderId={id} onClose={() => setShowReturn(false)} onDone={() => { setShowReturn(false); }} />}
    </Drawer>
  );
}

export function QuickReturn({ orderId, onClose, onDone }: { orderId: ID; onClose: () => void; onDone: () => void }) {
  const { t, businessId, money, toast } = useApp();
  const order = useLiveQuery(() => db.orders.get(orderId), [orderId]);
  const [condition, setCondition] = useState('resellable');
  const [refund, setRefund] = useState(0);
  const [fee, setFee] = useState(60);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (order) setRefund(Math.round(order.paid / 100)); }, [order]);
  const save = async () => {
    if (!businessId) return;
    setBusy(true);
    try {
      await processReturn(businessId, { orderId, condition: condition as never, refund: toPaisa(refund), returnFee: toPaisa(fee) });
      toast(t('t.saved')); onDone();
    } catch { toast(t('err.save'), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t('rt.new')} — ${order?.code ?? ''}`}>
      <div className="space-y-4">
        <Field label={t('rt.condition')}>
          <Tabs value={condition} onChange={setCondition} tabs={(['resellable', 'damaged', 'defective', 'missing', 'partial'] as const).map((c) => ({ k: c, label: t(`rc.${c}` as never) }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('rt.refund')} hint={order ? `${t('c.paid')}: ${money(order.paid)}` : ''}><MoneyInput value={refund} onChange={setRefund} /></Field>
          <Field label={t('rt.fee')}><MoneyInput value={fee} onChange={setFee} /></Field>
        </div>
        <p className="rounded-xl bg-ink-50 p-3 text-[12.5px] leading-relaxed text-ink-500">
          {condition === 'resellable' || condition === 'partial' ? `✓ ${t('rt.restocked')}` : `✕ ${t('rt.notRestocked')}`} · {t('fin.actual')}
        </p>
        <Btn className="w-full" loading={busy} onClick={save}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}
