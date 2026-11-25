import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { Pencil } from 'lucide-react';
import { Card, CardHead, Count, Badge, BrandTile, Button, Empty, TooltipBox } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, fmtDate, daysTo, brandColor, byCategory, BRAND_STYLE, cn } from './lib.js';

export default function Brand({ brandId, finance, live, withTaxes, selected, onSelect, go }) {
  const brand = (finance.brands || []).find((b) => b.id === brandId) || { id: brandId, name: brandId };
  const color = brandColor(brandId);
  const events = (finance.events || []).filter((e) => e.brand === brandId).sort((a, b) => a.date.localeCompare(b.date));
  let sel = events.find((e) => e.id === selected);
  if (!sel && events.length) { const done = events.filter(isActual); sel = done.length ? done[done.length - 1] : events[0]; }

  return (
    <div className="space-y-4">
      {/* Cabecera de marca */}
      <Card className="overflow-hidden" delay={0}>
        <div className="flex flex-wrap items-center gap-5 px-5 py-5" style={{ background: `linear-gradient(90deg, ${BRAND_STYLE[brandId]?.soft || '#F4F3F0'} 0%, #FFFFFF 60%)` }}>
          <BrandTile id={brandId} size="lg" />
          <div className="min-w-0">
            <p className="text-xs text-muted">Paradisio Entertainment Group</p>
            <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
            <p className="text-sm text-ink-2">{brand.tagline} · {events.length} fecha{events.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {events.length > 0 && (
          <div className="scroll-thin flex gap-1 overflow-x-auto border-t border-line-soft px-3 py-2">
            {events.map((e) => (
              <button key={e.id} onClick={() => onSelect(e.id)}
                className={cn('relative shrink-0 rounded-lg px-3 py-2 text-left transition-colors', e.id === sel?.id ? 'bg-line-soft' : 'hover:bg-[#FAF9F7]')}>
                <span className="block text-sm font-medium capitalize">{fmtDate(e.date)}</span>
                <span className="block text-[11px] text-muted">{e.status} · {e.venue || 'por confirmar'}</span>
                {e.id === sel?.id && <span className="absolute inset-x-3 -bottom-2 h-0.5 rounded-full" style={{ background: color }} />}
              </button>
            ))}
          </div>
        )}
      </Card>

      {!sel ? (
        <Card><Empty title="Todavía no hay fechas" action={<Button size="sm" onClick={() => go('edit')}>Crear fecha</Button>}>Crea la primera fecha de {brand.name} en Editar datos.</Empty></Card>
      ) : <EventView key={sel.id} e={sel} events={events} live={live} withTaxes={withTaxes} color={color} brandId={brandId} go={go} />}
    </div>
  );
}

function EventView({ e, events, live, withTaxes, color, brandId, go }) {
  const t = totals(e, withTaxes);
  const actual = isActual(e);
  const noCosts = !(e.costs || []).length;
  const noIncome = !(e.income || []).length;
  const n = daysTo(e.date);
  const prev = events.filter((x) => x.date < e.date && (x.costs || []).length).pop();
  const L = brandId === 'club' && e.liveEventId && live ? live[e.liveEventId] : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Badge tone={e.status}>{e.status}</Badge>{n >= 0 && <span className="text-xs text-muted">faltan <b className="num text-ink">{n}</b> días</span>}</div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{e.name}</h2>
          <p className="text-sm capitalize text-muted">{fmtDate(e.date)} · {e.venue || 'Por confirmar'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => go('edit', e.id)}><Pencil className="h-3.5 w-3.5" />Editar fecha</Button>
      </div>

      {noCosts && noIncome ? (
        <Card>
          <Empty title="Números por definir" action={<Button size="sm" onClick={() => go('edit', e.id)}>Cargar números</Button>}>
            <p>{e.notes}</p>
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {['Local y consumo mínimo', 'DJs y talento', 'Personal: barra, seguridad, limpieza', 'Producción y decoración temática', 'Promotores y marketing', 'Precios de entradas, boxes y barra'].map((x) => <li key={x} className="rounded-md border border-dashed border-line px-2.5 py-1.5 text-ink-2">{x}</li>)}
            </ul>
          </Empty>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label={actual ? 'Ingresos' : 'Ingresos proyectados'} value={t.income} foot={`${(e.income || []).length} fuente${(e.income || []).length === 1 ? '' : 's'}`} />
            <Kpi label={actual ? 'Costos' : 'Costos proyectados'} value={t.cost} foot={noCosts ? 'Sin costos cargados' : withTaxes ? 'Con IGV y renta' : 'Sin IGV ni renta'} />
            <Kpi label={actual ? 'Resultado' : 'Utilidad proyectada'} value={t.result} tone={t.result >= 0 ? 'good' : 'bad'} foot={t.stock ? `Incluye stock ${money(t.stock)}` : noCosts ? 'Hasta cargar costos' : ' '} />
            <Kpi label="Margen" value={t.margin} format="pct" tone={t.margin >= 0 ? 'good' : 'bad'} foot="Resultado / ingresos" bar={Math.max(0, t.margin)} color={color} />
            {noCosts ? <Kpi label="Break-even" text="—" foot="Se calcula con los costos" /> :
              <Kpi label="Cobertura de costos" value={t.coverage} format="pct" tone={t.coverage >= 100 ? 'good' : 'bad'} foot={t.coverage >= 100 ? 'Cubre los costos' : `Faltan ${money(t.cost - t.income - t.stock)}`} bar={Math.min(100, t.coverage)} color={color} />}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card delay={0.05}>
              <CardHead title="De dónde viene la plata" hint="Ingresos por fuente" />
              <HBars data={(e.income || []).map((x) => ({ name: x.label, value: Number(x.amount) || 0 })).sort((a, b) => b.value - a.value)} color={color} total={t.income} />
            </Card>
            <Card delay={0.08}>
              <CardHead title="En qué se va" hint="Costos por categoría" />
              {noCosts ? <Empty title="Sin costos todavía" action={<Button size="sm" variant="outline" onClick={() => go('edit', e.id)}>Cargar costos</Button>} /> :
                <HBars data={byCategory(t.costs)} color="#B5B0A6" first="#55534E" total={t.cost} detail />}
            </Card>
          </div>

          <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
            <Card delay={0.1}>
              <CardHead title="Estado de resultados" hint={actual ? 'Real' : 'Presupuesto'} />
              <PL e={e} t={t} color={color} />
            </Card>
            <div className="grid gap-3">
              {prev && (
                <Card delay={0.12}>
                  <CardHead title={`Contra ${fmtShort(prev.date)}`} hint={`${prev.status} vs ${e.status}`} right={<div className="flex gap-3 text-[11px] text-ink-2"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-cost" />{fmtShort(prev.date)}</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px]" style={{ background: color }} />{fmtShort(e.date)}</span></div>} />
                  <div className="h-[220px] px-2 pb-2 pt-3"><Compare a={prev} b={e} withTaxes={withTaxes} color={color} /></div>
                </Card>
              )}
              <Card delay={0.14}>
                <CardHead title="Notas" />
                <p className="px-5 py-4 text-sm leading-relaxed text-ink-2">{e.notes || 'Sin notas.'}</p>
                {(e.brandInvestment || []).length > 0 && (
                  <div className="border-t border-line-soft px-5 py-4">
                    <p className="text-xs font-medium">Inversión en marca <span className="font-normal text-muted">· activos que se reusan</span></p>
                    <div className="mt-2 space-y-1.5 text-sm">
                      {e.brandInvestment.map((x, i) => <div key={i} className="flex justify-between"><span className="text-ink-2">{x.label}</span><span className="num">{money(x.amount)}</span></div>)}
                      <div className="flex justify-between border-t border-line-soft pt-1.5 font-medium"><span>Total</span><span className="num">{money(t.inv)}</span></div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      {brandId === 'club' && (L || e.bar || (e.stock || []).length > 0) && (
        <div className="flex items-center gap-3 pt-4">
          <h2 className="text-lg font-semibold tracking-tight">Operación</h2>
          <span className="text-xs text-muted">Puerta en vivo desde la web de tickets, barra y stock</span>
          <div className="h-px flex-1 bg-line" />
        </div>
      )}
      {brandId === 'club' && e.liveEventId && !L && <Card><Empty title="Sin registros todavía">Aparecen aquí apenas se abra el registro de esta fecha en la web.</Empty></Card>}
      {L && <Door L={L} color={color} />}
      {brandId === 'club' && e.bar && <BarSection B={e.bar} color={color} />}
      {brandId === 'club' && (e.stock || []).length > 0 && <Stock items={e.stock} color={color} />}
    </>
  );
}

function Kpi({ label, value, format = 'money', foot, tone, bar, color, text }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={cn('mt-2 text-2xl font-medium leading-none', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', text && 'text-muted')}>{text || <Count value={value} format={format} />}</p>
      <p className="mt-2.5 truncate text-xs text-muted">{foot}</p>
      {bar != null && <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full transition-[width] duration-1000" style={{ width: bar + '%', background: color }} /></div>}
    </Card>
  );
}

function HBars({ data, color, first, total, detail }) {
  const h = Math.max(120, data.length * 34 + 44);
  return (
    <div className="px-2 pb-2 pt-3" style={{ height: h }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap="26%">
          <CartesianGrid horizontal={false} stroke="#EFEDE9" />
          <XAxis type="number" tickFormatter={short} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#55534E' }} />
          <Tooltip cursor={{ fill: 'rgba(20,20,19,.04)' }} content={({ active, payload }) => {
            if (!active || !payload || !payload.length) return null;
            const r = payload[0].payload;
            return <TooltipBox title={r.name} rows={detail ? r.items.map((x) => ({ label: x.label, value: money(x.amount) })) : [{ label: 'Monto', value: money(r.value) }]} foot={`${money(r.value)} · ${total ? pct((r.value / total) * 100) : ''} del total`} />;
          }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={1000} maxBarSize={22}>
            {data.map((d, i) => <Cell key={i} fill={first && i === 0 ? first : color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PL({ e, t, color }) {
  const max = Math.max(...t.costs.map((x) => Number(x.amount) || 0), 1);
  return (
    <table className="w-full text-[13px]">
      <tbody>
        <tr><td colSpan={2} className="px-5 pb-1 pt-3 text-[11px] uppercase tracking-wider text-muted">Ingresos</td></tr>
        {(e.income || []).map((x, i) => <tr key={i} className="border-b border-line-soft"><td className="px-5 py-2">{x.label}</td><td className="num px-5 py-2 text-right">{money(x.amount)}</td></tr>)}
        <tr className="bg-[#FAF9F7] font-medium"><td className="px-5 py-2">Total ingresos</td><td className="num px-5 py-2 text-right">{money(t.income)}</td></tr>
        <tr><td colSpan={2} className="px-5 pb-1 pt-4 text-[11px] uppercase tracking-wider text-muted">Costos</td></tr>
        {t.costs.slice().sort((a, b) => b.amount - a.amount).map((x, i) => (
          <tr key={i} className="border-b border-line-soft">
            <td className="px-5 py-2">
              <div className="flex items-center gap-3">
                <span className="w-56 shrink-0 truncate">{x.label} <span className="ml-1 text-[11px] text-muted">{x.category}</span></span>
                <span className="hidden h-1 flex-1 overflow-hidden rounded-full bg-line-soft sm:block"><span className="block h-full rounded-full" style={{ width: (x.amount / max) * 100 + '%', background: color, opacity: 0.75 }} /></span>
              </div>
            </td>
            <td className="num px-5 py-2 text-right">{money(x.amount, x.amount % 1 ? 2 : 0)}</td>
          </tr>
        ))}
        <tr className="bg-[#FAF9F7] font-medium"><td className="px-5 py-2">Total costos</td><td className="num px-5 py-2 text-right">{money(t.cost)}</td></tr>
        {t.stock ? <tr className="border-b border-line-soft"><td className="px-5 py-2 text-ink-2">+ Stock que quedó (a costo)</td><td className="num px-5 py-2 text-right">{money(t.stock)}</td></tr> : null}
        <tr className="font-semibold"><td className="px-5 py-3">Resultado</td><td className={cn('num px-5 py-3 text-right', t.result >= 0 ? 'text-good' : 'text-bad')}>{money(t.result)}</td></tr>
      </tbody>
    </table>
  );
}

function Compare({ a, b, withTaxes, color }) {
  const ta = totals(a, withTaxes), tb = totals(b, withTaxes);
  const keys = ['Ingresos', ...new Set([...ta.costs, ...tb.costs].map((x) => x.category || 'Otros'))];
  const v = (t, k) => (k === 'Ingresos' ? t.income : sum(t.costs.filter((x) => (x.category || 'Otros') === k), (x) => x.amount));
  const data = keys.map((k) => ({ name: k, a: v(ta, k), b: v(tb, k) }));
  return (
    <ResponsiveContainer>
      <BarChart data={data} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="#EFEDE9" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10, fill: '#8B8881' }} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={52} />
        <Tooltip cursor={{ fill: 'rgba(20,20,19,.04)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: fmtShort(a.date), value: money(payload[0].payload.a), color: '#C9C5BD' }, { label: fmtShort(b.date), value: money(payload[0].payload.b), color }]} /> : null} />
        <Bar dataKey="a" fill="#C9C5BD" radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={1000} />
        <Bar dataKey="b" fill={color} radius={[3, 3, 0, 0]} maxBarSize={16} animationDuration={1000} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Operación de Paradisio Club ----------
function Door({ L, color }) {
  const max = Math.max(L.registros, 1);
  const funnel = [
    { label: 'Registros', n: L.registros, sub: 'Todo lo que entró por la web' },
    { label: 'Vigentes', n: L.vigentes, sub: `${L.anulados} anulados o rechazados` },
    { label: 'QRs emitidos', n: L.issued, sub: `${L.withPromoter} con promotor · ${L.withoutPromoter} sin promotor` },
    { label: 'Entraron', n: L.ingresaron, sub: `${L.aTiempo} a tiempo · ${L.tarde} después de hora` },
  ];
  const top = (L.promoters || []).slice(0, 12);
  const pmax = Math.max(...top.map((p) => p.qrs), 1);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Registros" value={L.registros} format="int" foot={`${L.vigentes} vigentes`} />
        <Kpi label="QRs emitidos" value={L.issued} format="int" foot={`${L.pending} pendientes`} />
        <Kpi label="Entraron" value={L.ingresaron} format="int" foot={`${L.tardeCobrado} pagaron después de hora`} bar={L.issued ? (L.ingresaron / L.issued) * 100 : 0} color={color} />
        <Kpi label="Conversión" value={L.conversion} format="pct" foot="De QR emitido a la pista" bar={L.conversion} color={color} />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="Curva de ingreso" hint="Personas adentro · cada 15 minutos" />
          <div className="h-[260px] px-2 pb-3 pt-3">
            <ResponsiveContainer>
              <AreaChart data={L.checkins}>
                <defs><linearGradient id="door" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="#EFEDE9" />
                <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <Tooltip content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.t} rows={[{ label: 'Adentro', value: payload[0].payload.acc, color }, { label: 'Entraron en 15 min', value: payload[0].payload.n }]} /> : null} />
                <Area type="monotone" dataKey="acc" stroke={color} strokeWidth={2} fill="url(#door)" animationDuration={1400} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHead title="Embudo" hint="Del registro a la pista" />
          <div className="space-y-4 px-5 py-4">
            {funnel.map((f, i) => (
              <div key={f.label}>
                <div className="flex items-baseline justify-between text-sm"><span>{f.label}</span><span className="num font-medium">{f.n.toLocaleString('en-US')} <span className="text-xs font-normal text-muted">{pct((f.n / max) * 100)}</span></span></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full transition-[width] duration-1000" style={{ width: (f.n / max) * 100 + '%', background: color, opacity: 1 - i * 0.18 }} /></div>
                <p className="mt-1 text-[11px] text-muted">{f.sub}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <MiniBars title="Edades" hint="Quienes entraron" data={L.agesAttended.map((x) => ({ name: x.label, value: x.n }))} color={color} />
        <MiniBars title="Registros por día" hint="Cómo se movió la demanda" data={L.registrations.map((x) => ({ name: fmtShort(x.d), value: x.n }))} color={color} />
        <Card>
          <CardHead title="Mix de entradas" hint="QRs vigentes por tipo" />
          <div className="space-y-3 px-5 py-4 text-sm">
            {[['Free entry', L.byType.promo + L.byType.free], ['Pagadas', L.byType.paid], ['Boxes y mesas', L.byType.table]].map(([k, v]) => (
              <div key={k}><div className="flex justify-between"><span className="text-ink-2">{k}</span><span className="num">{v}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: (v / Math.max(L.vigentes, 1)) * 100 + '%', background: color }} /></div></div>
            ))}
            <p className="pt-1 text-xs text-muted">Venta web: <span className="num text-ink-2">{money(L.webSales)}</span></p>
          </div>
        </Card>
      </div>
      {top.length > 0 && (
        <Card>
          <CardHead title="Promotores" hint={`QRs generados y cuántos entraron · top ${top.length} de ${L.promoters.length}`} />
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
                <th className="py-2 pl-5 text-left font-medium">#</th><th className="py-2 text-left font-medium">Promotor</th><th className="py-2 text-left font-medium">QRs vs entraron</th><th className="py-2 text-right font-medium">QRs</th><th className="py-2 text-right font-medium">Entraron</th><th className="py-2 pr-5 text-right font-medium">Conversión</th>
              </tr></thead>
              <tbody>
                {top.map((p, i) => (
                  <tr key={p.code} className="border-b border-line-soft">
                    <td className="num py-2 pl-5 text-muted">{i + 1}</td>
                    <td className="py-2 font-medium">{p.name}</td>
                    <td className="w-[38%] py-2 pr-4">
                      <div className="relative h-2 rounded-full bg-line-soft">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-cost" style={{ width: (p.qrs / pmax) * 100 + '%' }} />
                        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: (p.ingresaron / pmax) * 100 + '%', background: color }} />
                      </div>
                    </td>
                    <td className="num py-2 text-right">{p.qrs}</td>
                    <td className="num py-2 text-right">{p.ingresaron}</td>
                    <td className="num py-2 pr-5 text-right">{p.qrs ? pct((p.ingresaron / p.qrs) * 100) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function MiniBars({ title, hint, data, color }) {
  return (
    <Card>
      <CardHead title={title} hint={hint} />
      <div className="h-[200px] px-2 pb-2 pt-3">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="#EFEDE9" />
            <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={8} />
            <YAxis tickLine={false} axisLine={false} width={30} />
            <Tooltip cursor={{ fill: 'rgba(20,20,19,.04)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: title, value: payload[0].value, color }]} /> : null} />
            <Bar dataKey="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={28} animationDuration={1000} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function BarSection({ B, color }) {
  const pt = sum(B.payments, (x) => x.amount);
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card>
        <CardHead title="Barra · por terminal" hint={`${B.operations} operaciones · ticket promedio ${money(B.avgTicket)}`} />
        <div className="space-y-3 px-5 py-4 text-sm">
          {(B.terminals || []).map((x) => (
            <div key={x.label}><div className="flex justify-between"><span className="text-ink-2">{x.label}</span><span className="num">{money(x.amount)}</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: (x.amount / Math.max(...B.terminals.map((t) => t.amount))) * 100 + '%', background: color }} /></div>
              <p className="mt-0.5 text-[11px] text-muted">{x.ops} operaciones · ticket {money(x.amount / x.ops)}</p></div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="Medios de pago" hint={money(pt) + ' cobrados'} />
        <div className="space-y-3 px-5 py-4 text-sm">
          {(B.payments || []).slice().sort((a, b) => b.amount - a.amount).map((x, i) => (
            <div key={x.label}><div className="flex justify-between"><span className="text-ink-2">{x.label}</span><span className="num">{money(x.amount)} <span className="text-xs text-muted">{pct((x.amount / pt) * 100)}</span></span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: (x.amount / pt) * 100 + '%', background: i === 0 ? '#55534E' : '#C9C5BD' }} /></div></div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="Contra lo proyectado" hint={B.cocktails ? `${B.cocktails.units} cócteles · ${money(B.cocktails.amount)}` : null} />
        <div className="space-y-4 px-5 py-4 text-sm">
          {(B.vsProjection || []).map((x) => {
            const c = x.pct >= 70 ? '#12805C' : x.pct >= 40 ? '#C98500' : '#C8361B';
            return <div key={x.label}><div className="flex justify-between"><span className="text-ink-2">{x.label}</span><span className="num font-medium" style={{ color: c }}>{x.pct}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: Math.min(100, x.pct) + '%', background: c }} /></div></div>;
          })}
        </div>
      </Card>
    </div>
  );
}

function Stock({ items, color }) {
  const tot = sum(items, (x) => x.cost);
  const max = Math.max(...items.map((x) => x.cost));
  return (
    <Card>
      <CardHead title="Stock que quedó" hint={`Valorizado a costo · ${money(tot, 2)}`} />
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <tbody>
            {items.slice().sort((a, b) => b.cost - a.cost).map((x, i) => (
              <tr key={i} className="border-b border-line-soft">
                <td className="py-2 pl-5 font-medium">{x.label}</td>
                <td className="py-2 text-ink-2">{x.detail}</td>
                <td className="w-40 py-2 pr-4"><div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full" style={{ width: (x.cost / max) * 100 + '%', background: color, opacity: 0.8 }} /></div></td>
                <td className="num py-2 pr-5 text-right">{money(x.cost, 2)}</td>
              </tr>
            ))}
            <tr className="bg-[#FAF9F7] font-medium"><td className="py-2 pl-5" colSpan={3}>Total</td><td className="num py-2 pr-5 text-right">{money(tot, 2)}</td></tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
