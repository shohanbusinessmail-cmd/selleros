/** HishabOS UI kit — buttons, fields, modals, drawers, tables helpers, feedback. */
import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { PeriodKey } from '../lib/dates';

/* ---------- Buttons ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };
export function Btn({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
    secondary: 'bg-white border border-ink-200 hover:bg-ink-50 text-ink-900',
    ghost: 'hover:bg-ink-100 text-ink-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  }[variant];
  const s = { sm: 'h-9 px-3 text-[13px]', md: 'h-11 px-4 text-sm', lg: 'h-12 px-6 text-[15px]' }[size];
  return (
    <button disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none ${v} ${s} ${className}`} {...rest}>
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

/* ---------- Cards / stats ---------- */
export function Card({ className = '', children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card p-4 sm:p-5 ${className}`} {...rest}>{children}</div>;
}
export function Stat({ label, value, sub, delta, warn, onClick }: { label: string; value: string; sub?: string; delta?: { v: string; up: boolean; good?: boolean }; warn?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`card p-4 ${onClick ? 'cursor-pointer hover:border-brand-200 transition' : ''} ${warn ? 'border-amber-300' : ''}`}>
      <div className="text-[12.5px] font-medium text-ink-500">{label}</div>
      <div className="tnum mt-1 text-[22px] font-bold leading-tight tracking-tight">{value}</div>
      {(sub || delta) && (
        <div className="mt-1 flex items-center gap-2 text-[12px]">
          {delta && <span className={`tnum font-semibold ${delta.good === false ? 'text-red-600' : delta.up ? 'text-brand-600' : 'text-red-500'}`}>{delta.up ? '▲' : '▼'} {delta.v}</span>}
          {sub && <span className="text-ink-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Fields ---------- */
export function Field({ label, hint, error, children, optional }: { label: string; hint?: string; error?: string | null; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[13px] font-semibold text-ink-700">
        {label}{optional && <span className="text-[11px] font-normal text-ink-400">· {useApp().t('c.optional')}</span>}
      </span>
      {children}
      {error ? <span className="mt-1 block text-[12px] font-medium text-red-600">{error}</span>
        : hint ? <span className="mt-1 block text-[12px] text-ink-400">{hint}</span> : null}
    </label>
  );
}
const inputCls = 'h-11 w-full rounded-[10px] border border-ink-200 bg-white px-3.5 text-[14.5px] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 transition';
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />; }
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} pr-8 ${props.className ?? ''}`} />;
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 2} className={`min-h-[4.5rem] w-full rounded-[10px] border border-ink-200 bg-white px-3.5 py-2.5 text-[14.5px] placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ${props.className ?? ''}`} />;
}
export function MoneyInput({ value, onChange, ...rest }: { value: number; onChange: (taka: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] font-bold text-ink-400">৳</span>
      <input type="number" min={0} step="any" inputMode="decimal" value={value === 0 ? '' : value} placeholder="0"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)} {...rest} className={`${inputCls} pl-8 tnum ${rest.className ?? ''}`} />
    </div>
  );
}

/* ---------- Badge ---------- */
const badgeColors: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200', amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200', blue: 'bg-sky-50 text-sky-700 border-sky-200',
  gray: 'bg-ink-50 text-ink-600 border-ink-200', brand: 'bg-brand-50 text-brand-700 border-brand-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};
