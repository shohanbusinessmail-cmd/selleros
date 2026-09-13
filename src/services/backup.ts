/** BACKUP / RESTORE — versioned JSON snapshot of a workspace. Validated before import. */
import { db, type ID } from '../db/db';

export const BACKUP_VERSION = 1;
const TABLES = ['businesses','products','variants','purchases','purchaseItems','batches','customers','suppliers','orders','orderItems','payments','expenses','campaigns','couriers','settlements','returns','damages','moves','txns','alerts','audit'] as const;

export interface BackupFile { backupVersion: number; app: string; exportedAt: string; businessId: ID; counts: Record<string, number>; data: Record<string, unknown[]> }

export async function exportBackup(bid: ID): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {}; const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const table = (db as unknown as Record<string, { toArray: () => Promise<Record<string, unknown>[]> }>)[t];
    const all = await table.toArray();
    const rows = t === 'businesses' ? all.filter((r) => r.id === bid) : all.filter((r) => (r as { businessId?: string }).businessId === bid);
    data[t] = rows; counts[t] = rows.length;
  }
  return { backupVersion: BACKUP_VERSION, app: 'HishabOS', exportedAt: new Date().toISOString(), businessId: bid, counts, data };
}

export function validateBackup(json: unknown): { ok: boolean; errors: string[]; file?: BackupFile } {
  const errors: string[] = [];
  if (!json || typeof json !== 'object') return { ok: false, errors: ['backup.invalid'] };
  const f = json as Partial<BackupFile>;
  if (f.app !== 'HishabOS') errors.push('backup.wrongApp');
  if (f.backupVersion !== BACKUP_VERSION) errors.push('backup.version');
  if (!f.data || typeof f.data !== 'object') errors.push('backup.noData');
  if (!f.businessId) errors.push('backup.noBusiness');
  if (f.data) for (const t of TABLES) {
    const rows = (f.data as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) errors.push(`backup.badTable:${t}`);
  }
  return { ok: errors.length === 0, errors, file: errors.length ? undefined : (f as BackupFile) };
}

/** Restore with replace (default) or merge. Replace deletes ONLY this workspace's rows. */
export async function restoreBackup(file: BackupFile, mode: 'replace' | 'merge', targetBid: ID): Promise<void> {
  const remap = file.businessId !== targetBid;
  await db.transaction('rw', [...TABLES.map((t) => (db as unknown as Record<string, object>)[t])] as never, async () => {
    for (const t of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (db as any)[t];
      const rows = (file.data[t] ?? []) as Record<string, unknown>[];
      if (mode === 'replace') {
        if (t === 'businesses') { /* keep business shell, update name below */ }
        else {
          const mine = await table.where('businessId').equals(targetBid).primaryKeys();
          await table.bulkDelete(mine);
        }
      }
      for (const r of rows) {
        const row = { ...r };
        if (t === 'businesses') { if (row.id !== targetBid && !remap) continue; row.id = targetBid; }
        else if (remap || mode === 'replace') row.businessId = targetBid;
        if (mode === 'merge') {
          const exists = await table.get(row.id);
          if (exists) continue;
        }
        await table.put(row);
      }
    }
  });
}

export async function wipeWorkspace(bid: ID): Promise<void> {
  await db.transaction('rw', [...TABLES.map((t) => (db as unknown as Record<string, object>)[t])] as never, async () => {
    for (const t of TABLES) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const table = (db as any)[t];
      if (t === 'businesses') continue;
      const mine = await table.where('businessId').equals(bid).primaryKeys();
      await table.bulkDelete(mine);
    }
  });
}
