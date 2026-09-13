import { describe, it, expect } from 'vitest';
import { parseCSV, toCSV } from '../lib/csv';
import { validateBackup, BACKUP_VERSION } from '../services/backup';
import { vPhone, vMoney, vQty, vEmail } from '../lib/validate';
import { periodRange, prevRange, ymd } from '../lib/dates';

describe('csv', () => {
  it('round-trips quoted values', () => {
    const rows = [['a', 'b,c', 'd"e'], ['1', '2', '3']];
    expect(parseCSV(toCSV(rows))).toEqual(rows);
  });
});
describe('backup validation', () => {
  it('rejects garbage, accepts versioned schema', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ app: 'X' }).ok).toBe(false);
    const good = { backupVersion: BACKUP_VERSION, app: 'HishabOS', exportedAt: '', businessId: 'b', counts: {}, data: { orders: [] } };
    expect(validateBackup(good).ok).toBe(true);
    expect(validateBackup({ ...good, backupVersion: 999 }).ok).toBe(false);
  });
});
describe('validation', () => {
  it('bd phones', () => {
    expect(vPhone('01712345678')).toBe(null);
    expect(vPhone('+8801712345678')).toBe(null);
    expect(vPhone('123')).toBe('err.phone');
  });
  it('money + qty', () => {
    expect(vMoney(10)).toBe(null);
    expect(vMoney(-1)).toBe('err.money');
    expect(vQty(2)).toBe(null);
    expect(vQty(0)).toBe('err.qty');
    expect(vEmail('a@b.com')).toBe(null);
    expect(vEmail('nope')).toBe('err.email');
  });
});
describe('dates', () => {
  it('periods are sane + local', () => {
    expect(ymd()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const r = periodRange('30d');
    expect(r.from <= r.to).toBe(true);
    const p = prevRange(r);
    expect(p.to < r.from).toBe(true);
  });
});
