// "Ingresos en el tiempo": la vista principal del resumen (dirección visual de Midday, código propio).
// Dos fuentes reales, que nunca se suman entre sí:
//  - Por fecha de evento: ingreso de liquidación de fechas reales + presupuestos (proyectado, rayado).
//  - Venta web por día: entradas y mesas vendidas en la web de tickets, el día en que se cobraron.
// Agrupa por día, semana o mes; respeta el rango de la página y la marca elegida.
import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, Tooltip, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { ArrowDownRightIcon, ArrowUpRightIcon } from 'lucide-react';
import { useOS } from '../../os/store.jsx';
import { cn, money, short, brandColor, limaISO } from '../../lib.js';

const DAY = 86400000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const utc = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const startOf = (d, g) => (g === 'day' ? d : g === 'month' ? d.slice(0, 7) + '-01' : iso(utc(d) - ((new Date(utc(d)).getUTCDay() + 6) % 7) * DAY));
const nextOf = (d, g) => { if (g === 'day') return iso(utc(d) + DAY); if (g === 'week') return iso(utc(d) + 7 * DAY); const y = +d.slice(0, 4), m = +d.slice(5, 7); return iso(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1)); };
const endOf = (d, g) => iso(utc(nextOf(d, g)) - DAY);
const dm = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`;
function label(d, g, multiYear) {
  if (g === 'month') return `${MONTHS[+d.slice(5, 7) - 1]}${multiYear ? ` ${d.slice(2, 4)}` : ''}`;
  return dm(d);
}
function longLabel(d, g) {
  if (g === 'day') return `${dm(d)} ${d.slice(0, 4)}`;
  if (g === 'week') { const e = endOf(d, g); return `Semana del ${dm(d)} al ${dm(e)}`; }
  return `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
}

// Puntos reales/proyectados de cada fuente, ya filtrados por marca.
function pointsFor(lens, data, brand) {
  const inScope = (b) => !brand || b === brand;
  if (lens === 'event') {
    return data.os.summary.events
      .filter((f) => inScope(f.brand) && f.hasIncome && (f.kind === 'actual' || f.kind === 'budget'))
      .map((f) => ({ date: f.date, brand: f.brand, value: f.revenue, proj: f.kind === 'budget', id: f.id, name: f.name }));
  }
  const out = [];
  Object.entries(data.os.sales || {}).forEach(([id, s]) => {
    const ev = data.finance.events.find((e) => e.id === id);
    if (!ev || !inScope(ev.brand)) return;
    (s.velocity || []).forEach((v) => { if (v.revenue > 0) out.push({ date: v.d, brand: ev.brand, value: v.revenue, proj: false, id, name: ev.name }); });
  });
  return out;
}

function buildSeries(points, { group, from, to, extendFuture }) {
  if (!points.length) return { buckets: [] };
  const dates = points.map((p) => p.date).sort();
  let start = from || dates[0];
  let end = to || dates[dates.length - 1];
  if (extendFuture) { const lastProj = points.filter((p) => p.proj).map((p) => p.date).sort().pop(); if (lastProj && lastProj > end) end = lastProj; }
  if (start > end) return { buckets: [] };
  const buckets = [];
  for (let d = startOf(start, group), i = 0; d <= end && i < 800; d = nextOf(d, group), i++) buckets.push({ key: d, real: 0, proj: 0, byBrand: {}, projByBrand: {}, items: [] });
  const idx = new Map(buckets.map((b, i) => [b.key, i]));
  points.forEach((p) => {
    if (p.date < start || p.date > end) return;
    const b = buckets[idx.get(startOf(p.date, group))];
    if (!b) return;
    if (p.proj) { b.proj += p.value; b.projByBrand[p.brand] = (b.projByBrand[p.brand] || 0) + p.value; }
    else { b.real += p.value; b.byBrand[p.brand] = (b.byBrand[p.brand] || 0) + p.value; }
    const it = b.items.find((x) => x.id === p.id);
    if (it) it.value += p.value; else b.items.push({ id: p.id, name: p.name, brand: p.brand, value: p.value, proj: p.proj });
  });
  return { buckets, start, end };
}

