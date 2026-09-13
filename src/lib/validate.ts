/** Domain-level validation (UI + service shared). Returns error key or null. */
export const vRequired = (v: unknown): string | null =>
  v === undefined || v === null || String(v).trim() === '' ? 'err.required' : null;
export const vMoney = (taka: unknown): string | null => {
  const n = Number(taka);
  if (taka === '' || taka === undefined || taka === null) return 'err.required';
  if (!isFinite(n) || n < 0) return 'err.money';
  return null;
};
export const vQty = (q: unknown): string | null => {
  const n = Number(q);
  if (!isFinite(n) || n <= 0 || !Number.isInteger(n)) return 'err.qty';
  return null;
};
export const vPhone = (p: string): string | null => {
  const s = String(p || '').replace(/[\s-]/g, '');
  if (!s) return 'err.required';
  if (!/^(\+?880|0)?1[3-9]\d{8}$/.test(s)) return 'err.phone';
  return null;
};
export const vEmail = (e: string): string | null => {
  if (!e) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? null : 'err.email';
};
