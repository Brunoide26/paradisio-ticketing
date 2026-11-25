import React, { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GroupLogo } from '@/components/app-sidebar';
import { OSProvider, useOS } from './os/store.jsx';
import Shell from './os/Shell.jsx';
import Overview from './pages/Overview.jsx';
import Events from './pages/Events.jsx';
import { EventPage, BrandPage, FinanceData, Attention, Activity, NotFound } from './pages/Pages.jsx';
import { FinanceOverview, Transactions, Accounts, Pending, CashFlow, Budgets, FinanceTabs } from './pages/Finance.jsx';
import Simulator from './pages/Simulator.jsx';
import Inventory from './pages/Inventory.jsx';
import Sales from './pages/Sales.jsx';
import Promoters from './pages/Promoters.jsx';
import Operations, { MyTasks } from './pages/Operations.jsx';
import { BrandsCompare, BrandHome } from './pages/Brands.jsx';
import { Marketing, Sponsors, Team, Audience, Documents } from './pages/Commercial.jsx';
import { BrandTile } from './ui.jsx';

const evName = (p, d) => (d && d.finance.events.find((e) => e.id === p.id) || {}).name;
const brandName = (p, d) => (d && d.finance.brands.find((b) => b.id === p.brandId) || {}).name;

// Rutas reales bajo /administracion (vercel.json reescribe las rutas profundas al index).
const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Overview />, handle: { crumb: 'Resumen ejecutivo' } },
      { path: 'atencion', element: <Attention />, handle: { crumb: 'Atención' } },
      { path: 'calendario', element: <Events fixedView="calendario" />, handle: { crumb: 'Calendario' } },
      { path: 'eventos', handle: { crumb: 'Eventos' }, children: [
        { index: true, element: <Events /> },
        { path: ':id', element: <EventPage />, handle: { crumb: evName } },
      ] },
      { path: 'finanzas', handle: { crumb: 'Finanzas' }, children: [
        { index: true, element: <FinanceOverview /> },
        { path: 'transacciones', element: <Transactions />, handle: { crumb: 'Transacciones' } },
        { path: 'cuentas', element: <Accounts />, handle: { crumb: 'Cuentas' } },
        { path: 'por-pagar', element: <Pending />, handle: { crumb: 'Por pagar y cobrar' } },
        { path: 'flujo', element: <CashFlow />, handle: { crumb: 'Flujo de caja' } },
        { path: 'presupuestos', element: <Budgets />, handle: { crumb: 'Presupuestos' } },
        { path: 'simulador', element: <Simulator />, handle: { crumb: 'Simulador' } },
        { path: 'datos', element: <><FinanceTabs /><FinanceData /></>, handle: { crumb: 'Datos de eventos' } },
      ] },
      { path: 'inventario', element: <Inventory />, handle: { crumb: 'Inventario y barra' } },
      { path: 'ventas', element: <Sales />, handle: { crumb: 'Ventas y reservas' } },
      { path: 'promotores', element: <Promoters />, handle: { crumb: 'Promotores' } },
      { path: 'operaciones', element: <Operations />, handle: { crumb: 'Operaciones y proveedores' } },
      { path: 'tareas', element: <MyTasks />, handle: { crumb: 'Mis tareas' } },
      { path: 'marketing', element: <Marketing />, handle: { crumb: 'Marketing y contenido' } },
      { path: 'sponsors', element: <Sponsors />, handle: { crumb: 'Sponsors y alianzas' } },
      { path: 'equipo', element: <Team />, handle: { crumb: 'Equipo' } },
      { path: 'audiencia', element: <Audience />, handle: { crumb: 'Audiencia' } },
      { path: 'documentos', element: <Documents />, handle: { crumb: 'Documentos' } },
      { path: 'marcas', handle: { crumb: 'Marcas' }, children: [
        { index: true, element: <BrandsCompare />, handle: { crumb: 'Comparativo' } },
        { path: ':brandId', element: <BrandHome />, handle: { crumb: brandName } },
      ] },
      { path: 'actividad', element: <Activity />, handle: { crumb: 'Registro de actividad' } },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: '/administracion' });

function Gate() {
  const { data, pass, login, loading } = useOS();
  if (!data) return <Login waiting={!!pass && loading} onLogin={login} />;
  return <RouterProvider router={router} />;
}

export default function App() {
  return (
    <OSProvider>
      <TooltipProvider><Gate /></TooltipProvider>
    </OSProvider>
  );
}

function Login({ onLogin, waiting }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (waiting) return <div className="flex min-h-full items-start p-10 text-[13px] text-muted-foreground">Cargando Paradisio OS…</div>;
  return (
    <div className="grid min-h-full bg-muted lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <GroupLogo />
          <div className="leading-tight"><p className="text-[14px] font-semibold tracking-tight">Paradisio OS</p><p className="text-[12px] text-muted-foreground">Paradisio Entertainment Group</p></div>
        </div>
        <div className="space-y-3">
          {[['club', 'Paradisio Club'], ['beats', 'Paradisio Beats'], ['icon', 'Icon']].map(([id, name], i) => (
            <motion.div key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-center gap-3">
              <BrandTile id={id} size="md" />
              <span className="text-[15px] font-medium">{name}</span>
            </motion.div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">Acceso privado</p>
      </div>
      <div className="flex items-start px-6 pt-[14vh] sm:px-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <p className="text-[12px] text-muted-foreground lg:hidden">Paradisio OS</p>
            <CardTitle className="text-2xl tracking-tight">Entrar</CardTitle>
            <CardDescription>Usa la clave de administración.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={async (e) => {
              e.preventDefault(); setErr(''); setBusy(true);
              try { await onLogin(v.trim()); } catch (x) { setErr(x.status === 401 ? 'Clave incorrecta.' : x.status === 429 ? x.message : 'No se pudo conectar.'); } finally { setBusy(false); }
            }}>
              <Label htmlFor="pass" className="sr-only">Clave</Label>
              <Input id="pass" type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Clave" className="h-10" />
              <Button className="mt-3 h-10 w-full" disabled={busy || !v}>{busy ? 'Entrando…' : 'Entrar'}</Button>
              <p className="mt-3 min-h-5 text-sm text-destructive">{err}</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
