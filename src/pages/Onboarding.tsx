/** First-run onboarding — welcome, language, profile, channels, opening balances. */
import React, { useState } from 'react';
import { useApp } from '../state/AppContext';
import { db, DEFAULT_COURIERS, type Channel } from '../db/db';
import { uid } from '../lib/id';
import { toPaisa } from '../lib/money';
import { Btn, Field, Input, MoneyInput, Progress } from '../components/ui';
import { Logo } from '../components/Shell';
import { seedDemo } from '../services/seed';

const CHANNELS: Channel[] = ['facebook', 'instagram', 'tiktok', 'website', 'marketplace', 'whatsapp', 'store', 'direct'];
const TYPES = ['E-commerce', 'F-commerce', 'Retail', 'Wholesale', 'Reseller', 'Import', 'Handmade', 'Mixed'];

export function Onboarding() {
  const { t, lang, setLang, setBusinessId, setOnboarded, setDemo, toast } = useApp();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seedP, setSeedP] = useState(0);
  const [f, setF] = useState({ name: '', owner: '', phone: '', email: '', address: '', type: 'F-commerce', channels: ['facebook'] as Channel[], cash: 0 });
  const set = (k: keyof typeof f, v: unknown) => setF((s) => ({ ...s, [k]: v }));

  const finish = async (withDemo: boolean) => {
    if (!withDemo && !f.name.trim()) { toast(t('err.required'), 'err'); return; }
    setBusy(true);
    try {
      const id = uid('bi');
      await db.businesses.add({
        id, name: withDemo ? 'Demo Fashion House' : f.name.trim(), owner: f.owner, phone: f.phone,
        email: f.email, address: f.address, type: f.type, channels: f.channels,
        openingCash: withDemo ? toPaisa(50000) : toPaisa(f.cash), createdAt: Date.now(), seq: 0,
      });
      for (const c of DEFAULT_COURIERS) {
        await db.couriers.add({ id: uid('co'), businessId: id, name: c.name, kind: c.kind as never, baseFee: toPaisa(60), codFee: toPaisa(10), returnFee: toPaisa(60), status: 'active' });
      }
      if (withDemo) { await seedDemo(id, setSeedP); setDemo(true); }
      try { localStorage.setItem('hishab.businessId', id); } catch { /* ignore */ }
      setBusinessId(id);
      setOnboarded(true);
    } catch {
      toast(t('err.save'), 'err');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-brand-50 to-ink-50 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Logo size={46} />
          <div><div className="text-[22px] font-extrabold tracking-tight">HishabOS</div>
          <div className="text-[12.5px] font-medium text-ink-500">{t('app.tagline')}</div></div>
        </div>
        <div className="card p-6 sm:p-8">
          <Progress v={((step + 1) / 4) * 100} />
          {step === 0 && (
            <div className="pt-6 text-center">
              <h1 className="text-[24px] font-extrabold tracking-tight">{t('on.welcome')}</h1>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-500">{t('on.sub')}</p>
              <div className="mt-6 text-[13px] font-bold uppercase tracking-wider text-ink-400">{t('on.lang')}</div>
              <div className="mx-auto mt-3 grid max-w-xs grid-cols-2 gap-2.5">
                <button onClick={() => setLang('bn')} className={`rounded-xl border-2 p-4 text-[16px] font-bold transition ${lang === 'bn' ? 'border-brand-600 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>বাংলা</button>
                <button onClick={() => setLang('en')} className={`rounded-xl border-2 p-4 text-[16px] font-bold transition ${lang === 'en' ? 'border-brand-600 bg-brand-50' : 'border-ink-200 hover:border-ink-300'}`}>English</button>
              </div>
              <Btn className="mt-7 w-full" size="lg" onClick={() => setStep(1)}>{t('c.next')}</Btn>
              <button disabled={busy} onClick={() => finish(true)} className="mt-3 w-full text-[13.5px] font-semibold text-brand-700 hover:underline disabled:opacity-60">
                {busy ? `${seedP}%…` : `✦ ${t('on.demo')}`}
              </button>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4 pt-6">
              <h2 className="text-[19px] font-extrabold tracking-tight">{t('on.profile')}</h2>
              <Field label={`${t('on.bizName')} *`}><Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Aarong Fashion" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('on.owner')} optional><Input value={f.owner} onChange={(e) => set('owner', e.target.value)} /></Field>
                <Field label={t('c.phone')} optional><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" /></Field>
              </div>
              <Field label={t('on.type')}><select value={f.type} onChange={(e) => set('type', e.target.value)} className="h-11 w-full rounded-[10px] border border-ink-200 px-3.5 text-[14.5px]">{TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <NavBtns back={() => setStep(0)} next={() => setStep(2)} />
            </div>
          )}
          {step === 2 && (
            <div className="pt-6">
              <h2 className="text-[19px] font-extrabold tracking-tight">{t('on.channels')}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {CHANNELS.map((c) => {
                  const on = f.channels.includes(c);
                  return (
                    <button key={c} onClick={() => set('channels', on ? f.channels.filter((x) => x !== c) : [...f.channels, c])}
                      className={`rounded-xl border-2 p-3.5 text-[14px] font-bold transition ${on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-200 text-ink-600'}`}>{t(`ch.${c}` as never)}</button>
                  );
                })}
              </div>
              <div className="mt-6"><NavBtns back={() => setStep(1)} next={() => setStep(3)} /></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4 pt-6">
              <h2 className="text-[19px] font-extrabold tracking-tight">{t('on.money')}</h2>
              <Field label={t('on.cash')} hint={lang === 'bn' ? 'ব্যবসার শুরুর নগদ টাকা' : 'Cash you start the business with'}><MoneyInput value={f.cash} onChange={(v) => set('cash', v)} /></Field>
              <Btn size="lg" className="w-full" loading={busy} onClick={() => finish(false)}>{t('on.finish')}</Btn>
              <button onClick={() => setStep(2)} className="w-full text-[13.5px] font-semibold text-ink-500">{t('c.back')}</button>
            </div>
          )}
        </div>
        <p className="mt-5 text-center text-[12px] text-ink-400">{t('ob.made')} · {t('ob.local')}</p>
      </div>
    </div>
  );
}

function NavBtns({ back, next }: { back: () => void; next: () => void }) {
  const { t } = useApp();
  return (
    <div className="flex gap-2.5">
      <Btn variant="secondary" className="flex-1" onClick={back}>{t('c.back')}</Btn>
      <Btn className="flex-[2]" onClick={next}>{t('c.next')}</Btn>
    </div>
  );
}
