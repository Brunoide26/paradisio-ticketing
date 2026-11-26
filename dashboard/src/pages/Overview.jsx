import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUpRightIcon, ChevronDownIcon, CheckIcon, PlusIcon, RotateCcwIcon, SlidersHorizontalIcon, CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOS, useSummary } from '../os/store.jsx';
import { fmtStamp } from '../os/kit.jsx';
import { t as tr } from '../os/motion.jsx';
import { cn, money, limaISO, brandColor } from '../lib.js';
import WidgetGrid from './overview/WidgetGrid.jsx';
import PrimaryChart from './overview/PrimaryChart.jsx';
import KpiStrip from './overview/KpiStrip.jsx';
import { dm } from './overview/metrics.js';
import {
  actionLabel, BreakdownWidget, EventsWidget, UpcomingWidget, AttentionWidget, CashWidget, StaffWidget,
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
const LinkAction = ({ to, children = 'Ver todo', label }) => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)} aria-label={label} className="inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{children}<ArrowUpRightIcon className="size-3.5" /></button>;
};
export const REGISTRY = {
  attention: { title: 'Requiere atención', render: (c) => <AttentionWidget items={c.attention} />, action: <LinkAction to="/atencion" label="Abrir la bandeja de atención">Bandeja</LinkAction> },
  upcoming: { title: 'Agenda de producción', kind: 'proj', render: (c) => <UpcomingWidget S={c.S} />, action: <LinkAction to="/calendario" label="Abrir el calendario">Calendario</LinkAction> },
  breakdown: { title: 'Composición del resultado', render: (c) => <BreakdownWidget S={c.S} />, action: <LinkAction to="/finanzas" label="Ir a finanzas">Finanzas</LinkAction> },
  events: { title: 'Rendimiento por fecha', render: (c) => <EventsWidget S={c.S} />, action: <LinkAction to="/eventos" label="Ver todos los eventos" /> },
  cash: { title: 'Caja y obligaciones', render: (c) => <CashWidget LS={c.LS} />, action: <LinkAction to="/finanzas/cuentas" label="Ir a cuentas">Cuentas</LinkAction> },
  staff: { title: 'Costos de personal', render: (c) => <StaffWidget S={c.S} />, action: <LinkAction to="/operaciones" label="Ir al staff">Staff</LinkAction> },
  portfolio: { title: 'Marcas', render: (c) => <PortfolioWidget S={c.S} />, action: <LinkAction to="/marcas" label="Comparar marcas">Comparar</LinkAction> },
  variance: { title: 'Real vs. presupuesto', render: (c) => <VarianceWidget S={c.S} /> },
  activity: { title: 'Actividad reciente', render: () => <ActivityWidget />, action: <LinkAction to="/actividad" label="Ver todo el registro de actividad" /> },
  inventory: { title: 'Barra e inventario', render: () => <InventoryWidget />, action: <LinkAction to="/inventario" label="Ir a inventario" /> },
  tasks: { title: 'Producción pendiente', render: () => <TasksWidget />, action: <LinkAction to="/tareas" label="Ver mis tareas" /> },
  audience: { title: 'Audiencia', render: () => <AudienceWidget />, action: <LinkAction to="/audiencia" label="Ver audiencia" /> },
  sponsors: { title: 'Sponsors', kind: 'proj', render: () => <SponsorsWidget />, action: <LinkAction to="/sponsors" label="Ver sponsors" /> },
};
export const PRESETS = {
  executive: { label: 'Dirección', hint: 'Lo urgente, lo que viene y el resultado', items: [['attention', 'm'], ['upcoming', 'm'], ['breakdown', 'l'], ['portfolio', 's'], ['events', 'l'], ['cash', 's'], ['variance', 'm'], ['activity', 'm']] },
  finance: { label: 'Finanzas', hint: 'Caja, costos y desviaciones', items: [['cash', 'm'], ['breakdown', 'm'], ['events', 'f'], ['staff', 's'], ['variance', 's'], ['inventory', 's'], ['attention', 'm'], ['activity', 'm']] },
  production: { label: 'Producción de eventos', hint: 'Fechas, tareas, staff y barra', items: [['upcoming', 'l'], ['tasks', 's'], ['attention', 'm'], ['staff', 's'], ['inventory', 's'], ['activity', 'f']] },
  commercial: { label: 'Comercial', hint: 'Audiencia, sponsors y marcas', items: [['audience', 's'], ['sponsors', 's'], ['portfolio', 's'], ['upcoming', 'l'], ['attention', 's'], ['events', 'f']] },
};
// v2: el preset "Dirección" cambió de orden; los diseños guardados por el usuario se conservan tal cual.
const LAYOUT_KEY = 'os_overview_layout_v1';
const presetItems = (p) => PRESETS[p].items.map(([id, size]) => ({ id, size }));
function loadLayout() {
  try {
    const o = JSON.parse(ls(LAYOUT_KEY) || 'null');
    if (o && PRESETS[o.preset] && Array.isArray(o.items)) return { preset: o.preset, items: o.custom ? o.items.filter((i) => REGISTRY[i.id]) : presetItems(o.preset), custom: !!o.custom };
  } catch { /* */ }
  return { preset: 'executive', items: presetItems('executive'), custom: false };
}

