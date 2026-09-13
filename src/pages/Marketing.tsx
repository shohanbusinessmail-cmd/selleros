/** MARKETING — campaigns with manual attribution, ROAS, cost/order. */
import React, { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { createCampaign, updateCampaign } from '../services/expenses';
import { toPaisa } from '../lib/money';
import { ymd, fmtDate } from '../lib/dates';
import { Btn, Card, Field, Input, Select, MoneyInput, Modal, Badge, Empty, Stat } from '../components/ui';
import { HBars } from '../components/charts';

const PLATFORMS = ['meta', 'facebook', 'instagram', 'google', 'tiktok', 'other'] as const;

export function Marketing() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const campaigns = useLiveQuery(() => businessId ? db.campaigns.where('businessId').equals(businessId).reverse().toArray() : [], [businessId]) ?? [];
  const agg = useMemo(() => {
    const spend = campaigns.reduce((a, c) => a + c.spend, 0);
    const rev = campaigns.reduce((a, c) => a + (c.revenue ?? 0), 0);
    const ord = campaigns.reduce((a, c) => a + (c.orders ?? 0), 0);
    return { spend, rev, ord, roas: spend ? rev / spend : 0, cpo: ord ? spend / ord : 0 };
  }, [campaigns]);
  const byPlatform = useMemo(() => {
    const m = new Map<string, { spend: number; rev: number }>();
    for (const c of campaigns) {
      const g = m.get(c.platform) ?? { spend: 0, rev: 0 };
      g.spend += c.spend; g.rev += c.revenue ?? 0; m.set(c.platform, g);
    }
    return [...m.entries()].map(([label, g]) => ({ label: label[0].toUpperCase() + label.slice(1), value: g.spend, sub: `ROAS ${(g.spend ? g.rev / g.spend : 0).toFixed(2)}×` }));
  }, [campaigns]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('mk.title')}</h1>
        <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('mk.new')}</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('mk.spend')} value={money(agg.spend)} />
        <Stat label={t('mk.revenue')} value={money(agg.rev)} sub={t('mk.manual')} />
        <Stat label={t('mk.roas')} value={`${agg.roas.toFixed(2)}×`} warn={agg.spend > 0 && agg.roas < 2} />
        <Stat label={t('mk.cpo')} value={money(Math.round(agg.cpo))} />
      </div>
      {!!byPlatform.length && <Card><h3 className="mb-3 text-[15px] font-bold">{t('mk.platform')}</h3><HBars money={money} rows={byPlatform} /></Card>}
      <div className="grid gap-2.5 md:grid-cols-2">
        {campaigns.map((c) => {
          const roas = c.spend ? (c.revenue ?? 0) / c.spend : 0;
          return (
            <button key={c.id} onClick={() => setEditId(c.id)} className="card p-4 text-left transition hover:border-brand-200">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate text-[15px] font-extrabold">{c.name}</div>
                <div className="tnum mt-0.5 text-[12px] text-ink-400">{fmtDate(c.startDate, lang)}{c.endDate ? ` → ${fmtDate(c.endDate, lang)}` : ''}</div></div>
                <Badge color={roas >= 4 ? 'green' : roas >= 2 ? 'brand' : 'red'}>ROAS {roas.toFixed(2)}×</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]"><Badge>{c.platform}</Badge><Badge color="gray">{t('mk.manual')}</Badge></div>
              <div className="tnum mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold">{money(c.spend)}</div><div className="text-[11px] text-ink-500">{t('mk.spend')}</div></div>
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold">{num(c.orders ?? 0)}</div><div className="text-[11px] text-ink-500">{t('mk.orders')}</div></div>
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold">{money(c.revenue ?? 0)}</div><div className="text-[11px] text-ink-500">{t('mk.revenue')}</div></div>
              </div>
            </button>
          );
        })}
      </div>
      {!campaigns.length && <Empty icon="◈" title={t('empty.campaigns.t')} body={t('empty.campaigns.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('mk.new')}</Btn>} />}
      {showNew && <CampaignForm onClose={() => setShowNew(false)} />}
      {editId && <CampaignForm id={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function CampaignForm({ id, onClose }: { id?: string; onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [f, setF] = useState({ platform: 'meta', name: '', startDate: ymd(), endDate: '', spend: 0, orders: 0, revenue: 0, notes: '' });
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (!id) return;
    db.campaigns.get(id).then((c) => { if (c) setF({ platform: c.platform, name: c.name, startDate: c.startDate, endDate: c.endDate ?? '', spend: c.spend / 100, orders: c.orders ?? 0, revenue: (c.revenue ?? 0) / 100, notes: c.notes ?? '' }); });
  }, [id]);
  const save = async () => {
    if (!businessId || !f.name.trim()) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      const data = { platform: f.platform as never, name: f.name.trim(), startDate: f.startDate, endDate: f.endDate || undefined, spend: toPaisa(f.spend), orders: Math.floor(f.orders) || undefined, revenue: f.revenue ? toPaisa(f.revenue) : undefined, notes: f.notes || undefined };
      if (id) await updateCampaign(businessId, id, data);
      else await createCampaign(businessId, data);
      toast(t('t.saved')); onClose();
    } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
  };
  const roas = f.spend > 0 && f.revenue > 0 ? (f.revenue / f.spend).toFixed(2) : '—';
  return (
    <Modal open onClose={onClose} title={id ? t('c.edit') : t('mk.new')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label={`${t('c.name')} *`}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Hijab — September Boost" /></Field></div>
        <Field label={t('mk.platform')}><Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</Select></Field>
        <Field label={t('mk.spend')}><MoneyInput value={f.spend} onChange={(v) => setF({ ...f, spend: v })} /></Field>
        <Field label={t('c.from')}><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        <Field label={t('c.to')} optional><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        <Field label={t('mk.orders')} optional><Input type="number" min={0} value={f.orders || ''} onChange={(e) => setF({ ...f, orders: parseInt(e.target.value) || 0 })} className="tnum" /></Field>
        <Field label={t('mk.revenue')} optional><MoneyInput value={f.revenue} onChange={(v) => setF({ ...f, revenue: v })} /></Field>
        <div className="sm:col-span-2"><Field label={t('c.notes')} optional><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field></div>
      </div>
      <div className="tnum mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-3.5 py-2.5 text-[14px]">
        <span className="font-semibold text-brand-800">{t('mk.roas')} · {t('mk.manual')}</span><span className="font-extrabold text-brand-800">{roas}{roas !== '—' ? '×' : ''}</span>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>{t('c.cancel')}</Btn><Btn loading={busy} onClick={save}>{t('c.save')}</Btn></div>
    </Modal>
  );
}
