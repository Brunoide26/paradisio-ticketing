import React from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { PencilIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { Panel, PanelHeader, CardContent, SectionTitle, Money, Num, DeltaPill, KindTag, Bars, DataTable, MetricStrip, BrandTile, Empty, TooltipBox, Legend, HatchDefs } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, fmtDate, daysTo, brandColor, byCategory, cn } from './lib.js';

const cfg = { v: { label: 'Monto' } };

export default function Brand({ brandId, finance, live, culqi, withTaxes, selected, onSelect, go }) {
  const brand = (finance.brands || []).find((b) => b.id === brandId) || { id: brandId, name: brandId };
  const color = brandColor(brandId);
  const events = (finance.events || []).filter((e) => e.brand === brandId).sort((a, b) => a.date.localeCompare(b.date));
  const done = events.filter(isActual);
  const upcoming = events.filter((e) => !isActual(e));
  let sel = events.find((e) => e.id === selected);
  if (!sel && events.length) sel = done.length ? done[done.length - 1] : events[0];

  const Tab = ({ e }) => {
    const real = isActual(e);
    const on = e.id === sel?.id;
    return (
      <button onClick={() => onSelect(e.id)} aria-pressed={on}
        className={cn('flex shrink-0 items-center gap-3 rounded-lg border bg-background px-3 py-2 text-left transition-colors',
          real ? 'border-solid' : 'border-dashed border-proj-line bg-proj-soft/60',
          on ? 'ring-2 ring-offset-1' : 'hover:border-ring')}
        style={on ? { '--tw-ring-color': color } : undefined}>
        <span>
          <span className="block text-[13px] font-medium capitalize">{fmtDate(e.date)}</span>
          <span className="block text-[11px] text-muted-foreground">{e.venue || 'Local por confirmar'}</span>
        </span>
        <KindTag real={real} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <BrandTile id={brandId} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color }}>{brand.name}</h1>
          <p className="text-[13px] text-muted-foreground">{brand.tagline ? `${brand.tagline} · ` : ''}{done.length} cerrada{done.length === 1 ? '' : 's'} · {upcoming.length} por venir</p>
        </div>
      </div>

      {events.length > 0 && (
        <div className="scroll-thin flex items-stretch gap-2 overflow-x-auto pb-1">
          {done.length > 0 && <span className="flex shrink-0 items-center pr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Realizadas</span>}
          {done.map((e) => <Tab key={e.id} e={e} />)}
          {done.length > 0 && upcoming.length > 0 && <span className="mx-1 w-px shrink-0 self-stretch border-l border-dashed border-proj-line" />}
          {upcoming.length > 0 && <span className="flex shrink-0 items-center pr-1 text-[11px] font-medium uppercase tracking-wide text-proj">Proyectadas</span>}
          {upcoming.map((e) => <Tab key={e.id} e={e} />)}
        </div>
      )}

      {!sel ? (
        <Panel><Empty title="Todavía no hay fechas" action={<Button size="sm" onClick={() => go('/finanzas/datos')}>Crear fecha</Button>}>Crea la primera fecha de {brand.name} en Editar datos.</Empty></Panel>
      ) : <EventView key={sel.id + withTaxes} e={sel} events={events} live={live} culqi={culqi} withTaxes={withTaxes} color={color} brandId={brandId} go={go} />}
    </div>
  );
}

