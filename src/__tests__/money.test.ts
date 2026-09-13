import { describe, it, expect } from 'vitest';
import { toPaisa, toTaka, add, splitProportional, fmtMoney } from '../lib/money';

describe('money engine (integer paisa)', () => {
  it('avoids float errors: 0.1 + 0.2', () => {
    expect(add(toPaisa(0.1), toPaisa(0.2))).toBe(30);
    expect(toTaka(add(toPaisa(0.1), toPaisa(0.2)))).toBe(0.3);
  });
  it('converts taka<->paisa', () => {
    expect(toPaisa(900)).toBe(90000);
    expect(toPaisa('1,250.50')).toBe(125050);
    expect(toTaka(57500)).toBe(575);
  });
  it('splits proportionally with exact sum (largest remainder)', () => {
    const parts = splitProportional(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
    const p2 = splitProportional(57500, [50000, 5000, 2000, 500]);
    expect(p2.reduce((a, b) => a + b, 0)).toBe(57500);
  });
  it('formats BDT in en + bn', () => {
    expect(fmtMoney(125000, 'en')).toBe('৳1,250');
    expect(fmtMoney(125050, 'en')).toContain('1,250.50');
    expect(fmtMoney(125000, 'bn')).toContain('৳');
  });
});
