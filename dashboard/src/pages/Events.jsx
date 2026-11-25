import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { cn, money, brandColor, limaISO, parseDate } from '../lib.js';

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

const COLS = [
  { key: 'date', label: 'Fecha', get: (f) => f.date },
  { key: 'name', label: 'Evento', get: (f) => f.name.toLowerCase() },
  { key: 'stage', label: 'Etapa', get: (f) => f.stage },
  { key: 'revenue', label: 'Ingresos', get: (f) => f.revenue, num: true },
  { key: 'costs', label: 'Costos', get: (f) => (f.hasCosts ? f.costs : -Infinity), num: true },
  { key: 'result', label: 'Resultado / utilidad', get: (f) => (f.result == null ? -Infinity : f.result), num: true },
];

function ListView({ rows, stages, onOpen, brands }) {
  const [sort, setSort] = useState({ key: 'date', dir: -1 });
  const [page, setPage] = useState(0);
  const PER = 25;
  const sorted = rows.slice().sort((a, b) => { const c = COLS.find((x) => x.key === sort.key); const va = c.get(a), vb = c.get(b); return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir; });
  const shown = sorted.slice(page * PER, page * PER + PER);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  const csv = () => {
    const out = [['Fecha', 'Marca', 'Evento', 'Local', 'Etapa', 'Tipo', 'Ingresos', 'Costos', 'Resultado']].concat(sorted.map((f) => [f.date, brands.find((b) => b.id === f.brand)?.name, f.name, f.venue, stages.find((s) => s.id === f.stage)?.label, f.kind === 'actual' ? 'Real' : f.kind === 'budget' ? 'Proyectado' : 'Cancelado', f.revenue, f.hasCosts ? f.costs : '', f.result ?? '']));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `eventos-${limaISO()}.csv`; a.click();
  };
  return (
    <Panel>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]">
            {COLS.map((c, i) => (
              <TableHead key={c.key} className={cn(i === 0 && 'pl-4', c.num && 'text-end')}>
                <button type="button" className={cn('inline-flex items-center gap-1 hover:text-foreground', c.num && 'flex-row-reverse')} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : c.num ? -1 : 1 }))}>
                  {c.label}{sort.key === c.key && (sort.dir > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                </button>
              </TableHead>
            ))}
            <TableHead className="w-10 pr-4 text-end"><Button variant="ghost" size="icon-sm" onClick={csv} title="Exportar CSV" aria-label="Exportar CSV"><DownloadIcon /></Button></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 && <TableRow><TableCell colSpan={7} className="px-4 py-8 text-[13px] text-muted-foreground">Ningún evento coincide con los filtros.</TableCell></TableRow>}
          {shown.map((f) => {
            const proj = f.kind === 'budget';
            return (
              <TableRow key={f.id} className={cn('cursor-pointer text-[13px]', proj && 'border-dashed', f.kind === 'cancelled' && 'opacity-50')} onClick={() => onOpen(f.id)}>
                <TableCell className="pl-4"><span className="mono">{fmtDay(f.date)}</span><span className="block text-[11px] text-muted-foreground">{relDays(f.daysTo)}</span></TableCell>
                <TableCell><span className="flex items-center gap-2"><BrandTile id={f.brand} size="xs" /><span className="min-w-0"><span className="block max-w-[320px] truncate font-medium">{f.name}</span><span className="block text-[11px] text-muted-foreground">{f.venue || 'Local por confirmar'}</span></span>{f.warnings.some((w) => w.level === 'warn') && <TriangleAlertIcon className="size-3.5 shrink-0 text-[#C98500]" />}</span></TableCell>
                <TableCell><StageBadge stage={f.stage} stages={stages} /></TableCell>
                <TableCell className={cn('mono text-end', proj && 'text-foreground/70')}>{f.hasIncome ? money(f.revenue) : <Unavailable />}</TableCell>
                <TableCell className={cn('mono text-end', proj && 'text-foreground/70')}>{f.hasCosts ? money(f.costs) : <Unavailable />}</TableCell>
                <TableCell className={cn('mono text-end', f.result != null && (f.result >= 0 ? 'text-good' : 'text-bad'), proj && 'opacity-80')}>{f.result == null ? (f.kind === 'cancelled' ? '—' : <span className="text-[12px] text-proj">Incompleto</span>) : <>{money(f.result)}{proj && <span className="ml-1 text-[10px] text-proj">proy.</span>}</>}</TableCell>
                <TableCell className="pr-4" />
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-[12px] text-muted-foreground">
          Página {page + 1} de {pages}
          <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Siguiente"><ChevronRightIcon /></Button>
        </div>
      )}
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
          <div key={s.id} className="flex w-[244px] shrink-0 flex-col rounded-lg border bg-background/60">
            <div className="flex items-center justify-between border-b px-2.5 py-2"><StageBadge stage={s.id} stages={stages} /><span className="text-[12px] text-muted-foreground">{items.length}</span></div>
            <div className="flex min-h-24 flex-col gap-1.5 p-1.5">
              {items.map((f) => (
                <div key={f.id} className={cn('group rounded-md border bg-card p-2.5 text-left shadow-xs', f.kind === 'budget' && 'border-dashed')} style={{ boxShadow: `inset 2px 0 0 ${brandColor(f.brand)}` }}>
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
