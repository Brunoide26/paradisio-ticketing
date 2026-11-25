import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Pencil } from 'lucide-react';
import { Card, CardHeader, Money, Num, DeltaPill, KindTag, ShareBarList, DataTable, MetricStrip, BrandTile, Button, Empty, TooltipBox } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, fmtDate, daysTo, brandColor, byCategory, cn } from './lib.js';

export default function Brand({ brandId, finance, live, withTaxes, selected, onSelect, go }) {
  const brand = (finance.brands || []).find((b) => b.id === brandId) || { id: brandId, name: brandId };
  const color = brandColor(brandId);
  const events = (finance.events || []).filter((e) => e.brand === brandId).sort((a, b) => a.date.localeCompare(b.date));
  let sel = events.find((e) => e.id === selected);
  if (!sel && events.length) { const done = events.filter(isActual); sel = done.length ? done[done.length - 1] : events[0]; }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <BrandTile id={brandId} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">{brand.name}</h1>
          <p className="text-[13px] text-muted">{brand.tagline} · {events.filter(isActual).length} cerrada{events.filter(isActual).length === 1 ? '' : 's'} · {events.filter((e) => !isActual(e)).length} por venir</p>
        </div>
      </div>
      {events.length > 0 && (
        <div className="scroll-thin flex gap-2 overflow-x-auto pb-1">
          {events.map((e) => (
            <button key={e.id} onClick={() => onSelect(e.id)}
              className={cn('flex shrink-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors', e.id === sel?.id ? 'border-ink bg-white' : isActual(e) ? 'border-line bg-white hover:border-[#CFCFCB]' : 'border-dashed border-[#D6D6D2] bg-white hover:border-[#BDBDB8]')}>
              <div>
                <span className="block text-[13px] font-medium capitalize">{fmtDate(e.date)}</span>
                <span className="block text-[11px] text-muted">{e.venue || 'Local por confirmar'}</span>
              </div>
              <KindTag real={isActual(e)} />
            </button>
          ))}
        </div>
      )}
      {!sel ? (
        <Card><Empty title="Todavía no hay fechas" action={<Button size="sm" onClick={() => go('edit')}>Crear fecha</Button>}>Crea la primera fecha de {brand.name} en Editar datos.</Empty></Card>
      ) : <EventView key={sel.id + withTaxes} e={sel} events={events} live={live} withTaxes={withTaxes} color={color} brandId={brandId} go={go} />}
    </div>
  );
}

