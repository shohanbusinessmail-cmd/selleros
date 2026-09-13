/** Lightweight SVG charts — responsive, touch-friendly, no deps. */
import React, { useId, useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';

const C = { line: '#1f6a57', prev: '#c4ccd8', bars: ['#1f6a57', '#4da087', '#e8b34b', '#8794a9', '#7c9cd6', '#d67c7c', '#9a7cd6', '#5cc4b5'] };

export function Spark({ data, w = 96, h = 30 }: { data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - 3 - ((v - min) / Math.max(1, max - min)) * (h - 6)}`).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden><polyline points={pts} fill="none" stroke={C.line} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function TrendChart({ days, money }: { days: { date: string; revenue: number; prevRevenue: number }[]; money: (n: number) => string }) {
  const { lang } = useApp();
  const gid = useId();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720, H = 240, P = { t: 12, r: 10, b: 30, l: 8 };
  const max = Math.max(1, ...days.map((d) => Math.max(d.revenue, d.prevRevenue)));
  const X = (i: number) => P.l + (i / Math.max(1, days.length - 1)) * (W - P.l - P.r);
  const Y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (get: (d: (typeof days)[0]) => number) => days.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(get(d)).toFixed(1)}`).join(' ');
  const area = `${path((d) => d.revenue)} L${X(days.length - 1).toFixed(1)},${H - P.b} L${X(0).toFixed(1)},${H - P.b} Z`;
  const ticks = useMemo(() => {
    const n = days.length <= 10 ? days.length : 6;
    return days.filter((_, i) => i % Math.max(1, Math.ceil(days.length / n)) === 0 || i === days.length - 1);
  }, [days]);
  if (!days.length) return <div className="flex h-40 items-center justify-center text-sm text-ink-400">—</div>;
  const hovD = hov !== null ? days[hov] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Revenue trend"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width * W - P.l) / (W - P.l - P.r) * (days.length - 1));
          setHov(Math.max(0, Math.min(days.length - 1, i)));
        }} onMouseLeave={() => setHov(null)}
        onTouchMove={(e) => {
          const t = e.touches[0]; const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const i = Math.round(((t.clientX - r.left) / r.width * W - P.l) / (W - P.l - P.r) * (days.length - 1));
          setHov(Math.max(0, Math.min(days.length - 1, i)));
        }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1f6a57" stopOpacity=".22" /><stop offset="100%" stopColor="#1f6a57" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={P.l} x2={W - P.r} y1={P.t + (1 - f) * (H - P.t - P.b)} y2={P.t + (1 - f) * (H - P.t - P.b)} stroke="#eceef2" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        <path d={path((d) => d.prevRevenue)} fill="none" stroke={C.prev} strokeWidth="1.6" strokeDasharray="5 4" />
        <path d={path((d) => d.revenue)} fill="none" stroke={C.line} strokeWidth="2.4" strokeLinecap="round" />
        {ticks.map((d) => {
          const i = days.indexOf(d);
          return <text key={d.date} x={X(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#8794a9">{d.date.slice(5)}</text>;
        })}
        {hov !== null && (
          <g>
            <line x1={X(hov)} x2={X(hov)} y1={P.t} y2={H - P.b} stroke="#1f6a57" strokeOpacity=".35" />
            <circle cx={X(hov)} cy={Y(days[hov].revenue)} r="4.5" fill="#1f6a57" stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hovD && (
        <div className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-center shadow-pop"
          style={{ left: `${(X(hov!) / W) * 100}%` }}>
          <div className="text-[11px] font-medium text-ink-400">{new Date(hovD.date + 'T00:00:00').toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short' })}</div>
          <div className="tnum text-[13.5px] font-bold">{money(hovD.revenue)}</div>
          <div className="tnum text-[11px] text-ink-400">prev {money(hovD.prevRevenue)}</div>
        </div>
      )}
      <div className="mt-1 flex items-center gap-4 text-[12px] text-ink-500">
        <span className="flex items-center gap-1.5"><span className="h-[3px] w-5 rounded bg-brand-600" />This period</span>
        <span className="flex items-center gap-1.5"><span className="h-0 w-5 border-t-2 border-dashed border-ink-300" />Previous</span>
      </div>
    </div>
  );
}

export function Donut({ parts, money, size = 168 }: { parts: { label: string; value: number; color?: string }[]; money: (n: number) => string; size?: number }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const R = 54, CIRC = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="Breakdown">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eceef2" strokeWidth="20" />
        {total > 0 && parts.filter((p) => p.value > 0).map((p, i) => {
          const frac = p.value / total;
          const el = <circle key={p.label} cx="70" cy="70" r={R} fill="none" stroke={p.color ?? C.bars[i % C.bars.length]} strokeWidth="20"
            strokeDasharray={`${frac * CIRC} ${CIRC}`} strokeDashoffset={-acc * CIRC} transform="rotate(-90 70 70)" strokeLinecap="butt" />;
          acc += frac;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" fontSize="11" fill="#68778f">Total</text>
        <text x="70" y="84" textAnchor="middle" fontSize="14.5" fontWeight="800" fill="#23272f" className="tnum">{money(total)}</text>
      </svg>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color ?? C.bars[i % C.bars.length] }} />
            <span className="min-w-0 flex-1 truncate text-ink-600">{p.label}</span>
            <span className="tnum font-bold">{money(p.value)}</span>
            <span className="tnum w-11 text-right text-ink-400">{total ? ((p.value / total) * 100).toFixed(0) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ rows, money, maxRows = 6 }: { rows: { label: string; value: number; sub?: string }[]; money: (n: number) => string; maxRows?: number }) {
  const list = rows.slice(0, maxRows);
  const max = Math.max(1, ...list.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {list.map((r, i) => (
        <li key={r.label + i}>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate font-medium">{r.label}{r.sub && <span className="ml-1.5 font-normal text-ink-400">{r.sub}</span>}</span>
            <span className="tnum shrink-0 font-bold">{money(r.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: C.bars[i % C.bars.length] }} />
          </div>
        </li>
      ))}
      {!list.length && <li className="py-4 text-center text-[13px] text-ink-400">—</li>}
    </ul>
  );
}

export function CashBars({ inflow, outflow, money }: { inflow: number; outflow: number; money: (n: number) => string }) {
  const max = Math.max(1, inflow, outflow);
  const row = (label: string, v: number, color: string) => (
    <div>
      <div className="flex items-baseline justify-between text-[13px]"><span className="font-medium">{label}</span><span className="tnum font-bold">{money(v)}</span></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} /></div>
    </div>
  );
  return <div className="space-y-3">{row('Money in', inflow, '#1f6a57')}{row('Money out', outflow, '#d67c7c')}</div>;
}

export const PALETTE = C.bars;
export type { React as R };
