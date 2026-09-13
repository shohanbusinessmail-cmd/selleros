/** RETURNS — return history with cost analysis. */
import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { fmtDate } from '../lib/dates';
import { Btn, Card, Badge, Empty, Stat, Select, SearchInput } from '../components/ui';
import { QuickReturn } from './Orders';

export function Returns() {
  const { t, businessId, money, num, lang } = useApp();
  const [q, setQ] = useState('');
  const [cond, setCond] = useState('all');
  const [retId, setRetId] = useState<string | null>(null);
  const returns = useLiveQuery(() => businessId ? db.returns.where('businessId').equals(businessId).reverse().toArray() : [], [businessId]) ?? [];
  const orders = useLiveQuery(() => businessId ? db.orders.where('businessId').equals(businessId).toArray() : [], [businessId]) ?? [];
  const codeOf = (oid: string) => orders.find((o) => o.id === oid)?.code ?? '—';
  const list = returns.filter((r) => (cond === 'all' || r.condition === cond) && (!q || codeOf(r.orderId).toLowerCase().includes(q.toLowerCase())));
  const cost = returns.reduce((a, r) => a + r.refund + r.returnFee + r.outboundLost, 0);
  const restocked = returns.reduce((a, r) => a + r.restockQty, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-extrabold tracking-tight">{t('rt.title')} <span className="tnum text-[14px] font-semibold text-ink-400">· {num(returns.length)}</span></h1>
        <Link to="/orders"><Btn size="sm" variant="secondary">🧾 {t('ord.title')}</Btn></Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('rt.title')} value={num(returns.length)} />
        <Stat label={lang === 'bn' ? 'মোট রিটার্ন খরচ' : 'Total return cost'} value={money(cost)} warn={cost > 0} />
        <Stat label={t('rt.restocked')} value={`${num(restocked)} ${t('c.units').toLowerCase()}`} />
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="flex-1"><SearchInput value={q} onChange={setQ} placeholder={`${t('ord.code')}…`} /></div>
        <Select value={cond} onChange={(e) => setCond(e.target.value)} className="sm:!w-48">
          <option value="all">{t('c.all')}</option>
          {['resellable', 'damaged', 'defective', 'missing', 'partial'].map((c) => <option key={c} value={c}>{t(`rc.${c}` as never)}</option>)}
        </Select>
      </div>
      <Card className="divide-y divide-ink-100 p-0">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <Link to={`/orders?view=${r.orderId}`} className="min-w-0 flex-1">
              <span className="block text-[14px] font-extrabold">{codeOf(r.orderId)}</span>
              <span className="tnum block text-[12px] text-ink-400">{fmtDate(r.date, lang)} · {t('rt.refund')} {money(r.refund)} · {t('rt.fee')} {money(r.returnFee)}</span>
            </Link>
            <Badge color={r.condition === 'resellable' ? 'green' : r.condition === 'partial' ? 'amber' : 'red'}>{t(`rc.${r.condition}` as never)}</Badge>
            <Badge color={r.restocked ? 'brand' : 'gray'}>{r.restocked ? `↩ ${num(r.restockQty)}` : t('rt.notRestocked')}</Badge>
          </div>
        ))}
        {!list.length && <div className="p-6"><Empty icon="↩" title={t('empty.generic.t')} body={t('empty.generic.b')} /></div>}
      </Card>
      {retId && businessId && <QuickReturn orderId={retId} onClose={() => setRetId(null)} onDone={() => setRetId(null)} />}
    </div>
  );
}
