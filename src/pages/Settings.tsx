/** SETTINGS — business, language, backup/restore, import/export, data, PIN, privacy, about. */
import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, getSetting, setSetting } from '../db/db';
import { uid } from '../lib/id';
import { toPaisa } from '../lib/money';
import { fmtDateTime } from '../lib/dates';
import { exportBackup, validateBackup, restoreBackup, wipeWorkspace } from '../services/backup';
import { seedDemo } from '../services/seed';
import { parseCSV, download, toCSV } from '../lib/csv';
import { BRAND } from '../brand';
import { Btn, Card, Field, Input, Modal, Tabs, Confirm } from '../components/ui';
import { Logo } from '../components/Shell';

type Tab = 'business' | 'backup' | 'data' | 'security' | 'about';

export function Settings() {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>('business');
  return (
    <div className="space-y-4">
      <h1 className="text-[21px] font-extrabold tracking-tight">{t('se.title')}</h1>
      <Tabs value={tab} onChange={setTab} tabs={[
        { k: 'business', label: t('se.business') }, { k: 'backup', label: t('se.backup') },
        { k: 'data', label: t('se.data') }, { k: 'security', label: `🔒 ${t('se.applock')}` }, { k: 'about', label: t('se.about') },
      ]} />
      {tab === 'business' && <BusinessTab />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'data' && <DataTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'about' && <AboutTab />}
    </div>
  );
}

function BusinessTab() {
  const { t, businessId, lang, setLang, toast } = useApp();
  const biz = useLiveQuery(() => (businessId ? db.businesses.get(businessId) : undefined), [businessId]);
  const [f, setF] = useState({ name: '', owner: '', phone: '', email: '', address: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (biz) setF({ name: biz.name, owner: biz.owner ?? '', phone: biz.phone ?? '', email: biz.email ?? '', address: biz.address ?? '' }); }, [biz]);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-[15px] font-bold">{t('se.business')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label={t('on.bizName')}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field></div>
          <Field label={t('on.owner')}><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
          <Field label={t('c.phone')}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" /></Field>
          <Field label={t('on.email')} optional><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} inputMode="email" /></Field>
          <Field label={t('c.address')} optional><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </div>
        <Btn className="mt-4" loading={busy} onClick={async () => {
          if (!businessId) return;
          setBusy(true);
          try { await db.businesses.update(businessId, { ...f }); toast(t('t.saved')); } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
        }}>{t('c.save')}</Btn>
      </Card>
      <Card>
        <h3 className="mb-3 text-[15px] font-bold">{t('se.language')}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <button onClick={() => setLang('bn')} className={`rounded-xl border-2 p-4 text-[16px] font-bold ${lang === 'bn' ? 'border-brand-600 bg-brand-50' : 'border-ink-200'}`}>বাংলা</button>
          <button onClick={() => setLang('en')} className={`rounded-xl border-2 p-4 text-[16px] font-bold ${lang === 'en' ? 'border-brand-600 bg-brand-50' : 'border-ink-200'}`}>English</button>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-400">Currency: ৳ BDT · Timezone: device local</p>
      </Card>
    </div>
  );
}

