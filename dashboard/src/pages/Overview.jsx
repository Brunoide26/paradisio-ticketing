import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ArrowRightIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOS, useSummary } from '../os/store.jsx';
import { Kpi, Section, StageBadge, BrandDot, Unavailable, fmtDay, fmtStamp, relDays, moneyOrNA, signTone, PageHeader } from '../os/kit.jsx';
import { sel } from '../os/Shell.jsx';
import { Panel, TooltipBox, BrandTile, KindTag } from '../ui.jsx';
import { cn, money, pct, short, brandColor, limaISO } from '../lib.js';

const PERIODS = [
  { id: 'all', label: 'Todo el historial' },
  { id: 'month', label: 'Este mes' },
  { id: '90d', label: 'Últimos 90 días' },
  { id: 'year', label: 'Este año' },
  { id: 'lastyear', label: 'Año pasado' },
];
function periodRange(id) {
  const t = limaISO(); const y = Number(t.slice(0, 4));
  if (id === 'month') return { from: t.slice(0, 8) + '01', to: t };
  if (id === '90d') { const d = new Date(Date.now() - 90 * 86400000); return { from: limaISO(d), to: t }; }
  if (id === 'year') return { from: `${y}-01-01`, to: t };
  if (id === 'lastyear') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  return { from: null, to: null };
}
const lsGet = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };

export default function Overview() {
  const { data, workspace, setDrawer, withTaxes } = useOS();
  const navigate = useNavigate();
  const [period, setPeriodState] = useState(lsGet('os_period', 'all'));
  const setPeriod = (p) => { setPeriodState(p); try { localStorage.setItem('os_period', p); } catch { /* */ } };
  const brand = workspace === 'group' ? null : workspace;
  const { from, to } = periodRange(period);
  const { summary: S, attention, loading, error } = useSummary({ brand, from, to });
  const brands = data.finance.brands;
  const scopeName = brand ? brands.find((b) => b.id === brand)?.name : 'Paradisio Entertainment Group';
  const metric = (id) => () => setDrawer({ type: 'metric', id, summary: S });

  if (error) return <Panel className="p-6 text-sm">No se pudo calcular el resumen. <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reintentar</Button></Panel>;
  if (!S) return <Skeleton />;
  const A = S.actual, P = S.projected;
  const upcoming = S.events.filter((f) => f.kind === 'budget').sort((a, b) => a.date.localeCompare(b.date));
  const closed = S.events.filter((f) => f.kind === 'actual' && A.events.includes(f.id));
  const activity = (data.os.activity || []).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Resumen ejecutivo"
        description={<>{scopeName} · {PERIODS.find((p) => p.id === period).label.toLowerCase()} · {withTaxes ? 'con' : 'sin'} IGV y renta{loading && ' · calculando…'}</>}
        actions={<select aria-label="Período" className={cn(sel, 'h-8 w-auto text-[13px]')} value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>}
      />

      {/* KPIs: lo real primero y sólido; lo proyectado al final, punteado. */}
      <div className={cn('grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8', loading && 'opacity-60')}>
        <Kpi label="Ingresos reales" value={money(A.revenue)} sub={`${A.count} evento${A.count === 1 ? '' : 's'} cerrado${A.count === 1 ? '' : 's'}`} onClick={metric('revenue')} />
        <Kpi label="Resultado real" value={money(A.result)} tone={signTone(A.result)} sub={A.stock ? `incluye ${money(A.stock)} de stock` : 'sin stock final'} onClick={metric('result')} />
        <Kpi label="Margen" value={pct(A.margin)} tone={signTone(A.margin)} unavailable={A.margin == null ? 'Sin ingresos reales en el período' : null} sub="resultado / ingresos" onClick={metric('margin')} />
        <Kpi label="Caja disponible" unavailable={S.unavailable.cash} sub="falta registrar cuentas" onClick={metric('cash')} />
        <Kpi label="Por pagar" unavailable={S.unavailable.payables} sub="falta registrar pagos" onClick={metric('payables')} />
        <Kpi label="Por cobrar" unavailable={S.unavailable.receivables} sub="falta registrar cobranzas" onClick={metric('receivables')} />
        <Kpi proj label="Ingresos proyectados" value={money(P.revenue)} sub={`${P.count} evento${P.count === 1 ? '' : 's'} por venir`} onClick={metric('projRevenue')} />
        <Kpi proj label="Utilidad proyectada" value={moneyOrNA(P.profit)} unavailable={P.profit == null ? 'Ningún presupuesto tiene costos' : null} tone={signTone(P.profit)}
          sub={P.incomplete.length ? `${P.completeCount} de ${P.count} presupuestos completos` : 'todos los presupuestos completos'} onClick={metric('projProfit')} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <Header title="Resultado por evento" description="Eventos en Liquidación o Cerrados." action={<KindTag real />} />
          <div className="px-2 pb-2 pt-3">
            {closed.length ? <ResultChart events={closed} brands={brands} onPick={(id) => setDrawer({ type: 'event', id })} /> : <p className="px-3 py-10 text-[13px] text-muted-foreground">No hay eventos cerrados en este período.</p>}
          </div>
        </Panel>

        <Panel className="xl:col-span-4">
          <Header title="Requiere atención" description="Calculado con los datos actuales." action={<Button variant="ghost" size="sm" onClick={() => navigate('/atencion')}>Ver todo<ArrowRightIcon /></Button>} />
          <ul className="divide-y">
            {attention.length === 0 && <li className="px-4 py-6 text-[13px] text-muted-foreground">Nada pendiente.</li>}
            {attention.slice(0, 6).map((a, i) => (
              <li key={i}>
                <button type="button" onClick={() => (a.event ? setDrawer({ type: 'event', id: a.event }) : navigate('/atencion'))} className="flex w-full gap-2.5 px-4 py-2.5 text-left hover:bg-muted/60">
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', a.level === 'high' ? 'bg-bad' : a.level === 'med' ? 'bg-[#C98500]' : 'bg-muted-foreground/50')} />
                  <span className="min-w-0"><span className="block text-[13px] font-medium">{a.title}</span><span className="line-clamp-2 block text-[12px] text-muted-foreground">{a.text}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel proj className="xl:col-span-8">
          <Header title="Próximos eventos" description="Presupuestos. No se suman a lo real." action={<KindTag />} />
          <Table>
            <TableHeader><TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]">
              <TableHead className="pl-4">Evento</TableHead><TableHead>Etapa</TableHead><TableHead className="text-end">Ingresos proy.</TableHead><TableHead className="text-end">Costos proy.</TableHead><TableHead className="pr-4 text-end">Utilidad proy.</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {upcoming.length === 0 && <TableRow><TableCell colSpan={5} className="px-4 py-6 text-[13px] text-muted-foreground">No hay eventos por venir.</TableCell></TableRow>}
              {upcoming.map((f) => (
                <TableRow key={f.id} className="cursor-pointer border-dashed border-proj-line/60" onClick={() => setDrawer({ type: 'event', id: f.id })}>
                  <TableCell className="pl-4"><div className="flex items-center gap-2"><BrandTile id={f.brand} size="xs" /><div className="min-w-0"><p className="truncate text-[13px] font-medium">{f.name}</p><p className="text-[11px] text-muted-foreground">{fmtDay(f.date)} · {relDays(f.daysTo)}</p></div></div></TableCell>
                  <TableCell><StageBadge stage={f.stage} stages={data.os.stages} /></TableCell>
                  <TableCell className="mono text-end text-[13px]">{f.hasIncome ? money(f.revenue) : <Unavailable reason="Sin ingresos presupuestados" />}</TableCell>
                  <TableCell className="mono text-end text-[13px]">{f.hasCosts ? money(f.costs) : <Unavailable reason="Sin costos presupuestados" />}</TableCell>
                  <TableCell className={cn('mono pr-4 text-end text-[13px]', f.result != null && (f.result >= 0 ? 'text-good' : 'text-bad'))}>{f.result == null ? <span className="text-[12px] text-proj">Incompleto</span> : money(f.result)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel className="xl:col-span-4">
          <Header title="Portafolio" description="Resultado real por marca en el período." />
          <ul className="divide-y">
            {A.byBrand.map((b) => {
              const br = brands.find((x) => x.id === b.brand);
              const nUp = S.events.filter((f) => f.kind === 'budget' && f.brand === b.brand).length;
              return (
                <li key={b.brand}>
                  <button type="button" onClick={() => navigate(`/marcas/${b.brand}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60" style={{ boxShadow: `inset 2px 0 0 ${brandColor(b.brand)}` }}>
                    <BrandTile id={b.brand} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{br?.name}</span><span className="block text-[11px] text-muted-foreground">{b.count} cerrado{b.count === 1 ? '' : 's'} · {nUp} por venir</span></span>
                    <span className="text-right">
                      {b.count ? <span className={cn('mono block text-[13px] font-medium', b.result >= 0 ? 'text-good' : 'text-bad')}>{money(b.result)}</span> : <Unavailable reason="Sin eventos cerrados" className="text-[12px]" />}
                      {b.count > 0 && <span className="mono block text-[11px] text-muted-foreground">{money(b.revenue)} · {pct(b.margin)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="xl:col-span-8">
          <Header title="Real vs. presupuesto" description="Eventos cerrados que tenían presupuesto aprobado." />
          {S.variance ? (
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]"><TableHead className="pl-4">Evento</TableHead><TableHead className="text-end">Presupuesto</TableHead><TableHead className="text-end">Real</TableHead><TableHead className="pr-4 text-end">Variación</TableHead></TableRow></TableHeader>
              <TableBody>
                {S.variance.events.map((v) => { const f = S.events.find((x) => x.id === v.id); return (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => setDrawer({ type: 'event', id: v.id })}>
                    <TableCell className="pl-4 text-[13px]"><span className="flex items-center gap-2"><BrandDot id={f.brand} />{f.name}</span></TableCell>
                    <TableCell className="mono text-end text-[13px] text-muted-foreground">{money(v.budget)}</TableCell>
                    <TableCell className="mono text-end text-[13px]">{money(v.actual)}</TableCell>
                    <TableCell className={cn('mono pr-4 text-end text-[13px]', v.diff >= 0 ? 'text-good' : 'text-bad')}>{v.diff >= 0 ? '+' : ''}{money(v.diff)}</TableCell>
                  </TableRow>); })}
              </TableBody>
            </Table>
          ) : <p className="px-4 py-6 text-[13px] text-muted-foreground">Todavía no hay comparaciones: los eventos cerrados no tenían presupuesto guardado. Desde ahora, al pasar un evento a Liquidación, su presupuesto queda guardado y aparece aquí.</p>}
        </Panel>

        <Panel className="xl:col-span-4">
          <Header title="Actividad reciente" action={<Button variant="ghost" size="sm" onClick={() => navigate('/actividad')}>Ver todo<ArrowRightIcon /></Button>} />
          <ul className="divide-y">
            {activity.length === 0 && <li className="px-4 py-6 text-[13px] text-muted-foreground">Sin cambios registrados todavía. Cada cambio hecho desde el OS queda aquí.</li>}
            {activity.map((a, i) => <ActivityRow key={i} a={a} onOpen={(id) => setDrawer({ type: 'event', id })} />)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function ActivityRow({ a, onOpen, stages }) {
  const label = { 'event.update': 'Editó', 'event.create': 'Creó', 'finance.save': 'Guardó datos financieros', 'event.numbers': 'Cargó números de' }[a.action] || a.action;
  const money2 = (v) => (typeof v === 'number' ? money(v) : v);
  const ch = a.changes ? Object.entries(a.changes).map(([k, v]) => `${{ stage: 'etapa', name: 'nombre', date: 'fecha', venue: 'local', brand: 'marca', notes: 'notas', openingStock: 'inventario inicial', liveEventId: 'fecha en la web', income: 'ingresos', costs: 'costos', brandInvestment: 'inversión en marca', stockLeft: 'stock final', stock: 'detalle de stock', bar: 'barra' }[k] || k}${k === 'stage' && stages ? `: ${stages.find((s) => s.id === v.to)?.label || v.to}` : ['income', 'costs', 'brandInvestment', 'stockLeft', 'openingStock'].includes(k) ? ` ${money2(v.from)} → ${money2(v.to)}` : ''}`).join(', ') : '';
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
      <span className="min-w-0 flex-1 text-[13px]">
        {label} {a.event ? <button type="button" className="font-medium hover:underline" onClick={() => onOpen(a.event)}>{a.name || a.event}</button> : a.events ? <span className="text-muted-foreground">({a.events} eventos)</span> : null}
        {a.actor === 'claude' && <span className="ml-1.5 rounded border px-1 text-[10px] font-medium text-muted-foreground">Claude</span>}
        {ch && <span className="block text-[12px] text-muted-foreground">{ch}</span>}
        {a.source && <span className="block text-[11px] text-muted-foreground">Fuente: {a.source}</span>}
      </span>
      <span className="shrink-0 text-[11px] text-muted-foreground">{fmtStamp(a.at)}</span>
    </li>
  );
}

function Header({ title, description, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
      <div className="min-w-0"><h3 className="text-[14px] font-medium">{title}</h3>{description && <p className="text-[12px] text-muted-foreground">{description}</p>}</div>
      {action}
    </div>
  );
}
export { Header as PanelBar };

function ResultChart({ events, brands, onPick }) {
  const rows = events.map((f) => ({ id: f.id, name: fmtDay(f.date), f, v: f.result }));
  return (
    <ChartContainer config={{ v: { label: 'Resultado' } }} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={rows} margin={{ left: 4, right: 12 }} barCategoryGap="30%" onClick={(s) => s && s.activePayload && onPick(s.activePayload[0].payload.id)}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={64} domain={[(min) => Math.min(0, min), (max) => Math.max(0, max)]} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={({ active, payload }) => {
          if (!active || !payload || !payload.length) return null; const f = payload[0].payload.f;
          return <TooltipBox title={f.name} rows={[{ label: 'Ingresos', value: money(f.revenue), color: brandColor(f.brand) }, { label: 'Costos', value: money(f.costs) }, { label: 'Resultado', value: money(f.result) }]} foot={`${brands.find((b) => b.id === f.brand)?.name} · margen ${pct(f.margin)}`} />;
        }} />
        <Bar dataKey="v" radius={[3, 3, 3, 3]} maxBarSize={56} isAnimationActive={false} className="cursor-pointer">
          {rows.map((r) => <Cell key={r.id} fill={brandColor(r.f.brand)} fillOpacity={r.v >= 0 ? 1 : 0.55} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-64 animate-pulse rounded-md bg-background" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[78px] animate-pulse rounded-lg bg-background" />)}</div>
      <div className="grid gap-4 xl:grid-cols-12"><div className="h-72 animate-pulse rounded-xl bg-background xl:col-span-8" /><div className="h-72 animate-pulse rounded-xl bg-background xl:col-span-4" /></div>
    </div>
  );
}
