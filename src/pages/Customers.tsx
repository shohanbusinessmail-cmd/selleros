/** CUSTOMERS — CRM list, profiles, value metrics, segmentation. */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID } from '../db/db';
import { uid } from '../lib/id';
import { ymd, fmtDate } from '../lib/dates';
import { customerStats, type CustomerStat } from '../services/finance';
import { Btn, Field, Input, Modal, Drawer, Badge, Empty, SearchInput, Avatar, StatusBadge, useDebounced } from '../components/ui';
import { toCSV, download } from '../lib/csv';

export function Customers() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('all');
  const [showNew, setShowNew] = useState(sp.get('new') === '1');
  const [editId, setEditId] = useState<string | null>(null);
  const viewId = sp.get('view');
  const [stats, setStats] = useState<CustomerStat[]>([]);
  const dq = useDebounced(q, 200);

  useEffect(() => { if (sp.get('new') === '1') { setShowNew(true); setSp((p) => { p.delete('new'); return p; }, { replace: true }); } }, [sp, setSp]);
  const customers = useLiveQuery(() => businessId ? db.customers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => { if (businessId) customerStats(businessId).then(setStats); }, [businessId, customers.length]);

  const list = useMemo(() => stats.filter((s) => {
    if (seg !== 'all' && s.segment !== seg) return false;
    if (dq && !`${s.name} ${s.phone}`.toLowerCase().includes(dq.toLowerCase())) return false;
    return true;
  }), [stats, seg, dq]);

  const segColor = (s: string) => s === 'high-value' ? 'green' : s === 'returning' ? 'brand' : s === 'high-return' ? 'red' : 'gray';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('cu.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(list.length)}</span></h1>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={() => {
            download(`customers-${ymd()}.csv`, toCSV([['Name', 'Phone', 'Orders', 'Spent (BDT)', 'Outstanding (BDT)'], ...list.map((s) => [s.name, s.phone, s.orders, (s.spent / 100).toFixed(2), (s.outstanding / 100).toFixed(2)])]), 'text/csv');
            toast(t('t.exported'));
          }}>⇩ {t('c.export')}</Btn>
          <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('cu.new')}</Btn>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('c.name')} / ${t('c.phone')}…`} /></div>
        <select value={seg} onChange={(e) => setSeg(e.target.value)} className="h-11 rounded-[10px] border border-ink-200 bg-white px-3 text-[14px]" aria-label={t('cu.segment')}>
          <option value="all">{t('c.all')}</option>
          {['new', 'returning', 'high-value', 'high-return'].map((s) => <option key={s} value={s}>{t(`sg.${s}` as never)}</option>)}
        </select>
      </div>
      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[840px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">{t('c.name')}</th><th className="px-2 py-3 font-bold">{t('cu.segment')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('cu.orders')}</th><th className="px-2 py-3 text-right font-bold">{t('cu.spent')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('cu.aov')}</th><th className="px-4 py-3 text-right font-bold">{t('cu.outstanding')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((s) => (
              <tr key={s.customerId} className="cursor-pointer hover:bg-brand-50/50" onClick={() => setSp({ view: s.customerId })}>
                <td className="px-4 py-3"><span className="flex items-center gap-2.5"><Avatar name={s.name} /><span><span className="block font-bold">{s.name}</span><span className="tnum block text-[12px] text-ink-400">{s.phone}</span></span></span></td>
                <td className="px-2 py-3"><Badge color={segColor(s.segment)}>{t(`sg.${s.segment}` as never)}</Badge></td>
                <td className="tnum px-2 py-3 text-right">{num(s.orders)}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{money(s.spent)}</td>
                <td className="tnum px-2 py-3 text-right">{money(Math.round(s.aov))}</td>
                <td className={`tnum px-4 py-3 text-right font-bold ${s.outstanding > 0 ? 'text-amber-700' : 'text-ink-300'}`}>{money(s.outstanding)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>
      <ul className="space-y-2.5 md:hidden">
        {list.map((s) => (
          <li key={s.customerId}><button onClick={() => setSp({ view: s.customerId })} className="card flex w-full items-center gap-3 p-3.5 text-left">
            <Avatar name={s.name} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{s.name}</span>
            <span className="tnum block text-[12px] text-ink-500">{s.phone} · {num(s.orders)} {t('cu.orders').toLowerCase()}</span></span>
            <span className="text-right"><span className="tnum block text-[14px] font-extrabold">{money(s.spent)}</span>
            {s.outstanding > 0 && <span className="tnum block text-[12px] font-bold text-amber-700">{t('c.due')} {money(s.outstanding)}</span>}</span>
          </button></li>
        ))}
      </ul>
      {!list.length && !dq && <Empty icon="◉" title={t('empty.customers.t')} body={t('empty.customers.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('cu.new')}</Btn>} />}

      {showNew && <CustomerForm onClose={() => setShowNew(false)} />}
      {editId && <CustomerForm id={editId} onClose={() => setEditId(null)} />}
      {viewId && <CustomerDetail id={viewId} onClose={() => setSp({})} onEdit={(x) => { setSp({}); setEditId(x); }} />}
    </div>
  );
}

export function CustomerForm({ id, onClose }: { id?: ID; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [f, setF] = useState({ name: '', phone: '', altPhone: '', address: '', district: '', area: '', notes: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) db.customers.get(id).then((c) => { if (c) setF({ name: c.name, phone: c.phone, altPhone: c.altPhone ?? '', address: c.address ?? '', district: c.district ?? '', area: c.area ?? '', notes: c.notes ?? '' }); }); }, [id]);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!businessId || !f.name.trim() || !f.phone.trim()) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      if (id) await db.customers.update(id, { ...f, name: f.name.trim(), phone: f.phone.trim() });
      else await db.customers.add({ ...f, id: uid('cu'), businessId, name: f.name.trim(), phone: f.phone.trim(), status: 'active', createdAt: Date.now() });
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={id ? t('c.edit') : t('cu.new')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${t('c.name')} *`}><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label={`${t('c.phone')} *`}><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
        <div className="sm:col-span-2"><Field label={t('c.address')} optional><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></Field></div>
        <Field label={t('c.optional') === 'ঐচ্ছিক' ? 'জেলা' : 'District'} optional><Input value={f.district} onChange={(e) => set('district', e.target.value)} /></Field>
        <Field label={t('c.optional') === 'ঐচ্ছিক' ? 'এলাকা' : 'Area'} optional><Input value={f.area} onChange={(e) => set('area', e.target.value)} /></Field>
        <Field label={t('c.phone')} optional><Input value={f.altPhone} onChange={(e) => set('altPhone', e.target.value)} inputMode="tel" /></Field>
        <Field label={t('c.notes')} optional><Input value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn><Btn loading={busy} onClick={save}>{t('c.save')}</Btn></div>
    </Modal>
  );
}

function CustomerDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (x: ID) => void }) {
  const { t, businessId, money, num, lang } = useApp();
  const c = useLiveQuery(() => db.customers.get(id), [id]);
  const orders = useLiveQuery(() => businessId ? db.orders.where('[businessId+customerId]').equals([businessId, id]).reverse().toArray() : [], [businessId, id]) ?? [];
  const [stat, setStat] = useState<CustomerStat | null>(null);
  useEffect(() => { if (businessId) customerStats(businessId).then((all) => setStat(all.find((s) => s.customerId === id) ?? null)); }, [businessId, id, orders.length]);
  if (!c) return <Drawer open onClose={onClose} title="…"><p>…</p></Drawer>;
  return (
    <Drawer open onClose={onClose} title={c.name}>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-[19px] font-extrabold text-brand-700">{c.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
          <div className="tnum text-[13.5px]"><div className="font-bold">{c.phone}</div><div className="text-ink-500">{[c.address, c.area, c.district].filter(Boolean).join(', ') || '—'}</div></div>
        </div>
        {stat && (
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {[['cu.orders', num(stat.orders)], ['cu.spent', money(stat.spent)], ['cu.aov', money(Math.round(stat.aov))], ['cu.outstanding', money(stat.outstanding)], ['cu.returnRate', `${stat.returnRate.toFixed(1)}%`], ['cu.last', stat.lastDate ? fmtDate(stat.lastDate, lang) : '—']].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-ink-50 p-3"><div className="tnum text-[15px] font-extrabold">{v}</div><div className="mt-0.5 text-[11px] text-ink-500">{t(k as never)}</div></div>
            ))}
          </div>
        )}
        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('cu.orders')} ({num(orders.length)})</h3>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {orders.slice(0, 30).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                <span className="font-bold">{o.code} <span className="tnum font-medium text-ink-400">{fmtDate(o.date, lang)}</span></span>
                <span className="flex items-center gap-2"><span className="tnum font-bold">{money(o.total)}</span><StatusBadge status={o.status} /></span>
              </li>
            ))}
            {!orders.length && <li className="px-3 py-5 text-center text-ink-400">—</li>}
          </ul>
        </section>
        <Btn variant="secondary" className="w-full" onClick={() => onEdit(id)}>{t('c.edit')}</Btn>
      </div>
    </Drawer>
  );
}