export function EventView({ e, events, live, culqi, withTaxes, color, brandId, go }) {
  const t = totals(e, withTaxes);
  const real = isActual(e);
  const noCosts = !(e.costs || []).length;
  const noIncome = !(e.income || []).length;
  const n = daysTo(e.date);
  // Solo se compara real contra real: nunca un presupuesto contra un cierre.
  const prev = real ? events.filter((x) => x.date < e.date && isActual(x) && (x.costs || []).length).pop() : null;
  const tp = prev ? totals(prev, withTaxes) : null;
  const L = brandId === 'club' && e.liveEventId && live ? live[e.liveEventId] : null;
  const isClub = brandId === 'club';
  const showOps = isClub && (L || e.bar || (e.stock || []).length || e.liveEventId);
  const where = `${fmtDate(e.date)} · ${e.venue || 'por confirmar'}${n >= 0 ? ` · faltan ${n} días` : ''}`;
  const culqiCard = <CulqiCard c={culqi} e={e} color={color} />;
  const hasCulqi = culqi && culqi.connected && culqi.byEvent && culqi.byEvent[e.id];

  const numbers = noCosts && noIncome ? (
    <Panel proj={!real}>
      <PanelHeader title={e.name} description={where} action={<KindTag real={real} />} />
      <Empty title="Números por definir" action={<Button size="sm" onClick={() => go('/finanzas/datos?evento=' + e.id)}><PencilIcon />Cargar números</Button>}>
        {e.notes && <p>{e.notes}</p>}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {['Local y consumo mínimo', 'DJs y talento', 'Personal: barra, seguridad, limpieza', 'Producción y decoración temática', 'Promotores y marketing', 'Precios de entradas, boxes y barra'].map((x) => <li key={x} className="rounded-md border border-dashed px-2.5 py-1.5 text-foreground/80">{x}</li>)}
        </ul>
      </Empty>
    </Panel>
  ) : (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel proj={!real} className="md:col-span-2 lg:col-span-3">
        <PanelHeader big className="border-b-0"
          title={<span className={cn(!real && 'text-foreground/80')}><Money value={t.income} /></span>}
          description={<><span className="capitalize">{fmtDate(e.date)}</span>{where.slice(fmtDate(e.date).length)} · {real ? 'ingresos' : 'ingresos proyectados'} de {e.name}</>}
          action={<div className="flex items-center gap-2">
            {tp && tp.income ? <DeltaPill value={((t.income - tp.income) / tp.income) * 100} label={`vs ${fmtShort(prev.date)}`} /> : null}
            {!real && <KindTag />}
            <Button variant="outline" size="sm" onClick={() => go('/finanzas/datos?evento=' + e.id)}><PencilIcon />Editar</Button>
          </div>} />
        <CardContent className="px-2 pb-2">
          {noCosts ? <Empty title="Sin costos cargados" /> : <CategoryChart t={t} tp={tp} prev={prev} e={e} color={color} real={real} />}
        </CardContent>
        <Legend items={[
          { label: `${fmtShort(e.date)} ${real ? '(real)' : '(proyectado)'}`, color, dashed: !real },
          ...(prev ? [{ label: `${fmtShort(prev.date)} (real, fecha anterior)`, color: '#CFCFCB' }] : []),
        ]} />
      </Panel>

      <Panel proj={!real} className="md:col-span-2 lg:col-span-1">
        {/* Un presupuesto sin costos no tiene utilidad: nunca se muestra el ingreso como si lo fuera. */}
        <PanelHeader big title={!real && noCosts ? <span className="text-[17px] font-medium text-proj">Incompleto</span> : <span className={t.result >= 0 ? 'text-good' : 'text-bad'}><Money value={t.result} /></span>}
          description={!real && noCosts ? 'Utilidad proyectada: faltan los costos del presupuesto.' : `${real ? 'Resultado' : 'Utilidad proyectada'}${t.stock ? ` · incluye ${money(t.stock)} de stock` : ''}${t.opening ? ` · descuenta ${money(t.opening)} de inventario inicial` : ''}`}
          action={t.income && !(!real && noCosts) ? <DeltaPill value={t.margin} good={t.margin >= 0} label="margen" /> : null} />
        <CardContent className="px-0 py-1">
          <p className="px-6 pt-3 text-[12px] font-medium text-muted-foreground">De dónde viene la plata</p>
          <Bars dashed={!real} items={(e.income || []).map((x) => ({ label: x.label, value: Number(x.amount) || 0 })).sort((a, b) => b.value - a.value)} color={color} />
        </CardContent>
      </Panel>

      <Panel proj={!real} className="md:col-span-2 lg:col-span-3">
        <PanelHeader title={real ? 'Costos' : 'Costos presupuestados'} description={`${t.costs.length} conceptos · ${withTaxes ? 'con' : 'sin'} IGV y renta`} action={!real ? <KindTag /> : null} />
        <DataTable proj={!real} limit={8}
          columns={[
            { key: 'l', label: 'Concepto', render: (x) => <span className="font-medium">{x.label}</span> },
            { key: 'c', label: 'Categoría', render: (x) => <span className="text-muted-foreground">{x.category}</span> },
            { key: 'p', label: '%', align: 'right', mono: true, render: (x) => <span className="text-muted-foreground">{t.cost ? pct((x.amount / t.cost) * 100) : '—'}</span> },
            { key: 'a', label: 'Monto', align: 'right', mono: true, render: (x) => money(x.amount, x.amount % 1 ? 2 : 0) },
          ]}
          rows={t.costs.slice().sort((a, b) => b.amount - a.amount)}
          empty="Sin costos cargados."
          footer={t.costs.length ? <TableRow><TableCell className="pl-6" colSpan={3}>Total costos</TableCell><TableCell className="mono pr-6 text-end">{money(t.cost)}</TableCell></TableRow> : null}
        />
      </Panel>

      <Panel proj={!real}>
        <PanelHeader title="Por categoría" description="Pasa el mouse para ver el detalle." />
        <CardContent className="px-0 py-1">
          <Bars dashed={!real} items={byCategory(t.costs).map((c) => ({ label: c.name, value: c.value, title: c.items.map((x) => `${x.label}: ${money(x.amount)}`).join('\n') }))} color="#A3A3A0" />
        </CardContent>
        {e.notes && <p className="border-t px-6 py-3 text-[13px] leading-relaxed text-foreground/80">{e.notes}</p>}
      </Panel>

      <Panel proj={!real} className="md:col-span-2 lg:col-span-4">
        <PanelHeader title={real ? 'Indicadores' : 'Indicadores proyectados'} action={<KindTag real={real} />} />
        <MetricStrip items={[
          { label: 'Margen', sub: 'Resultado / ingresos', value: t.income && !(!real && noCosts) ? pct(t.margin) : '—', tone: t.margin >= 0 ? 'good' : 'bad' },
          noCosts ? { label: 'Break-even', sub: 'Se calcula con los costos', value: '—' } :
            { label: 'Break-even', sub: 'Ingresos necesarios para no perder', value: money(Math.max(0, t.cost - t.stock)), foot: t.coverage >= 100 ? `Cubierto al ${pct(t.coverage)}` : `Faltan ${money(t.cost - t.income - t.stock)}`, tone: t.coverage >= 100 ? 'good' : 'bad' },
          L && L.ingresaron ? { label: 'Ingreso por asistente', sub: `${L.ingresaron} personas adentro`, value: money(t.income / L.ingresaron, 2) } : { label: 'Costo más grande', sub: (byCategory(t.costs)[0] || {}).name || '—', value: byCategory(t.costs)[0] ? money(byCategory(t.costs)[0].value) : '—' },
          (e.brandInvestment || []).length ? { label: 'Inversión en marca', sub: 'Activos que se reusan, aparte', value: money(t.inv) } : { label: 'Stock que quedó', sub: 'A costo', value: money(t.stock) },
        ]} />
      </Panel>
    </div>
  );

  return (
    <>
      {real ? (
        <>
          <SectionTitle kind="real" title="Cierre de la fecha" description="Números reales." />
          {numbers}
          {culqiCard}
        </>
      ) : (
        <>
          {/* Lo cobrado de verdad (Culqi) va arriba y sólido, aunque la fecha todavía no pase. */}
          {hasCulqi && <><SectionTitle kind="real" title="Ya cobrado" description="Venta real registrada en Culqi." />{culqiCard}</>}
          {culqi && !culqi.connected && culqiCard}
          <SectionTitle kind="proj" title="Presupuesto de la fecha" description="Estimados: no cuentan como reales hasta marcar la fecha como realizada." className={hasCulqi ? 'pt-4' : ''} />
          {numbers}
        </>
      )}

      {showOps ? (
        <>
          {/* Operación: solo dentro de Paradisio Club. */}
          <SectionTitle kind="real" title="Operación" description="Puerta en vivo desde la web de tickets, barra y stock." className="pt-6" />
          {e.liveEventId && !L && <Panel><Empty title="Sin registros todavía">Aparecen aquí apenas se abra el registro de esta fecha en la web.</Empty></Panel>}
          {L && <Door L={L} color={color} />}
          {e.bar && <BarOps B={e.bar} color={color} />}
          {(e.stock || []).length > 0 && <Stock items={e.stock} />}
        </>
      ) : null}
    </>
  );
}

