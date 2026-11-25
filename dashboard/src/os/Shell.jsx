import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useMatches } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboardIcon, InboxIcon, CalendarDaysIcon, TicketIcon, WalletIcon, HistoryIcon, PlusIcon, BellIcon,
  RefreshCwIcon, DownloadIcon, ReceiptIcon, MoonIcon, SunIcon, ChevronsUpDownIcon, CheckIcon, Building2Icon, ExternalLinkIcon, SlidersHorizontalIcon, TriangleAlertIcon, PackageIcon, ArrowLeftRightIcon, CalculatorIcon, CopyIcon, ListTodoIcon, ShoppingBagIcon, MegaphoneIcon, WrenchIcon, UserPlusIcon, SparklesIcon, HandshakeIcon, UsersIcon, ContactIcon, FileTextIcon, RadioIcon, LineChartIcon, PlugIcon,
} from 'lucide-react';
import Frame, { BrandSwitch, Notifications, AccountMenu, NextEventNote } from './Frame.jsx';
import { PageTransition } from './motion.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useKeypress } from '@/hooks/use-keypress';
import { useOS } from './store.jsx';
import { TxForm, AccountForm, ProductForm, MoveForm, ContactForm, TaskForm, ContentForm, CampaignForm, AssetForm, DealForm, DocumentForm } from './forms.jsx';
import { StageBadge, BrandDot, fmtDay, fmtDayYear, relDays, Unavailable, moneyOrNA } from './kit.jsx';
import { BrandTile, KindTag } from '../ui.jsx';
import { cn, money, pct, isActual, totals, limaISO, brandColor } from '../lib.js';