function BackupTab() {
  const { t, businessId, toast, lang } = useApp();
  const [last, setLast] = useState('');
  const [preview, setPreview] = useState<{ counts: Record<string, number>; exportedAt: string } | null>(null);
  const [file, setFile] = useState<{ json: unknown } | null>(null);
  const [mode, setMode] = useState<'replace' | 'merge'>('replace');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getSetting('lastBackup', '').then(setLast); }, []);
  const doBackup = async () => {
    if (!businessId) return;
    setBusy(true);
    try {
      const b = await exportBackup(businessId);
      download(`hishabos-backup-${b.businessId.slice(-6)}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json');
      try { localStorage.setItem('hishab.lastBackup', String(Date.now())); } catch { /* ignore */ }
      setLast(String(Date.now()));
      toast(t('t.backupDone'));
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  const onFile = async (fl: File) => {
    try {
      const json = JSON.parse(await fl.text());
      const v = validateBackup(json);
      if (!v.ok || !v.file) { toast(v.errors.map((e) => t(e as never)).join(' '), 'err'); return; }
      setFile({ json: v.file });
      setPreview({ counts: v.file.counts, exportedAt: v.file.exportedAt });
    } catch { toast(t('backup.invalid'), 'err'); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-1 text-[15px] font-bold">{t('se.backupNow')}</h3>
        <p className="text-[13px] text-ink-500">{t('se.lastBackup')}: {last ? fmtDateTime(Number(last), lang) : '—'}</p>
        <Btn className="mt-3 w-full" loading={busy} onClick={doBackup}>⇩ {t('se.backupNow')}</Btn>
        <p className="mt-2 text-[12px] text-ink-400">backupVersion: 1 · JSON · {lang === 'bn' ? 'সব টেবিল অন্তর্ভুক্ত' : 'All tables included'}</p>
      </Card>
      <Card>
        <h3 className="mb-1 text-[15px] font-bold">{t('se.restore')}</h3>
        <input type="file" accept="application/json" aria-label={t('se.restore')} onChange={(e) => { const fl = e.target.files?.[0]; if (fl) onFile(fl); }}
          className="mt-2 text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-[13px] file:font-bold file:text-brand-700" />
        {preview && (
          <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[13px]">
            <div className="tnum mb-1.5 font-bold">{new Date(preview.exportedAt).toLocaleString()}</div>
            <div className="tnum flex flex-wrap gap-x-3 gap-y-1 text-ink-600">
              {Object.entries(preview.counts).filter(([, v]) => v > 0).map(([k, v]) => <span key={k}>{k}: <b>{v}</b></span>)}
            </div>
            <div className="mt-2.5 flex gap-2">
              <Btn size="sm" variant={mode === 'replace' ? 'soft' : 'secondary'} onClick={() => setMode('replace')}>Replace</Btn>
              <Btn size="sm" variant={mode === 'merge' ? 'soft' : 'secondary'} onClick={() => setMode('merge')}>Merge</Btn>
            </div>
            <Btn size="sm" className="mt-2 w-full" loading={busy} onClick={async () => {
              if (!businessId || !file) return;
              if (!confirm(t('c.confirmDelete'))) return;
              setBusy(true);
              try { await restoreBackup(file.json as never, mode, businessId); toast(t('t.restoreDone')); setPreview(null); setFile(null); }
              catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
            }}>{t('se.restore')}</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

function DataTab() {
  const { t, businessId, toast, demo, setDemo } = useApp();
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [seedP, setSeedP] = useState(0);
  const [impKind, setImpKind] = useState<'products' | 'customers' | null>(null);
  const [impRows, setImpRows] = useState<string[][]>([]);

  const exportAll = async (kind: 'products' | 'customers' | 'orders' | 'expenses') => {
    if (!businessId) return;
    const table = { products: db.products, customers: db.customers, orders: db.orders, expenses: db.expenses }[kind] as unknown as { where: (k: string) => { equals: (v: string) => { toArray: () => Promise<Record<string, unknown>[]> } } };
    const rows = await table.where('businessId').equals(businessId).toArray();
    if (!rows.length) { toast(t('c.noResults'), 'err'); return; }
    const keys = Object.keys(rows[0]);
    download(`${kind}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([keys, ...rows.map((r) => keys.map((k) => String(r[k] ?? '')))]), 'text/csv');
    toast(t('t.exported'));
  };
  const onImportFile = async (fl: File, kind: 'products' | 'customers') => {
    const rows = parseCSV(await fl.text());
    setImpKind(kind); setImpRows(rows.slice(0, 501));
  };
  const commitImport = async () => {
    if (!businessId || !impKind || impRows.length < 2) return;
    const [head, ...body] = impRows;
    const idx = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
    let n = 0;
    try {
      if (impKind === 'products') {
        const ni = idx('name'), si = idx('sku'), pi = idx('price'), ci = idx('category');
        for (const r of body) {
          if (ni < 0 || !r[ni]?.trim()) continue;
          await db.products.add({ id: uid('pr'), businessId, name: r[ni].trim(), sku: (si >= 0 && r[si]) || `SKU-${uid('').slice(-6).toUpperCase()}`, category: ci >= 0 ? r[ci] : undefined, sellPrice: toPaisa(parseFloat(pi >= 0 ? r[pi] : '0') || 0), stockQty: 0, avgCost: 0, status: 'active', createdAt: Date.now(), updatedAt: Date.now() });
          n++;
        }
      } else {
        const ni = idx('name'), pi = idx('phone'), ai = idx('address');
        for (const r of body) {
          if (ni < 0 || pi < 0 || !r[ni]?.trim() || !r[pi]?.trim()) continue;
          await db.customers.add({ id: uid('cu'), businessId, name: r[ni].trim(), phone: r[pi].trim(), address: ai >= 0 ? r[ai] : undefined, status: 'active', createdAt: Date.now() });
          n++;
        }
      }
      toast(t('t.imported', n)); setImpKind(null); setImpRows([]);
    } catch { toast(t('err.save'), 'err'); }
  };
  const enterDemo = async () => {
    setBusy(true);
    try {
      if (businessId) try { localStorage.setItem('hishab.prevBusinessId', businessId); } catch { /* ignore */ }
      const id = uid('bi');
      await db.businesses.add({ id, name: 'Demo Fashion House', openingCash: toPaisa(50000), createdAt: Date.now(), seq: 0 });
      setDemo(true);
      try { localStorage.setItem('hishab.businessId', id); } catch { /* ignore */ }
      await seedDemo(id, setSeedP);
      location.hash = '#/'; location.reload();
    } finally { setBusy(false); }
  };
  const exitDemo = async () => {
    if (!businessId) return;
    setBusy(true);
    try {
      await wipeWorkspace(businessId);
      await db.businesses.delete(businessId);
      const prev = (() => { try { return localStorage.getItem('hishab.prevBusinessId') ?? ''; } catch { return ''; } })();
      try { localStorage.setItem('hishab.businessId', prev); localStorage.setItem('hishab.demo', ''); } catch { /* ignore */ }
      location.hash = '#/'; location.reload();
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-2 text-[15px] font-bold">{t('se.export')}</h3>
        <div className="grid grid-cols-2 gap-2">
          {(['products', 'customers', 'orders', 'expenses'] as const).map((k) => (
            <Btn key={k} variant="secondary" size="sm" onClick={() => exportAll(k)}>⇩ {k}.csv</Btn>
          ))}
        </div>
        <h3 className="mb-2 mt-5 text-[15px] font-bold">{t('se.import')}</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="cursor-pointer rounded-[10px] border border-ink-200 px-3 py-2.5 text-center text-[13px] font-bold hover:border-brand-300">⇧ {t('imp.products')}
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) onImportFile(fl, 'products'); }} /></label>
          <label className="cursor-pointer rounded-[10px] border border-ink-200 px-3 py-2.5 text-center text-[13px] font-bold hover:border-brand-300">⇧ {t('imp.customers')}
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) onImportFile(fl, 'customers'); }} /></label>
        </div>
        <p className="mt-2 text-[12px] text-ink-400">{t('imp.errors')} Products: name,sku,price,category · Customers: name,phone,address</p>
      </Card>
      <Card>
        <h3 className="mb-2 text-[15px] font-bold">{t('se.data')}</h3>
        {!demo ? (
          <Btn variant="secondary" className="w-full" loading={busy} onClick={enterDemo}>✦ {t('se.demo')}{seedP > 0 && seedP < 100 ? ` ${seedP}%` : ''}</Btn>
        ) : (
          <Btn variant="secondary" className="w-full" loading={busy} onClick={exitDemo}>{t('se.exitDemo')}</Btn>
        )}
        <div className="my-4 border-t border-ink-100" />
        <Btn variant="danger" className="w-full" onClick={() => setWipeOpen(true)}>🗑 {t('se.wipe')}</Btn>
      </Card>

      <Modal open={!!impKind} onClose={() => { setImpKind(null); setImpRows([]); }} title={`${t('imp.title')} — ${impKind}`} wide>
        <p className="mb-2 text-[13px] text-ink-500">{t('imp.preview')} · {Math.max(0, impRows.length - 1)} rows · {t('imp.errors')}</p>
        <div className="max-h-64 overflow-auto rounded-xl border border-ink-200 text-[12px]">
          <table className="w-full text-left"><tbody>
            {impRows.slice(0, 9).map((r, i) => <tr key={i} className={i === 0 ? 'bg-ink-100 font-bold' : 'border-t border-ink-100'}>{r.map((c, j) => <td key={j} className="px-2 py-1.5">{c}</td>)}</tr>)}
          </tbody></table>
        </div>
        <Btn className="mt-3 w-full" onClick={commitImport}>{t('imp.commit')}</Btn>
      </Modal>

      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title={t('se.wipe')}>
        <p className="text-[13.5px] leading-relaxed text-ink-600">{t('se.wipeConfirm')}</p>
        <Input className="mt-3" value={wipeText} onChange={(e) => setWipeText(e.target.value)} placeholder="DELETE" />
        <Btn variant="danger" className="mt-3 w-full" disabled={wipeText !== 'DELETE'} onClick={async () => {
          if (!businessId) return;
          await wipeWorkspace(businessId);
          setWipeOpen(false); setWipeText('');
          toast(t('t.deleted'));
        }}>{t('c.yesDelete')}</Btn>
      </Modal>
    </div>
  );
}

