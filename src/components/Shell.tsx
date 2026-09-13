/** App shell — responsive sidebar / header / bottom-nav / FAB quick actions. */
import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useApp } from '../state/AppContext';
import { db } from '../db/db';
import { BRAND } from '../brand';
import { Modal, Btn, useOnline } from './ui';
import { CommandPalette } from './CommandPalette';

const NAV: { section: string; items: { to: string; icon: string; k: string }[] }[] = [
  { section: 'nav.overview', items: [{ to: '/', icon: '◧', k: 'nav.dashboard' }] },
  { section: 'nav.sales', items: [
    { to: '/orders', icon: '🧾', k: 'nav.orders' }, { to: '/products', icon: '▦', k: 'nav.products' }, { to: '/customers', icon: '◉', k: 'nav.customers' },
  ]},
  { section: 'nav.ops', items: [
    { to: '/inventory', icon: '⧉', k: 'nav.inventory' }, { to: '/purchases', icon: '▣', k: 'nav.purchases' },
    { to: '/suppliers', icon: '⬡', k: 'nav.suppliers' }, { to: '/couriers', icon: '➤', k: 'nav.couriers' }, { to: '/returns', icon: '↩', k: 'nav.returns' },
  ]},
  { section: 'nav.money', items: [
    { to: '/finance', icon: '৳', k: 'nav.finance' }, { to: '/marketing', icon: '◈', k: 'nav.marketing' }, { to: '/reports', icon: '▤', k: 'nav.reports' },
  ]},
  { section: '—', items: [{ to: '/settings', icon: '⚙', k: 'nav.settings' }] },
];

const MOBILE_NAV = [
  { to: '/', icon: '◧', k: 'nav.dashboard' }, { to: '/orders', icon: '🧾', k: 'nav.orders' },
  { to: '/products', icon: '▦', k: 'nav.products' }, { to: '/finance', icon: '৳', k: 'nav.finance' }, { to: '/more', icon: '⋯', k: 'nav.more' },
];

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[11px] font-extrabold text-white"
      style={{ width: size, height: size, background: 'linear-gradient(135deg,#1f6a57,#173a32)', fontSize: size * 0.5 }}>হি</span>
  );
}

function QuickSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useApp();
  const nav = useNavigate();
  const acts = [
    { label: t('cmd.addProduct'), icon: '▦', to: '/products?new=1' }, { label: t('cmd.newOrder'), icon: '🧾', to: '/orders?new=1' },
    { label: t('cmd.addCustomer'), icon: '◉', to: '/customers?new=1' }, { label: t('cmd.addExpense'), icon: '−', to: '/finance?tab=expenses&new=1' },
    { label: t('cmd.addPurchase'), icon: '▣', to: '/purchases?new=1' }, { label: t('cmd.reports'), icon: '▤', to: '/reports' },
  ];
  return (
    <Modal open={open} onClose={onClose} title={t('dash.quick')}>
      <div className="grid grid-cols-2 gap-2.5">
        {acts.map((a) => (
          <button key={a.label} onClick={() => { onClose(); nav(a.to); }}
            className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3.5 text-left text-[14px] font-semibold transition hover:border-brand-300 hover:bg-brand-50">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-[17px]">{a.icon}</span>{a.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang, businessId, demo, setDemo, toast } = useApp();
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const online = useOnline();
  const biz = useLiveQuery(() => (businessId ? db.businesses.get(businessId) : undefined), [businessId]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); } };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  useEffect(() => { setMoreOpen(false); setQuick(false); }, [loc.pathname]);
  useEffect(() => { if (loc.pathname === '/more') setMoreOpen(true); }, [loc.pathname]);

  return (
    <div className="min-h-full">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-ink-200 bg-white lg:flex">
        <button onClick={() => nav('/')} className="flex items-center gap-2.5 px-5 pb-4 pt-5 text-left">
          <Logo />
          <span><span className="block text-[16.5px] font-extrabold tracking-tight">HishabOS</span>
          <span className="block max-w-[160px] truncate text-[11.5px] font-medium text-ink-400">{biz?.name ?? BRAND.taglineEn}</span></span>
        </button>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Primary">
          {NAV.map((s) => (
            <div key={s.section} className="mb-1.5">
              {s.section !== '—' && <div className="px-2.5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-400">{t(s.section as never)}</div>}
              {s.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === '/'}
                  className={({ isActive }) => `mb-[2px] flex items-center gap-3 rounded-[10px] px-3 py-[9px] text-[14px] font-medium transition ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-ink-600 hover:bg-ink-100'}`}>
                  <span className="w-5 text-center text-[15px]" aria-hidden>{it.icon}</span>{t(it.k as never)}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-ink-100 p-3">
          <button onClick={() => setPalette(true)} className="flex w-full items-center gap-2.5 rounded-[10px] border border-ink-200 bg-ink-50 px-3 py-2.5 text-[13px] text-ink-500 hover:border-brand-300">
            <span aria-hidden>⌕</span><span className="flex-1 text-left">{t('app.searchPh').split('(')[0]}</span><kbd className="rounded bg-white px-1.5 py-0.5 text-[11px] font-bold text-ink-400 shadow-sm">⌘K</kbd>
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="pt-safe sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <button onClick={() => nav('/')} aria-label="HishabOS home"><Logo size={34} /></button>
          <button onClick={() => nav('/')} className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[15px] font-extrabold tracking-tight">{biz?.name || 'HishabOS'}</span>
            <span className="block text-[11px] font-medium text-ink-400">{t('app.tagline')}</span>
          </button>
          <button onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} className="rounded-full border border-ink-200 px-3 py-[7px] text-[12.5px] font-bold text-ink-700" aria-label="Switch language">{lang === 'en' ? 'বাং' : 'EN'}</button>
          <button onClick={() => setPalette(true)} className="flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 text-[16px]" aria-label={t('c.search')}>⌕</button>
        </div>
        {demo && <DemoBar onExit={() => { setDemo(false); toast(t('misc.demoExit')); }} />}
        {!online && <OfflineBar />}
      </header>

      {/* Desktop header */}
      <div className="hidden lg:block lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-ink-50/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-6 py-3.5">
            <button onClick={() => setPalette(true)} className="flex h-10 max-w-md flex-1 items-center gap-2.5 rounded-xl border border-ink-200 bg-white px-3.5 text-[13.5px] text-ink-400 hover:border-brand-300">
              <span aria-hidden>⌕</span> {t('app.searchPh')}
            </button>
            <div className="flex-1" />
            <button onClick={() => setLang(lang === 'en' ? 'bn' : 'en')} className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-[12.5px] font-bold" aria-label="Switch language">{lang === 'en' ? 'বাংলা' : 'English'}</button>
            <Btn size="sm" onClick={() => setQuick(true)}>＋ {t('c.new')}</Btn>
          </div>
          {demo && <DemoBar onExit={() => { setDemo(false); toast(t('misc.demoExit')); }} />}
          {!online && <OfflineBar />}
        </header>
      </div>

      {/* Content */}
      <main className="pb-28 lg:pb-10 lg:pl-[248px]">
        <div className="mx-auto max-w-[1200px] px-4 pt-4 sm:px-6 sm:pt-6">{children}</div>
        <footer className="mx-auto max-w-[1200px] px-6 pb-6 pt-10 text-center text-[12px] text-ink-400">
          HishabOS v{BRAND.version} · {t('ob.made')} · {t('ob.local').slice(0, 44)}…
        </footer>
      </main>

      {/* FAB (mobile) */}
      <button onClick={() => setQuick(true)} aria-label={t('dash.quick')}
        className="pb-safe fixed bottom-[76px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-[26px] font-bold text-white shadow-pop transition active:scale-95 lg:hidden">＋</button>

      {/* Bottom nav (mobile) */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/98 backdrop-blur lg:hidden" aria-label="Mobile">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((it) => {
            const active = it.to === '/more' ? false : loc.pathname === it.to || (it.to !== '/' && loc.pathname.startsWith(it.to));
            return (
              <NavLink key={it.k} to={it.to === '/more' ? '/#' : it.to}
                onClick={it.to === '/more' ? (e) => { e.preventDefault(); setMoreOpen(true); } : undefined}
                className={`flex flex-col items-center gap-[3px] py-2.5 text-[11px] font-semibold ${active ? 'text-brand-700' : 'text-ink-400'}`}>
                <span className={`text-[19px] leading-none ${active ? 'scale-110' : ''}`} aria-hidden>{it.icon}</span>{t(it.k as never)}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <QuickSheet open={quick} onClose={() => setQuick(false)} />
      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        <div className="grid grid-cols-2 gap-2.5">
          {NAV.flatMap((s) => s.items).filter((i) => !MOBILE_NAV.some((m) => m.to === i.to)).map((it) => (
            <button key={it.to} onClick={() => { setMoreOpen(false); nav(it.to); }}
              className="flex items-center gap-3 rounded-xl border border-ink-200 p-3.5 text-left text-[14px] font-semibold hover:border-brand-300 hover:bg-brand-50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-[16px]">{it.icon}</span>{t(it.k as never)}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function DemoBar({ onExit }: { onExit: () => void }) {
  const { t } = useApp();
  return (
    <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-1.5 text-center text-[12px] font-semibold text-amber-900">
      <span className="truncate">{t('misc.demoOn')}</span>
      <button onClick={onExit} className="shrink-0 rounded-full bg-amber-900/90 px-2.5 py-[3px] text-[11px] font-bold text-white">{t('misc.demoExit')}</button>
    </div>
  );
}
function OfflineBar() {
  const { t } = useApp();
  return <div className="bg-ink-900 px-4 py-1.5 text-center text-[12px] font-semibold text-white">{t('misc.offline')}</div>;
}
