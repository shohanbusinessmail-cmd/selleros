/** COURIERS — manual management, performance analytics, settlements. No paid APIs. */
import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db, type ID } from '../db/db';
import { uid } from '../lib/id';
import { toPaisa } from '../lib/money';
import { ymd, fmtDate, periodRange, type PeriodKey } from '../lib/dates';
import { courierStats, type CourierStat } from '../services/finance';
import { Btn, Card, Field, Input, MoneyInput, Modal, Badge, Empty, PeriodBar, Stat } from '../components/ui';

export function Couriers() {
  const { t, businessId, money, num, toast, lang } = useApp();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [stats, setStats] = useState<CourierStat[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [settleId, setSettleId] = useState<string | null>(null);
  const couriers = useLiveQuery(() => businessId ? db.couriers.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const settlements = useLiveQuery(() => businessId ? db.settlements.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const range = useMemo(() => periodRange(period, custom.from && custom.to ? custom : undefined), [period, custom]);
  const orders = useLiveQuery(() => businessId ? db.orders.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  useEffect(() => { if (businessId) courierStats(businessId, range).then(setStats); }, [businessId, range, orders.length, couriers.length]);

  const best = stats.filter((s) => s.orders >= 3).sort((a, b) => b.successRate - a.successRate)[0];
  const totalFees = stats.reduce((a, s) => a + s.fees, 0);
  const codExpected = (bid: string) => orders.filter((o) => o.courierId === bid && o.status === 'delivered' && o.payMethod === 'cod').reduce((a, o) => a + o.total, 0);
  const settled = (bid: string) => settlements.filter((s) => s.courierId === bid).reduce((a, s) => a + s.received, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('co.title')}</h1>
        <Btn size="sm" onClick={() => setShowNew(true)}>＋ {t('co.new')}</Btn>
      </div>
      <PeriodBar value={period} onChange={setPeriod} onCustom={setCustom} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label={t('co.fees')} value={money(totalFees)} />
        <Stat label={lang === 'bn' ? 'সেরা কুরিয়ার' : 'Best courier'} value={best?.name ?? '—'} sub={best ? `${best.successRate.toFixed(0)}% ✓` : ''} />
        <Stat label={t('c.orders')} value={num(stats.reduce((a, s) => a + s.orders, 0))} />
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {couriers.filter((c) => c.status === 'active').map((c) => {
          const st = stats.find((s) => s.courierId === c.id);
          const exp = codExpected(c.id);
          const rec = settled(c.id);
          return (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-2">
                <div><div className="text-[15.5px] font-extrabold">{c.name}</div>
                <div className="tnum text-[12px] text-ink-400">{t('c.cost')}: {money(c.baseFee ?? 0)} · COD {money(c.codFee ?? 0)} · {t('rt.fee')}: {money(c.returnFee ?? 0)}</div></div>
                {st && st.orders > 0 && <Badge color={st.successRate >= 80 ? 'green' : st.successRate >= 60 ? 'amber' : 'red'}>{st.successRate.toFixed(0)}% ✓</Badge>}
              </div>
              <div className="tnum mt-3 grid grid-cols-4 gap-2 text-center text-[13px]">
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold">{num(st?.orders ?? 0)}</div><div className="text-[10.5px] text-ink-500">{t('c.orders')}</div></div>
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold text-brand-700">{num(st?.delivered ?? 0)}</div><div className="text-[10.5px] text-ink-500">✓</div></div>
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold text-amber-700">{num(st?.returned ?? 0)}</div><div className="text-[10.5px] text-ink-500">↩ {(st?.returnRate ?? 0).toFixed(0)}%</div></div>
                <div className="rounded-lg bg-ink-50 p-2"><div className="font-extrabold">{money(st?.fees ?? 0)}</div><div className="text-[10.5px] text-ink-500">{t('co.fees')}</div></div>
              </div>
              {(exp > 0 || rec > 0) && (
                <div className="tnum mt-2 flex justify-between rounded-lg bg-brand-50 px-3 py-2 text-[12.5px]">
                  <span className="text-brand-800">{t('co.expected')} <b>{money(exp)}</b></span>
                  <span className="text-brand-800">{t('co.received')} <b>{money(rec)}</b></span>
                  <span className={exp - rec > 0 ? 'font-bold text-amber-700' : 'text-brand-800'}>{t('c.due')} <b>{money(Math.max(0, exp - rec))}</b></span>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Btn size="sm" variant="secondary" className="flex-1" onClick={() => setSettleId(c.id)}>৳ {t('co.settle')}</Btn>
                <Btn size="sm" variant="ghost" onClick={async () => { await db.couriers.update(c.id, { status: 'archived' }); toast(t('t.updated')); }}>{t('pr.archive')}</Btn>
              </div>
            </Card>
          );
        })}
      </div>
      {!couriers.filter((c) => c.status === 'active').length && <Empty icon="➤" title={t('empty.generic.t')} body={t('empty.generic.b')} action={<Btn onClick={() => setShowNew(true)}>＋ {t('co.new')}</Btn>} />}
      {!!settlements.length && (
        <Card>
          <h3 className="mb-2 text-[15px] font-bold">{t('co.settle')}</h3>
          <ul className="divide-y divide-ink-100 text-[13px]">
            {settlements.slice().reverse().slice(0, 20).map((s) => (
              <li key={s.id} className="tnum flex justify-between py-2"><span>{couriers.find((c) => c.id === s.courierId)?.name} · {fmtDate(s.date, lang)}</span><span className="font-bold text-brand-700">+{money(s.received)} <span className="font-medium text-ink-400">/ {money(s.expected)}</span></span></li>
            ))}
          </ul>
        </Card>
      )}
      {showNew && <CourierForm onClose={() => setShowNew(false)} />}
      {settleId && businessId && <SettleModal id={settleId} onClose={() => setSettleId(null)} />}
    </div>
  );
}

function CourierForm({ onClose }: { onClose: () => void }) {
  const { t, businessId, toast } = useApp();
  const [f, setF] = useState({ name: '', baseFee: 60, codFee: 0, returnFee: 60 });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('co.new')}>
      <div className="space-y-3.5">
        <Field label={`${t('c.name')} *`}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Steadfast" /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('c.cost')}><MoneyInput value={f.baseFee} onChange={(v) => setF({ ...f, baseFee: v })} /></Field>
          <Field label="COD"><MoneyInput value={f.codFee} onChange={(v) => setF({ ...f, codFee: v })} /></Field>
          <Field label={t('rt.fee')}><MoneyInput value={f.returnFee} onChange={(v) => setF({ ...f, returnFee: v })} /></Field>
        </div>
        <Btn className="w-full" loading={busy} onClick={async () => {
          if (!businessId || !f.name.trim()) { toast(t('err.required'), 'err'); return; }
          setBusy(true);
          try { await db.couriers.add({ id: uid('co'), businessId, name: f.name.trim(), kind: 'custom', baseFee: toPaisa(f.baseFee), codFee: toPaisa(f.codFee), returnFee: toPaisa(f.returnFee), status: 'active' }); toast(t('t.saved')); onClose(); }
          catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
        }}>{t('c.save')}</Btn>
      </div>
    </Modal>
  );
}

function SettleModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, businessId, money, toast } = useApp();
  const [expected, setExpected] = useState(0);
  const [received, setReceived] = useState(0);
  const [fees, setFees] = useState(0);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={t('co.settle')}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-3">
          <Field label={t('co.expected')}><MoneyInput value={expected} onChange={setExpected} /></Field>
          <Field label={t('co.received')}><MoneyInput value={received} onChange={setReceived} /></Field>
          <Field label={t('co.fees')}><MoneyInput value={fees} onChange={setFees} /></Field>
        </div>
        <Btn className="w-full" loading={busy} onClick={async () => {
          if (!businessId) return;
          setBusy(true);
          try {
            await db.settlements.add({ id: uid('st'), businessId, courierId: id, date: ymd(), expected: toPaisa(expected), received: toPaisa(received), fees: toPaisa(fees), createdAt: Date.now() });
            toast(t('t.saved')); onClose();
          } catch { toast(t('err.save'), 'err'); } finally { setBusy(false); }
        }}>{t('c.save')} · {money(toPaisa(received))}</Btn>
      </div>
    </Modal>
  );
}
