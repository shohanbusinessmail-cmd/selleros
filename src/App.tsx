/** HishabOS root — routing, onboarding gate, PIN lock, toasts. */
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './state/AppContext';
import { getSettingSync } from './db/db';
import { Shell, Logo } from './components/Shell';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
const Orders = React.lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })));
const Products = React.lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })));
const Inventory = React.lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })));
const Customers = React.lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })));
const Suppliers = React.lazy(() => import('./pages/Suppliers').then((m) => ({ default: m.Suppliers })));
const Purchases = React.lazy(() => import('./pages/Purchases').then((m) => ({ default: m.Purchases })));
const Finance = React.lazy(() => import('./pages/Finance').then((m) => ({ default: m.Finance })));
const Marketing = React.lazy(() => import('./pages/Marketing').then((m) => ({ default: m.Marketing })));
const Couriers = React.lazy(() => import('./pages/Couriers').then((m) => ({ default: m.Couriers })));
const Returns = React.lazy(() => import('./pages/Returns').then((m) => ({ default: m.Returns })));
const Reports = React.lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })));
const Settings = React.lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
import { Btn, Input, Skeleton, PageSkeleton } from './components/ui';

function LockScreen() {
  const { t, setLocked } = useApp();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  return (
    <div className="flex min-h-full items-center justify-center bg-ink-50 px-4">
      <div className="card w-full max-w-xs p-6 text-center">
        <div className="flex justify-center"><Logo size={48} /></div>
        <h1 className="mt-3 text-[17px] font-extrabold">{t('lock.title')}</h1>
        <Input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setErr(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (document.getElementById('unlock-btn') as HTMLButtonElement)?.click(); }}
          inputMode="numeric" type="password" autoFocus placeholder="••••" className="tnum mt-4 text-center text-[20px] tracking-[.4em]" aria-label={t('lock.title')} />
        {err && <p className="mt-2 text-[13px] font-semibold text-red-600">{t('lock.wrong')}</p>}
        <Btn id="unlock-btn" className="mt-3 w-full" onClick={() => {
          if (pin && pin === getSettingSync('pin', '§')) setLocked(false);
          else setErr(true);
        }}>{t('c.done')}</Btn>
      </div>
    </div>
  );
}

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-8" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-bold shadow-pop ${x.kind === 'ok' ? 'bg-ink-900 text-white' : 'bg-red-600 text-white'}`}>
          <span>{x.kind === 'ok' ? '✓' : '!'}</span>{x.msg}
        </div>
      ))}
    </div>
  );
}

function Gate() {
  const { loading, onboarded, businessId, locked } = useApp();
  if (loading) return <div className="mx-auto max-w-[1200px] space-y-3 p-6"><Skeleton className="h-10 w-52" /><Skeleton className="h-40" /><Skeleton className="h-64" /></div>;
  if (locked) return <LockScreen />;
  if (!onboarded || !businessId) return <Onboarding />;
  return (
    <Shell>
      <React.Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/products" element={<Products />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/marketing" element={<Marketing />} />
        <Route path="/couriers" element={<Couriers />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>
    </Shell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Gate />
        <Toasts />
      </HashRouter>
    </AppProvider>
  );
}
