import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRightIcon, ChevronDownIcon, LayoutGridIcon, CheckIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useOS, useSummary } from '../os/store.jsx';
import { fmtStamp } from '../os/kit.jsx';
import { t as tr } from '../os/motion.jsx';
import { cn, money, pct, limaISO } from '../lib.js';
import WidgetGrid from './overview/WidgetGrid.jsx';
import RevenueChart from './overview/RevenueChart.jsx';
import {
  Fig, NA, ProjTag, RealTag, actionLabel, BreakdownWidget, EventsWidget, UpcomingWidget, AttentionWidget, CashWidget, StaffWidget,
  PortfolioWidget, VarianceWidget, ActivityWidget, InventoryWidget, TasksWidget, AudienceWidget, SponsorsWidget,
} from './overview/widgets.jsx';

const PERIODS = [
  { id: 'all', label: 'Todo el historial' },
  { id: 'month', label: 'Este mes' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'year', label: 'Este año' },
  { id: 'lastyear', label: 'Año pasado' },
  { id: 'custom', label: 'Rango personalizado' },
];
function periodRange(id) {
  const t = limaISO(); const y = Number(t.slice(0, 4));
  if (id === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (id === '90d') { const d = new Date(Date.now() - 90 * 86400000); return { from: limaISO(d), to: t }; }
  if (id === 'year') return { from: `${y}-01-01`, to: t };
  if (id === 'lastyear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (id === 'custom') return { from: ls('os_period_from') || null, to: ls('os_period_to') || null };
  return { from: null, to: null };
}
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } return null; };

// ---------- Widgets y presets ----------
const LinkAction = ({ to, children = 'Ver todo' }) => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)} className="inline-flex items-center gap-0.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground">{children}<ArrowUpRightIcon className="size-3" /></button>;
};
export const REGISTRY = {
  breakdown: { title: 'Composición del resultado', kind: 'real', render: (c) => <BreakdownWidget S={c.S} />, action: <LinkAction to="/finanzas" /> },
  events: { title: 'Rendimiento por fecha', kind: 'real', render: (c) => <EventsWidget S={c.S} />, action: <LinkAction to="/eventos" /> },
  upcoming: { title: 'Próximas fechas', kind: 'proj', render: (c) => <UpcomingWidget S={c.S} />, action: <LinkAction to="/calendario">Calendario</LinkAction> },
  attention: { title: 'Requiere atención', render: (c) => <AttentionWidget items={c.attention} />, action: <LinkAction to="/atencion">Bandeja</LinkAction> },
  cash: { title: 'Caja y obligaciones', render: (c) => <CashWidget LS={c.LS} />, action: <LinkAction to="/finanzas/cuentas">Cuentas</LinkAction> },
  staff: { title: 'Costos de personal', kind: 'real', render: (c) => <StaffWidget S={c.S} />, action: <LinkAction to="/operaciones">Staff</LinkAction> },
  portfolio: { title: 'Marcas', kind: 'real', render: (c) => <PortfolioWidget S={c.S} />, action: <LinkAction to="/marcas">Comparar</LinkAction> },
  variance: { title: 'Real vs. presupuesto', render: (c) => <VarianceWidget S={c.S} /> },
  activity: { title: 'Actividad reciente', render: () => <ActivityWidget />, action: <LinkAction to="/actividad" /> },
  inventory: { title: 'Barra e inventario', render: () => <InventoryWidget />, action: <LinkAction to="/inventario" /> },
  tasks: { title: 'Producción pendiente', render: () => <TasksWidget />, action: <LinkAction to="/tareas" /> },
  audience: { title: 'Audiencia', render: () => <AudienceWidget />, action: <LinkAction to="/audiencia" /> },
  sponsors: { title: 'Sponsors', kind: 'proj', render: () => <SponsorsWidget />, action: <LinkAction to="/sponsors" /> },
};
export const PRESETS = {
  executive: { label: 'Dirección', hint: 'Resultado, caja y lo que viene', items: [['breakdown', 'l'], ['attention', 's'], ['upcoming', 'l'], ['portfolio', 's'], ['events', 'l'], ['cash', 's'], ['variance', 'm'], ['activity', 'm']] },
  finance: { label: 'Finanzas', hint: 'Caja, costos y desviaciones', items: [['cash', 'm'], ['breakdown', 'm'], ['events', 'f'], ['staff', 's'], ['variance', 's'], ['inventory', 's'], ['attention', 'm'], ['activity', 'm']] },
  production: { label: 'Producción de eventos', hint: 'Fechas, tareas, staff y barra', items: [['upcoming', 'l'], ['tasks', 's'], ['staff', 's'], ['inventory', 's'], ['attention', 's'], ['activity', 'f']] },
  commercial: { label: 'Comercial', hint: 'Audiencia, sponsors y marcas', items: [['audience', 's'], ['sponsors', 's'], ['portfolio', 's'], ['upcoming', 'l'], ['attention', 's'], ['events', 'f']] },
};
const LAYOUT_KEY = 'os_overview_layout_v1';
const presetItems = (p) => PRESETS[p].items.map(([id, size]) => ({ id, size }));
function loadLayout() {
  try {
    const o = JSON.parse(ls(LAYOUT_KEY) || 'null');
    if (o && PRESETS[o.preset] && Array.isArray(o.items)) return { preset: o.preset, items: o.items.filter((i) => REGISTRY[i.id]), custom: !!o.custom };
  } catch { /* */ }
  return { preset: 'executive', items: presetItems('executive'), custom: false };
}

