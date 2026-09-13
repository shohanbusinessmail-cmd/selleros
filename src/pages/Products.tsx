/** PRODUCTS — catalog, cost engine, variants, profitability, batches, archive. */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID } from '../db/db';
import { uid } from '../lib/id';
import { toPaisa } from '../lib/money';
import { periodRange } from '../lib/dates';
import { productProfits } from '../services/finance';
import { Btn, Field, Input, Select, MoneyInput, Modal, Drawer, Badge, Empty, SearchInput, useDebounced } from '../components/ui';
import { toCSV, download } from '../lib/csv';
import { ymd } from '../lib/dates';

export function Products() {
  const { t, businessId, money, num, toast } = useApp();
  const [sp, setSp] = useSearchParams();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [showArch, setShowArch] = useState(false);
  const [showNew, setShowNew] = useState(sp.get('new') === '1');
  const [editId, setEditId] = useState<string | null>(null);
  const viewId = sp.get('view');

  useEffect(() => { if (sp.get('new') === '1') { setShowNew(true); setSp((p) => { p.delete('new'); return p; }, { replace: true }); } }, [sp, setSp]);

  const products = useLiveQuery(() => businessId ? db.products.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const dq = useDebounced(q, 200);
  const cats = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[], [products]);
  const list = useMemo(() => products.filter((p) => {
    if (!showArch && p.status !== 'active') return false;
    if (cat !== 'all' && p.category !== cat) return false;
    if (dq && !`${p.name} ${p.sku} ${p.brand ?? ''}`.toLowerCase().includes(dq.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name)), [products, showArch, cat, dq]);

  const stockBadge = (p: { stockQty: number; reorderLevel?: number }) =>
    p.stockQty <= 0 ? <Badge color="red">{t('pr.out')}</Badge>
    : p.stockQty <= (p.reorderLevel ?? 5) ? <Badge color="amber">{t('pr.low')}</Badge>
    : <Badge color="green">{t('pr.ok')}</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('pr.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(list.length)}</span></h1>
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={() => {
            download(`products-${ymd()}.csv`, toCSV([['Name', 'SKU', 'Category', 'Sell (BDT)', 'AvgCost (BDT)', 'Stock'], ...list.map((p) => [p.name, p.sku, p.category ?? '', (p.sellPrice / 100).toFixed(2), (p.avgCost / 100).toFixed(2), p.stockQty])]), 'text/csv');
            toast(t('t.exported'));
          }}>⇩ {t('c.export')}</Btn>
          <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('pr.new')}</Btn>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('c.search')}…`} /></div>
        <div className="flex gap-2">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto"><option value="all">{t('pr.category')}: {t('c.all')}</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
          <Btn variant={showArch ? 'soft' : 'secondary'} size="sm" onClick={() => setShowArch((v) => !v)} className="!h-11">📦</Btn>
        </div>
      </div>

      <div className="card hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[820px] text-left text-[13.5px]">
          <thead><tr className="border-b border-ink-100 text-[12px] uppercase tracking-wide text-ink-400">
            <th className="px-4 py-3 font-bold">{t('c.name')}</th><th className="px-2 py-3 font-bold">{t('pr.sku')}</th>
            <th className="px-2 py-3 font-bold">{t('pr.category')}</th><th className="px-2 py-3 text-right font-bold">{t('pr.sellPrice')}</th>
            <th className="px-2 py-3 text-right font-bold">{t('pr.avgCost')}</th><th className="px-2 py-3 text-right font-bold">{t('pr.stock')}</th>
            <th className="px-4 py-3 text-right font-bold">{t('c.status')}</th>
          </tr></thead>
          <tbody className="divide-y divide-ink-50">
            {list.map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-brand-50/50" onClick={() => setSp({ view: p.id })}>
                <td className="px-4 py-3"><span className="flex items-center gap-2.5">{p.image ? <img src={p.image} alt="" className="h-9 w-9 rounded-lg object-cover" loading="lazy" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-[15px]">▦</span>}<span className="font-bold">{p.name}</span></span></td>
                <td className="px-2 py-3 text-ink-500">{p.sku}</td>
                <td className="px-2 py-3">{p.category ? <Badge>{p.category}</Badge> : '—'}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{money(p.sellPrice - (p.discount ?? 0))}</td>
                <td className="tnum px-2 py-3 text-right">{money(p.avgCost)}</td>
                <td className="tnum px-2 py-3 text-right font-bold">{num(p.stockQty)}</td>
                <td className="px-4 py-3 text-right">{stockBadge(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && <div className="p-8 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
      </div>

      <ul className="space-y-2.5 md:hidden">
        {list.map((p) => (
          <li key={p.id}><button onClick={() => setSp({ view: p.id })} className="card flex w-full items-center gap-3 p-3.5 text-left">
            {p.image ? <img src={p.image} alt="" className="h-12 w-12 rounded-xl object-cover" loading="lazy" /> : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-100 text-[20px]">▦</span>}
            <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-bold">{p.name}</span>
            <span className="tnum block text-[12.5px] text-ink-500">{p.sku} · {t('pr.stock')}: {num(p.stockQty)}</span></span>
            <span className="text-right"><span className="tnum block text-[14.5px] font-extrabold">{money(p.sellPrice - (p.discount ?? 0))}</span>{stockBadge(p)}</span>
          </button></li>
        ))}
      </ul>
      {!list.length && !dq && <Empty icon="▦" title={t('empty.products.t')} body={t('empty.products.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('pr.new')}</Btn>} />}

      {showNew && businessId && <ProductForm onClose={() => setShowNew(false)} />}
      {editId && businessId && <ProductForm id={editId} onClose={() => setEditId(null)} />}
      {viewId && businessId && <ProductDetail id={viewId} onClose={() => setSp({})} onEdit={(id) => { setSp({}); setEditId(id); }} />}
    </div>
  );
}

/* ---------- image: resize + compress to dataURL (local, fast) ---------- */
export function fileToDataURL(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ProductForm({ id, onClose }: { id?: ID; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [f, setF] = useState({ name: '', sku: '', category: '', brand: '', supplierId: '', sellPrice: 0, discount: 0, reorderLevel: 5, weight: 0, notes: '', image: '' });
  const [busy, setBusy] = useState(false);
  const suppliers = useLiveQuery(() => businessId ? db.suppliers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => {
    if (!id) { setF((s) => ({ ...s, sku: `SKU-${Date.now().toString(36).toUpperCase()}` })); return; }
    db.products.get(id).then((p) => { if (p) setF({ name: p.name, sku: p.sku, category: p.category ?? '', brand: p.brand ?? '', supplierId: p.supplierId ?? '', sellPrice: p.sellPrice / 100, discount: (p.discount ?? 0) / 100, reorderLevel: p.reorderLevel ?? 5, weight: p.weight ?? 0, notes: p.notes ?? '', image: p.image ?? '' }); });
  }, [id]);
  const set = (k: keyof typeof f, v: string | number) => setF((s) => ({ ...s, [k]: v }));
  const save = async () => {
    if (!businessId || !f.name.trim() || !f.sku.trim()) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      const data = { businessId, name: f.name.trim(), sku: f.sku.trim(), category: f.category.trim() || undefined, brand: f.brand.trim() || undefined, supplierId: f.supplierId || undefined, image: f.image || undefined, sellPrice: toPaisa(f.sellPrice), discount: toPaisa(f.discount), reorderLevel: Math.max(0, Math.floor(f.reorderLevel)), weight: f.weight || undefined, notes: f.notes || undefined, updatedAt: Date.now() };
      if (id) await db.products.update(id, data);
      else await db.products.add({ ...data, id: uid('pr'), stockQty: 0, avgCost: 0, status: 'active', createdAt: Date.now() });
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={id ? t('c.edit') : t('pr.new')} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`${t('c.name')} *`}><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Premium Chiffon Hijab" /></Field>
        <Field label={`${t('pr.sku')} *`}><Input value={f.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
        <Field label={t('pr.category')}><Input value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Fashion" list="hishab-cats" /></Field>
        <Field label={t('pr.brand')} optional><Input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></Field>
        <Field label={t('pr.sellPrice')}><MoneyInput value={f.sellPrice} onChange={(v) => set('sellPrice', v)} /></Field>
        <Field label={t('ord.discount')} optional><MoneyInput value={f.discount} onChange={(v) => set('discount', v)} /></Field>
        <Field label={t('pr.supplier')} optional><Select value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}><option value="">—</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label={t('pr.reorder')}><Input type="number" min={0} value={f.reorderLevel} onChange={(e) => set('reorderLevel', parseInt(e.target.value) || 0)} /></Field>
        <Field label={t('pr.image')} optional>
          <div className="flex items-center gap-3">
            {f.image && <img src={f.image} alt="" className="h-11 w-11 rounded-lg object-cover" />}
            <input type="file" accept="image/*" aria-label={t('pr.image')} onChange={async (e) => { const fl = e.target.files?.[0]; if (fl) { try { set('image', await fileToDataURL(fl)); } catch { toast(t('err.save'), 'err'); } } }} className="text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-[13px] file:font-bold file:text-brand-700" />
          </div>
        </Field>
        <Field label={t('pr.weight')} optional><Input type="number" min={0} value={f.weight || ''} onChange={(e) => set('weight', parseFloat(e.target.value) || 0)} /></Field>
        <div className="sm:col-span-2"><Field label={t('c.notes')} optional><Input value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field></div>
      </div>
      <datalist id="hishab-cats"><option value="Fashion" /><option value="Dresses" /><option value="Cosmetics" /><option value="Electronics" /><option value="Home" /><option value="Kids" /></datalist>
      <div className="mt-5 flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn><Btn loading={busy} onClick={save}>{t('c.save')}</Btn></div>
    </Modal>
  );
}

function ProductDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit: (id: ID) => void }) {
  const { t, businessId, money, num, toast } = useApp();
  const p = useLiveQuery(() => db.products.get(id), [id]);
  const variants = useLiveQuery(() => businessId ? db.variants.where('[businessId+productId]').equals([businessId, id]).toArray() : [], [businessId, id]) ?? [];
  const batches = useLiveQuery(() => businessId ? db.batches.where('[businessId+productId]').equals([businessId, id]).toArray() : [], [businessId, id]) ?? [];
  const [profit, setProfit] = useState<{ units: number; revenue: number; gross: number; net: number; margin: number } | null>(null);
  const [vName, setVName] = useState('');
  const [vPrice, setVPrice] = useState(0);

  useEffect(() => {
    if (!businessId) return;
    productProfits(businessId, periodRange('12m')).then((all) => {
      const x = all.find((a) => a.productId === id);
      if (x) setProfit({ units: x.units, revenue: x.revenue, gross: x.gross, net: x.net, margin: x.margin });
    });
  }, [businessId, id]);

  if (!p) return <Drawer open onClose={onClose} title="…"><p>…</p></Drawer>;
  const marginOnPrice = p.sellPrice > 0 ? ((p.sellPrice - (p.discount ?? 0) - p.avgCost) / p.sellPrice) * 100 : 0;
  return (
    <Drawer open onClose={onClose} title={p.name}>
      <div className="space-y-5">
        <div className="flex gap-3.5">
          {p.image ? <img src={p.image} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-100 text-[30px]">▦</span>}
          <div className="min-w-0 text-[13px]">
            <div className="tnum font-bold text-ink-500">{p.sku}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{p.category && <Badge>{p.category}</Badge>}{p.brand && <Badge color="blue">{p.brand}</Badge>}</div>
            <div className="tnum mt-1.5 text-[19px] font-extrabold">{money(p.sellPrice - (p.discount ?? 0))} <span className="text-[12px] font-medium text-ink-400">{t('pr.avgCost')} {money(p.avgCost)}</span></div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded-xl bg-ink-50 p-3"><div className="tnum text-[18px] font-extrabold">{num(p.stockQty)}</div><div className="text-[11.5px] text-ink-500">{t('pr.stock')}</div></div>
          <div className="rounded-xl bg-ink-50 p-3"><div className={`tnum text-[18px] font-extrabold ${marginOnPrice < 0 ? 'text-red-600' : 'text-brand-700'}`}>{marginOnPrice.toFixed(1)}%</div><div className="text-[11.5px] text-ink-500">{t('c.margin')}</div></div>
          <div className="rounded-xl bg-ink-50 p-3"><div className="tnum text-[18px] font-extrabold">{money(p.stockQty * p.avgCost)}</div><div className="text-[11.5px] text-ink-500">{t('inv.value')}</div></div>
        </div>
        {profit && (
          <section className="rounded-xl border border-ink-200 p-3.5">
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('pr.profitability')} · 12M</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13.5px]">
              <KV k={t('c.units')} v={num(profit.units)} /><KV k={t('c.revenue')} v={money(profit.revenue)} />
              <KV k={t('fin.gross')} v={money(profit.gross)} /><KV k={`${t('fin.net')} (${t('fin.estimated')})`} v={money(profit.net)} bold neg={profit.net < 0} />
            </div>
          </section>
        )}
        {!!batches.length && (
          <section>
            <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('pu.batches')}</h3>
            <ul className="space-y-1.5 text-[13px]">
              {batches.slice().reverse().slice(0, 8).map((b) => (
                <li key={b.id} className="tnum flex justify-between rounded-lg bg-ink-50 px-3 py-2"><span>{b.date} · ×{num(b.qty)}</span><span className="font-bold">{money(b.unitCost)}/u · {t('pr.stock')} {num(b.remaining)}</span></li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-400">{t('pr.variants')} ({num(variants.length)})</h3>
          <ul className="space-y-1.5 text-[13px]">
            {variants.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2">
                <span className="font-semibold">{v.name}</span>
                <span className="tnum text-ink-500">{money(v.sellPrice ?? p.sellPrice)} · ⦿{num(v.stockQty)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Red / XL…" className="flex-1" />
            <div className="w-28"><MoneyInput value={vPrice} onChange={setVPrice} /></div>
            <Btn variant="secondary" onClick={async () => {
              if (!businessId || !vName.trim()) return;
              await db.variants.add({ id: uid('vr'), businessId, productId: id, name: vName.trim(), sellPrice: vPrice ? toPaisa(vPrice) : undefined, stockQty: 0, avgCost: 0, status: 'active' });
              setVName(''); setVPrice(0); toast(t('t.saved'));
            }}>＋</Btn>
          </div>
        </section>
        {p.notes && <p className="rounded-xl bg-ink-50 p-3 text-[13px] text-ink-600">{p.notes}</p>}
        <div className="flex gap-2">
          <Btn variant="secondary" className="flex-1" onClick={() => onEdit(id)}>{t('c.edit')}</Btn>
          <Btn variant="secondary" className="flex-1" onClick={async () => { await db.products.update(id, { status: p.status === 'active' ? 'archived' : 'active' }); toast(t('t.updated')); onClose(); }}>
            {p.status === 'active' ? t('pr.archive') : t('pr.restore')}
          </Btn>
        </div>
      </div>
    </Drawer>
  );
}
function KV({ k, v, bold, neg }: { k: string; v: string; bold?: boolean; neg?: boolean }) {
  return <div className="flex items-center justify-between gap-2"><span className="text-ink-500">{k}</span><span className={`tnum ${bold ? 'font-extrabold' : 'font-bold'} ${neg ? 'text-red-600' : ''}`}>{v}</span></div>;
}