function SecurityTab() {
  const { t, hasPin, refreshPin, toast } = useApp();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!/^\d{4,8}$/.test(pin)) { toast(t('lock.wrong'), 'err'); return; }
    setBusy(true);
    try {
      await setSetting('pin', pin);
      try { localStorage.setItem('hishab.pin', pin); } catch { /* ignore */ }
      await refreshPin(); setPin('');
      toast(t('t.saved'));
    } finally { setBusy(false); }
  };
  const remove = async () => {
    await setSetting('pin', '');
    try { localStorage.setItem('hishab.pin', ''); } catch { /* ignore */ }
    await refreshPin();
    toast(t('t.deleted'));
  };
  return (
    <Card className="max-w-md">
      <h3 className="mb-1 text-[15px] font-bold">🔒 {t('se.applock')}</h3>
      <p className="text-[13px] text-ink-500">{hasPin ? '●●●●' : '—'}</p>
      {!hasPin ? (
        <div className="mt-3 flex gap-2">
          <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} inputMode="numeric" placeholder="4–8 digits" className="tnum flex-1" />
          <Btn loading={busy} onClick={save}>{t('se.setPin')}</Btn>
        </div>
      ) : (
        <Btn variant="secondary" className="mt-3" onClick={remove}>{t('se.removePin')}</Btn>
      )}
    </Card>
  );
}

