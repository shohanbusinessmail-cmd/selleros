export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${r}`;
}
export function orderCode(seq: number): string {
  return `ORD-${String(seq).padStart(5, '0')}`;
}
