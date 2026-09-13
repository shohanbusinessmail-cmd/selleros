/** Global app state: language, workspace, onboarding, toasts, PIN lock, demo mode. */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { dict, type Key, type Lang } from '../i18n/dict';
import { db, getSetting, setSetting, getSettingSync, setSettingSync, type ID } from '../db/db';

export interface Toast { id: number; msg: string; kind: 'ok' | 'err' }

interface AppState {
  lang: Lang; setLang: (l: Lang) => void;
  t: (k: Key, ...p: (string | number)[]) => string;
  tx: (compound: string) => string; // "key|p0|p1"
  businessId: ID | null; setBusinessId: (id: ID | null) => void;
  onboarded: boolean; setOnboarded: (v: boolean) => void;
  loading: boolean;
  toasts: Toast[]; toast: (msg: string, kind?: 'ok' | 'err') => void;
  demo: boolean; setDemo: (v: boolean) => void;
  locked: boolean; setLocked: (v: boolean) => void;
  hasPin: boolean; refreshPin: () => Promise<void>;
  money: (paisa: number, opts?: { decimals?: number }) => string;
  num: (n: number) => string;
}
const Ctx = createContext<AppState>(null!);

let toastId = 1;
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (getSettingSync('lang', 'en') as Lang) || 'en');
  const [businessId, setBusinessIdState] = useState<ID | null>(() => getSettingSync('businessId', '') || null);
  const [onboarded, setOnboardedState] = useState(() => getSettingSync('onboarded', '') === '1');
  const [demo, setDemoState] = useState(() => getSettingSync('demo', '') === '1');
  const [locked, setLocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = toastId++;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  useEffect(() => {
    (async () => {
      const [l, b, o, d, pin] = await Promise.all([
        getSetting('lang', 'en'), getSetting('businessId', ''), getSetting('onboarded', ''),
        getSetting('demo', ''), getSetting('pin', ''),
      ]);
      if (l === 'bn' || l === 'en') setLangState(l);
      // validate business exists
      if (b) { const biz = await db.businesses.get(b).catch(() => undefined); setBusinessIdState(biz ? b : null); if (!biz) setSettingSync('businessId', ''); }
      setOnboardedState(o === '1');
      setDemoState(d === '1');
      setHasPin(!!pin);
      setLocked(!!pin);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { document.documentElement.lang = lang === 'bn' ? 'bn' : 'en'; }, [lang]);

  const t = useCallback((k: Key, ...p: (string | number)[]) => {
    let s: string = (dict[lang] as Record<string, string>)[k] ?? (dict.en as Record<string, string>)[k] ?? k;
    p.forEach((v, i) => { s = s.replace(`{${i}}`, String(v)); });
    return s;
  }, [lang]);
  const tx = useCallback((compound: string) => {
    const [k, ...ps] = compound.split('|');
    return t(k as Key, ...ps);
  }, [t]);

  const setLang = (l: Lang) => { setLangState(l); setSettingSync('lang', l); void setSetting('lang', l); };
  const setBusinessId = (id: ID | null) => { setBusinessIdState(id); setSettingSync('businessId', id ?? ''); };
  const setOnboarded = (v: boolean) => { setOnboardedState(v); setSettingSync('onboarded', v ? '1' : ''); };
  const setDemo = (v: boolean) => { setDemoState(v); setSettingSync('demo', v ? '1' : ''); };
  const refreshPin = async () => { const pin = await getSetting('pin', ''); setHasPin(!!pin); };

  const money = useCallback((paisa: number, opts?: { decimals?: number }) => {
    const v = Math.round(paisa || 0) / 100;
    const dec = opts?.decimals ?? (Number.isInteger(v) ? 0 : 2);
    return `৳${v.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }, [lang]);
  const num = useCallback((n: number) => Math.round(n || 0).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US'), [lang]);

  const value = useMemo(() => ({ lang, setLang, t, tx, businessId, setBusinessId, onboarded, setOnboarded, loading, toasts, toast, demo, setDemo, locked, setLocked, hasPin, refreshPin, money, num }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, businessId, onboarded, loading, toasts, demo, locked, hasPin, t, tx, money, num]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useApp = () => useContext(Ctx);