export { sel, Field } from './kit.jsx';
import { sel, Field } from './kit.jsx';

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
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'tx' }))}><ArrowLeftRightIcon />Nueva transacción<Kbd>T</Kbd></CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'move' }))}><PackageIcon />Movimiento de inventario</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'task' }))}><ListTodoIcon />Nueva tarea</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'contact' }))}><UserPlusIcon />Nuevo contacto</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'content' }))}><SparklesIcon />Nuevo contenido</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'campaign' }))}><SparklesIcon />Nueva campaña</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'deal' }))}><HandshakeIcon />Nuevo sponsor</CommandItem>
          <CommandItem onSelect={() => run(() => setDrawer({ type: 'document' }))}><FileTextIcon />Nuevo documento</CommandItem>
          <CommandItem onSelect={() => run(() => setWithTaxes(!withTaxes))}><ReceiptIcon />{withTaxes ? 'Ver sin IGV ni renta' : 'Ver con IGV y renta'}</CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</CommandItem>
          <CommandItem onSelect={() => run(() => exportCsv(data.finance, withTaxes))}><DownloadIcon />Exportar todo a CSV</CommandItem>
          <CommandItem onSelect={() => run(() => load(undefined, { quiet: false }).catch(() => {}))}><RefreshCwIcon />Actualizar datos</CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ir a">
          {[['/', 'Resumen ejecutivo', <LayoutDashboardIcon key="i" />], ['/atencion', 'Atención', <InboxIcon key="i" />], ['/calendario', 'Calendario', <CalendarDaysIcon key="i" />], ['/eventos', 'Eventos', <TicketIcon key="i" />], ['/finanzas', 'Finanzas', <WalletIcon key="i" />], ['/finanzas/transacciones', 'Transacciones', <ArrowLeftRightIcon key="i" />], ['/finanzas/cuentas', 'Cuentas', <WalletIcon key="i" />], ['/finanzas/por-pagar', 'Por pagar y por cobrar', <WalletIcon key="i" />], ['/finanzas/flujo', 'Flujo de caja', <WalletIcon key="i" />], ['/finanzas/presupuestos', 'Presupuestos', <WalletIcon key="i" />], ['/finanzas/simulador', 'Simulador de rentabilidad', <CalculatorIcon key="i" />], ['/finanzas/datos', 'Datos de eventos', <SlidersHorizontalIcon key="i" />], ['/inventario', 'Inventario y barra', <PackageIcon key="i" />], ['/ventas', 'Ventas y reservas', <ShoppingBagIcon key="i" />], ['/promotores', 'Promotores', <MegaphoneIcon key="i" />], ['/operaciones', 'Operaciones y proveedores', <WrenchIcon key="i" />], ['/tareas', 'Mis tareas', <ListTodoIcon key="i" />], ['/en-vivo', 'En vivo (día del evento)', <RadioIcon key="i" />], ['/analitica', 'Analítica', <LineChartIcon key="i" />], ['/integraciones', 'Integraciones', <PlugIcon key="i" />], ['/marketing', 'Marketing y contenido', <SparklesIcon key="i" />], ['/sponsors', 'Sponsors y alianzas', <HandshakeIcon key="i" />], ['/audiencia', 'Audiencia (CRM)', <ContactIcon key="i" />], ['/equipo', 'Equipo', <UsersIcon key="i" />], ['/documentos', 'Documentos', <FileTextIcon key="i" />], ['/actividad', 'Registro de actividad', <HistoryIcon key="i" />]].map(([to, l, icon]) => (
            <CommandItem key={to} value={`ir ${l}`} onSelect={() => run(() => navigate(to))}>{icon}{l}</CommandItem>
          ))}
          <CommandItem value="marcas comparativo" onSelect={() => run(() => navigate('/marcas'))}><Building2Icon />Comparativo de marcas</CommandItem>
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
  const out = [];
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
  const { data, loading, setCmd, setCreating, withTaxes, setWithTaxes, drawer, setDrawer, theme, setTheme, toast, logout, load, workspace, setWorkspace } = os;
  const navigate = useNavigate();
  const location = useLocation();
  const crumbs = useCrumbs();
  const mainRef = useRef(null);
  useKeypress({ combo: ['meta+k', 'ctrl+k'], callback: () => setCmd((v) => !v), enableOnInputs: true });
  useKeypress({ combo: 'c', callback: () => setCreating(true) });
  useKeypress({ combo: 't', callback: () => setDrawer({ type: 'tx' }) });
  useKeypress({ combo: 'shift+d', callback: () => setTheme(theme === 'dark' ? 'light' : 'dark') });
  // Atajos de marca: 0 grupo, 1 Club, 2 Beats, 3 Icon.
  const brands = data.finance.brands || [];
  useKeypress({ combo: ['0', '1', '2', '3'], callback: (e) => { const i = Number(e.key); setWorkspace(i === 0 ? 'group' : (brands[i - 1] || {}).id || workspace); } });
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [location.pathname]);

  const scopeAttention = data.os.attention.filter((a) => workspace === 'group' || !a.event || (data.finance.events.find((e) => e.id === a.event) || {}).brand === workspace);
  const upcoming = data.os.summary.events.filter((f) => f.kind !== 'cancelled' && f.daysTo >= 0 && (workspace === 'group' || f.brand === workspace));
  const next = upcoming[0];
  const updated = new Date(data.generatedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  const overdue = data.os.ledgerSummary.payables.overdue;

  const navGroups = [
    { label: 'Espacio de trabajo', items: [
      { to: '/', title: 'Resumen ejecutivo', icon: <LayoutDashboardIcon />, end: true },
      { to: '/atencion', title: 'Atención', icon: <InboxIcon />, badge: scopeAttention.length || null },
      { to: '/calendario', title: 'Calendario', icon: <CalendarDaysIcon /> },
      { to: '/en-vivo', title: 'En vivo', icon: <RadioIcon />, badge: data.finance.events.some((e) => e.date === limaISO() && e.stage !== 'cancelled') ? 'hoy' : null, badgeTone: 'bad' },
      { to: '/tareas', title: 'Mis tareas', icon: <ListTodoIcon />, badge: (data.os.tasks || []).filter((t) => t.overdue).length || null },
    ] },
    { label: 'Negocio', collapsible: true, items: [
      { to: '/eventos', title: 'Eventos', icon: <TicketIcon /> },
      { to: '/finanzas', title: 'Finanzas', icon: <WalletIcon />, end: true, match: ['/finanzas/transacciones', '/finanzas/cuentas', '/finanzas/por-pagar', '/finanzas/flujo', '/finanzas/presupuestos', '/finanzas/simulador', '/finanzas/datos'], badge: overdue || null, badgeTone: 'bad' },
      { to: '/ventas', title: 'Ventas y reservas', icon: <ShoppingBagIcon /> },
      { to: '/promotores', title: 'Promotores', icon: <MegaphoneIcon /> },
      { to: '/inventario', title: 'Inventario y barra', icon: <PackageIcon />, badge: data.os.inventorySummary.low.length || null },
      { to: '/operaciones', title: 'Operaciones', icon: <WrenchIcon /> },
      { to: '/analitica', title: 'Analítica', icon: <LineChartIcon /> },
    ] },
    { label: 'Comercial', collapsible: true, items: [
      { to: '/marketing', title: 'Marketing y contenido', icon: <SparklesIcon /> },
      { to: '/sponsors', title: 'Sponsors y alianzas', icon: <HandshakeIcon /> },
      { to: '/audiencia', title: 'Audiencia', icon: <ContactIcon /> },
    ] },
    { label: 'Organización', collapsible: true, items: [
      { to: '/equipo', title: 'Equipo', icon: <UsersIcon /> },
      { to: '/documentos', title: 'Documentos', icon: <FileTextIcon /> },
    ] },
    { label: 'Marcas', collapsible: true, items: [
      { to: '/marcas', title: 'Comparativo', icon: <Building2Icon />, end: true },
      ...brands.map((b) => ({ to: `/marcas/${b.id}`, title: b.name, icon: <BrandTile id={b.id} size="xs" className="size-4! rounded-[4px]" />, badge: (data.os.brands && data.os.brands[b.id] && !data.os.brands[b.id].events.done) ? 'nueva' : null })),
    ] },
    { label: 'Sistema', collapsible: true, items: [
      { to: '/integraciones', title: 'Integraciones', icon: <PlugIcon />, badge: (data.os.integrations || []).some((i) => i.status === 'error') ? '!' : null, badgeTone: 'bad' },
      { to: '/actividad', title: 'Registro de actividad', icon: <HistoryIcon /> },
    ] },
  ];

  // El selector de marca filtra las secciones generales; no aplica en la página de una marca ni en el detalle de un evento.
  const showBrandSwitch = !/^\/(marcas|eventos\/[^/]+|finanzas\/datos)/.test(location.pathname);
  const brandCounts = Object.fromEntries(brands.map((b) => [b.id, data.os.brands && data.os.brands[b.id] ? data.os.brands[b.id].events.done : null]));
  const openAttention = (a) => (a.event ? setDrawer({ type: 'event', id: a.event }) : navigate(a.route || '/atencion'));
  const refresh = () => load(undefined, { quiet: false }).catch(() => {});

  return (
    <>
      <Frame
        groups={navGroups}
        crumbs={crumbs}
        mainRef={mainRef}
        onSearch={() => setCmd(true)}
        brandSwitch={showBrandSwitch && <BrandSwitch value={workspace} onChange={setWorkspace} brands={brands} counts={brandCounts} />}
        note={next && <NextEventNote ev={next} dayLabel={fmtDay(next.date).replace(/^(\S+) (\d+).*/, '$1 $2')} rel={relDays(next.daysTo)} onOpen={() => setDrawer({ type: 'event', id: next.id })} />}
        account={(collapsed) => (
          <AccountMenu collapsed={collapsed} staff={data.usingStaffPasscode} theme={theme} onTheme={setTheme} withTaxes={withTaxes} onTaxes={setWithTaxes}
            onExport={() => exportCsv(data.finance, withTaxes)} onRefresh={refresh} onEdit={() => navigate('/finanzas/datos')} onLogout={logout} />
        )}
        actions={(
          <>
            <button type="button" onClick={refresh} title={`Sincronizado ${updated}. Clic para actualizar.`}
              className="press hidden h-8 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-black/5 hover:text-foreground xl:flex dark:hover:bg-white/5">
              <span className={cn('size-1.5 rounded-full', loading ? 'animate-pulse bg-warn' : 'bg-good')} />{loading ? 'Sincronizando' : updated}
            </button>
            <button type="button" onClick={refresh} aria-label="Actualizar" className="press flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 hover:text-foreground xl:hidden dark:hover:bg-white/5"><RefreshCwIcon className={cn('size-4', loading && 'animate-spin')} /></button>
            <button type="button" onClick={() => setWithTaxes(!withTaxes)} aria-pressed={withTaxes} title="Incluir IGV y renta en los costos"
              className={cn('press hidden h-8 items-center gap-1.5 rounded-md px-2 text-[12px] transition-colors lg:flex', withTaxes ? 'text-foreground hover:bg-black/5 dark:hover:bg-white/5' : 'text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5')}>
              <ReceiptIcon className="size-3.5" />{withTaxes ? 'Con IGV' : 'Sin IGV'}
            </button>
            <Notifications items={scopeAttention} onOpen={openAttention} onAction={(a) => navigate(`/finanzas/datos?evento=${a.event}`)} onSeeAll={() => navigate('/atencion')} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="sm" className="ml-1 h-8 gap-1.5 px-2.5"><PlusIcon /><span className="hidden sm:inline">Nuevo</span></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                <DropdownMenuItem onSelect={() => setCreating(true)}><TicketIcon />Evento<Kbd>C</Kbd></DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'tx' })}><ArrowLeftRightIcon />Transacción<Kbd>T</Kbd></DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'move' })}><PackageIcon />Movimiento de inventario</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'task' })}><ListTodoIcon />Tarea</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'contact' })}><UserPlusIcon />Contacto</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'content' })}><SparklesIcon />Contenido</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'deal' })}><HandshakeIcon />Sponsor</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'document' })}><FileTextIcon />Documento</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'account' })}><WalletIcon />Cuenta</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setDrawer({ type: 'product' })}><PackageIcon />Producto</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      >
        <PageTransition id={location.pathname} className="flex min-h-full flex-col p-4 md:p-6">
          <Outlet />
        </PageTransition>
      </Frame>

      <Sheet open={!!drawer} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[460px]">
          {drawer?.type === 'event' && <EventDrawer id={drawer.id} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'metric' && <MetricDrawer id={drawer.id} summary={drawer.summary} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'tx' && <TxForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'account' && <AccountForm key={drawer.id || 'new'} id={drawer.id} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'product' && <ProductForm key={drawer.id || 'new'} id={drawer.id} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'move' && <MoveForm key="mv" preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'contact' && <ContactForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'content' && <ContentForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'campaign' && <CampaignForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'asset' && <AssetForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'deal' && <DealForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'document' && <DocumentForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
          {drawer?.type === 'task' && <TaskForm key={drawer.id || 'new'} id={drawer.id} preset={drawer.preset} onClose={() => setDrawer(null)} />}
        </SheetContent>
      </Sheet>
      <QuickCreate />
      <Palette />
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.98 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            role="status" className="fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-2.5 rounded-lg bg-foreground px-3.5 py-2.5 text-[13px] text-background shadow-xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
