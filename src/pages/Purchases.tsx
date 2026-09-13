/** PURCHASES — stock-in with landed cost, supplier payments. */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID } from '../db/db';
import { createPurchase, paySupplier } from '../services/purchases';
import { toPaisa } from '../lib/money';
import { ymd, fmtDate } from '../lib/dates';
import { Btn, Field, Input, Select, MoneyInput, Modal, Badge, Empty, StatusBadge } from '../components/ui';

export function Purchases() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [sp, setSp] = useSearchParams();
  const [showNew, setShowNew] = useState(sp.get('new') === '1');
  const [payId, setPayId] = useState<string | null>(null);
  useEffect(() => { if (sp.get('new') === '1') { setShowNew(true); setSp((p) => { p.delete('new'); return p; }, { replace: true }); } }, [sp, setSp]);
  const purchases = useLiveQuery(() => businessId ? db.purchases.where('businessId').equals(businessId).reverse().toArray() : [], [businessId]) ?? [];
  const suppliers = useLiveQuery(() => businessId ? db.suppliers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const sname = (id?: ID) => suppliers.find((s) => s.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('pu.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(purchases.length)}</span></h1>
        <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('pu.new')}</Btn>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[680px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">PO</th><th className="px-2 py-3 font-bold">{t('c.date')}</th>
            <th className="px-2 py-3 font-bold">{t('pr.supplier')}</th><th className="px-2 py-3 text-right font-bold">{t('c.total')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('c.paid')}</th><th className="px-2 py-3 text-right font-bold">{t('c.due')}</th>
            <th className="px-4 py-3 text-right font-bold">{t('c.status')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {purchases.map((p) => (
              <tr key={p.id} className="hover:bg-brand-50/40">
                <td className="px-4 py-3 font-bold">{p.code}</td>
                <td className="tnum whitespace-nowrap px-2 py-3 text-ink-500">{fmtDate(p.date, lang)}</td>
                <td className="px-2 py-3">{sname(p.supplierId)}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{money(p.total)}</td>
                <td className="tnum px-2 py-3 text-right">{money(p.paid)}</td>
                <td className={`tnum px-2 py-3 text-right font-bold ${p.total - p.paid > 0 ? 'text-amber-700' : 'text-ink-300'}`}>{money(Math.max(0, p.total - p.paid))}</td>
                <td className="px-4 py-3 text-right"><span className="mr-2"><StatusBadge status={p.status} /></span>
                  {p.total - p.paid > 0 && <button onClick={() => setPayId(p.id)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-[12px] font-bold text-brand-700">{t('pu.pay')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!purchases.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>
      {!purchases.length && <Empty icon="▣" title={t('empty.generic.t')} body={t('empty.generic.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('pu.new')}</Btn>} />}
      {showNew && businessId && <PurchaseForm onClose={() => setShowNew(false)} />}
      {payId && businessId && <PayModal id={payId} onClose={() => setPayId(null)} />}
    </div>
  );
}

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const { t, businessId, money, toast } = useApp();
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(ymd());
  const [extra, setExtra] = useState(0);
  const [paid, setPaid] = useState(0);
  const [payAll, setPayAll] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<{ productId: ID; qty: number; unitCost: number }[]>([{ productId: '', qty: 10, unitCost: 0 }]);
  const [busy, setBusy] = useState(false);
  const products = useLiveQuery(() => businessId ? db.products.where('[businessId+status]').equals([businessId, 'active']).toArray() : [], [businessId]) ?? [];
  const suppliers = useLiveQuery(() => businessId ? db.suppliers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const sub = lines.reduce((a, l) => a + toPaisa(l.qty * l.unitCost), 0);
  const total = sub + toPaisa(extra);
  const save = async () => {
    if (!businessId) return;
    const items = lines.filter((l) => l.productId && l.qty > 0).map((l) => ({ productId: l.productId, qty: Math.floor(l.qty), unitCost: toPaisa(l.unitCost) }));
    if (!items.length) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      await createPurchase(businessId, { supplierId: supplierId || undefined, date, items, extraCost: toPaisa(extra), paid: payAll ? total : toPaisa(paid), notes: notes || undefined });
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('pu.new')} wide>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('pr.supplier')} optional><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label={t('c.date')}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t('c.notes')} optional><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-semibold text-ink-700">{t('ord.items')}</div>
          <ul className="space-y-2">
            {lines.map((l, i) => (
              <li key={i} className="grid grid-cols-[1fr_62px_92px_34px] sm:grid-cols-[1fr_76px_110px_40px] gap-2">
                <Select value={l.productId} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, productId: e.target.value } : x))}>
                  <option value="">{t('ord.selectProduct')}</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (⦿{p.stockQty} · {money(p.avgCost)})</option>)}
                </Select>
                <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x))} className="tnum" aria-label={t('c.qty')} />
                <MoneyInput value={l.unitCost} onChange={(v) => setLines((ls) => ls.map((x, j) => j === i ? { ...x, unitCost: v } : x))} aria-label={t('c.cost')} />
                <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} className="flex h-11 items-center justify-center rounded-[10px] border border-ink-200 text-ink-400">×</button>
              </li>
            ))}
          </ul>
          <button onClick={() => setLines((ls) => [...ls, { productId: '', qty: 10, unitCost: 0 }])} className="mt-2 text-[13.5px] font-bold text-brand-700">＋ {t('ord.addItem')}</button>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-xl bg-ink-50 p-3.5 text-[13.5px]">
          <div><div className="text-ink-500">{t('pu.subtotal')}</div><div className="tnum text-[16px] font-extrabold">{money(sub)}</div></div>
          <Field label={t('pu.extra')}><MoneyInput value={extra} onChange={setExtra} /></Field>
          <div><div className="text-ink-500">{t('c.total')}</div><div className="tnum text-[16px] font-extrabold text-brand-700">{money(total)}</div></div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13.5px] font-semibold"><input type="checkbox" checked={payAll} onChange={(e) => setPayAll(e.target.checked)} className="h-4 w-4 accent-[#1f6a57]" /> {t('pu.paidNow')} ({money(total)})</label>
          {!payAll && <div className="w-40"><MoneyInput value={paid} onChange={setPaid} /></div>}
        </div>
        <div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn><Btn loading={busy} onClick={save}>{t('c.save')}</Btn></div>
      </div>
    </Modal>
  );
}

function PayModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, businessId, money, toast } = useApp();
  const [amt, setAmt] = useState(0);
  const [busy, setBusy] = useState(false);
  const p = useLiveQuery(() => db.purchases.get(id), [id]);
  useEffect(() => { if (p) setAmt(Math.round((p.total - p.paid) / 100)); }, [p]);
  return (
    <Modal open onClose={onClose} title={`${t('pu.pay')} — ${p?.code ?? ''}`}>
      <p className="tnum mb-3 text-[13.5px] text-ink-500">{t('c.due')}: <b className="text-amber-700">{p ? money(p.total - p.paid) : ''}</b></p>
      <Field label={t('c.amount')}><MoneyInput value={amt} onChange={setAmt} /></Field>
      <Btn className="mt-4 w-full" loading={busy} onClick={async () => {
        if (!businessId || amt <= 0) return;
        setBusy(true);
        try { await paySupplier(businessId, id, toPaisa(amt)); toast(t('t.paymentAdded')); onClose(); }
        catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
      }}>{t('pu.pay')}</Btn>
    </Modal>
  );
}
export function BadgeX({ c }: { c: string }) { return <Badge>{c}</Badge>; }
