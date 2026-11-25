import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, ListIcon, KanbanIcon, CalendarDaysIcon, MoreHorizontalIcon, PlusIcon, SearchIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useOS } from '../os/store.jsx';
import { PageHeader, StageBadge, BrandDot, Unavailable, fmtDay, relDays, MONTHS_LONG } from '../os/kit.jsx';
import { sel } from '../os/Shell.jsx';
import { Panel, BrandTile } from '../ui.jsx';
import { cn, money, brandColor, limaISO, parseDate, totals, byCategory } from '../lib.js';
import DataTable from '../os/DataTable.jsx';
import { MiniLines } from './overview/widgets.jsx';

const VIEWS = [{ id: 'lista', label: 'Lista', icon: ListIcon }, { id: 'tablero', label: 'Tablero', icon: KanbanIcon }, { id: 'calendario', label: 'Calendario', icon: CalendarDaysIcon }];

export default function Events({ fixedView }) {
  const { data, workspace, setDrawer, setCreating } = useOS();
  const [params, setParams] = useSearchParams();
  const view = fixedView || params.get('vista') || 'lista';
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('all');
  const stages = data.os.stages;
  const fin = data.os.summary.events;
  const rows = useMemo(() => fin.filter((f) => (workspace === 'group' || f.brand === workspace)
    && (stage === 'all' || (stage === 'active' ? !['closed', 'cancelled'].includes(f.stage) : f.stage === stage))
    && (!q || `${f.name} ${f.venue} ${f.date}`.toLowerCase().includes(q.toLowerCase()))), [fin, workspace, stage, q]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={view === 'calendario' && fixedView ? 'Calendario' : 'Eventos'} description={`${rows.length} de ${fin.length} eventos${workspace !== 'group' ? ` · ${data.finance.brands.find((b) => b.id === workspace)?.name}` : ''}`}
        actions={<>
          {!fixedView && (
            <Tabs value={view} onValueChange={(v) => setParams((p) => { p.set('vista', v); return p; })}>
              <TabsList className="h-8">{VIEWS.map((v) => <TabsTrigger key={v.id} value={v.id} className="text-[12px]"><v.icon />{v.label}</TabsTrigger>)}</TabsList>
            </Tabs>
          )}
          <Button size="sm" onClick={() => setCreating(true)}><PlusIcon />Nuevo evento</Button>
        </>} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar evento, local o fecha" className="h-8 pl-8 text-[13px]" />
        </div>
        <select aria-label="Etapa" className={cn(sel, 'h-8 w-auto text-[13px]')} value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="all">Todas las etapas</option>
          <option value="active">Activos (sin cerrados ni cancelados)</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {(q || stage !== 'all') && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setStage('all'); }}>Limpiar filtros</Button>}
      </div>

      {view === 'lista' && <ListView rows={rows} stages={stages} onOpen={(id) => setDrawer({ type: 'event', id })} brands={data.finance.brands} />}
      {view === 'tablero' && <BoardView rows={rows} stages={stages} onOpen={(id) => setDrawer({ type: 'event', id })} />}
      {view === 'calendario' && <CalendarView rows={rows} onOpen={(id) => setDrawer({ type: 'event', id })} />}
    </div>
  );
}

