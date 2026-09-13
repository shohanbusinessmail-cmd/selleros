/** INVENTORY — stock health, ledger, adjustments, damage & loss. */
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID, type MoveType } from '../db/db';
import { applyStock, audit } from '../services/ledger';
import { recordDamage } from '../services/returns';
import { inventoryValue } from '../services/finance';
import { ymd, fmtDate } from '../lib/dates';
import { Btn, Card, Field, Input, Select, Modal, Badge, Empty, SearchInput, Stat, useDebounced } from '../components/ui';

export function Inventory() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAdj, setShowAdj] = useState(false);
  const [showDmg, setShowDmg] = useState(false);
  const [showLedger, setShowLedger] = useState(false);

  const products = useLiveQuery(() => businessId ? db.products.where('[businessId+status]').equals([businessId, 'active']).toArray() : [], [businessId]) ?? [];
  const moves = useLiveQuery(() => businessId ? db.moves.where('businessId').equals(businessId).reverse().limit(120).toArray() : [], [businessId]) ?? [];
  const damages = useLiveQuery(() => businessId ? db.damages.where('businessId').equals(businessId).reverse().limit(60).toArray() : [], [businessId]) ?? [];
  const [val, setVal] = useState({ value: 0, units: 0 });
  React.useEffect(() => { if (businessId) inventoryValue(businessId).then(setVal); }, [businessId, products.length]);
  const dq = useDebounced(q, 200);

  const pname = (id: ID) => products.find((p) => p.id === id)?.name ?? '—';
  const list = useMemo(() => products.filter((p) => {
    if (filter === 'low' && !(p.stockQty > 0 && p.stockQty <= (p.reorderLevel ?? 5))) return false;
    if (filter === 'out' && p.stockQty > 0) return false;
    if (dq && !`${p.name} ${p.sku}`.toLowerCase().includes(dq.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.stockQty - b.stockQty), [products, filter, dq]);

  const lowN = products.filter((p) => p.stockQty <= (p.reorderLevel ?? 5)).length;
  const outN = products.filter((p) => p.stockQty <= 0).length;
  const dmgLoss = damages.reduce((a, d) => a + d.qty * d.unitCost, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('inv.title')}</h1>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={() => setShowLedger(true)}>📒 {t('inv.ledger')}</Btn>
          <Btn variant="secondary" size="sm" onClick={() => setShowDmg(true)}>⚠ {t('pr.damage')}</Btn>
          <Btn size="sm" onClick={() => setShowAdj(true)}>⇄ {t('inv.adjust')}</Btn>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('inv.value')} value={money(val.value)} />
        <Stat label={t('inv.units')} value={num(val.units)} />
        <Stat label={t('pr.low')} value={num(lowN)} warn={lowN > 0} />
        <Stat label={`${t('inv.damages')} (${t('c.cost')})`} value={money(dmgLoss)} warn={dmgLoss > 0} />
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('c.search')}…`} /></div>
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:!w-44">
          <option value="all">{t('c.all')}</option><option value="low">{t('pr.low')}</option><option value="out">{t('pr.out')}</option>
        </Select>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">{t('c.name')}</th><th className="px-2 py-3 text-right font-bold">{t('pr.stock')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('pr.avgCost')}</th><th className="px-2 py-3 text-right font-bold">{t('inv.value')}</th>
            <th className="px-4 py-3 text-right font-bold">{t('c.status')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3"><span className="font-bold">{p.name}</span> <span className="tnum text-[12px] text-ink-400">{p.sku}</span></td>
                <td className={`tnum px-2 py-3 text-right font-extrabold ${p.stockQty <= 0 ? 'text-red-600' : p.stockQty <= (p.reorderLevel ?? 5) ? 'text-amber-700' : ''}`}>{num(p.stockQty)}</td>
                <td className="tnum px-2 py-3 text-right">{money(p.avgCost)}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{money(p.stockQty * p.avgCost)}</td>
                <td className="px-4 py-3 text-right">{p.stockQty <= 0 ? <Badge color="red">{t('pr.out')}</Badge> : p.stockQty <= (p.reorderLevel ?? 5) ? <Badge color="amber">{t('pr.low')}</Badge> : <Badge color="green">{t('pr.ok')}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>

      {!!damages.length && (
        <Card>
          <h3 className="mb-2 text-[15px] font-bold">⚠ {t('inv.damages')}</h3>
          <ul className="divide-y divide-ink-100 text-[13px]">
            {damages.slice(0, 15).map((d) => (
              <li key={d.id} className="tnum flex items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="font-semibold">{pname(d.productId)}</span> <span className="text-ink-400">×{num(d.qty)} · {d.reason} · {fmtDate(d.date, lang)}</span></span>
                <span className="font-bold text-red-600">−{money(d.qty * d.unitCost)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {showAdj && businessId && <AdjustModal products={products.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty }))} onClose={() => setShowAdj(false)} />}
      {showDmg && businessId && <DamageModal products={products.map((p) => ({ id: p.id, name: p.name, stockQty: p.stockQty }))} onClose={() => setShowDmg(false)} />}
      <Modal open={showLedger} onClose={() => setShowLedger(false)} title={t('inv.ledger')} wide>
        <ul className="divide-y divide-ink-100 text-[13px]">
          {moves.map((m) => (
            <li key={m.id} className="tnum flex items-center justify-between gap-2 py-2">
              <span className="min-w-0"><span className="font-semibold">{pname(m.productId)}</span>
              <span className="block text-[12px] text-ink-400">{t(`mv.${m.type}` as never)} · {fmtDate(m.date, lang)}{m.notes ? ` · ${m.notes}` : ''}</span></span>
              <span className={`font-extrabold ${m.qty >= 0 ? 'text-brand-700' : 'text-red-600'}`}>{m.qty >= 0 ? '+' : ''}{num(m.qty)} <span className="font-medium text-ink-400">→ {num(m.balance)}</span></span>
            </li>
          ))}
          {!moves.length && <li className="py-6 text-center text-ink-400">—</li>}
        </ul>
      </Modal>
    </div>
  );
}

function AdjustModal({ products, onClose }: { products: { id: ID; name: string; stockQty: number }[]; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [pid, setPid] = useState('');
  const [toQty, setToQty] = useState(0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = products.find((p) => p.id === pid)?.stockQty ?? 0;
  const save = async () => {
    if (!businessId || !pid || toQty < 0 || !Number.isInteger(toQty)) { toast(t('err.qty'), 'err'); return; }
    setBusy(true);
    try {
      await applyStock(businessId, pid, undefined, toQty - cur, ymd(), 'adjustment', { notes: reason || 'Manual adjustment' });
      await audit(businessId, 'adjust', 'inventory', pid, `${cur} → ${toQty}`);
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('inv.adjust')}>
      <div className="space-y-3.5">
        <Field label={t('c.name')}><Select value={pid} onChange={(e) => { setPid(e.target.value); setToQty(products.find((p) => p.id === e.target.value)?.stockQty ?? 0); }}><option value="">—</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (⦿{p.stockQty})</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pr.stock')}><Input value={cur} disabled className="tnum" /></Field>
          <Field label={`${t('inv.adjust')} →`}><Input type="number" min={0} value={toQty} onChange={(e) => setToQty(parseInt(e.target.value) || 0)} className="tnum" /></Field>
        </div>
        <Field label={t('c.notes')} optional><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cycle count correction…" /></Field>
        <Btn className="w-full" loading={busy} onClick={save}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}

function DamageModal({ products, onClose }: { products: { id: ID; name: string; stockQty: number }[]; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [pid, setPid] = useState('');
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('courier');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!businessId || !pid) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try { await recordDamage(businessId, { productId: pid, qty: Math.floor(qty), reason }); toast(t('t.saved')); onClose(); }
    catch (e) { toast((e as Error).message === 'stock-short' ? t('err.stock', '') : t('err.save'), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('pr.damage')}>
      <div className="space-y-3.5">
        <Field label={t('c.name')}><Select value={pid} onChange={(e) => setPid(e.target.value)}><option value="">—</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} (⦿{p.stockQty})</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('c.qty')}><Input type="number" min={1} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)} className="tnum" /></Field>
          <Field label={t('c.status')}><Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {['courier', 'customer', 'supplier', 'broken', 'lost', 'expired', 'other'].map((r) => <option key={r} value={r}>{r}</option>)}
          </Select></Field>
        </div>
        <Btn className="w-full" loading={busy} onClick={save}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}
export type { MoveType };