export function Badge({ color = 'gray', children, className = '' }: { color?: keyof typeof badgeColors | string; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap ${(badgeColors[color] ?? badgeColors.gray)} ${className}`}>{children}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const { t } = useApp();
  const map: Record<string, string> = { delivered: 'green', returned: 'amber', cancelled: 'red', failed: 'red', draft: 'gray', pending: 'blue', confirmed: 'blue', processing: 'violet', packed: 'violet', shipped: 'amber', paid: 'green', partial: 'amber', unpaid: 'red' };
  const label = (t as (k: string) => string)(`st.${status}` as never) !== `st.${status}` ? (t as (k: string) => string)(`st.${status}` as never) : status;
  return <Badge color={map[status] ?? 'gray'}>{label}</Badge>;
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/45" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-pop`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white/95 px-4 sm:px-6 py-4 backdrop-blur">
          <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100 text-xl leading-none">×</button>
        </div>
        <div className="px-4 sm:px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Drawer (desktop detail / mobile sheet) ---------- */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink-950/45" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-[6dvh] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[440px] overflow-y-auto rounded-t-2xl sm:rounded-none bg-white shadow-pop">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur">
          <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-ink-100 text-xl leading-none">×</button>
        </div>
        <div className="px-5 py-5 pb-10">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Confirm ---------- */
export function Confirm({ open, onClose, onYes, title, body, danger }: { open: boolean; onClose: () => void; onYes: () => void; title: string; body: string; danger?: boolean }) {
  const { t } = useApp();
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-[14px] leading-relaxed text-ink-600">{body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn>
        <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onYes(); onClose(); }}>{t('c.yesDelete')}</Btn>
      </div>
    </Modal>
  );
}

/* ---------- Empty / loading / misc ---------- */
export function Empty({ icon, title, body, action }: { icon?: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-[26px]">{icon ?? '◍'}</div>
      <h3 className="mt-4 text-[16px] font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-500">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function Skeleton({ className = '' }: { className?: string }) { return <div className={`skeleton rounded-xl ${className}`} aria-hidden />; }
export function PageSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-9 w-48" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-64" />
    </div>
  );
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { k: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.k} role="tab" aria-selected={value === tb.k} onClick={() => onChange(tb.k)}
          className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${value === tb.k ? 'bg-white shadow-sm text-ink-900' : 'text-ink-500 hover:text-ink-800'}`}>{tb.label}</button>
      ))}
    </div>
  );
}
export function PeriodBar({ value, onChange, onCustom }: { value: PeriodKey; onChange: (v: PeriodKey) => void; onCustom?: (r: { from: string; to: string }) => void }) {
  const { t } = useApp();
  const [show, setShow] = useState(false);
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const opts: { k: PeriodKey; label: string }[] = [
    { k: 'today', label: t('c.today') }, { k: '7d', label: t('c.d7') }, { k: '30d', label: t('c.d30') },
    { k: 'month', label: t('c.month') }, { k: '3m', label: t('c.m3') }, { k: '6m', label: t('c.m6') }, { k: '12m', label: t('c.m12') },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opts.map((o) => (
        <button key={o.k} onClick={() => onChange(o.k)} className={`rounded-full px-3 py-[7px] text-[12.5px] font-semibold transition ${value === o.k ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600 hover:border-ink-300'}`}>{o.label}</button>
      ))}
      <div className="relative">
        <button onClick={() => setShow((s) => !s)} className={`rounded-full px-3 py-[7px] text-[12.5px] font-semibold transition ${value === 'custom' ? 'bg-ink-900 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}>{t('c.custom')}</button>
        {show && (
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-ink-200 bg-white p-3 shadow-pop">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] font-semibold">{t('c.from')}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-ink-200 px-2 text-[13px]" /></label>
              <label className="text-[12px] font-semibold">{t('c.to')}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-ink-200 px-2 text-[13px]" /></label>
            </div>
            <Btn size="sm" className="mt-2 w-full" onClick={() => { if (from && to && from <= to) { onCustom?.({ from, to }); onChange('custom'); setShow(false); } }}>{t('c.apply')}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden>⌕</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} pl-10`} />
    </div>
  );
}
export function Avatar({ name }: { name: string }) {
  const init = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[12.5px] font-bold text-brand-700">{init}</span>;
}
export function Progress({ v }: { v: number }) {
  return <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>;
}
export function useDebounced<T>(v: T, ms = 250): T {
  const [d, setD] = useState(v);
  useEffect(() => { const id = setTimeout(() => setD(v), ms); return () => clearTimeout(id); }, [v, ms]);
  return d;
}
export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}
export { inputCls };
export type { PeriodKey };
export function useEscape(onClose: () => void, active = true) {
  const ref = useRef(onClose); ref.current = onClose;
  useEffect(() => {
    if (!active) return;
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') ref.current(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [active]);
}
