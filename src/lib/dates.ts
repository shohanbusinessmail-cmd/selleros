/** Local-date helpers. All business dates are YYYY-MM-DD in LOCAL time (no TZ shifts). */
export const pad = (n: number) => String(n).padStart(2, '0');
export function ymd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}
export function addDays(s: string, n: number): string {
  const d = parseYMD(s); d.setDate(d.getDate() + n); return ymd(d);
}
export function monthKey(s: string): string { return s.slice(0, 7); }
export function isBetween(s: string, from: string, to: string): boolean { return s >= from && s <= to; }
export function daysBetween(a: string, b: string): number {
  return Math.round((parseYMD(b).getTime() - parseYMD(a).getTime()) / 86400000);
}
export type PeriodKey = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastmonth' | '3m' | '6m' | '12m' | 'all' | 'custom';
export function periodRange(key: PeriodKey, custom?: { from: string; to: string }): { from: string; to: string } {
  const t = ymd();
  const now = new Date();
  switch (key) {
    case 'today': return { from: t, to: t };
    case 'yesterday': { const y = addDays(t, -1); return { from: y, to: y }; }
    case '7d': return { from: addDays(t, -6), to: t };
    case '30d': return { from: addDays(t, -29), to: t };
    case 'month': return { from: `${t.slice(0, 7)}-01`, to: t };
    case 'lastmonth': {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(d), to: ymd(end) };
    }
    case '3m': return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: t };
    case '6m': return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 5, 1)), to: t };
    case '12m': return { from: ymd(new Date(now.getFullYear() - 1, now.getMonth(), 1)), to: t };
    case 'all': return { from: '2000-01-01', to: t };
    case 'custom': return custom ?? { from: addDays(t, -29), to: t };
  }
}
export function prevRange(r: { from: string; to: string }): { from: string; to: string } {
  const len = daysBetween(r.from, r.to) + 1;
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []; let c = from;
  while (c <= to) { out.push(c); c = addDays(c, 1); if (out.length > 1200) break; }
  return out;
}
export function fmtDate(s: string, lang: 'en' | 'bn' = 'en'): string {
  try {
    return parseYMD(s).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return s; }
}
export function fmtDateTime(ts: number, lang: 'en' | 'bn' = 'en'): string {
  return new Date(ts).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
