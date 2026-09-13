/** Money engine — ALL money stored as integer paisa (BDT x 100). No floats. */
export const P = 100;

export const toPaisa = (taka: number | string): number => {
  if (typeof taka === 'string') taka = parseFloat(taka.replace(/[,৳\s]/g, '')) || 0;
  if (!isFinite(taka)) return 0;
  return Math.round(taka * P); // banker's rounding not needed; half-up via Math.round
};
export const toTaka = (paisa: number): number => Math.round(paisa) / P;

export const add = (...xs: number[]) => xs.reduce((a, b) => a + Math.round(b), 0);
export const sub = (a: number, b: number) => Math.round(a) - Math.round(b);
export const mulQty = (unitPaisa: number, qty: number) => Math.round(unitPaisa) * qty;
export const pctOf = (base: number, pct: number) => Math.round((Math.round(base) * pct) / 100);

/** Split an amount across weights with largest-remainder so the sum is exact. */
export function splitProportional(total: number, weights: number[]): number[] {
  const t = Math.round(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0 || weights.length === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (t * w) / sum);
  const floors = raw.map((r) => Math.floor(r));
  let rest = t - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; floors[i] += 1; rest -= 1; }
  return floors;
}

export const isNonNegInt = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Format paisa → "৳1,250" (or with decimals when needed). Locale-aware bn/en digits. */
export function fmtMoney(paisa: number, lang: 'en' | 'bn' = 'en', opts?: { decimals?: number }): string {
  const v = Math.round(paisa || 0) / P;
  const dec = opts?.decimals ?? (Number.isInteger(v) ? 0 : 2);
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  return `৳${v.toLocaleString(locale, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
}
export const fmtNum = (n: number, lang: 'en' | 'bn' = 'en') =>
  Math.round(n || 0).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US');
export const fmtPct = (n: number, digits = 1) => `${n >= 0 ? '' : ''}${n.toFixed(digits)}%`;