// ---------- Página ----------
export default function Overview() {
  const { data, workspace, setDrawer, load, flash } = useOS();
  const navigate = useNavigate();
  const [period, setPeriodState] = useState(() => ls('os_period') || 'all');
  const setPeriod = (p) => { setPeriodState(p); ls('os_period', p); };
  const brand = workspace === 'group' ? null : workspace;
  const [, bump] = useState(0);
  const { from, to } = periodRange(period);
  const setCustom = (k, v) => { ls(k === 'from' ? 'os_period_from' : 'os_period_to', v); bump((n) => n + 1); };
  const rangeLabel = period === 'custom' ? (from || to ? `del ${from ? dm(from) : 'inicio'} al ${to ? dm(to) : 'hoy'}` : 'Todo el historial') : PERIODS.find((p) => p.id === period).label;
  const { summary: S, ledger: LS, attention, loading, error } = useSummary({ brand, from, to });
  const [layout, setLayoutState] = useState(loadLayout);
  const [editing, setEditing] = useState(false);
  const setLayout = (fn) => setLayoutState((cur) => { const next = typeof fn === 'function' ? fn(cur) : fn; ls(LAYOUT_KEY, JSON.stringify(next)); return next; });
  const setItems = (items) => setLayout((l) => ({ ...l, items: typeof items === 'function' ? items(l.items) : items, custom: true }));
  useEffect(() => { if (!editing) return undefined; const k = (e) => e.key === 'Escape' && setEditing(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [editing]);

  const brands = data.finance.brands;
  const scopeName = brand ? brands.find((b) => b.id === brand)?.name : 'Paradisio Entertainment Group';
  if (error) {
    return (
      <div role="alert" className="surface mx-auto mt-6 w-full max-w-xl px-5 py-4">
        <h1 className="text-[14px] font-medium">No se pudo calcular el resumen de {scopeName}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {error.status === 401 ? 'Tu sesión venció. Vuelve a entrar con la clave de administración.' : error.status >= 500 ? 'El servidor no respondió al calcular este período. Suele resolverse en segundos.' : 'Revisa tu conexión a internet.'}
          {' '}Los datos guardados no se perdieron.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => load(undefined, { quiet: false }).catch(() => {})}>Reintentar</Button>
          {period !== 'all' && <Button size="sm" variant="outline" onClick={() => setPeriod('all')}>Ver todo el historial</Button>}
        </div>
      </div>
    );
  }
  if (!S) return <OverviewSkeleton items={layout.items} />;

  const hidden = Object.keys(REGISTRY).filter((id) => !layout.items.some((i) => i.id === id));
  const metric = (id) => () => setDrawer({ type: 'metric', id, summary: S });
  const restore = () => setLayout((l) => ({ preset: l.preset, items: presetItems(l.preset), custom: false }));
  const removeWidget = (item, index) => {
    setItems((items) => items.filter((x) => x.id !== item.id));
    flash(`Quitaste "${REGISTRY[item.id].title}"`, { action: { label: 'Deshacer', run: () => setItems((items) => (items.some((x) => x.id === item.id) ? items : [...items.slice(0, index), item, ...items.slice(index)])) } });
  };
  const urgent = attention.filter((a) => a.level !== 'low');

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 md:gap-5">
      <h1 className="sr-only">Resumen ejecutivo de {scopeName}</h1>

      {/* Barra de la página: vista a la izquierda; período y personalizar a la derecha */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="press flex h-8 items-center gap-1.5 rounded-md border border-panel-border bg-panel px-2.5 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
              {brand ? <i className="size-2 rounded-full" style={{ background: brandColor(brand) }} aria-hidden /> : null}
              <span className="text-muted-foreground">Vista</span>{PRESETS[layout.preset].label}{layout.custom && <span className="text-muted-foreground">(personalizada)</span>}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Vistas guardadas</DropdownMenuLabel>
            {Object.entries(PRESETS).map(([id, p]) => (
              <DropdownMenuItem key={id} onSelect={() => setLayout({ preset: id, items: presetItems(id), custom: false })} className="items-start">
                <span className="flex size-4 items-center justify-center pt-0.5">{layout.preset === id && <CheckIcon className="size-3.5" />}</span>
                <span><span className="block text-[13px]">{p.label}</span><span className="block text-[12px] text-muted-foreground">{p.hint}</span></span>
              </DropdownMenuItem>
            ))}
            {layout.custom && (<><DropdownMenuSeparator /><DropdownMenuItem onSelect={restore}><RotateCcwIcon />Restaurar “{PRESETS[layout.preset].label}”</DropdownMenuItem></>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="hidden text-[13px] text-muted-foreground sm:inline">{scopeName}</span>

        <div className="ml-auto flex items-center gap-1.5">
          <PeriodPicker period={period} setPeriod={setPeriod} from={from} to={to} setCustom={setCustom} />
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => setEditing(!editing)} aria-pressed={editing} aria-label="Personalizar el resumen"
                className={cn('press flex size-8 items-center justify-center rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring', editing ? 'border-foreground bg-foreground text-background' : 'border-panel-border bg-panel text-muted-foreground hover:text-foreground')}>
                <SlidersHorizontalIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Personalizar</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className={cn('flex flex-col gap-4 transition-opacity duration-[var(--dur-standard)] md:gap-5', loading && 'opacity-60')}>
        <PrimaryChart from={from} to={to} rangeLabel={rangeLabel} />

        {/* Móvil: lo importante de la bandeja justo después de la cifra principal */}
        {urgent.length > 0 && layout.items.some((i) => i.id === 'attention') && (
          <section aria-labelledby="att-m" className="surface md:hidden">
            <header className="flex items-center justify-between px-4 pb-1 pt-3"><h2 id="att-m" className="text-[14px] font-medium">Requiere atención</h2>{REGISTRY.attention.action}</header>
            <AttentionWidget items={attention} compact />
          </section>
        )}

        <KpiStrip S={S} LS={LS} onMetric={metric} navigate={navigate} setDrawer={setDrawer} />

        {/* Modo personalizar: barra propia; en modo normal no hay controles de edición */}
        <AnimatePresence initial={false}>
          {editing && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={tr.standard}
              className="surface float-shadow sticky top-2 z-30 flex flex-wrap items-center gap-2 px-3 py-2">
              <p className="mr-auto text-[13px]"><span className="font-medium">Personalizando el resumen.</span> <span className="text-muted-foreground">Arrastra para ordenar, cambia el tamaño o quita widgets. Se guarda en este navegador.</span></p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button size="sm" variant="outline" className="h-8 gap-1" disabled={!hidden.length}><PlusIcon />Añadir widget</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {hidden.map((id) => <DropdownMenuItem key={id} onSelect={() => setItems((items) => [...items, { id, size: 's' }])}>{REGISTRY[id].title}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" className="h-8" onClick={restore} disabled={!layout.custom}><RotateCcwIcon />Restaurar</Button>
              <Button size="sm" className="h-8" onClick={() => setEditing(false)}><CheckIcon />Listo</Button>
            </motion.div>
          )}
        </AnimatePresence>

        <WidgetGrid items={layout.items} setItems={setItems} registry={REGISTRY} editing={editing} ctx={{ S, LS, attention }} onRemove={removeWidget} hideOnMobile={urgent.length ? ['attention'] : []} />
      </div>
    </div>
  );
}

// ---------- Período ----------
function PeriodPicker({ period, setPeriod, from, to, setCustom }) {
  const label = PERIODS.find((p) => p.id === period).label;
  const bad = period === 'custom' && from && to && from > to;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="press flex h-8 items-center gap-1.5 rounded-md border border-panel-border bg-panel px-2.5 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            <CalendarIcon className="size-3.5 text-muted-foreground" />{period === 'custom' && (from || to) ? `${from ? dm(from) : 'inicio'} – ${to ? dm(to) : 'hoy'}` : label}<ChevronDownIcon className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Período</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={period} onValueChange={setPeriod}>
            {PERIODS.map((p) => <DropdownMenuRadioItem key={p.id} value={p.id}>{p.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {period === 'custom' && (
        <Popover defaultOpen={!from && !to}>
          <PopoverTrigger asChild>
            <button type="button" className={cn('press h-8 rounded-md border px-2.5 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring', bad ? 'border-bad text-bad' : 'border-panel-border bg-panel')}>Fechas</button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-[13px] font-medium">Rango personalizado</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">Desde<input type="date" value={from || ''} max={to || undefined} onChange={(e) => setCustom('from', e.target.value)} aria-invalid={bad || undefined} className="num h-8 rounded-md border border-input bg-transparent px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
              <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">Hasta<input type="date" value={to || ''} min={from || undefined} onChange={(e) => setCustom('to', e.target.value)} aria-invalid={bad || undefined} className="num h-8 rounded-md border border-input bg-transparent px-2 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
            </div>
            {bad && <p role="alert" className="mt-2 text-[12px] text-bad">La fecha de inicio es posterior a la de fin. Cambia una de las dos.</p>}
            <p className="mt-2 text-[12px] text-muted-foreground">Deja una vacía para no limitar ese extremo.</p>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}

// Esqueleto con las mismas medidas que el contenido final (sin saltos al cargar).
const SKEL = { s: 'col-span-12 md:col-span-6 xl:col-span-4', m: 'col-span-12 md:col-span-6', l: 'col-span-12 xl:col-span-8', f: 'col-span-12' };
function OverviewSkeleton({ items }) {
  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 md:gap-5" aria-busy="true" aria-label="Cargando resumen">
      <div className="flex items-center gap-2"><div className="skeleton h-8 w-44 rounded-md" /><div className="skeleton ml-auto h-8 w-40 rounded-md" /><div className="skeleton size-8 rounded-md" /></div>
      <div className="surface px-4 pb-3 pt-4 md:px-6 md:pt-5">
        <div className="flex justify-between"><div className="skeleton h-4 w-56" /><div className="skeleton h-8 w-28 rounded-md" /></div>
        <div className="skeleton mt-3 h-[44px] w-72 md:h-[54px]" />
        <div className="skeleton mt-3 h-4 w-80" />
        <div className="mt-4 flex gap-2"><div className="skeleton h-8 w-44 rounded-md" /><div className="skeleton h-8 w-24 rounded-md" /></div>
        <div className="skeleton mt-3 h-[210px] w-full md:h-[272px]" />
        <div className="skeleton mt-3 h-4 w-64" />
      </div>
      <div className="surface grid h-[96px] grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className={cn('px-5 py-3.5', i > 0 && 'hidden xl:block')}><div className="skeleton h-3.5 w-24" /><div className="skeleton mt-2 h-7 w-32" /></div>)}</div>
      <div className="grid grid-cols-12 gap-4">{items.map((i) => <div key={i.id} className={cn(SKEL[i.size] || SKEL.m, 'skeleton h-[280px] rounded-[10px]')} />)}</div>
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
        {a.actor === 'claude' && <span className="ml-1.5 rounded border px-1 text-[11px] font-medium text-muted-foreground">Claude</span>}
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
      <div className="min-w-0"><h3 className="text-[14px] font-medium tracking-tight">{title}</h3>{description && <p className="text-[12px] text-muted-foreground">{description}</p>}</div>
      {action}
    </div>
  );
}
export { Header as PanelBar };