// Lista: tabla compartida con filtros por etapa y marca, detalle desplegable y acciones por fila.
function ListView({ rows, stages, onOpen, brands }) {
  const { data, withTaxes } = useOS();
  const navigate = useNavigate();
  const stageName = (id) => stages.find((s) => s.id === id)?.label || id;
  const brandName = (id) => brands.find((b) => b.id === id)?.name || id;
  return (
    <Panel>
      <DataTable id="events-list" rows={rows} searchable={false} initialSort={{ key: 'date', dir: -1 }} csvName="eventos"
        rowClassName={(f) => cn(f.kind === 'budget' && 'border-dashed', f.kind === 'cancelled' && 'opacity-50')}
        empty="Ningún evento coincide con los filtros."
        rowActions={(f) => [
          { label: 'Revisar en panel', onSelect: () => onOpen(f.id) },
          { label: 'Abrir evento', onSelect: () => navigate(`/eventos/${f.id}`) },
          { label: 'Editar números', onSelect: () => navigate(`/finanzas/datos?evento=${f.id}`) },
        ]}
        expand={(f) => {
          const ev = data.finance.events.find((e) => e.id === f.id);
          if (!ev) return null;
          const tt = totals(ev, withTaxes);
          return (
            <div className="grid gap-5 md:grid-cols-3">
              <MiniLines title={f.kind === 'actual' ? 'Ingresos' : 'Ingresos proyectados'} lines={(ev.income || []).map((l) => ({ key: l.label, value: Number(l.amount) || 0 }))} />
              <MiniLines title={f.kind === 'actual' ? 'Costos por categoría' : 'Costos proyectados'} lines={byCategory(tt.costs).map((c) => ({ key: c.name, value: c.value }))} />
              <div className="text-[12px]">
                <p className="mb-1.5 text-[11.5px] text-muted-foreground">Avisos</p>
                {f.warnings.length ? <ul className="space-y-1">{f.warnings.map((w, i) => <li key={i} className="flex gap-2 text-muted-foreground"><i className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', w.level === 'warn' ? 'bg-warn' : 'bg-faint')} />{w.text}</li>)}</ul> : <p className="text-muted-foreground">Sin avisos.</p>}
                <div className="mt-3 flex gap-3"><button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => onOpen(f.id)}>Revisar</button><button type="button" className="font-medium underline-offset-4 hover:underline" onClick={() => navigate(`/eventos/${f.id}`)}>Abrir evento</button></div>
              </div>
            </div>
          );
        }}
        columns={[
          { key: 'date', label: 'Fecha', get: (f) => f.date, render: (f) => <span className="num whitespace-nowrap">{fmtDay(f.date)}<span className="block text-[11px] text-muted-foreground">{relDays(f.daysTo)}</span></span> },
          { key: 'name', label: 'Evento', get: (f) => f.name, render: (f) => <span className="flex items-center gap-2.5"><i className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: brandColor(f.brand) }} /><span className="min-w-0"><span className="block max-w-[320px] truncate font-medium">{f.name}</span><span className="block text-[11px] text-muted-foreground">{f.venue || 'Local por confirmar'}</span></span>{f.warnings.some((w) => w.level === 'warn') && <TriangleAlertIcon className="size-3.5 shrink-0 text-warn" />}</span> },
          { key: 'brand', label: 'Marca', facet: true, hidden: true, get: (f) => brandName(f.brand) },
          { key: 'stage', label: 'Etapa', get: (f) => stageName(f.stage), render: (f) => <StageBadge stage={f.stage} stages={stages} /> },
          { key: 'kind', label: 'Tipo', facet: true, hidden: true, get: (f) => (f.kind === 'actual' ? 'Real' : f.kind === 'budget' ? 'Proyectado' : 'Cancelado') },
          { key: 'revenue', label: 'Ingresos', num: true, get: (f) => (f.hasIncome ? f.revenue : null), render: (f) => (f.hasIncome ? <span className={f.kind === 'budget' ? 'text-foreground/70' : ''}>{money(f.revenue)}</span> : <Unavailable />) },
          { key: 'costs', label: 'Costos', num: true, get: (f) => (f.hasCosts ? f.costs : null), render: (f) => (f.hasCosts ? <span className={f.kind === 'budget' ? 'text-foreground/70' : 'text-muted-foreground'}>{money(f.costs)}</span> : <Unavailable />) },
          { key: 'result', label: 'Resultado / utilidad', num: true, get: (f) => f.result, render: (f) => (f.result == null ? (f.kind === 'cancelled' ? '—' : <span className="text-[12px] text-proj">Incompleto</span>) : <span className={f.result >= 0 ? 'text-good' : 'text-bad'}>{money(f.result)}{f.kind === 'budget' && <span className="ml-1 text-[10px] text-proj">proy.</span>}</span>) },
        ]} />
    </Panel>
  );
}