function AboutTab() {
  const { t, lang } = useApp();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="flex items-center gap-3">
          <Logo size={46} />
          <div><div className="text-[19px] font-extrabold">HishabOS <span className="tnum text-[12px] font-bold text-ink-400">v{BRAND.version}</span></div>
          <div className="text-[12.5px] text-ink-500">{t('app.tagline')}</div></div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">{t('ob.local')}</p>
        <p className="mt-2 text-[13.5px] font-semibold">{t('ob.made')} · {BRAND.creatorEmail}</p>
      </Card>
      <Card>
        <h3 className="mb-2 text-[15px] font-bold">🔒 {t('pv.title')}</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[13.5px] leading-relaxed text-ink-600">
          <li>{t('pv.b1')}</li><li>{t('pv.b2')}</li><li>{t('pv.b3')}</li>
        </ul>
        <p className="mt-3 text-[12px] text-ink-400">{lang === 'bn' ? 'ডেটাবেস: IndexedDB (ভার্সন ১) · ব্যাকআপ স্কিমা v1' : 'Database: IndexedDB (v1) · Backup schema v1'}</p>
      </Card>
    </div>
  );
}
export function ConfirmX({ open, onClose }: { open: boolean; onClose: () => void }) { return <Confirm open={open} onClose={onClose} onYes={onClose} title="" body="" />; }