function EventView({ e, events, live, withTaxes, color, brandId, go }) {
  const t = totals(e, withTaxes);
  const real = isActual(e);
  const noCosts = !(e.costs || []).length;
  const noIncome = !(e.income || []).length;
  const n = daysTo(e.date);
  const prev = events.filter((x) => x.date < e.date && (x.costs || []).length).pop();
  const tp = prev ? totals(prev, withTaxes) : null;
  const L = brandId === 'club' && e.liveEventId && live ? live[e.liveEventId] : null;
  const showOps = brandId === 'club' && (L || e.bar || (e.stock || []).length);

  if (noCosts && noIncome) {
    return (
      <Card dashed>
        <CardHeader title={e.name} description={`${fmtDate(e.date)} · ${e.venue || 'local por confirmar'}${n >= 0 ? ` · faltan ${n} días` : ''}`} action={<KindTag />} />
        <Empty title="Números por definir" action={<Button size="sm" onClick={() => go('edit', e.id)}><Pencil className="h-3.5 w-3.5" />Cargar números</Button>}>
          <p>{e.notes}</p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {['Local y consumo mínimo', 'DJs y talento', 'Personal: barra, seguridad, limpieza', 'Producción y decoración temática', 'Promotores y marketing', 'Precios de entradas, boxes y barra'].map((x) => <li key={x} className="rounded-md border border-dashed border-line px-2.5 py-1.5 text-ink-2">{x}</li>)}
          </ul>
        </Empty>
      </Card>
    );
  }

  return (
    <>
      {!real && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#E9C892] bg-[#FFF9F0] px-3.5 py-2.5 text-[13px] text-[#7A4A06]">
          <KindTag /> Esta fecha es un <b>presupuesto</b>: los números son estimados y no cuentan como reales hasta que la marques como realizada.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card delay={0} dashed={!real}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <div className="flex items-center gap-2"><KindTag real={real} /><span className="text-[13px] text-muted"><span className="capitalize">{fmtDate(e.date)}</span> · {e.venue || 'por confirmar'}{n >= 0 ? ` · faltan ${n} días` : ''}</span></div>
              <p className="mt-2 text-[32px] font-medium leading-none tracking-tight"><Money value={t.income} /></p>
              <p className="mt-1.5 text-[13px] text-muted">{real ? 'Ingresos' : 'Ingresos proyectados'} de {e.name}</p>
            </div>
            <div className="flex items-center gap-2">
              {tp && tp.income ? <DeltaPill value={((t.income - tp.income) / tp.income) * 100} label={` vs ${fmtShort(prev.date)}`} /> : null}
              <Button variant="outline" size="sm" onClick={() => go('edit', e.id)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
            </div>
          </div>
          <div className="h-[240px] px-2 pb-2 pt-4">{noCosts ? <Empty title="Sin costos cargados" /> : <CategoryChart t={t} tp={tp} prev={prev} e={e} color={color} real={real} />}</div>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />{fmtShort(e.date)} {real ? '(real)' : '(presupuesto)'}</span>
            {prev && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-cost" />{fmtShort(prev.date)} {isActual(prev) ? '(real)' : '(presupuesto)'}</span>}
          </div>
        </Card>
        <Card delay={0.05} dashed={!real}>
          <div className="flex items-start justify-between gap-2 px-4 pt-4">
            <div>
              <p className={cn('text-[32px] font-medium leading-none tracking-tight', t.result >= 0 ? 'text-good' : 'text-bad')}><Money value={t.result} /></p>
              <p className="mt-1.5 text-[13px] text-muted">{real ? 'Resultado' : 'Utilidad proyectada'}{t.stock ? ` · incluye ${money(t.stock)} de stock` : ''}</p>
            </div>
            {t.income ? <DeltaPill value={t.margin} good={t.margin >= 0} label=" margen" /> : null}
          </div>
          <div className="mt-3 border-t border-line">
            <p className="px-4 pt-3 text-[12px] font-medium text-muted">De dónde viene la plata</p>
            <ShareBarList items={(e.income || []).map((x) => ({ label: x.label, value: Number(x.amount) || 0 })).sort((a, b) => b.value - a.value)} color={color} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card delay={0.08} dashed={!real}>
          <CardHeader title={real ? 'Costos' : 'Costos presupuestados'} description={`${t.costs.length} conceptos · ${withTaxes ? 'con' : 'sin'} IGV y renta`} />
          <DataTable limit={8}
            columns={[
              { key: 'l', label: 'Concepto', render: (x) => <span className="font-medium">{x.label}</span> },
              { key: 'c', label: 'Categoría', render: (x) => <span className="text-ink-2">{x.category}</span> },
              { key: 'p', label: '%', align: 'right', mono: true, render: (x) => <span className="text-muted">{t.cost ? pct((x.amount / t.cost) * 100) : '—'}</span> },
              { key: 'a', label: 'Monto', align: 'right', mono: true, render: (x) => money(x.amount, x.amount % 1 ? 2 : 0) },
            ]}
            rows={t.costs.slice().sort((a, b) => b.amount - a.amount)}
            empty="Sin costos cargados."
            footer={t.costs.length ? <tfoot><tr className="border-t border-line bg-[#FAFAF9] font-medium"><td className="px-4 py-2" colSpan={3}>Total costos</td><td className="mono px-4 py-2 text-right">{money(t.cost)}</td></tr></tfoot> : null}
          />
        </Card>
        <Card delay={0.1} dashed={!real}>
          <CardHeader title="Por categoría" description="Pasa el mouse para ver el detalle." />
          <ShareBarList items={byCategory(t.costs).map((c) => ({ label: c.name, value: c.value, title: c.items.map((x) => `${x.label}: ${money(x.amount)}`).join('\n') }))} color="#A3A3A0" />
          {e.notes && <p className="border-t border-line px-4 py-3 text-[13px] leading-relaxed text-ink-2">{e.notes}</p>}
        </Card>
      </div>

      <Card delay={0.12} dashed={!real}>
        <CardHeader title={real ? 'Indicadores' : 'Indicadores proyectados'} action={<KindTag real={real} />} />
        <MetricStrip items={[
          { label: 'Margen', sub: 'Resultado / ingresos', value: t.income ? pct(t.margin) : '—', tone: t.margin >= 0 ? 'good' : 'bad' },
          noCosts ? { label: 'Break-even', sub: 'Se calcula con los costos', value: '—' } :
            { label: 'Break-even', sub: 'Ingresos necesarios para no perder', value: money(Math.max(0, t.cost - t.stock)), foot: t.coverage >= 100 ? `Cubierto al ${pct(t.coverage)}` : `Faltan ${money(t.cost - t.income - t.stock)}`, tone: t.coverage >= 100 ? 'good' : 'bad' },
          L && L.ingresaron ? { label: 'Ingreso por asistente', sub: `${L.ingresaron} personas adentro`, value: money(t.income / L.ingresaron, 2) } : { label: 'Costo más grande', sub: (byCategory(t.costs)[0] || {}).name || '—', value: byCategory(t.costs)[0] ? money(byCategory(t.costs)[0].value) : '—' },
          (e.brandInvestment || []).length ? { label: 'Inversión en marca', sub: 'Activos que se reusan, aparte', value: money(t.inv) } : { label: 'Stock que quedó', sub: 'A costo', value: money(t.stock) },
        ]} />
      </Card>

      {showOps ? (
        <div className="flex items-center gap-3 pt-6">
          <h2 className="text-[17px] font-semibold tracking-tight">Operación</h2>
          <span className="text-[13px] text-muted">Puerta en vivo desde la web de tickets, barra y stock</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      ) : null}
      {brandId === 'club' && e.liveEventId && !L && <Card><Empty title="Sin registros todavía">Aparecen aquí apenas se abra el registro de esta fecha en la web.</Empty></Card>}
      {L && <Door L={L} color={color} />}
      {brandId === 'club' && e.bar && <BarOps B={e.bar} color={color} />}
      {brandId === 'club' && (e.stock || []).length > 0 && <Stock items={e.stock} color={color} />}
    </>
  );
}

function CategoryChart({ t, tp, prev, e, color }) {
  const cats = [...new Set(['Ingresos', ...t.costs.map((x) => x.category || 'Otros'), ...(tp ? tp.costs.map((x) => x.category || 'Otros') : [])])];
  const v = (tt, k) => (!tt ? 0 : k === 'Ingresos' ? tt.income : sum(tt.costs.filter((x) => (x.category || 'Otros') === k), (x) => x.amount));
  const data = cats.map((k) => ({ name: k, a: v(t, k), b: v(tp, k) }));
  return (
    <ResponsiveContainer>
      <BarChart data={data} barGap={3} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke="#F1F1EF" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 11, fill: '#8A8A86' }} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={52} />
        <Tooltip cursor={{ fill: 'rgba(10,10,10,.03)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: fmtShort(e.date), value: money(payload[0].payload.a), color }, ...(prev ? [{ label: fmtShort(prev.date), value: money(payload[0].payload.b), color: '#CFCFCB' }] : [])]} /> : null} />
        {prev && <Bar dataKey="b" fill="#DADAD6" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={900} />}
        <Bar dataKey="a" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={900}>
          {data.map((d, i) => <Cell key={i} fill={color} fillOpacity={d.name === 'Ingresos' ? 1 : 0.7} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Operación de Paradisio Club ----------
function Door({ L, color }) {
  const max = Math.max(L.registros, 1);
  const top = L.promoters || [];
  const pmax = Math.max(...top.map((p) => p.qrs), 1);
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <p className="text-[32px] font-medium leading-none tracking-tight"><Num value={L.ingresaron} /></p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-muted"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-good" /></span>personas entraron · {L.aTiempo} a tiempo, {L.tarde} después de hora</p>
            </div>
            <DeltaPill value={L.conversion} good={L.conversion >= 50} label=" de los QRs" />
          </div>
          <div className="h-[230px] px-2 pb-2 pt-4">
            <ResponsiveContainer>
              <AreaChart data={L.checkins}>
                <defs><linearGradient id="door" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#F1F1EF" />
                <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <Tooltip content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.t} rows={[{ label: 'Adentro', value: payload[0].payload.acc, color }, { label: 'Entraron en 15 min', value: payload[0].payload.n }]} /> : null} />
                <Area type="monotone" dataKey="acc" stroke={color} strokeWidth={2} fill="url(#door)" dot={false} activeDot={{ r: 4 }} animationDuration={1300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Embudo" description="Del registro a la pista." />
          <ShareBarList color={color} format={(v) => v.toLocaleString('en-US')} items={[
            { label: 'Registros', value: L.registros, extra: '100%' },
            { label: 'Vigentes', value: L.vigentes, extra: pct((L.vigentes / max) * 100) },
            { label: 'QRs emitidos', value: L.issued, extra: pct((L.issued / max) * 100) },
            { label: 'Entraron', value: L.ingresaron, extra: pct((L.ingresaron / max) * 100) },
          ]} />
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-muted">{L.withPromoter} QRs con promotor · {L.withoutPromoter} sin promotor · {L.tardeCobrado} pagaron después de hora</p>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title="Promotores" description="QRs que generó cada uno y cuántos entraron." />
          <DataTable limit={8}
            columns={[
              { key: 'n', label: 'Promotor', render: (p) => <span className="font-medium">{p.name}</span> },
              { key: 'b', label: '', className: 'w-[32%]', render: (p) => <div className="relative h-1.5 rounded-full bg-line-soft"><div className="absolute inset-y-0 left-0 rounded-full bg-[#DADAD6]" style={{ width: (p.qrs / pmax) * 100 + '%' }} /><div className="absolute inset-y-0 left-0 rounded-full" style={{ width: (p.ingresaron / pmax) * 100 + '%', background: color }} /></div> },
              { key: 'q', label: 'QRs', align: 'right', mono: true, render: (p) => p.qrs },
              { key: 'i', label: 'Entraron', align: 'right', mono: true, render: (p) => p.ingresaron },
              { key: 'c', label: 'Conversión', align: 'right', mono: true, render: (p) => <span className={p.qrs && p.ingresaron / p.qrs >= 0.5 ? 'text-good' : 'text-ink-2'}>{p.qrs ? pct((p.ingresaron / p.qrs) * 100) : '—'}</span> },
            ]}
            rows={top}
          />
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader title="Edades" description="Quienes entraron." />
            <ShareBarList color={color} format={(v) => String(v)} items={L.agesAttended.map((x) => ({ label: x.label, value: x.n }))} />
          </Card>
          <Card>
            <CardHeader title="Registros por día" description="Cómo se movió la demanda." />
            <div className="h-[120px] px-2 pb-2 pt-3">
              <ResponsiveContainer>
                <BarChart data={L.registrations.map((x) => ({ name: fmtShort(x.d), v: x.n }))}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={16} />
                  <Tooltip cursor={{ fill: 'rgba(10,10,10,.03)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Registros', value: payload[0].value, color }]} /> : null} />
                  <Bar dataKey="v" fill={color} fillOpacity={0.75} radius={[2, 2, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function BarOps({ B, color }) {
  const pt = sum(B.payments, (x) => x.amount);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader title="Barra" description={`${B.operations} cobros · ticket ${money(B.avgTicket)}`} />
        <ShareBarList color={color} items={(B.terminals || []).map((x) => ({ label: x.label.replace(/ \(.*\)/, ''), value: x.amount, title: `${x.ops} operaciones · ticket ${money(x.amount / x.ops)}` }))} />
      </Card>
      <Card>
        <CardHeader title="Medios de pago" description={`${money(pt)} cobrados`} />
        <ShareBarList color="#525252" items={(B.payments || []).slice().sort((a, b) => b.amount - a.amount).map((x) => ({ label: x.label, value: x.amount, extra: pct((x.amount / pt) * 100) }))} />
      </Card>
      <Card>
        <CardHeader title="Contra lo proyectado" description="Vendido vs. esperado." />
        <ShareBarList format={(v) => v + '%'} items={(B.vsProjection || []).map((x) => ({ label: x.label, value: x.pct, color: x.pct >= 70 ? '#059669' : x.pct >= 40 ? '#C98500' : '#DC3B1A' }))} />
      </Card>
      <Card>
        <CardHeader title="Cócteles" description="Venta de la carta." />
        <div className="px-4 py-4">
          <p className="mono text-[28px] font-medium leading-none">{B.cocktails ? B.cocktails.units : '—'}</p>
          <p className="mt-1.5 text-[13px] text-muted">cócteles vendidos</p>
          {B.cocktails && <p className="mono mt-4 text-lg">{money(B.cocktails.amount)}</p>}
          {B.cocktails && <p className="text-[13px] text-muted">{pct((B.cocktails.amount / pt) * 100)} de la barra</p>}
        </div>
      </Card>
    </div>
  );
}

function Stock({ items }) {
  const tot = sum(items, (x) => x.cost);
  return (
    <Card>
      <CardHeader title="Stock que quedó" description={`Valorizado a costo: ${money(tot, 2)}`} />
      <DataTable limit={6}
        columns={[
          { key: 'l', label: 'Grupo', render: (x) => <span className="font-medium">{x.label}</span> },
          { key: 'd', label: 'Qué queda', render: (x) => <span className="text-ink-2">{x.detail}</span> },
          { key: 'c', label: 'Costo', align: 'right', mono: true, render: (x) => money(x.cost, 2) },
        ]}
        rows={items.slice().sort((a, b) => b.cost - a.cost)}
      />
    </Card>
  );
}