function BoardView({ rows, stages, onOpen }) {
  const { updateEvent } = useOS();
  return (
    <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
      {stages.map((s) => {
        const items = rows.filter((f) => f.stage === s.id).sort((a, b) => a.date.localeCompare(b.date));
        return (
          <div key={s.id} className="flex w-[248px] shrink-0 flex-col rounded-lg bg-surface">
            <div className="flex items-center justify-between px-2.5 py-2"><StageBadge stage={s.id} stages={stages} /><span className="text-[12px] text-muted-foreground">{items.length}</span></div>
            <div className="flex min-h-24 flex-col gap-1.5 p-1.5">
              {items.map((f) => (
                <div key={f.id} className={cn('group relative rounded-md border bg-card p-2.5 pl-3.5 text-left transition-colors hover:border-ring/60', f.kind === 'budget' && 'border-dashed')}>
                  <i className="absolute inset-y-2.5 left-1.5 w-[2px] rounded-full" style={{ background: brandColor(f.brand) }} />
                  <div className="flex items-start gap-1">
                    <button type="button" onClick={() => onOpen(f.id)} className="min-w-0 flex-1 text-left">
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug">{f.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><BrandDot id={f.brand} />{fmtDay(f.date)} · {relDays(f.daysTo)}</p>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="size-6 shrink-0 text-muted-foreground" aria-label="Mover a otra etapa"><MoreHorizontalIcon /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Mover a</DropdownMenuLabel>
                        {stages.filter((x) => x.id !== f.stage).map((x) => <DropdownMenuItem key={x.id} onSelect={() => updateEvent(f.id, { stage: x.id }, `Movido a ${x.label}`).catch(() => {})}>{x.label}</DropdownMenuItem>)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="mono mt-1.5 text-[12px]">{f.result != null ? <span className={f.result >= 0 ? 'text-good' : 'text-bad'}>{money(f.result)}{f.kind === 'budget' && <span className="ml-1 text-[10px] text-proj">proy.</span>}</span> : f.hasIncome ? <span className="text-muted-foreground">{money(f.revenue)} ingreso · <span className="text-proj">incompleto</span></span> : <span className="text-muted-foreground">Sin números</span>}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({ rows, onOpen }) {
  const t = parseDate(limaISO());
  const [cur, setCur] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const first = new Date(cur.y, cur.m, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes primero
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDow + days) / 7) * 7 }, (_, i) => i - startDow + 1);
  const iso = (d) => `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shift = (n) => setCur(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const todayIso = limaISO();
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h3 className="text-[14px] font-medium capitalize">{MONTHS_LONG[cur.m]} {cur.y}</h3>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCur({ y: t.getFullYear(), m: t.getMonth() })}>Hoy</Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Mes anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Mes siguiente"><ChevronRightIcon /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b text-[11px] text-muted-foreground">{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d >= 1 && d <= days;
          const evs = inMonth ? rows.filter((f) => f.date === iso(d)) : [];
          return (
            <div key={i} className={cn('min-h-[92px] border-b border-r p-1 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-muted/40')}>
              {inMonth && <span className={cn('inline-flex size-5 items-center justify-center rounded-full text-[11px]', iso(d) === todayIso ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{d}</span>}
              <div className="mt-0.5 flex flex-col gap-0.5">
                {evs.map((f) => (
                  <button key={f.id} type="button" onClick={() => onOpen(f.id)} title={f.name}
                    className={cn('truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium', f.kind === 'budget' ? 'border border-dashed' : 'text-white', f.kind === 'cancelled' && 'line-through opacity-50')}
                    style={f.kind === 'budget' ? { borderColor: brandColor(f.brand), color: brandColor(f.brand) } : { background: brandColor(f.brand) }}>
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">Relleno = evento con números reales · borde punteado = presupuesto.</p>
    </Panel>
  );
}
