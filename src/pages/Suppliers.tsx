/** SUPPLIERS — list, payables, purchase history. */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID } from '../db/db';
import { uid } from '../lib/id';
import { fmtDate } from '../lib/dates';
import { Btn, Field, Input, Modal, Drawer, Empty, SearchInput, Avatar, Card } from '../components/ui';

export function Suppliers() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const viewId = sp.get('view');
  const suppliers = useLiveQuery(() => businessId ? db.suppliers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const purchases = useLiveQuery(() => businessId ? db.purchases.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const payOf = (sid: ID) => purchases.filter((p) => p.supplierId === sid).reduce((a, p) => a + Math.max(0, p.total - p.paid), 0);
  const list = suppliers.filter((s) => s.status === 'active' && (!q || `${s.name} ${s.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('su.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(list.length)}</span></h1>
        <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('su.new')}</Btn>
      </div>
      <SearchInput value={q} onChange={setQ} placeholder={`${t('c.search')}…`} />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => (
          <button key={s.id} onClick={() => setSp({ view: s.id })} className="card flex items-center gap-3 p-4 text-left transition hover:border-brand-200">
            <Avatar name={s.name} />
            <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-bold">{s.name}</span>
            <span className="tnum block text-[12px] text-ink-500">{s.phone ?? ''}</span></span>
            <span className="text-right"><span className={`tnum block text-[14px] font-extrabold ${payOf(s.id) > 0 ? 'text-amber-700' : ''}`}>{money(payOf(s.id))}</span><span className="block text-[11px] text-ink-400">{t('su.payable')}</span></span>
          </button>
        ))}
      </div>
      {!list.length && <Empty icon="⬡" title={t('empty.generic.t')} body={t('empty.generic.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('su.new')}</Btn>} />}
      {showNew && <SupplierForm onClose={() => setShowNew(false)} />}
      {editId && <SupplierForm id={editId} onClose={() => setEditId(null)} />}
      {viewId && <SupplierDetail id={viewId} onClose={() => setSp({})} onEdit={(x) => { setSp({}); setEditId(x); }} />}
    </div>
  );
}

export function SupplierForm({ id, onClose }: { id?: ID; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [f, setF] = useState({ name: '', phone: '', address: '', notes: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (id) db.suppliers.get(id).then((s) => { if (s) setF({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '' }); }); }, [id]);
  const save = async () => {
    if (!businessId || !f.name.trim()) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      if (id) await db.suppliers.update(id, { name: f.name.trim(), phone: f.phone || undefined, address: f.address || undefined, notes: f.notes || undefined });
      else await db.suppliers.add({ id: uid('su'), businessId, name: f.name.trim(), phone: f.phone || undefined, address: f.address || undefined, notes: f.notes || undefined, status: 'active', createdAt: Date.now() });
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={id ? t('c.edit') : t('su.new')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${t('c.name')} *`}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={t('c.phone')} optional><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
        <div className="sm:col-span-2"><Field label={t('c.address')} optional><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label={t('c.notes')} optional><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn><Btn loading={busy} onClick={save}>{t('c.save')}</Btn></div>
    </Modal>
  );
}

function SupplierDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (x: ID) => void }) {
  const { t, businessId, money, num, lang } = useApp();
  const s = useLiveQuery(() => db.suppliers.get(id), [id]);
  const purchases = useLiveQuery(() => businessId ? db.purchases.where('businessId').equals(businessId).toArray().then((a) => a.filter((p) => p.supplierId === id).reverse()) : [], [businessId, id]) ?? [];
  if (!s) return <Drawer open onClose={onClose} title="…"><p>…</p></Drawer>;
  const payable = purchases.reduce((a, p) => a + Math.max(0, p.total - p.paid), 0);
  const total = purchases.reduce((a, p) => a + p.total, 0);
  return (
    <Drawer open onClose={onClose} title={s.name}>
      <div className="space-y-5">
        <div className="tnum text-[13.5px] text-ink-500">{s.phone ?? ''} {s.address ? `· ${s.address}` : ''}</div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl bg-ink-50 p-3"><div className="tnum text-[17px] font-extrabold">{num(purchases.length)}</div><div className="text-[11px] text-ink-500">{t('su.purchases')}</div></div>
          <div className="rounded-xl bg-ink-50 p-3"><div className="tnum text-[17px] font-extrabold">{money(total)}</div><div className="text-[11px] text-ink-500">{t('c.total')}</div></div>
          <div className="rounded-xl bg-amber-50 p-3"><div className="tnum text-[17px] font-extrabold text-amber-800">{money(payable)}</div><div className="text-[11px] text-amber-700">{t('su.payable')}</div></div>
        </div>
        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('su.purchases')}</h3>
          <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
            {purchases.map((p) => (
              <li key={p.id} className="tnum flex items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                <span className="font-bold">{p.code} <span className="font-medium text-ink-400">{fmtDate(p.date, lang)}</span></span>
                <span className="font-bold">{money(p.total)} <span className="font-medium text-ink-400">· {t('c.paid')} {money(p.paid)}</span></span>
              </li>
            ))}
            {!purchases.length && <li className="px-3 py-5 text-center text-ink-400">—</li>}
          </ul>
        </section>
        <Btn variant="secondary" className="w-full" onClick={() => onEdit(id)}>{t('c.edit')}</Btn>
      </div>
    </Drawer>
  );
}
export function CardBox({ children }: { children: React.ReactNode }) { return <Card>{children}</Card>; }
