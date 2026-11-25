import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, Unavailable, StageBadge, fmtDay, relDays, moneyOrNA, signTone } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { EventPromoters } from './Promoters.jsx';
import Brand from '../Brand.jsx';
import { Panel, Bars, DivergingBars, BrandTile, KindTag, TooltipBox } from '../ui.jsx';
import { cn, money, pct, short, brandColor } from '../lib.js';

const sumVals = (list) => (list || []).reduce((s, x) => s + x.value, 0);

// ---------- Comparativo de las tres marcas ----------
export function BrandsCompare() {
  const { data } = useOS();
  const navigate = useNavigate();
  const brands = data.finance.brands;
  const B = data.os.brands || {};
  const G = data.os.summary.actual;
  const LSg = data.os.ledgerSummary;
  const col = (b) => B[b.id];
  const rows = [
    ['Fechas realizadas', (x) => x.events.done, (x) => String(x)],
    ['Fechas por venir', (x) => x.events.upcoming, (x) => String(x)],
    ['Ingresos reales', (x) => x.actual.revenue, money, true],
    ['Costos reales', (x) => x.actual.costs, money],
    ['Personal (barra, seguridad, limpieza…)', (x) => sumVals(x.actual.byStaffArea), money],
    ['Resultado real', (x) => x.actual.result, money, true, true],
    ['Margen', (x) => x.actual.margin, pct],
    ['% de los ingresos del grupo', (x) => x.share.revenue, pct],
    ['Comisiones de promotores', (x) => (x.promoters ? x.promoters.commission : null), money],
    ['Pagado a proveedores y staff', (x) => (x.payments.hasData ? x.payments.paidOut : null), money],
    ['Por pagar', (x) => (x.payments.hasData ? x.payments.payables : null), money],
  ];
  const chart = brands.map((b) => ({ id: b.id, name: b.name, result: col(b).actual.result, revenue: col(b).actual.revenue, done: col(b).events.done }));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Comparativo de marcas" description="Qué aporta cada marca al grupo y qué le queda. Real arriba; proyectado aparte." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {brands.map((b) => {
          const x = col(b);
          return (
            <button key={b.id} type="button" onClick={() => navigate(`/marcas/${b.id}`)} className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:border-ring" style={{ boxShadow: `inset 3px 0 0 ${brandColor(b.id)}` }}>
              <div className="flex items-center gap-3"><BrandTile id={b.id} size="md" /><div className="min-w-0"><p className="text-[15px] font-semibold" style={{ color: brandColor(b.id) }}>{b.name}</p><p className="truncate text-[12px] text-muted-foreground">{b.tagline}</p></div></div>
              {x.events.done ? (
                <div className="grid grid-cols-3 gap-2">
                  <Mini label="Ingresos" value={money(x.actual.revenue)} />
                  <Mini label="Resultado" value={money(x.actual.result)} tone={signTone(x.actual.result)} />
                  <Mini label="Del grupo" value={pct(x.share.revenue)} />
                </div>
              ) : <p className="text-[13px] text-muted-foreground">Todavía sin fechas realizadas. {x.events.upcoming ? `${x.events.upcoming} por venir.` : ''}</p>}
              {x.projected.count > 0 && <p className="rounded-md border border-dashed border-proj-line bg-proj-soft/50 px-2.5 py-1.5 text-[12px] text-proj">Proyectado: {x.projected.revenue ? `${money(x.projected.revenue)} de ingresos` : 'sin ingresos presupuestados'} · utilidad {x.projected.profit == null ? 'incompleta' : money(x.projected.profit)}</p>}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelBar title="Lado a lado" description="Sólo números reales (fechas en Liquidación o Cerradas) y pagos registrados. — = la marca todavía no tiene fechas realizadas." action={<KindTag real />} />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent [&_th]:h-10 [&_th]:text-[12px]">
                <TableHead className="pl-4" />
                {brands.map((b) => <TableHead key={b.id} className="text-end"><span className="inline-flex items-center gap-1.5"><BrandTile id={b.id} size="xs" />{b.name}</span></TableHead>)}
                <TableHead className="pr-4 text-end">Grupo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map(([label, get, fmt, strong, colored]) => {
                  const vals = brands.map((b) => get(col(b)));
                  const groupVal = label === 'Ingresos reales' ? G.revenue : label === 'Costos reales' ? G.costs : label === 'Resultado real' ? G.result : label === 'Margen' ? G.margin : label === 'Personal (barra, seguridad, limpieza…)' ? sumVals(G.byStaffArea) : label === '% de los ingresos del grupo' ? (G.revenue ? 100 : null) : label === 'Fechas realizadas' ? G.count : label === 'Por pagar' ? (LSg.hasData ? LSg.payables.total : null) : vals.every((v) => v == null) ? null : vals.reduce((s, v) => s + (v || 0), 0);
                  return (
                    <TableRow key={label} className={cn('text-[13px] hover:bg-transparent', strong && 'font-medium')}>
                      <TableCell className="pl-4">{label}</TableCell>
                      {vals.map((v, i) => { const noOps = !col(brands[i]).events.done && !label.startsWith('Fechas'); return <TableCell key={i} className={cn('mono text-end', !noOps && colored && v != null && (v >= 0 ? 'text-good' : 'text-bad'), noOps && 'text-muted-foreground')}>{noOps ? '—' : v == null ? <Unavailable /> : fmt(v)}</TableCell>; })}
                      <TableCell className={cn('mono bg-muted/40 pr-4 text-end', colored && groupVal != null && (groupVal >= 0 ? 'text-good' : 'text-bad'))}>{groupVal == null ? '—' : fmt(groupVal)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel className="xl:col-span-4">
          <PanelBar title="Resultado real por marca" />
          <DivergingBars items={chart.map((c) => ({ label: c.name, color: brandColor(c.id), value: c.done ? c.result : null, na: 'sin fechas cerradas' }))} />
        </Panel>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }) {
  return <div><p className="text-[11px] text-muted-foreground">{label}</p><p className={cn('mono text-[15px] font-semibold', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</p></div>;
}

// ---------- Espacio de una marca ----------
// Se vuelve a montar al cambiar de marca: cada una abre en su Resumen.
export function BrandHome() {
  const { brandId } = useParams();
  return <BrandSpace key={brandId} brandId={brandId} />;
}

function BrandSpace({ brandId }) {
  const { data, withTaxes, setDrawer } = useOS();
  const navigate = useNavigate();
  const [tab, setTab] = useState('resumen');
  const [sel, setSel] = useState(null);
  const b = data.finance.brands.find((x) => x.id === brandId);
  if (!b) return <Panel className="p-6 text-sm">Esta marca no existe.</Panel>;
  const X = data.os.brands[brandId];
  const color = brandColor(brandId);
  const evs = data.os.summary.events.filter((f) => f.brand === brandId);
  const real = evs.filter((f) => f.kind === 'actual');
  const proj = evs.filter((f) => f.kind === 'budget');
  const promoEvents = evs.filter((f) => data.os.promoters[f.id]);
  const none = X.events.done === 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 border-b pb-4" style={{ borderBottomColor: color }}>
        <BrandTile id={brandId} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color }}>{b.name}</h1>
          <p className="text-[13px] text-muted-foreground">{b.tagline} · {X.events.done} fecha{X.events.done === 1 ? '' : 's'} realizada{X.events.done === 1 ? '' : 's'} · {X.events.upcoming} por venir</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/marcas')}>Comparar marcas</Button>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="resumen" className="text-[12px]">Resumen</TabsTrigger>
          <TabsTrigger value="fechas" className="text-[12px]">Fechas</TabsTrigger>
          <TabsTrigger value="costos" className="text-[12px]">Costos y proveedores</TabsTrigger>
          <TabsTrigger value="promotores" className="text-[12px]">Promotores</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'resumen' && (
        <>
          {none && <Panel className="px-5 py-4 text-[13px] text-muted-foreground">{b.name} todavía no tiene fechas realizadas. Cuando cierre la primera, aquí vas a ver qué le entra, en qué se le va, qué le queda y cuánto aporta al grupo, separado de las otras marcas.</Panel>}
          <div className="kpi-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Ingresos reales" value={money(X.actual.revenue)} sub={`${X.events.done} fecha(s)`} unavailable={none ? 'Sin fechas realizadas' : null} />
            <Kpi label="Costos reales" value={money(X.actual.costs)} unavailable={none ? 'Sin fechas realizadas' : null} />
            <Kpi label="Le queda (resultado)" value={money(X.actual.result)} tone={signTone(X.actual.result)} unavailable={none ? 'Sin fechas realizadas' : null} sub={X.actual.stock ? `incluye ${money(X.actual.stock)} de stock` : ''} />
            <Kpi label="Aporte al grupo" value={pct(X.share.revenue)} unavailable={none ? 'Sin fechas realizadas' : null} sub="de los ingresos reales" />
            <Kpi proj label="Ingresos proyectados" value={money(X.projected.revenue)} unavailable={!proj.some((f) => f.hasIncome) ? 'Sin ingresos presupuestados' : null} sub={`${X.projected.count} por venir`} />
            <Kpi proj label="Utilidad proyectada" value={moneyOrNA(X.projected.profit)} unavailable={X.projected.profit == null ? 'Presupuestos sin costos' : null} tone={signTone(X.projected.profit)} />
          </div>
          {!none && (
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Panel><PanelBar title="De dónde le entra" description="Ingresos reales por fuente." /><Bars items={X.actual.byIncomeCategory.map((c) => ({ label: c.key, value: c.value }))} color={color} /></Panel>
              <Panel><PanelBar title="En qué se le va" description="Costos reales por categoría." /><Bars items={X.actual.byCostCategory.map((c) => ({ label: c.key, value: c.value }))} color="#A3A3A0" /></Panel>
              <Panel><PanelBar title="Personal por área" description="Barra, seguridad, limpieza, caja." /><Bars items={X.actual.byStaffArea.map((c) => ({ label: c.key, value: c.value }))} color="#737370" empty="Sin costos de personal." /></Panel>
              <Panel>
                <PanelBar title="Promotores" description="Fechas con datos de la web de tickets." />
                {X.promoters ? (
                  <div className="flex flex-col gap-2 px-4 py-3 text-[13px]">
                    <p className="flex justify-between"><span className="text-muted-foreground">Entraron por promotores</span><span className="mono">{X.promoters.attended}</span></p>
                    <p className="flex justify-between"><span className="text-muted-foreground">Comisiones</span>{X.promoters.commission == null ? <Unavailable reason="Sin regla de comisión" /> : <span className="mono">{money(X.promoters.commission)}</span>}</p>
                    <p className="flex justify-between"><span className="text-muted-foreground">Pagado</span><span className="mono">{money(X.promoters.paid)}</span></p>
                    <div className="mt-1 border-t pt-2">{X.promoters.top.map((p) => <p key={p.name} className="flex justify-between text-[12px]"><span>{p.name}</span><span className="mono text-muted-foreground">{p.attended}</span></p>)}</div>
                  </div>
                ) : <p className="px-4 py-5 text-[13px] text-muted-foreground">Sin datos de promotores.</p>}
              </Panel>
            </div>
          )}
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
            <Panel>
              <PanelBar title="Fechas realizadas" action={<KindTag real />} />
              <EventsTable rows={real} empty="Sin fechas realizadas." onOpen={(id) => navigate(`/eventos/${id}`)} />
            </Panel>
            <Panel proj>
              <PanelBar title="Próximas fechas" action={<KindTag />} />
              <EventsTable rows={proj} proj empty="Sin fechas por venir." onOpen={(id) => navigate(`/eventos/${id}`)} />
            </Panel>
          </div>
          <Panel>
            <PanelBar title="Pagos de la marca" description="Del libro de transacciones (Finanzas)." />
            {X.payments.hasData ? (
              <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
                <Kpi label="Pagado" value={money(X.payments.paidOut)} />
                <Kpi label="Cobrado" value={money(X.payments.collected)} />
                <Kpi label="Por pagar" value={money(X.payments.payables)} tone={X.payments.payables ? 'bad' : undefined} />
                <Kpi label="Por cobrar" value={money(X.payments.receivables)} />
                <Kpi label="Anticipos de clientes" value={money(X.payments.deposits)} />
              </div>
            ) : <p className="px-4 py-5 text-[13px] text-muted-foreground">Todavía no hay pagos registrados para {b.name}. Se registran en Finanzas → Transacciones (o en la pestaña Pagos de cada fecha).</p>}
          </Panel>
        </>
      )}

      {tab === 'fechas' && <Brand brandId={brandId} finance={data.finance} live={data.live} culqi={data.culqi} withTaxes={withTaxes} selected={sel} onSelect={setSel} go={navigate} />}

      {tab === 'costos' && <BrandCosts brandId={brandId} X={X} />}

      {tab === 'promotores' && (promoEvents.length ? promoEvents.map((f) => (
        <div key={f.id} className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">{f.name} · {fmtDay(f.date)}</h3>
          <EventPromoters eventId={f.id} />
        </div>
      )) : <Panel className="px-5 py-6 text-[13px] text-muted-foreground">{b.name} no tiene fechas con datos de la web de tickets.</Panel>)}
    </div>
  );
}

function EventsTable({ rows, proj, empty, onOpen }) {
  const { data } = useOS();
  return (
    <DataTable id={proj ? 'brand-ev-proj' : 'brand-ev-real'} searchable={false} rows={rows} onRowClick={(f) => onOpen(f.id)} empty={empty} initialSort={{ key: 'date', dir: proj ? 1 : -1 }} rowClassName={() => (proj ? 'border-dashed' : '')}
      columns={[
        { key: 'date', label: 'Fecha', get: (f) => f.date, render: (f) => <span className="mono">{fmtDay(f.date)}<span className="block text-[11px] font-sans text-muted-foreground">{relDays(f.daysTo)}</span></span> },
        { key: 'name', label: 'Evento', get: (f) => f.name, render: (f) => <span className="block max-w-[220px] truncate font-medium">{f.name}</span> },
        { key: 'stage', label: 'Etapa', get: (f) => f.stage, render: (f) => <StageBadge stage={f.stage} stages={data.os.stages} /> },
        { key: 'revenue', label: 'Ingresos', num: true, get: (f) => f.revenue, render: (f) => (f.hasIncome ? money(f.revenue) : <Unavailable />) },
        { key: 'result', label: proj ? 'Utilidad' : 'Resultado', num: true, get: (f) => f.result, render: (f) => (f.result == null ? <span className="text-[12px] text-proj">Incompleto</span> : <span className={f.result >= 0 ? 'text-good' : 'text-bad'}>{money(f.result)}</span>) },
      ]} />
  );
}

// Costos de la marca: cada línea de costo de sus fechas reales, más proveedores del libro y staff asignado.
function BrandCosts({ brandId, X }) {
  const { data, setDrawer, withTaxes } = useOS();
  const evs = data.finance.events.filter((e) => e.brand === brandId);
  const lines = evs.flatMap((e) => (e.costs || []).filter((l) => withTaxes || l.category !== 'Impuestos').map((l, i) => ({ id: `${e.id}-${i}`, e, ...l, real: data.os.summary.events.find((f) => f.id === e.id)?.kind === 'actual' })));
  const staffRows = evs.flatMap((e) => ((data.ops.staff || {})[e.id] || []).map((s, i) => ({ id: `${e.id}-s${i}`, e, ...s, contact: (data.ops.contacts || []).find((c) => c.id === s.contactId) })));
  return (
    <div className="flex flex-col gap-4">
      {[[true, 'Costos reales', 'Fechas en Liquidación o Cerradas.'], [false, 'Costos presupuestados', 'Fechas por venir. No se suman a lo real.']].map(([isReal, title, desc]) => (
        <Panel key={title} proj={!isReal}>
          <PanelBar title={`${title} · ${money(lines.filter((l) => l.real === isReal).reduce((t, l) => t + (Number(l.amount) || 0), 0))}`} description={desc} action={<KindTag real={isReal} />} />
          <DataTable id={`brand-costs-${isReal ? 'real' : 'proj'}-${brandId}`} rows={lines.filter((l) => l.real === isReal)} initialSort={{ key: 'amount', dir: -1 }} pageSize={15} onRowClick={(l) => setDrawer({ type: 'event', id: l.e.id })} rowClassName={() => (isReal ? '' : 'border-dashed')} empty={isReal ? 'Sin fechas realizadas.' : 'Sin presupuestos.'}
            columns={[
              { key: 'date', label: 'Fecha', get: (l) => l.e.date, render: (l) => <span className="mono">{fmtDay(l.e.date)}</span> },
              { key: 'label', label: 'Concepto', get: (l) => l.label, render: (l) => <span className="font-medium">{l.label}</span> },
              { key: 'category', label: 'Categoría', get: (l) => l.category },
              { key: 'amount', label: 'Monto', num: true, get: (l) => Number(l.amount) || 0, render: (l) => money(l.amount, 2) },
            ]} />
        </Panel>
      ))}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Panel>
          <PanelBar title="Proveedores (pagos registrados)" description="Del libro de transacciones, por proveedor." />
          <DataTable id={`brand-sup-${brandId}`} searchable={false} rows={X.suppliers.map((s) => ({ ...s, id: s.name }))} empty="Sin pagos registrados a proveedores."
            columns={[
              { key: 'name', label: 'Proveedor', get: (s) => s.name, render: (s) => <span className="font-medium">{s.name}</span> },
              { key: 'count', label: 'Movimientos', num: true, get: (s) => s.count },
              { key: 'paid', label: 'Pagado', num: true, get: (s) => s.paid, render: (s) => money(s.paid, 2) },
              { key: 'pending', label: 'Por pagar', num: true, get: (s) => s.pending, render: (s) => (s.pending ? <span className="text-bad">{money(s.pending, 2)}</span> : '—') },
            ]} />
        </Panel>
        <Panel>
          <PanelBar title="Staff asignado" description="Operaciones → Producción de cada fecha." />
          <DataTable id={`brand-staff-${brandId}`} searchable={false} rows={staffRows} empty="Sin staff asignado." onRowClick={(s) => setDrawer({ type: 'contact', id: s.contactId })}
            columns={[
              { key: 'date', label: 'Fecha', get: (s) => s.e.date, render: (s) => <span className="mono">{fmtDay(s.e.date)}</span> },
              { key: 'who', label: 'Equipo / persona', get: (s) => (s.contact || {}).name, render: (s) => <span className="font-medium">{(s.contact || {}).name}</span> },
              { key: 'role', label: 'Rol', get: (s) => s.role, render: (s) => <span className="block max-w-[180px] truncate" title={s.role}>{s.role}</span> },
              { key: 'confirmed', label: 'Estado', get: (s) => (s.confirmed ? 'Confirmado' : 'Por confirmar') },
              { key: 'fee', label: 'Pago', num: true, get: (s) => s.fee, render: (s) => (s.fee == null ? '—' : money(s.fee)) },
            ]} />
        </Panel>
      </div>
    </div>
  );
}
