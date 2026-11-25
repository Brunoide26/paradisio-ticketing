import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useMatches } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboardIcon, InboxIcon, CalendarDaysIcon, TicketIcon, WalletIcon, HistoryIcon, PlusIcon, BellIcon,
  RefreshCwIcon, DownloadIcon, ReceiptIcon, MoonIcon, SunIcon, ChevronsUpDownIcon, CheckIcon, Building2Icon, ExternalLinkIcon, SlidersHorizontalIcon, TriangleAlertIcon,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { GroupLogo } from '@/components/app-sidebar';
import { NavUser } from '@/components/nav-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useKeypress } from '@/hooks/use-keypress';
import { useOS } from './store.jsx';
import { StageBadge, BrandDot, fmtDay, fmtDayYear, relDays, Unavailable, moneyOrNA } from './kit.jsx';
import { BrandTile, KindTag } from '../ui.jsx';
import { cn, money, pct, isActual, totals, limaISO } from '../lib.js';

export const sel = 'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30';

// CSV del estado de resultados de cada fecha (real y presupuesto separados por columna "Tipo").
export function exportCsv(finance, withTaxes) {
  const rows = [['Marca', 'Fecha', 'Evento', 'Etapa', 'Tipo', 'Línea', 'Concepto', 'Categoría', 'Monto (PEN)']];
  const bn = (id) => (finance.brands.find((b) => b.id === id) || {}).name || id;
  finance.events.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
    const kind = isActual(e) ? 'Real' : 'Presupuesto';
    (e.income || []).forEach((l) => rows.push([bn(e.brand), e.date, e.name, e.stage, kind, 'Ingreso', l.label, l.category || '', l.amount]));
    totals(e, withTaxes).costs.forEach((l) => rows.push([bn(e.brand), e.date, e.name, e.stage, kind, 'Costo', l.label, l.category || '', -l.amount]));
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `paradisio-os-${limaISO()}.csv`;
  a.click();
}