const SEG = 'relative z-10 flex h-7 items-center rounded-md px-2.5 text-[12.5px] transition-colors data-[active=true]:font-medium data-[active=true]:text-foreground text-muted-foreground hover:text-foreground';

export default function RevenueChart({ from, to, rangeLabel }) {
  const { data, workspace, setDrawer } = useOS();
  const brand = workspace === 'group' ? null : workspace;
  const brands = data.finance.brands;
  const [lens, setLens] = useState('event');
  const [group, setGroup] = useState(() => { try { return localStorage.getItem('os_rev_group') || 'week'; } catch { return 'week'; } });
  const [split, setSplit] = useState(false);
  const [hover, setHover] = useState(null);
  const setG = (g) => { setGroup(g); try { localStorage.setItem('os_rev_group', g); } catch { /* */ } };
  const today = limaISO();

  const pts = useMemo(() => ({ event: pointsFor('event', data, brand), web: pointsFor('web', data, brand) }), [data, brand]);
  const points = pts[lens];
  const extendFuture = lens === 'event' && (!to || to >= today);
  const { buckets } = useMemo(() => buildSeries(points, { group, from, to, extendFuture }), [points, group, from, to, extendFuture]);

  // Totales de cada fuente en el rango (sólo reales; lo proyectado aparte).
  const inRange = (p) => (!from || p.date >= from) && (!to || p.date <= to);
  const totalOf = (list) => list.filter((p) => !p.proj && inRange(p)).reduce((s, p) => s + p.value, 0);
  const totals = { event: totalOf(pts.event), web: totalOf(pts.web) };
  const projTotal = buckets.reduce((s, b) => s + b.proj, 0);

  // Período anterior del mismo largo (sólo si el rango tiene inicio).
  let prev = null;
  if (from) {
    const len = utc(to || today) - utc(from) + DAY;
    const pFrom = iso(utc(from) - len), pTo = iso(utc(from) - DAY);
    const pv = points.filter((p) => !p.proj && p.date >= pFrom && p.date <= pTo).reduce((s, p) => s + p.value, 0);
    prev = { from: pFrom, to: pTo, value: pv };
  }
  const total = totals[lens];
  const change = prev && prev.value > 0 ? ((total - prev.value) / prev.value) * 100 : null;
  const active = buckets.filter((b) => b.real > 0);
  const best = active.reduce((m, b) => (!m || b.real > m.real ? b : m), null);
  const low = active.length > 1 ? active.reduce((m, b) => (!m || b.real < m.real ? b : m), null) : null;
  const avg = active.length ? active.reduce((s, b) => s + b.real, 0) / active.length : null;
  const empty = buckets.filter((b) => b.real === 0 && b.proj === 0 && b.key <= today).length;
  const unit = { day: 'día', week: 'semana', month: 'mes' }[group];
  const multiYear = buckets.length && buckets[0].key.slice(0, 4) !== buckets[buckets.length - 1].key.slice(0, 4);
  const brandIds = brands.map((b) => b.id).filter((id) => !brand || id === brand);
  const splitOn = split && !brand;

  // Períodos sin ventas: una marca mínima sobre la base para que se lea la línea de tiempo (no es un cero inventado: el tooltip lo dice).
  const peak = Math.max(1, ...buckets.map((b) => Math.max(b.real, b.proj)));
  const stub = peak * 0.012;
  const rows = buckets.map((b, i) => {
    const isEmpty = !b.real && !b.proj;
    const r = { key: b.key, name: label(b.key, group, multiYear), real: b.real || (isEmpty ? stub : null), proj: b.proj || null, b, isEmpty, prevReal: i > 0 ? buckets[i - 1].real : null };
    brandIds.forEach((id, k) => { r['r_' + id] = b.byBrand[id] || (isEmpty && k === 0 ? stub : null); r['p_' + id] = b.projByBrand[id] || null; });
    return r;
  });
  const fillFor = (r, base) => (r.isEmpty ? 'var(--border)' : base);
  const opacity = (i) => (hover == null || hover === i ? 1 : 0.32);

  return (
    <section aria-label="Ingresos en el tiempo" className="border-t border-divider pt-5">
      {/* Fuentes: cada una con su total real en el rango */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <Highlight controlledItems mode="parent" value={lens} hover={false} click={false}
          className="rounded-md bg-muted/70 dark:bg-white/[0.05]" containerClassName="flex gap-1" transition={{ type: 'spring', stiffness: 420, damping: 40 }}>
          {[['event', 'Ingresos por fecha de evento'], ['web', 'Venta web por día']].map(([k, l]) => (
            <HighlightItem key={k} value={k} asChild>
              <button type="button" onClick={() => { setLens(k); setHover(null); }} aria-pressed={lens === k}
                className={cn('relative z-10 flex min-w-[180px] flex-col items-start rounded-md px-3 py-2 text-left transition-colors', lens === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                <span className="text-[12px]">{l}</span>
                <span className="mt-1 text-[22px] font-medium leading-none tracking-[-0.03em] md:text-[26px]">
                  {totals[k] > 0 ? <NumberFlow value={totals[k]} locales="es-PE" format={{ style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }} className="num" /> : <span className="text-[15px] font-normal text-muted-foreground">Sin datos</span>}
                </span>
              </button>
            </HighlightItem>
          ))}
        </Highlight>

        <div className="flex flex-wrap items-center gap-2">
          {!brand && (
            <button type="button" onClick={() => setSplit(!split)} aria-pressed={split}
              className={cn('press flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] transition-colors', split ? 'border-foreground/20 bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <span className="flex -space-x-0.5">{brandIds.map((id) => <i key={id} className="size-2 rounded-full ring-1 ring-background" style={{ background: brandColor(id) }} />)}</span>Por marca
            </button>
          )}
          <Highlight controlledItems mode="parent" value={group} hover={false} click={false}
            className="rounded-md bg-background shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.06)] dark:bg-accent" containerClassName="flex rounded-lg bg-muted p-0.5" transition={{ type: 'spring', stiffness: 520, damping: 42 }}>
            {[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([k, l]) => (
              <HighlightItem key={k} value={k} asChild><button type="button" data-active={group === k} onClick={() => { setG(k); setHover(null); }} className={SEG}>{l}</button></HighlightItem>
            ))}
          </Highlight>
        </div>
      </div>

      {/* Lectura rápida: cambio vs período anterior, mejor y peor período, promedio y lo proyectado aparte */}
      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[12.5px]">
        <Stat label={prev ? `vs. ${dm(prev.from)} – ${dm(prev.to)}` : 'vs. período anterior'}>
          {change != null ? (
            <span className={cn('inline-flex items-center gap-0.5 font-medium', change >= 0 ? 'text-good' : 'text-bad')}>
              {change >= 0 ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
              <NumberFlow value={Math.abs(change) / 100} locales="es-PE" format={{ style: 'percent', maximumFractionDigits: 1 }} className="num" />
            </span>
          ) : <span className="text-muted-foreground">{prev ? 'sin ventas antes' : 'elige un rango'}</span>}
        </Stat>
        <Stat label={{ day: 'Mejor día', week: 'Mejor semana', month: 'Mejor mes' }[group]}>{best ? <button type="button" className="hover:underline" onMouseEnter={() => setHover(buckets.indexOf(best))} onMouseLeave={() => setHover(null)}><span className="num font-medium">{money(best.real)}</span> <span className="text-muted-foreground">· {label(best.key, group, true)}</span></button> : <span className="text-muted-foreground">—</span>}</Stat>
        <Stat label={{ day: 'Día más bajo', week: 'Semana más baja', month: 'Mes más bajo' }[group]}>{low ? <button type="button" className="hover:underline" onMouseEnter={() => setHover(buckets.indexOf(low))} onMouseLeave={() => setHover(null)}><span className="num font-medium">{money(low.real)}</span> <span className="text-muted-foreground">· {label(low.key, group, true)}</span></button> : <span className="text-muted-foreground">{active.length === 1 ? 'un solo período con ventas' : '—'}</span>}</Stat>
        <Stat label={{ day: 'Promedio por día con ventas', week: 'Promedio semanal', month: 'Promedio mensual' }[group]}>{avg != null ? <span className="num font-medium">{money(avg)}</span> : <span className="text-muted-foreground">—</span>}</Stat>
        {lens === 'event' && (
          <Stat label={<span className="inline-flex items-center gap-1.5"><i className="proj-hatch inline-block size-2.5 rounded-[2px] border border-proj-line" />Proyectado</span>}>
            {projTotal > 0 ? <span className="num font-medium text-proj">{money(projTotal)}</span> : <span className="text-muted-foreground">—</span>}
          </Stat>
        )}
      </dl>

      {/* Gráfico */}
      <div className="relative mt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={lens + group + (splitOn ? 's' : '')} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
            {!buckets.length ? (
              <p className="flex h-24 items-center text-[13px] text-muted-foreground">{lens === 'web' ? 'La web de tickets no registra ventas pagadas en este rango.' : 'No hay fechas con ingresos en este rango.'}</p>
            ) : (
              <div className="h-[240px] w-full min-w-0" onMouseLeave={() => setHover(null)}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 900, height: 240 }}>
                  <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2} barCategoryGap={buckets.length > 40 ? '12%' : '28%'}
                    onMouseMove={(s) => setHover(s && s.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
                    onClick={(s) => { const r = s && s.activeTooltipIndex != null && rows[Number(s.activeTooltipIndex)]; if (r && r.b.items.length) setDrawer({ type: 'event', id: r.b.items[0].id }); }}>
                    <defs>
                      <pattern id="rev-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="5" height="5" fill="var(--proj)" fillOpacity="0.07" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--proj)" strokeWidth="1.3" strokeOpacity="0.55" />
                      </pattern>
                      {brandIds.map((id) => (
                        <pattern key={id} id={`rev-hatch-${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <rect width="5" height="5" fill={brandColor(id)} fillOpacity="0.08" /><line x1="0" y1="0" x2="0" y2="5" stroke={brandColor(id)} strokeWidth="1.3" strokeOpacity="0.6" />
                        </pattern>
                      ))}
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="2 4" />
                    <XAxis xAxisId="p" dataKey="name" hide />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={10} minTickGap={18} interval="preserveStartEnd" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <YAxis orientation="right" tickFormatter={(v) => (v ? short(v) : '')} tickLine={false} axisLine={false} width={54} tick={{ fontSize: 11, fill: 'var(--faint)' }} tickCount={4} />
                    {avg != null && active.length > 1 && <ReferenceLine y={avg} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeDasharray="3 4" label={{ value: `prom. ${short(avg)}`, position: 'insideTopLeft', fontSize: 10.5, fill: 'var(--muted-foreground)' }} />}
                    <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.55, radius: 4 }} isAnimationActive animationDuration={180} animationEasing="ease-out" content={<ChartTip group={group} brands={brands} />} wrapperStyle={{ outline: 'none', transition: 'transform 180ms cubic-bezier(0.2,0,0,1)' }} />
                    {lens === 'event' && (splitOn ? brandIds.map((id, k) => (
                      <Bar key={'p' + id} dataKey={'p_' + id} stackId="proj" xAxisId="p" fill={`url(#rev-hatch-${id})`} stroke={brandColor(id)} strokeOpacity={0.55} strokeDasharray="3 2" maxBarSize={44} radius={k === brandIds.length - 1 ? [3, 3, 0, 0] : 0} animationDuration={450}>
                        {rows.map((r, i) => <Cell key={i} fillOpacity={opacity(i)} strokeOpacity={hover == null || hover === i ? 0.6 : 0.2} />)}
                      </Bar>
                    )) : (
                      <Bar xAxisId="p" dataKey="proj" fill="url(#rev-hatch)" stroke="var(--proj)" strokeOpacity={0.55} strokeDasharray="3 2" maxBarSize={44} radius={[3, 3, 0, 0]} animationDuration={450}>
                        {rows.map((r, i) => <Cell key={i} fillOpacity={opacity(i)} strokeOpacity={hover == null || hover === i ? 0.6 : 0.2} />)}
                      </Bar>
                    ))}
                    {splitOn ? brandIds.map((id, k) => (
                      <Bar key={'r' + id} dataKey={'r_' + id} stackId="real" fill={brandColor(id)} maxBarSize={44} radius={k === brandIds.length - 1 ? [3, 3, 0, 0] : 0} animationDuration={450} animationEasing="ease-out">
                        {rows.map((r, i) => <Cell key={i} fill={fillFor(r, brandColor(id))} fillOpacity={opacity(i)} />)}
                      </Bar>
                    )) : (
                      <Bar dataKey="real" fill="var(--foreground)" maxBarSize={44} radius={[3, 3, 0, 0]} animationDuration={450} animationEasing="ease-out">
                        {rows.map((r, i) => <Cell key={i} fill={fillFor(r, 'var(--foreground)')} fillOpacity={opacity(i)} />)}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-muted-foreground">
        {splitOn ? brandIds.map((id) => <span key={id} className="flex items-center gap-1.5"><i className="size-2.5 rounded-[2px]" style={{ background: brandColor(id) }} />{brands.find((b) => b.id === id)?.name}</span>)
          : <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[2px] bg-foreground" />Real</span>}
        {lens === 'event' && <span className="flex items-center gap-1.5"><i className="proj-hatch size-2.5 rounded-[2px] border border-dashed border-proj-line" />Proyectado (presupuestos)</span>}
        <span>{rangeLabel}{empty > 0 ? ` · ${empty} ${unit === 'mes' ? 'meses' : unit === 'día' ? 'días' : 'semanas'} sin ventas` : ''}</span>
        <span className="ml-auto">{lens === 'event' ? 'Ingreso de liquidación en la fecha del evento. No incluye la venta web del día (sería contarla dos veces).' : 'Cobrado en la web de tickets (entradas y mesas), por día de venta. No incluye barra ni puerta.'}</span>
      </div>
    </section>
  );
}

function Stat({ label, children }) {
  return <div className="flex items-baseline gap-2"><dt className="text-muted-foreground">{label}</dt><dd>{children}</dd></div>;
}

// Tooltip animado: período, real por marca, proyectado aparte, cambio vs el período previo y qué fechas lo componen.
function ChartTip({ active, payload, group, brands }) {
  const r = active && payload && payload.length ? payload[0].payload : null;
  return (
    <AnimatePresence>
      {r && (
        <motion.div key="tip" initial={{ opacity: 0, y: 4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          className="min-w-52 max-w-72 rounded-lg border bg-popover px-3 py-2.5 text-[12px] text-popover-foreground shadow-xl">
          <p className="font-medium">{longLabel(r.key, group)}</p>
          {r.b.real > 0 ? (
            <div className="mt-1.5 flex items-baseline justify-between gap-4"><span className="text-muted-foreground">Real</span><span className="num text-[14px] font-medium">{money(r.b.real)}</span></div>
          ) : r.b.proj === 0 && <p className="mt-1 text-muted-foreground">Sin ventas en este período.</p>}
          {Object.keys(r.b.byBrand).length > 1 && Object.entries(r.b.byBrand).map(([id, v]) => (
            <div key={id} className="flex items-center justify-between gap-4 text-muted-foreground"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full" style={{ background: brandColor(id) }} />{brands.find((b) => b.id === id)?.name}</span><span className="num">{money(v)}</span></div>
          ))}
          {r.b.proj > 0 && <div className="mt-1 flex items-baseline justify-between gap-4"><span className="flex items-center gap-1.5 text-proj"><i className="proj-hatch size-2 rounded-[2px] border border-proj-line" />Proyectado</span><span className="num text-proj">{money(r.b.proj)}</span></div>}
          {r.b.real > 0 && r.prevReal > 0 && (() => { const c = ((r.b.real - r.prevReal) / r.prevReal) * 100; return <p className={cn('mt-1 text-[11.5px]', c >= 0 ? 'text-good' : 'text-bad')}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(1)}% vs. el período anterior</p>; })()}
          {r.b.items.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t pt-1.5 text-muted-foreground">
              {r.b.items.slice(0, 4).map((it) => <li key={it.id} className="flex items-center gap-1.5 truncate"><i className="h-2.5 w-[2px] shrink-0 rounded-full" style={{ background: brandColor(it.brand) }} /><span className="truncate">{it.name}</span>{it.proj && <span className="text-[10.5px] text-proj">proy.</span>}</li>)}
              {r.b.items.length > 4 && <li>y {r.b.items.length - 4} más</li>}
            </ul>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
