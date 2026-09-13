/** Global command center — Ctrl/Cmd+K: search everything + quick actions. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { useEscape } from './ui';

interface Hit { kind: string; id: string; title: string; sub: string; to: string }

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, businessId, money } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEscape(onClose, open);

  useEffect(() => { if (open) { setQ(''); setHits([]); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open ]);
  useEffect(() => {
    if (!open || !businessId) return;
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) { setHits([]); return; }
    let dead = false;
    const run = async () => {
      const [ps, os, cs, ss, es] = await Promise.all([
        db.products.where('businessId').equals(businessId).limit(60).toArray(),
        db.orders.where('businessId').equals(businessId).reverse().limit(60).toArray(),
        db.customers.where('businessId').equals(businessId).limit(60).toArray(),
        db.suppliers.where('businessId').equals(businessId).limit(30).toArray(),
        db.expenses.where('businessId').equals(businessId).reverse().limit(30).toArray(),
      ]);
      const out: Hit[] = [];
      for (const p of ps) if (p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle))
        out.push({ kind: t('nav.products'), id: p.id, title: p.name, sub: `${p.sku} · ${money(p.sellPrice)}`, to: `/products?view=${p.id}` });
      for (const o of os) if (o.code.toLowerCase().includes(needle) || (o.trackingId ?? '').toLowerCase().includes(needle))
        out.push({ kind: t('nav.orders'), id: o.id, title: o.code, sub: `${money(o.total)} · ${o.status}`, to: `/orders?view=${o.id}` });
      for (const c of cs) if (c.name.toLowerCase().includes(needle) || c.phone.includes(needle))
        out.push({ kind: t('nav.customers'), id: c.id, title: c.name, sub: c.phone, to: `/customers?view=${c.id}` });
      for (const s of ss) if (s.name.toLowerCase().includes(needle))
        out.push({ kind: t('nav.suppliers'), id: s.id, title: s.name, sub: s.phone ?? '', to: `/suppliers?view=${s.id}` });
      for (const e of es) if (e.category.includes(needle) || (e.notes ?? '').toLowerCase().includes(needle))
        out.push({ kind: t('fi.expenses'), id: e.id, title: `${e.category} · ${money(e.amount)}`, sub: e.date, to: `/finance?tab=expenses` });
      if (!dead) { setHits(out.slice(0, 24)); setIdx(0); }
    };
    const id = setTimeout(run, 120);
    return () => { dead = true; clearTimeout(id); };
  }, [q, open, businessId, t, money]);

  const actions = useMemo(() => [
    { label: t('cmd.addProduct'), to: '/products?new=1' }, { label: t('cmd.newOrder'), to: '/orders?new=1' },
    { label: t('cmd.addCustomer'), to: '/customers?new=1' }, { label: t('cmd.addExpense'), to: '/finance?tab=expenses&new=1' },
    { label: t('cmd.addPurchase'), to: '/purchases?new=1' }, { label: t('cmd.reports'), to: '/reports' },
  ].filter((a) => !q || a.label.toLowerCase().includes(q.toLowerCase())), [q, t]);

  if (!open) return null;
  const go = (to: string) => { onClose(); nav(to); };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[10dvh]" role="dialog" aria-modal="true" aria-label={t('cmd.title')}>
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-ink-100 px-4">
          <span className="text-ink-400" aria-hidden>⌕</span>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length + actions.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { const all = [...hits.map((h) => h.to), ...actions.map((a) => a.to)]; if (all[idx]) go(all[idx]); }
            }}
            placeholder={t('app.searchPh')} className="h-14 w-full bg-transparent py-3.5 text-[15px] outline-none placeholder:text-ink-300" />
          <kbd className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-bold text-ink-400">esc</kbd>
        </div>
        <div className="max-h-[52dvh] overflow-y-auto p-2">
          {!!hits.length && <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">{t('cmd.results')}</div>}
          {hits.map((h, i) => (
            <button key={h.kind + h.id} onClick={() => go(h.to)} onMouseEnter={() => setIdx(i)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${idx === i ? 'bg-brand-50' : ''}`}>
              <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-[3px] text-[10.5px] font-bold text-ink-500">{h.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{h.title}</span>
              <span className="tnum shrink-0 text-[12px] text-ink-400">{h.sub}</span>
            </button>
          ))}
          <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-ink-400">{t('cmd.actions')}</div>
          {actions.map((a, j) => {
            const i = hits.length + j;
            return (
              <button key={a.label} onClick={() => go(a.to)} onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold ${idx === i ? 'bg-brand-50' : ''}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-[14px] font-bold text-brand-700">＋</span>{a.label}
              </button>
            );
          })}
          {!hits.length && !actions.length && <div className="px-3 py-6 text-center text-[13.5px] text-ink-400">{t('c.noResults')}</div>}
        </div>
      </div>
    </div>
  );
}