function WorkspaceSwitcher({ brands }) {
  const { workspace, setWorkspace } = useOS();
  const cur = brands.find((b) => b.id === workspace);
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              {cur ? <BrandTile id={cur.id} size="sm" className="size-8!" /> : <GroupLogo />}
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold">Paradisio OS</span>
                <span className="truncate text-[11px] text-muted-foreground">{cur ? cur.name : 'Paradisio Entertainment Group'}</span>
              </span>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Espacio de trabajo</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setWorkspace('group')}>
              <Building2Icon />Todo el grupo{workspace === 'group' && <CheckIcon className="ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {brands.map((b) => (
              <DropdownMenuItem key={b.id} onSelect={() => setWorkspace(b.id)}>
                <BrandTile id={b.id} size="xs" />{b.name}{workspace === b.id && <CheckIcon className="ml-auto" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function Notifications({ items, onOpen }) {
  const high = items.filter((a) => a.level === 'high').length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label={`Atención (${items.length})`} className="relative">
          <BellIcon />
          {items.length > 0 && <span className={cn('absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white', high ? 'bg-bad' : 'bg-foreground/70')}>{items.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="border-b px-3 py-2 text-[13px] font-medium">Requiere atención</div>
        <ul className="scroll-thin max-h-[360px] divide-y overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-4 text-[13px] text-muted-foreground">Nada pendiente.</li>}
          {items.map((a, i) => (
            <li key={i}>
              <button type="button" onClick={() => onOpen(a)} className="flex w-full gap-2.5 px-3 py-2.5 text-left hover:bg-muted">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.level === 'high' ? 'bg-bad' : a.level === 'med' ? 'bg-[#C98500]' : 'bg-muted-foreground/50')} />
                <span className="min-w-0"><span className="block text-[13px] font-medium">{a.title}</span><span className="block text-[12px] text-muted-foreground">{a.text}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function QuickCreate() {
  const { creating, setCreating, createEvent, data, workspace, setDrawer } = useOS();
  const brands = data.finance.brands || [];
  const stages = data.os.stages;
  const blank = () => ({ brand: brands.some((b) => b.id === workspace) ? workspace : brands[0]?.id, name: '', date: limaISO(), venue: '', stage: 'concept', notes: '' });
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (creating) setF(blank()); }, [creating]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={creating} onOpenChange={setCreating}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo evento</DialogTitle>
          <DialogDescription>Se crea en etapa de concepto, sin números. Luego cargas el presupuesto.</DialogDescription>
        </DialogHeader>
        <form id="qc" className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { const r = await createEvent(f); setCreating(false); if (r && r.id) setDrawer({ type: 'event', id: r.id }); } catch { /* el toast ya avisa */ } finally { setBusy(false); }
        }}>
          <Field label="Nombre" className="sm:col-span-2"><Input autoFocus required value={f.name} onChange={set('name')} placeholder="Ej. Paradisio Club · 12 de diciembre" /></Field>
          <Field label="Marca"><select className={sel} value={f.brand} onChange={set('brand')}>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Fecha"><Input type="date" required value={f.date} onChange={set('date')} /></Field>
          <Field label="Local"><Input value={f.venue} onChange={set('venue')} placeholder="Por confirmar" /></Field>
          <Field label="Etapa"><select className={sel} value={f.stage} onChange={set('stage')}>{stages.filter((s) => !['settlement', 'closed'].includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-16" /></Field>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          <Button type="submit" form="qc" disabled={busy || !f.name || !f.date}>{busy ? 'Creando…' : 'Crear evento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, className, hint }) {
  return (
    <Label className={cn('flex flex-col items-stretch gap-1.5 text-xs font-normal text-muted-foreground', className)}>
      {label}{children}{hint && <span className="text-[11px]">{hint}</span>}
    </Label>
  );
}

// Panel lateral para revisar y editar un evento sin salir de la página.
function EventDrawer({ id, onClose }) {
  const { data, updateEvent } = useOS();
  const navigate = useNavigate();
  const e = data.finance.events.find((x) => x.id === id);
  const f = data.os.summary.events.find((x) => x.id === id);
  const stages = data.os.stages;
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (e) setForm({ name: e.name, date: e.date, venue: e.venue || '', brand: e.brand, stage: e.stage, notes: e.notes || '', openingStock: e.openingStock ?? '' }); }, [id, data.version]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e || !form) return null;
  const brand = data.finance.brands.find((b) => b.id === e.brand);
  const set = (k) => (ev) => setForm((x) => ({ ...x, [k]: ev.target.value }));
  const goingActual = !isActual(e) && ['settlement', 'closed'].includes(form.stage);
  const dirty = ['name', 'date', 'venue', 'brand', 'stage', 'notes'].some((k) => form[k] !== (k === 'venue' || k === 'notes' ? e[k] || '' : e[k])) || String(form.openingStock) !== String(e.openingStock ?? '');
  const go = (to) => { onClose(); navigate(to); };
  return (
    <>
      <SheetHeader className="border-b pb-3">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><BrandTile id={e.brand} size="xs" />{brand?.name}<span>·</span>{fmtDayYear(e.date)}<span>·</span>{relDays(f?.daysTo)}</div>
        <SheetTitle className="text-[17px]">{e.name}</SheetTitle>
        <SheetDescription asChild><div className="flex items-center gap-2"><StageBadge stage={e.stage} stages={stages} /><KindTag real={isActual(e)} /></div></SheetDescription>
      </SheetHeader>
      <div className="scroll-thin flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {f && (
          <div className="grid grid-cols-3 gap-2">
            <Mini label={isActual(e) ? 'Ingresos' : 'Ingresos proy.'} value={money(f.revenue)} proj={!isActual(e)} />
            <Mini label={isActual(e) ? 'Costos' : 'Costos proy.'} value={f.hasCosts ? money(f.costs) : null} reason="Sin costos cargados" proj={!isActual(e)} />
            <Mini label={isActual(e) ? 'Resultado' : 'Utilidad proy.'} value={moneyOrNA(f.result)} reason="Presupuesto incompleto: faltan costos" proj={!isActual(e)} tone={f.result == null ? null : f.result >= 0 ? 'good' : 'bad'} />
          </div>
        )}
        {f && f.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {f.warnings.map((w, i) => <li key={i} className={cn('flex gap-2 rounded-md border px-2.5 py-2 text-[12px]', w.level === 'warn' ? 'border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-muted/60 text-muted-foreground')}><TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />{w.text}</li>)}
          </ul>
        )}
        <form id="ev-form" className="grid gap-3 sm:grid-cols-2" onSubmit={async (ev) => {
          ev.preventDefault(); setBusy(true);
          try { await updateEvent(e.id, { ...form, openingStock: form.openingStock === '' ? null : Number(form.openingStock) }); } catch { /* toast */ } finally { setBusy(false); }
        }}>
          <Field label="Nombre" className="sm:col-span-2"><Input value={form.name} onChange={set('name')} required /></Field>
          <Field label="Etapa"><select className={sel} value={form.stage} onChange={set('stage')}>{stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
          <Field label="Fecha"><Input type="date" value={form.date} onChange={set('date')} required /></Field>
          <Field label="Marca"><select className={sel} value={form.brand} onChange={set('brand')}>{data.finance.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
          <Field label="Local"><Input value={form.venue} onChange={set('venue')} /></Field>
          <Field label="Inventario inicial (S/)" hint="Stock de fechas anteriores que esta fecha usa, a costo." className="sm:col-span-2"><Input type="number" step="0.01" className="mono" value={form.openingStock} onChange={set('openingStock')} placeholder="No registrado" /></Field>
          <Field label="Notas" className="sm:col-span-2"><Textarea value={form.notes} onChange={set('notes')} className="min-h-16" /></Field>
          {goingActual && <p className="rounded-md border border-dashed border-proj-line bg-proj-soft px-2.5 py-2 text-[12px] text-proj sm:col-span-2">Al pasar a {stages.find((s) => s.id === form.stage)?.label}, los números actuales se guardan como presupuesto aprobado y desde ahí cuentan como reales. Reemplázalos por los del cierre en Datos financieros.</p>}
        </form>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t p-3">
        <Button size="sm" variant="outline" onClick={() => go(`/eventos/${e.id}`)}><ExternalLinkIcon />Abrir evento</Button>
        <Button size="sm" variant="outline" onClick={() => go(`/finanzas/datos?evento=${e.id}`)}><SlidersHorizontalIcon />Editar números</Button>
        <Button size="sm" type="submit" form="ev-form" className="ml-auto" disabled={busy || !dirty}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </>
  );
}

function Mini({ label, value, reason, tone, proj }) {
  return (
    <div className={cn('rounded-md border px-2.5 py-2', proj && 'border-dashed border-proj-line')}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {value == null ? <Unavailable reason={reason} className="text-[12px]" /> : <p className={cn('mono text-[15px] font-semibold', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</p>}
    </div>
  );
}

// Panel lateral con la definición de una métrica y las fechas que la componen.
function MetricDrawer({ id, summary, onClose }) {
  const { data, setDrawer } = useOS();
  const m = data.os.metrics[id] || { label: id };
  const S = summary || data.os.summary;
  const evs = S.events;
  const byId = new Map(evs.map((x) => [x.id, x]));
  const ids = { revenue: S.actual.events, costs: S.actual.events, result: S.actual.events, margin: S.actual.events, stock: S.actual.events, brandInvestment: S.actual.events, projRevenue: S.projected.events, projProfit: S.projected.events, variance: S.variance ? S.variance.events.map((v) => v.id) : [] }[id] || [];
  const val = (f) => ({ revenue: money(f.revenue), costs: money(f.costs), result: moneyOrNA(f.result), margin: f.margin == null ? null : pct(f.margin), stock: money(f.closingStock), brandInvestment: money(f.brandInvestment), projRevenue: money(f.revenue), projProfit: f.complete ? money(f.result) : null, variance: f.budget ? money(f.result - (f.budget.result || 0)) : null }[id]);
  return (
    <>
      <SheetHeader className="border-b pb-3">
        <SheetTitle>{m.label}</SheetTitle>
        <SheetDescription>{m.formula}</SheetDescription>
        {m.notes && <p className="text-[12px] text-muted-foreground">{m.notes}</p>}
      </SheetHeader>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {ids.length === 0 ? <p className="px-4 py-6 text-[13px] text-muted-foreground">{['cash', 'payables', 'receivables'].includes(id) ? 'Todavía no hay datos para calcularlo.' : 'Ninguna fecha entra en este cálculo con los filtros actuales.'}</p> : (
          <ul className="divide-y">
            {ids.map((x) => byId.get(x)).filter(Boolean).map((f) => (
              <li key={f.id}>
                <button type="button" onClick={() => setDrawer({ type: 'event', id: f.id })} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted">
                  <BrandDot id={f.brand} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{f.name}</span><span className="block text-[11px] text-muted-foreground">{fmtDay(f.date)}</span></span>
                  {val(f) == null ? <Unavailable reason={id === 'projProfit' ? 'Presupuesto sin costos: excluido' : ''} className="text-[12px]" /> : <span className="mono text-[13px]">{val(f)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {id === 'projProfit' && S.projected.incomplete.length > 0 && <p className="border-t px-4 py-3 text-[12px] text-muted-foreground">{S.projected.incomplete.length} presupuesto(s) sin costos quedan fuera de la utilidad proyectada.</p>}
      </div>
    </>
  );
}

function Palette() {
  const { cmd, setCmd, data, setDrawer, setCreating, withTaxes, setWithTaxes, theme, setTheme, load, setWorkspace } = useOS();
  const navigate = useNavigate();
  const brands = data.finance.brands || [];
  const events = data.finance.events.slice().sort((a, b) => b.date.localeCompare(a.date));
  const run = (fn) => { setCmd(false); fn(); };
  return (
    <CommandDialog open={cmd} onOpenChange={setCmd} title="Buscar" description="Busca páginas, eventos o acciones">
      <CommandInput placeholder="Busca páginas, eventos o acciones…" />
      <CommandList className="scroll-thin">
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Acciones">
          <CommandItem onSelect={() => run(() => setCreating(true))}><PlusIcon />Nuevo evento<Kbd>C</Kbd></CommandItem>
          <CommandItem onSelect={() => run(() => setWithTaxes(!withTaxes))}><ReceiptIcon />{withTaxes ? 'Ver sin IGV ni renta' : 'Ver con IGV y renta'}</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</CommandItem>
          <CommandItem onSelect={() => run(() => exportCsv(data.finance, withTaxes))}><DownloadIcon />Exportar todo a CSV</CommandItem>
          <CommandItem onSelect={() => run(() => load(undefined, { quiet: false }).catch(() => {}))}><RefreshCwIcon />Actualizar datos</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ir a">
          {[['/', 'Resumen ejecutivo', <LayoutDashboardIcon key="i" />], ['/atencion', 'Atención', <InboxIcon key="i" />], ['/calendario', 'Calendario', <CalendarDaysIcon key="i" />], ['/eventos', 'Eventos', <TicketIcon key="i" />], ['/finanzas', 'Finanzas', <WalletIcon key="i" />], ['/finanzas/datos', 'Datos financieros', <SlidersHorizontalIcon key="i" />], ['/actividad', 'Registro de actividad', <HistoryIcon key="i" />]].map(([to, l, icon]) => (
            <CommandItem key={to} value={`ir ${l}`} onSelect={() => run(() => navigate(to))}>{icon}{l}</CommandItem>
          ))}
          {brands.map((b) => <CommandItem key={b.id} value={`marca ${b.name}`} onSelect={() => run(() => navigate(`/marcas/${b.id}`))}><BrandTile id={b.id} size="xs" />{b.name}</CommandItem>)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Espacio de trabajo">
          <CommandItem value="espacio todo el grupo" onSelect={() => run(() => setWorkspace('group'))}><Building2Icon />Todo el grupo</CommandItem>
          {brands.map((b) => <CommandItem key={b.id} value={`espacio ${b.name}`} onSelect={() => run(() => setWorkspace(b.id))}><BrandTile id={b.id} size="xs" />Cambiar a {b.name}</CommandItem>)}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Eventos">
          {events.map((e) => (
            <CommandItem key={e.id} value={`${e.name} ${fmtDay(e.date)} ${e.venue || ''} ${e.id}`} onSelect={() => run(() => setDrawer({ type: 'event', id: e.id }))}>
              <BrandTile id={e.brand} size="xs" /><span className="flex-1 truncate">{e.name} <span className="text-muted-foreground">· {fmtDay(e.date)}</span></span><StageBadge stage={e.stage} stages={data.os.stages} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
const Kbd = ({ children }) => <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px] text-muted-foreground">{children}</kbd>;

// Título de cada ruta para la ruta de migas (handle.crumb en el router).
function useCrumbs() {
  const matches = useMatches();
  const { data } = useOS();
  const out = [{ label: 'Paradisio OS', to: '/' }];
  matches.forEach((m) => {
    const c = m.handle && m.handle.crumb;
    if (!c) return;
    const label = typeof c === 'function' ? c(m.params, data) : c;
    if (label) out.push({ label, to: m.pathname });
  });
  return out;
}

export default function Shell() {
  const os = useOS();
  const { data, loading, setCmd, setCreating, withTaxes, setWithTaxes, drawer, setDrawer, theme, setTheme, toast, logout, load, workspace } = os;
  const navigate = useNavigate();
  const location = useLocation();
  const crumbs = useCrumbs();
  useKeypress({ combo: ['meta+k', 'ctrl+k'], callback: () => setCmd((v) => !v), enableOnInputs: true });
  useKeypress({ combo: 'c', callback: () => setCreating(true) });
  useEffect(() => { window.scrollTo({ top: 0 }); }, [location.pathname]);

  const brands = data.finance.brands || [];
  const scopeAttention = data.os.attention.filter((a) => workspace === 'group' || !a.event || (data.finance.events.find((e) => e.id === a.event) || {}).brand === workspace);
  const upcoming = data.os.summary.events.filter((f) => f.kind !== 'cancelled' && f.daysTo >= 0 && (workspace === 'group' || f.brand === workspace));
  const next = upcoming[0];
  const updated = new Date(data.generatedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });

  const navGroups = [
    { label: 'Espacio de trabajo', items: [
      { to: '/', title: 'Resumen ejecutivo', icon: <LayoutDashboardIcon />, end: true },
      { to: '/atencion', title: 'Atención', icon: <InboxIcon />, badge: scopeAttention.length || null },
      { to: '/calendario', title: 'Calendario', icon: <CalendarDaysIcon /> },
    ] },
    { label: 'Negocio', collapsible: true, items: [
      { to: '/eventos', title: 'Eventos', icon: <TicketIcon /> },
      { to: '/finanzas', title: 'Finanzas', icon: <WalletIcon />, end: true, match: ['/finanzas/datos'] },
    ] },
    { label: 'Marcas', collapsible: true, items: brands.map((b) => ({ to: `/marcas/${b.id}`, title: b.name, icon: <BrandTile id={b.id} size="xs" className="size-4!" /> })) },
    { label: 'Sistema', collapsible: true, items: [{ to: '/actividad', title: 'Registro de actividad', icon: <HistoryIcon /> }] },
  ];

  const openAttention = (a) => (a.event ? setDrawer({ type: 'event', id: a.event }) : navigate(a.route || '/atencion'));

  return (
    <>
      <AppShell
        crumbs={crumbs}
        navGroups={navGroups}
        switcher={<WorkspaceSwitcher brands={brands} />}
        onSearch={() => setCmd(true)}
        sidebarNote={next && (
          <button type="button" onClick={() => setDrawer({ type: 'event', id: next.id })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:border-ring">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><CalendarDaysIcon className="size-3.5" />Próximo evento · {relDays(next.daysTo)}</p>
            <p className="mt-1 flex items-center gap-2 text-xs font-medium"><BrandTile id={next.brand} size="xs" /><span className="truncate">{next.name}</span></p>
            <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">{fmtDay(next.date)} · {next.venue || 'local por confirmar'}</p>
          </button>
        )}
        sidebarFooter={
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} tooltip={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} className="text-[13px] text-muted-foreground">
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}<span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        }
        headerActions={(
          <>
            <div className="hidden items-center gap-2 lg:flex" title="Incluir IGV y renta en los costos">
              <Switch id="taxes" checked={withTaxes} onCheckedChange={setWithTaxes} />
              <Label htmlFor="taxes" className="text-[12px] font-normal text-muted-foreground">{withTaxes ? 'Con impuestos' : 'Sin impuestos'}</Label>
            </div>
            <span className="hidden text-[11px] text-muted-foreground xl:inline" title="Última sincronización">Sincronizado {updated}</span>
            <Button variant="outline" size="icon-sm" onClick={() => load(undefined, { quiet: false }).catch(() => {})} aria-label="Actualizar" title="Actualizar"><RefreshCwIcon className={cn(loading && 'animate-spin')} /></Button>
            <Notifications items={scopeAttention} onOpen={openAttention} />
            <Button size="sm" onClick={() => setCreating(true)} className="h-8"><PlusIcon /><span className="hidden sm:inline">Nuevo</span></Button>
          </>
        )}
        user={<NavUser staff={data.usingStaffPasscode} onExport={() => exportCsv(data.finance, withTaxes)} onRefresh={() => load(undefined, { quiet: false }).catch(() => {})} onEdit={() => navigate('/finanzas/datos')} onLogout={logout} />}
      >
        <Outlet />
      </AppShell>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
          {drawer?.type === 'event' && <EventDrawer id={drawer.id} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'metric' && <MetricDrawer id={drawer.id} summary={drawer.summary} onClose={() => setDrawer(null)} />}
        </SheetContent>
      </Sheet>
      <QuickCreate />
      <Palette />
      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} role="status" className="fixed bottom-6 right-6 z-[60] max-w-sm rounded-lg border bg-popover px-3.5 py-2 text-sm text-popover-foreground shadow-xl">{toast}</motion.div>}
      </AnimatePresence>
    </>
  );
}