// ---------- Página ----------
export default function Overview() {
  const { data, workspace, setDrawer, withTaxes } = useOS();
  const navigate = useNavigate();
  const [period, setPeriodState] = useState(() => ls('os_period') || 'all');
  const setPeriod = (p) => { setPeriodState(p); ls('os_period', p); };
  const brand = workspace === 'group' ? null : workspace;
  const [, bump] = useState(0);
  const { from, to } = periodRange(period);
  const setCustom = (k, v) => { ls(k === 'from' ? 'os_period_from' : 'os_period_to', v); bump((n) => n + 1); };
  const rangeLabel = period === 'custom' ? `${from || 'inicio'} → ${to || 'hoy'}` : PERIODS.find((p) => p.id === period).label;
  const { summary: S, ledger: LS, attention, loading, error } = useSummary({ brand, from, to });
  const [layout, setLayoutState] = useState(loadLayout);
  const [editing, setEditing] = useState(false);
  const setLayout = (l) => { setLayoutState(l); ls(LAYOUT_KEY, JSON.stringify(l)); };
  const setItems = (items) => setLayout({ ...layout, items, custom: true });
  useEffect(() => { if (!editing) return undefined; const k = (e) => e.key === 'Escape' && setEditing(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [editing]);

  const brands = data.finance.brands;
  const scopeName = brand ? brands.find((b) => b.id === brand)?.name : 'Paradisio Entertainment Group';
  if (error) return <div className="rounded-lg border p-6 text-sm">No se pudo calcular el resumen. <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reintentar</Button></div>;
  if (!S) return <OverviewSkeleton items={layout.items} />;

  const hidden = Object.keys(REGISTRY).filter((id) => !layout.items.some((i) => i.id === id));
  const metric = (id) => () => setDrawer({ type: 'metric', id, summary: S });

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">
      {/* Encabezado editorial */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{scopeName}</p>
          <h1 className="mt-0.5 text-[24px] font-semibold leading-tight tracking-[-0.025em]">Resumen</h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">{PERIODS.find((p) => p.id === period).label}<ChevronDownIcon className="text-muted-foreground" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Período</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={period} onValueChange={setPeriod}>
                {PERIODS.map((p) => <DropdownMenuRadioItem key={p.id} value={p.id}>{p.label}</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {period === 'custom' && (
            <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
              <input type="date" aria-label="Desde" value={from || ''} onChange={(e) => setCustom('from', e.target.value)} className="num h-8 rounded-md border border-input bg-background px-2 text-[12.5px] text-foreground" />
              →
              <input type="date" aria-label="Hasta" value={to || ''} onChange={(e) => setCustom('to', e.target.value)} className="num h-8 rounded-md border border-input bg-background px-2 text-[12.5px] text-foreground" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal"><span className="hidden sm:inline">Vista:</span> {PRESETS[layout.preset].label}{layout.custom && <span className="text-muted-foreground">· editada</span>}<ChevronDownIcon className="text-muted-foreground" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Vistas</DropdownMenuLabel>
              {Object.entries(PRESETS).map(([id, p]) => (
                <DropdownMenuItem key={id} onSelect={() => setLayout({ preset: id, items: presetItems(id), custom: false })} className="items-start">
                  <span className="flex size-4 items-center justify-center pt-0.5">{layout.preset === id && <CheckIcon className="size-3.5" />}</span>
                  <span><span className="block text-[13px]">{p.label}</span><span className="block text-[11.5px] text-muted-foreground">{p.hint}</span></span>
                </DropdownMenuItem>
              ))}
              {layout.custom && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setLayout({ preset: layout.preset, items: presetItems(layout.preset), custom: false })}><RotateCcwIcon />Restaurar “{PRESETS[layout.preset].label}”</DropdownMenuItem></>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant={editing ? 'default' : 'outline'} className="h-8 gap-1.5" onClick={() => setEditing(!editing)} aria-pressed={editing}>
            {editing ? <CheckIcon /> : <LayoutGridIcon />}{editing ? 'Listo' : 'Personalizar'}
          </Button>
        </div>
      </div>

      <RevenueChart from={from} to={to} rangeLabel={rangeLabel} />

      <Hero S={S} LS={LS} loading={loading} metric={metric} navigate={navigate} setDrawer={setDrawer} withTaxes={withTaxes} />

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tr.layout} className="-mb-3 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-[12.5px] text-muted-foreground">
              Arrastra desde <span className="inline-flex items-center rounded border px-1">⋮⋮</span> para ordenar, cambia el tamaño con S·M·L·XL o quita widgets. Se guarda en este navegador.
              <span className="ml-auto flex gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-7 gap-1" disabled={!hidden.length}><PlusIcon />Añadir widget</Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {hidden.map((id) => <DropdownMenuItem key={id} onSelect={() => setItems([...layout.items, { id, size: 's' }])}>{REGISTRY[id].title}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setLayout({ preset: layout.preset, items: presetItems(layout.preset), custom: false })}><RotateCcwIcon />Restaurar</Button>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn('transition-opacity duration-[var(--dur-standard)]', loading && 'opacity-60')}>
        <WidgetGrid items={layout.items} setItems={setItems} registry={REGISTRY} editing={editing} ctx={{ S, LS, attention }} />
      </div>
    </div>
  );
}

// ---------- Cifras principales: lo real arriba y sólido; lo proyectado aparte ----------
function Lead({ label, children, sub, onClick, big }) {
  return (
    <button type="button" onClick={onClick} className="group min-w-0 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 lg:border-l lg:border-divider lg:pl-6 lg:first:border-l-0 lg:first:pl-0">
      <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground transition-colors group-hover:text-foreground">{label}<ArrowUpRightIcon className="size-3 opacity-0 transition-opacity group-hover:opacity-60" /></span>
      <span className={cn('mt-2 flex items-end truncate font-medium leading-none tracking-[-0.035em]', big ? 'h-9 text-[30px] md:h-11 md:text-[40px]' : 'h-9 text-[26px] md:h-11 md:text-[32px]')}>{children}</span>
      {sub && <span className="mt-2.5 block truncate text-[12px] text-muted-foreground">{sub}</span>}
    </button>
  );
}

function Hero({ S, LS, loading, metric, navigate, setDrawer }) {
  const A = S.actual, P = S.projected;
  const topIncome = (A.byIncomeCategory || [])[0];
  const completeRevenue = S.events.filter((f) => f.kind === 'budget' && f.complete).reduce((s, f) => s + (f.revenue || 0), 0);
  const cashNA = !LS || LS.cash == null;
  const secondary = [
    ['Margen', A.margin == null ? null : pct(A.margin), metric('margin'), A.margin != null && A.margin < 0],
    ['Stock final', A.stock ? money(A.stock) : null, metric('stock')],
    ['Inversión en marca', A.brandInvestment ? money(A.brandInvestment) : null, metric('brandInvestment')],
    ['Por cobrar', LS && LS.hasData ? money(LS.receivables.total) : null, () => navigate('/finanzas/por-pagar')],
  ];
  return (
    <section aria-label="Cifras principales" className={cn('transition-opacity duration-[var(--dur-standard)]', loading && 'opacity-60')}>
      <div className="mb-3 flex items-center gap-3">
        <RealTag />
        <span className="text-[11.5px] text-muted-foreground">{A.count ? `${A.count} fecha${A.count === 1 ? '' : 's'} en Liquidación o Cerrada${A.count === 1 ? '' : 's'}` : 'Sin fechas cerradas en el período'}</span>
        <span className="h-px flex-1 bg-divider" />
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-6 lg:grid-cols-3 lg:gap-x-0">
        <Lead big label="Resultado" onClick={metric('result')} sub={A.count ? `${money(A.revenue)} de ingresos − ${money(A.costs)} de costos${A.stock ? ` + ${money(A.stock)} de stock` : ''}` : '—'}>
          {A.count ? <span className={A.result < 0 ? 'text-bad' : 'text-good'}><Fig value={A.result} /></span> : <NA>—</NA>}
        </Lead>
        <Lead label="Caja disponible" onClick={() => (LS && LS.accounts.length ? navigate('/finanzas/cuentas') : setDrawer({ type: 'account' }))}
          sub={cashNA ? (LS && LS.accounts.length ? 'Falta el saldo inicial de una cuenta' : 'Registra tus cuentas para verla →') : `${LS.accounts.length} cuenta${LS.accounts.length === 1 ? '' : 's'}: bancos, caja y Culqi`}>
          {cashNA ? <NA className="pb-0.5 text-[17px] tracking-[-0.015em] md:text-[20px]">No disponible</NA> : <Fig value={LS.cash} />}
        </Lead>
        <Lead label="Por pagar" onClick={() => navigate('/finanzas/por-pagar')}
          sub={LS && LS.hasData ? (LS.payables.overdue ? `${LS.payables.overdue} vencido(s)` : `${LS.payables.count} pendiente(s)`) : 'Sin pagos registrados'}>
          {LS && LS.hasData ? <span className={LS.payables.overdue ? 'text-bad' : ''}><Fig value={LS.payables.total} /></span> : <NA className="pb-0.5 text-[17px] tracking-[-0.015em] md:text-[20px]">No disponible</NA>}
        </Lead>
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-divider pt-3">
        {secondary.map(([l, v, on, bad]) => (
          <li key={l}><button type="button" onClick={on} className="flex items-baseline gap-2 text-[12.5px] hover:underline-offset-4 hover:[&>span:first-child]:text-foreground">
            <span className="text-muted-foreground transition-colors">{l}</span>
            {v == null ? <span className="text-faint">—</span> : <span className={cn('num font-medium', bad && 'text-bad')}>{v}</span>}
          </button></li>
        ))}
      </ul>

      {/* Proyectado: aparte, rayado, nunca sumado a lo real. */}
      <div className="mt-5 rounded-lg border border-dashed border-proj-line bg-proj-soft/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ProjTag />
          <button type="button" onClick={metric('projRevenue')} className="flex items-baseline gap-2 text-left">
            <span className="text-[12.5px] text-muted-foreground">Ingresos proyectados</span>
            <span className="text-[17px] font-medium tracking-tight text-foreground/85"><Fig value={P.revenue} /></span>
            <span className="text-[11.5px] text-muted-foreground">{P.count} fecha{P.count === 1 ? '' : 's'} por venir</span>
          </button>
          <button type="button" onClick={metric('projProfit')} className="flex items-baseline gap-2 text-left">
            <span className="text-[12.5px] text-muted-foreground">Utilidad proyectada</span>
            {P.profit == null ? <span className="text-[13px] text-proj">Incompleta: ningún presupuesto tiene costos</span>
              : <span className={cn('text-[17px] font-medium tracking-tight', P.profit >= 0 ? 'text-good' : 'text-bad')}><Fig value={P.profit} /></span>}
            {P.profit != null && <span className="text-[11.5px] text-muted-foreground" title={`Sólo presupuestos con costos: ${money(completeRevenue)} de ingreso proyectado`}>de {P.completeCount} fecha{P.completeCount === 1 ? '' : 's'} con costos</span>}
          </button>
          <span className="ml-auto flex items-center gap-2 text-[11.5px] text-muted-foreground" title="Presupuestos con ingresos y costos cargados">
            <span className="flex gap-0.5">{Array.from({ length: P.count }).map((_, i) => <i key={i} className={cn('h-2 w-3.5 rounded-[2px]', i < P.completeCount ? 'bg-proj' : 'border border-dashed border-proj-line')} />)}</span>
            {P.completeCount}/{P.count} presupuestos completos
          </span>
        </div>
      </div>
    </section>
  );
}

// Esqueleto con las mismas medidas que el contenido final (sin saltos al cargar).
const SKEL = { s: 'col-span-12 md:col-span-6 xl:col-span-4', m: 'col-span-12 md:col-span-6', l: 'col-span-12 xl:col-span-8', f: 'col-span-12' };
function OverviewSkeleton({ items }) {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6" aria-busy="true" aria-label="Cargando resumen">
      <div><div className="skeleton h-3 w-40" /><div className="skeleton mt-2 h-7 w-32" /></div>
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i}><div className="skeleton h-3 w-20" /><div className="skeleton mt-3 h-9 w-40" /><div className="skeleton mt-3 h-3 w-32" /></div>)}</div>
      <div className="skeleton h-12 w-full rounded-lg" />
      <div className="grid grid-cols-12 gap-3">{items.map((i) => <div key={i.id} className={cn(SKEL[i.size] || SKEL.m, 'skeleton h-[260px] rounded-lg')} />)}</div>
    </div>
  );
}

// ---------- Compartidos con otras páginas ----------
export function ActivityRow({ a, onOpen, stages }) {
  const money2 = (v) => (typeof v === 'number' ? money(v) : v);
  const ch = a.changes ? Object.entries(a.changes).map(([k, v]) => `${{ stage: 'etapa', name: 'nombre', date: 'fecha', venue: 'local', brand: 'marca', notes: 'notas', openingStock: 'inventario inicial', liveEventId: 'fecha en la web', income: 'ingresos', costs: 'costos', brandInvestment: 'inversión en marca', stockLeft: 'stock final', stock: 'detalle de stock', bar: 'barra', capacity: 'aforo' }[k] || k}${k === 'stage' && stages ? `: ${stages.find((s) => s.id === v.to)?.label || v.to}` : ['income', 'costs', 'brandInvestment', 'stockLeft', 'openingStock'].includes(k) ? ` ${money2(v.from)} → ${money2(v.to)}` : ''}`).join(', ') : '';
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5">
      <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', a.actor === 'claude' ? 'bg-foreground' : 'bg-faint')} />
      <span className="min-w-0 flex-1 text-[13px]">
        <span className="text-muted-foreground">{actionLabel(a.action)} </span>
        {a.event && String(a.action).startsWith('event') ? <button type="button" className="font-medium hover:underline" onClick={() => onOpen(a.event)}>{a.name || a.event}</button> : a.name ? <span className="font-medium">{a.name}</span> : a.events ? <span className="text-muted-foreground">({a.events} eventos)</span> : null}
        {a.actor === 'claude' && <span className="ml-1.5 rounded border px-1 text-[10px] font-medium text-muted-foreground">Claude</span>}
        {ch && <span className="block text-[12px] text-muted-foreground">{ch}</span>}
        {a.source && <span className="block text-[11px] text-muted-foreground">Fuente: {a.source}</span>}
      </span>
      <span className="num shrink-0 text-[11px] text-muted-foreground">{fmtStamp(a.at)}</span>
    </li>
  );
}

function Header({ title, description, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-divider px-4 pb-2.5 pt-3">
      <div className="min-w-0"><h3 className="text-[13.5px] font-medium tracking-tight">{title}</h3>{description && <p className="text-[12px] text-muted-foreground">{description}</p>}</div>
      {action}
    </div>
  );
}
export { Header as PanelBar };