function CategoryChart({ t, tp, prev, e, color, real }) {
  const cats = [...new Set(['Ingresos', ...t.costs.map((x) => x.category || 'Otros'), ...(tp ? tp.costs.map((x) => x.category || 'Otros') : [])])];
  const v = (tt, k) => (!tt ? 0 : k === 'Ingresos' ? tt.income : sum(tt.costs.filter((x) => (x.category || 'Otros') === k), (x) => x.amount));
  const data = cats.map((k) => ({ name: k, a: v(t, k), b: v(tp, k) }));
  return (
    <ChartContainer config={cfg} className="aspect-auto h-60 w-full">
      <BarChart accessibilityLayer data={data} barGap={3} barCategoryGap="24%" margin={{ left: 4, right: 12 }}>
        {!real && <defs><HatchDefs id="cat-hatch" color={color} /></defs>}
        <CartesianGrid vertical={false} strokeDasharray={real ? undefined : '3 4'} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tickMargin={8} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={52} />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => active && payload && payload.length ? (
          <TooltipBox title={payload[0].payload.name} rows={[{ label: `${fmtShort(e.date)}${real ? '' : ' (proyectado)'}`, value: money(payload[0].payload.a), color, dashed: !real }, ...(prev ? [{ label: `${fmtShort(prev.date)} (real)`, value: money(payload[0].payload.b), color: '#CFCFCB' }] : [])]} />
        ) : null} />
        {prev && <Bar dataKey="b" fill="#DADAD6" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />}
        <Bar dataKey="a" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false}>
          {data.map((d, i) => real
            ? <Cell key={i} fill={color} fillOpacity={d.name === 'Ingresos' ? 1 : 0.7} />
            : <Cell key={i} fill="url(#cat-hatch)" stroke={color} strokeDasharray="4 3" strokeWidth={1.2} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ---------- Operación de Paradisio Club ----------
function Door({ L, color }) {
  const max = Math.max(L.registros, 1);
  const top = L.promoters || [];
  const pmax = Math.max(...top.map((p) => p.qrs), 1);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel className="md:col-span-2 lg:col-span-3">
        <PanelHeader big className="border-b-0" title={<Num value={L.ingresaron} />}
          description={<span className="flex items-center gap-1.5"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-good" /></span>personas entraron · {L.aTiempo} a tiempo, {L.tarde} después de hora</span>}
          action={<DeltaPill value={L.conversion} good={L.conversion >= 50} label="de los QRs" />} />
        <CardContent className="px-2 pb-3">
          <ChartContainer config={{ acc: { label: 'Adentro', color } }} className="aspect-auto h-56 w-full">
            <AreaChart accessibilityLayer data={L.checkins} margin={{ left: 4, right: 12 }}>
              <defs><linearGradient id="door" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={28} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <ChartTooltip cursor={{ stroke: color, strokeDasharray: '3 3' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.t} rows={[{ label: 'Adentro', value: payload[0].payload.acc, color }, { label: 'Entraron en 15 min', value: payload[0].payload.n }]} /> : null} />
              <Area type="linear" dataKey="acc" stroke={color} strokeWidth={2} fill="url(#door)" dot={{ fill: color, r: 2, strokeWidth: 2 }} isAnimationActive={false} />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Panel>
      <Panel className="md:col-span-2 lg:col-span-1">
        <PanelHeader title="Embudo" description="Del registro a la pista." />
        <CardContent className="px-0 py-1">
          <Bars color={color} format={(v) => v.toLocaleString('en-US')} items={[
            { label: 'Registros', value: L.registros, extra: '100%' },
            { label: 'Vigentes', value: L.vigentes, extra: pct((L.vigentes / max) * 100) },
            { label: 'QRs emitidos', value: L.issued, extra: pct((L.issued / max) * 100) },
            { label: 'Entraron', value: L.ingresaron, extra: pct((L.ingresaron / max) * 100) },
          ]} />
        </CardContent>
        <p className="border-t px-6 py-2.5 text-[12px] text-muted-foreground">{L.withPromoter} QRs con promotor · {L.withoutPromoter} sin promotor · {L.tardeCobrado} pagaron después de hora</p>
      </Panel>

      <Panel className="md:col-span-2">
        <PanelHeader title="Promotores" description="QRs que generó cada uno y cuántos entraron." />
        <DataTable limit={8}
          columns={[
            { key: 'n', label: 'Promotor', render: (p) => <span className="font-medium">{p.name}</span> },
            { key: 'b', label: '', className: 'w-[28%]', render: (p) => <div className="relative h-1.5 rounded-full bg-muted"><div className="absolute inset-y-0 left-0 rounded-full bg-[#DADAD6]" style={{ width: (p.qrs / pmax) * 100 + '%' }} /><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: (p.ingresaron / pmax) * 100 + '%', background: color }} /></div> },
            { key: 'q', label: 'QRs', align: 'right', mono: true, render: (p) => p.qrs },
            { key: 'i', label: 'Entraron', align: 'right', mono: true, render: (p) => p.ingresaron },
            { key: 'c', label: 'Conversión', align: 'right', mono: true, render: (p) => <span className={p.qrs && p.ingresaron / p.qrs >= 0.5 ? 'text-good' : 'text-muted-foreground'}>{p.qrs ? pct((p.ingresaron / p.qrs) * 100) : '—'}</span> },
          ]}
          rows={top}
        />
      </Panel>
      <Panel>
        <PanelHeader title="Edades" description="Quienes entraron." />
        <CardContent className="px-0 py-1"><Bars color={color} format={(v) => String(v)} items={(L.agesAttended || []).map((x) => ({ label: x.label, value: x.n }))} /></CardContent>
      </Panel>
      <Panel>
        <PanelHeader title="Registros por día" description="Cómo se movió la demanda." />
        <CardContent className="px-2 pb-2 pt-3">
          <ChartContainer config={{ v: { label: 'Registros', color } }} className="aspect-auto h-36 w-full">
            <BarChart accessibilityLayer data={(L.registrations || []).map((x) => ({ name: fmtShort(x.d), v: x.n }))}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={16} />
              <ChartTooltip cursor={{ fill: 'var(--muted)' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Registros', value: payload[0].value, color }]} /> : null} />
              <Bar dataKey="v" fill={color} fillOpacity={0.8} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Panel>
    </div>
  );
}

function BarOps({ B, color }) {
  const pt = sum(B.payments, (x) => x.amount);
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel>
        <PanelHeader title="Barra" description={`${B.operations} cobros · ticket ${money(B.avgTicket)}`} />
        <CardContent className="px-0 py-1"><Bars color={color} items={(B.terminals || []).map((x) => ({ label: x.label.replace(/ \(.*\)/, ''), value: x.amount, title: `${x.ops} operaciones · ticket ${money(x.amount / x.ops)}` }))} /></CardContent>
      </Panel>
      <Panel>
        <PanelHeader title="Medios de pago" description={`${money(pt)} cobrados`} />
        <CardContent className="px-0 py-1"><Bars color="#525252" items={(B.payments || []).slice().sort((a, b) => b.amount - a.amount).map((x) => ({ label: x.label, value: x.amount, extra: pt ? pct((x.amount / pt) * 100) : '' }))} /></CardContent>
      </Panel>
      <Panel>
        <PanelHeader title="Contra lo proyectado" description="Vendido como % de lo esperado." />
        <CardContent className="px-0 py-1"><Bars format={(v) => v + '%'} items={(B.vsProjection || []).map((x) => ({ label: x.label, value: x.pct, color: x.pct >= 70 ? '#059669' : x.pct >= 40 ? '#C98500' : '#DC3B1A' }))} /></CardContent>
      </Panel>
      <Panel>
        <PanelHeader title="Cócteles" description="Venta de la carta." />
        <CardContent className="px-6 py-5">
          <p className="mono text-[28px] font-medium leading-none">{B.cocktails ? B.cocktails.units : '—'}</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">cócteles vendidos</p>
          {B.cocktails && <p className="mono mt-4 text-lg">{money(B.cocktails.amount)}</p>}
          {B.cocktails && pt > 0 && <p className="text-[13px] text-muted-foreground">{pct((B.cocktails.amount / pt) * 100)} de la barra</p>}
        </CardContent>
      </Panel>
    </div>
  );
}

function Stock({ items }) {
  const tot = sum(items, (x) => x.cost);
  return (
    <Panel>
      <PanelHeader title="Stock que quedó" description={`Valorizado a costo: ${money(tot, 2)}`} />
      <DataTable limit={6}
        columns={[
          { key: 'l', label: 'Grupo', render: (x) => <span className="font-medium">{x.label}</span> },
          { key: 'd', label: 'Qué queda', render: (x) => <span className="text-muted-foreground">{x.detail}</span> },
          { key: 'c', label: 'Costo', align: 'right', mono: true, render: (x) => money(x.cost, 2) },
        ]}
        rows={items.slice().sort((a, b) => b.cost - a.cost)}
      />
    </Panel>
  );
}

function CulqiCard({ c, e, color }) {
  if (!c) return null;
  if (!c.connected) {
    return (
      <Panel>
        <PanelHeader title="Culqi" description="Cobros reales automáticos" />
        <p className="px-6 py-4 text-[13px] text-muted-foreground">No se pudo leer Culqi ({c.reason || 'sin conexión'}). Los montos de esta fecha siguen siendo los que cargaste a mano.</p>
      </Panel>
    );
  }
  const x = c.byEvent && c.byEvent[e.id];
  if (!x) return null;
  const w = x.window ? `${fmtShort(new Date(x.window.from * 1000 - 5 * 3600 * 1000).toISOString().slice(0, 10))} – ${fmtShort(new Date(x.window.to * 1000 - 5 * 3600 * 1000).toISOString().slice(0, 10))}` : '';
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Panel className="md:col-span-2 lg:col-span-3">
        <PanelHeader big className="border-b-0" title={<Money value={x.amount} />}
          description={<>Cobrado por Culqi en la venta de esta fecha · {x.count} cobro{x.count === 1 ? '' : 's'} exitoso{x.count === 1 ? '' : 's'}{x.failed ? ` · ${x.failed} rechazado${x.failed === 1 ? '' : 's'}` : ''}{w ? ` · ${w}` : ''}</>}
          action={<div className="text-right text-[13px]">
            <p className="mb-1 inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700"><i className="size-1.5 rounded-full bg-good" />Culqi{c.mode === 'test' ? ' (prueba)' : ''}</p>
            <p className="text-muted-foreground">Comisión <span className="mono text-foreground">{money(x.fee, 2)}</span></p>
            <p className="text-muted-foreground">Neto <span className="mono font-medium text-foreground">{money(x.net, 2)}</span></p>
          </div>} />
        <CardContent className="px-2 pb-2">
          {x.byDay.length ? (
            <ChartContainer config={{ v: { label: 'Cobrado', color } }} className="aspect-auto h-36 w-full">
              <BarChart accessibilityLayer data={x.byDay.map((d) => ({ name: fmtShort(d.d), v: d.amount }))}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={16} />
                <ChartTooltip cursor={{ fill: 'var(--muted)' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Cobrado', value: money(payload[0].value), color }]} /> : null} />
                <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          ) : <p className="px-4 py-2 text-[13px] text-muted-foreground">Sin cobros en Culqi para esta fecha todavía.</p>}
        </CardContent>
        <p className="border-t px-6 py-2.5 text-[12px] text-muted-foreground">Se actualiza solo cada 10 minutos. Incluye lo que pasa por la API de Culqi (web: entradas, boxes y mesas).</p>
      </Panel>
      <Panel>
        <PanelHeader title="Por medio de pago" description="Cobros exitosos en Culqi." />
        <CardContent className="px-0 py-1">
          {x.byMethod.length ? <Bars color="#525252" items={x.byMethod.map((m) => ({ label: m.label, value: m.amount, extra: `${m.n}` }))} /> : <p className="px-6 py-4 text-[13px] text-muted-foreground">Sin cobros todavía.</p>}
        </CardContent>
      </Panel>
    </div>
  );
}
