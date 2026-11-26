// Visualización financiera principal del resumen (dirección visual de Midday, código propio).
// Una métrica elegible a la vez; su total real es la cifra dominante. Lo proyectado va aparte, rayado y punteado.
// Escalonado para datos por fecha de evento (el ingreso ocurre un día puntual); curva monótona para series continuas.
// Nunca interpola sobre datos desconocidos: un faltante es un hueco marcado, no un cero ni una línea.
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { Highlight, HighlightItem } from '@animate-ui/react/primitives/effects/highlight';
import { ChevronDownIcon, InfoIcon, TableIcon, XIcon, ArrowUpRightIcon, ArrowDownRightIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useOS, useSummary } from '../../os/store.jsx';
import { cn, money, brandColor, limaISO } from '../../lib.js';
import {
  METRICS, metricById, LOCAL_GLOSSARY, pointsFor, availability, buildBuckets, readout, previousRange,
  monotonePath, runs, niceDomain, tickLabel, periodLabel, dm,
} from './metrics.js';

const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } return null; };
const GROUPS = [['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']];
const UNIT = { day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'] };
const NUM = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
const shortMoney = (v) => {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1000) return `${s}S/ ${(a / 1000).toFixed(a >= 10000 || a % 1000 === 0 ? 0 : 1)}k`;
  return `${s}S/ ${Math.round(a)}`;
};

function useSize(ref) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

// Interpola los valores cuando cambia la métrica o la marca sobre los mismos períodos (causa → efecto visible).
function useTween(target, sig, reduce) {
  const [cur, setCur] = useState(target);
  const prev = useRef({ sig, value: target });
  useEffect(() => {
    const from = prev.current;
    prev.current = { sig, value: target };
    if (reduce || from.sig !== sig || !from.value) { setCur(target); return undefined; }
    const a = from.value, b = target, t0 = performance.now(), D = 450;
    const ease = (t) => 1 - (1 - t) ** 3;
    let raf;
    const lerp = (x, y, k) => (x == null || y == null ? y : x + (y - x) * k);
    const step = (now) => {
      const k = ease(Math.min(1, (now - t0) / D));
      setCur({
        real: b.real.map((v, i) => lerp(a.real[i], v, k)),
        proj: b.proj.map((v, i) => lerp(a.proj[i], v, k)),
        prev: b.prev.map((v, i) => lerp(a.prev[i], v, k)),
        lo: lerp(a.lo, b.lo, k), hi: lerp(a.hi, b.hi, k),
      });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, sig, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  // Antes de que corra el efecto, el estado puede ser del render anterior: nunca devolver series de otro largo.
  if (prev.current.sig !== sig || !cur || cur.real.length !== target.real.length) return target;
  return cur;
}

export default function PrimaryChart({ from, to, rangeLabel, actual }) {
  const { data, workspace, setDrawer, withTaxes } = useOS();
  const brand = workspace === 'group' ? null : workspace;
  const today = limaISO();
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, '');
  // Historia completa del alcance (marca, impuestos) para poder comparar con el período anterior.
  const { summary: full } = useSummary({ brand });
  const events = (full || data.os.summary).events;
  const ledger = data.os.ledgerSummary;
  const ctx = { events, sales: data.os.sales, financeEvents: data.finance.events, ledger, brand, today };

  const [metricId, setMetricState] = useState(() => ls('os_metric') || 'revenue');
  const avail = useMemo(() => Object.fromEntries(METRICS.map((m) => [m.id, availability(m.id, ctx)])), [events, data.os.sales, ledger, brand]); // eslint-disable-line react-hooks/exhaustive-deps
  const metric = metricById(avail[metricId] && avail[metricId].ok ? metricId : 'revenue');
  const setMetric = (id) => { setMetricState(id); ls('os_metric', id); setActive(null); setPinned(null); };
  const [groupPref, setGroupState] = useState(() => ls('os_rev_group') || 'week');
  const group = metric.groups && !metric.groups.includes(groupPref) ? metric.groups[0] : groupPref;
  const setGroup = (g) => { setGroupState(g); ls('os_rev_group', g); setActive(null); setPinned(null); };
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [active, setActive] = useState(null);
  const [pinned, setPinned] = useState(null);

  const points = useMemo(() => pointsFor(metric.id, ctx), [metric.id, events, data.os.sales, ledger, brand]); // eslint-disable-line react-hooks/exhaustive-deps
  const continuous = metric.curve === 'smooth';
  const buckets = useMemo(() => buildBuckets(points, { group, from, to, today, continuous }), [points, group, from, to, today, continuous]);
  const R = readout(buckets);
  const fewReal = R.realPeriods < 2; // con menos de 2 períodos con valor no se dibuja tendencia (ni continua): se marca el punto.

  // Período anterior (mismo largo): sólo se ofrece cuando ambos lados tienen al menos 2 períodos con valor.
  const prevR = previousRange(from, to, today);
  const prevBuckets = useMemo(() => (prevR ? buildBuckets(points.filter((p) => p.state === 'real'), { group, from: prevR.from, to: prevR.to, today, continuous }) : []), [points, group, prevR && prevR.from, prevR && prevR.to, today, continuous]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevRead = readout(prevBuckets);
  const canCompare = !!prevR && prevRead.realPeriods >= 2 && R.realPeriods >= 2;
  const change = prevR && R.hasReal && prevRead.total > 0 && !metric.projOnly ? ((R.total - prevRead.total) / Math.abs(prevRead.total)) * 100 : null;

  // Series por marca (sólo líneas reales, en el alcance de grupo).
  const brands = data.finance.brands;
  const splitOn = split && !brand && !metric.projOnly && metric.source === 'events' && !fewReal;
  const brandSeries = useMemo(() => {
    if (!splitOn) return [];
    return brands.map((b) => {
      const bb = buildBuckets(pointsFor(metric.id, { ...ctx, brand: b.id }), { group, from: buckets[0] && buckets[0].key, to: buckets.length ? buckets[buckets.length - 1].end : to, today, continuous });
      return { id: b.id, name: b.name, values: buckets.map((x) => { const m = bb.find((y) => y.key === x.key); return m ? m.real : null; }) };
    });
  }, [splitOn, metric.id, buckets, group]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Geometría ----------
  const boxRef = useRef(null);
  const width = useSize(boxRef);
  const mobile = width > 0 && width < 560;
  const H = mobile ? 210 : 272;
  const M = { top: 26, right: 8, bottom: 26, left: mobile ? 44 : 56 };
  const W = Math.max(0, width - M.left - M.right);
  const n = buckets.length;
  const bw = n ? W / n : 0;
  const xc = (i) => M.left + bw * (i + 0.5);
  const target = useMemo(() => {
    const real = buckets.map((b) => b.real);
    const proj = buckets.map((b) => b.proj);
    const prev = buckets.map((_, i) => (compare && canCompare && prevBuckets[i] ? prevBuckets[i].real : null));
    const dom = niceDomain([...real, ...proj, ...(compare && canCompare ? prev : []), ...brandSeries.flatMap((s) => s.values)]);
    return { real, proj, prev, lo: dom.lo, hi: dom.hi };
  }, [buckets, compare, canCompare, prevBuckets, brandSeries]);
  const sig = `${group}|${n}|${buckets[0] && buckets[0].key}`;
  const tw = useTween(target, sig, reduce);
  const emptyDomain = niceDomain([...target.real, ...target.proj]).empty;
  const ticks = emptyDomain ? [0] : niceDomain([tw.lo, tw.hi]).ticks.filter((t) => t >= tw.lo - 1e-6 && t <= tw.hi + 1e-6);
  const y = (v) => M.top + (H - M.top - M.bottom) * (1 - (v - tw.lo) / (tw.hi - tw.lo || 1));
  const base = y(Math.max(tw.lo, Math.min(0, tw.hi)));

  const stepPath = (vals, close) => runs(vals).map(({ from: a, to: b }) => {
    let d = `M${xc(a) - bw / 2},${close ? base : y(vals[a])}`;
    if (close) d += `V${y(vals[a])}`;
    for (let i = a; i <= b; i++) { d += `H${xc(i) + bw / 2}`; if (i < b) d += `V${y(vals[i + 1])}`; }
    if (close) d += `V${base}`;
    return d;
  }).join('');
  const smoothPath = (vals, close) => runs(vals).map(({ from: a, to: b }) => {
    const pts = []; for (let i = a; i <= b; i++) pts.push([xc(i), y(vals[i])]);
    const line = monotonePath(pts);
    return close ? `${line}L${pts[pts.length - 1][0]},${base}L${pts[0][0]},${base}Z` : line;
  }).join('');
  const pathFor = (vals, close) => (continuous ? smoothPath(vals, close) : stepPath(vals, close));

  // Etiquetas del eje X sin solaparse.
  const multiYear = n && buckets[0].key.slice(0, 4) !== buckets[n - 1].key.slice(0, 4);
  const every = Math.max(1, Math.ceil(64 / Math.max(bw, 1)));
  const todayIdx = buckets.findIndex((b) => today >= b.key && today <= b.end);

  // ---------- Interacción ----------
  const plotRef = useRef(null);
  const idxAt = (clientX) => {
    const r = plotRef.current.getBoundingClientRect();
    const i = Math.floor((clientX - r.left - M.left) / (bw || 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const onKey = (e) => {
    if (!n) return;
    const lastReal = buckets.reduce((k, b, i) => (b.hasReal ? i : k), -1);
    const cur = active == null ? (lastReal >= 0 ? lastReal : todayIdx >= 0 ? todayIdx : n - 1) : active;
    const go = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: n - 1, PageUp: cur - 4, PageDown: cur + 4 }[e.key];
    if (go != null) { e.preventDefault(); setActive(Math.max(0, Math.min(n - 1, go))); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(cur); setPinned(pinned === cur ? null : cur); return; }
    if (e.key === 'Escape') { setPinned(null); setActive(null); }
  };
  useEffect(() => { setActive(null); setPinned(null); }, [workspace, from, to]);
  const shown = active != null ? buckets[active] : null;
  const pin = pinned != null ? buckets[pinned] : null;

  const glossary = data.os.metrics[metric.glossary] || LOCAL_GLOSSARY[metric.glossary] || { label: metric.long };
  const source = metric.source === 'tickets'
    ? (data.os.integrations || []).find((i) => i.id === 'tickets')
    : metric.source === 'ledger' ? { name: 'Libro de transacciones', lastSync: data.ledger && data.ledger.updatedAt } : { name: 'Liquidaciones y presupuestos', lastSync: data.generatedAt };
  const unit = UNIT[group];
  const nextDate = events.filter((f) => f.kind === 'budget' && f.date >= today && (!brand || f.brand === brand)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const isCash = metric.id === 'cash';

  // Texto para lectores de pantalla y para el resumen visible.
  const summaryText = !n ? 'Sin datos en este rango.'
    : `${metric.long} ${rangeLabel.toLowerCase()}: ${R.hasReal ? money(R.total) : 'sin datos reales'}` +
      `${R.realPeriods ? ` en ${R.realPeriods} ${R.realPeriods === 1 ? unit[0] : unit[1]} con valor` : ''}.` +
      `${R.hasProj ? ` Proyectado aparte: ${money(R.projTotal)}.` : ''}${R.missing ? ` ${R.missing} fecha${R.missing === 1 ? '' : 's'} sin liquidar.` : ''}${R.incomplete ? ` ${R.incomplete} presupuesto${R.incomplete === 1 ? '' : 's'} incompleto${R.incomplete === 1 ? '' : 's'}.` : ''}`;
  const announce = shown ? describeBucket(shown, group) : pin ? describeBucket(pin, group) : '';

  return (
    <section aria-labelledby={`${uid}-h`} className="surface relative px-4 pb-3 pt-4 md:px-6 md:pt-5">
      {/* Cabecera: métrica (dominante), selector y lectura de contexto */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-start gap-1 text-[13px] text-muted-foreground">
            <h2 id={`${uid}-h`} className="min-w-0 pt-px">{metric.long}, {rangeLabel.toLowerCase()}</h2>
            <GlossaryButton g={glossary} onOpen={() => setDrawer({ type: 'metric', id: metric.glossary })} serverMetric={!!data.os.metrics[metric.glossary]} />
          </div>
          <Figure metric={metric} R={R} isCash={isCash} cash={avail.cash} />
          <Context metric={metric} R={R} change={change} prevR={prevR} unit={unit} actual={actual} onResult={() => setDrawer({ type: 'metric', id: 'result' })} />
        </div>
        <MetricPicker metric={metric} avail={avail} onPick={setMetric} />
      </div>

      {/* Controles del gráfico */}
      {!isCash && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Segmented value={group} onChange={setGroup} options={GROUPS.map(([k, l]) => ({ id: k, label: l, disabled: metric.groups && !metric.groups.includes(k), hint: 'El flujo de caja se registra por semana' }))} label="Agrupar por" />
          {!brand && metric.source === 'events' && !metric.projOnly && (
            <Toggle on={splitOn} disabled={fewReal} onClick={() => setSplit(!split)} hint={fewReal ? 'Hace falta más de un período real para comparar marcas' : null}>
              <span className="flex -space-x-0.5" aria-hidden>{brands.map((b) => <i key={b.id} className="size-2 rounded-full ring-1 ring-panel" style={{ background: brandColor(b.id) }} />)}</span>Por marca
            </Toggle>
          )}
          {!metric.projOnly && (
            <Toggle on={compare && canCompare} disabled={!canCompare} onClick={() => setCompare(!compare)}
              hint={!prevR ? 'Elige un período con inicio para comparar' : !canCompare ? 'El período anterior no tiene datos suficientes para comparar' : null}>
              vs. período anterior
            </Toggle>
          )}
          <button type="button" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}
            className="press ml-auto flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <TableIcon className="size-3.5" />{showTable ? 'Ocultar datos' : 'Ver datos'}
          </button>
        </div>
      )}

      {/* Gráfico */}
      {!isCash && (
        <div ref={boxRef} className="relative mt-3 min-w-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={sig} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}>
              {!n || width === 0 ? (
                <div style={{ height: H }} className="flex items-center text-[13px] text-muted-foreground">{width === 0 ? '' : metric.id === 'web' ? 'La web de tickets no registra ventas pagadas en este rango.' : 'No hay fechas con datos en este rango. Prueba con "Todo el historial".'}</div>
              ) : (
                <div ref={plotRef} tabIndex={0} role="group" aria-roledescription="gráfico" aria-label={`${summaryText} Usa las flechas para recorrer los períodos y Enter para ver sus fechas.`}
                  onKeyDown={onKey} onPointerMove={(e) => { if (e.pointerType !== 'touch') setActive(idxAt(e.clientX)); }} onPointerLeave={() => setActive(null)}
                  onPointerUp={(e) => { const i = idxAt(e.clientX); setPinned(pinned === i ? null : i); setActive(e.pointerType === 'touch' ? null : i); }}
                  className="chart-plot relative cursor-crosshair touch-pan-y select-none">
                  <svg width={width} height={H} aria-hidden className="block overflow-visible">
                    <defs>
                      <pattern id={`${uid}-ink`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--chart-hatch)" strokeWidth="1" /></pattern>
                      <pattern id={`${uid}-proj`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--proj)" strokeOpacity="0.5" strokeWidth="1" /></pattern>
                      <pattern id={`${uid}-miss`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--missing)" strokeOpacity="0.3" strokeWidth="1" /></pattern>
                      <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity="1" /><stop offset="100%" stopColor="#fff" stopOpacity="0.15" /></linearGradient>
                      <mask id={`${uid}-mask`}><rect x="0" y="0" width={width} height={H} fill={`url(#${uid}-fade)`} /></mask>
                    </defs>

                    {/* Cuadrícula horizontal punteada y eje Y */}
                    {ticks.map((t) => (
                      <g key={t}>
                        <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray={t === 0 ? undefined : '2 4'} />
                        <text x={M.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="chart-axis">{t === 0 ? '0' : shortMoney(t)}</text>
                      </g>
                    ))}

                    {/* Hoy: separa lo ocurrido de lo que viene */}
                    {todayIdx >= 0 && todayIdx < n - 1 && (
                      <g>
                        <line x1={xc(todayIdx) + bw / 2} x2={xc(todayIdx) + bw / 2} y1={6} y2={H - M.bottom} stroke="var(--hairline)" strokeDasharray="1 3" />
                        <text x={xc(todayIdx) + bw / 2 - 6} y={12} textAnchor="end" className="chart-axis">hoy</text>
                      </g>
                    )}

                    {/* Datos faltantes: banda rayada gris, sin línea encima */}
                    {buckets.map((b, i) => b.missing.length > 0 && (
                      <g key={'m' + i}>
                        {b.real == null && b.proj == null && <rect x={xc(i) - bw / 2 + 1} y={M.top} width={Math.max(bw - 2, 2)} height={H - M.top - M.bottom} fill={`url(#${uid}-miss)`} />}
                        <circle cx={xc(i) + (b.proj != null ? Math.min(10, bw / 4) : 0)} cy={base} r="3.5" fill="var(--panel)" stroke="var(--missing)" strokeDasharray="2 1.5" />
                      </g>
                    ))}

                    {/* Fin de la cobertura de una serie continua: desde aquí no hay dato (no es cero) */}
                    {continuous && (() => { const last = buckets.reduce((k, b, i) => (b.covered ? i : k), -1); return last >= 0 && last < n - 1 ? (
                      <g>
                        <line x1={xc(last) + bw / 2} x2={xc(last) + bw / 2} y1={M.top} y2={H - M.bottom} stroke="var(--missing)" strokeDasharray="2 3" />
                        <text x={xc(last) + bw / 2 + 6} y={M.top + 10} className="chart-axis">datos hasta {dm(buckets[last].end)}</text>
                      </g>
                    ) : null; })()}

                    {/* Período anterior: línea tenue, sólo como referencia */}
                    {compare && canCompare && <path d={pathFor(tw.prev, false)} fill="none" stroke="var(--chart-axis)" strokeOpacity="0.7" strokeWidth="1" strokeDasharray="2 3" />}

                    {/* Proyectado: rayado ámbar y trazo punteado, separado de lo real */}
                    {/* Proyectado: área escalonada sólo con 2 o más períodos seguidos; si no, el punto con su fecha */}
                    {tw.proj.some((v) => v != null) && (() => {
                      const long = runs(tw.proj).filter((r) => r.to > r.from);
                      const lone = runs(tw.proj).filter((r) => r.to === r.from).map((r) => r.from);
                      const vals = tw.proj.map((v, i) => (long.some((r) => i >= r.from && i <= r.to) ? v : null));
                      return (
                        <>
                          {long.length > 0 && <path d={pathFor(vals, true)} fill={`url(#${uid}-proj)`} />}
                          {long.length > 0 && <path d={pathFor(vals, true)} fill="none" stroke="var(--proj)" strokeWidth="1.25" strokeDasharray="4 3" strokeLinejoin="round" />}
                          {lone.filter((i) => buckets[i]).map((i) => {
                            const names = buckets[i].items.filter((it) => it.state === 'proj').sort((a, b) => (b.value || 0) - (a.value || 0));
                            return (
                              <g key={'pj' + i}>
                                <line x1={xc(i)} x2={xc(i)} y1={base} y2={y(tw.proj[i])} stroke="var(--proj)" strokeWidth="1.25" strokeDasharray="3 3" />
                                <circle cx={xc(i)} cy={y(tw.proj[i])} r="4.5" fill="var(--panel)" stroke="var(--proj)" strokeWidth="1.5" strokeDasharray="2.5 1.5" />
                                {!mobile && active !== i && names.length > 0 && <text x={xc(i) > width * 0.66 ? xc(i) - 10 : xc(i) + 10} textAnchor={xc(i) > width * 0.66 ? 'end' : 'start'} y={y(tw.proj[i]) - 4} className="chart-axis" style={{ fill: 'var(--proj)' }}>{names[0].name}{names.length > 1 ? ` y ${names.length - 1} más` : ''}</text>}
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Real: trazo fino continuo y relleno rayado que se desvanece hacia la base */}
                    {!fewReal && !splitOn && (
                      <>
                        <path d={pathFor(tw.real, true)} fill={`url(#${uid}-ink)`} mask={`url(#${uid}-mask)`} />
                        <path d={pathFor(tw.real, false)} fill="none" stroke="var(--chart-ink)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                      </>
                    )}
                    {splitOn && brandSeries.map((s) => <path key={s.id} d={pathFor(s.values, false)} fill="none" stroke={brandColor(s.id)} strokeWidth="1.5" strokeLinejoin="round" />)}

                    {/* Pocos datos reales: el punto real, con su fecha, sin inventar una tendencia */}
                    {fewReal && buckets.map((b, i) => b.hasReal && tw.real[i] !== undefined && (
                      <g key={'p' + i}>
                        <line x1={xc(i)} x2={xc(i)} y1={base} y2={y(tw.real[i] ?? b.real)} stroke="var(--chart-ink)" strokeWidth="1" strokeDasharray="2 2" />
                        <circle cx={xc(i)} cy={y(tw.real[i] ?? b.real)} r="4.5" fill="var(--chart-ink)" />
                        {!mobile && active !== i && (
                          <text x={xc(i) > width * 0.66 ? xc(i) - 10 : xc(i) + 10} textAnchor={xc(i) > width * 0.66 ? 'end' : 'start'} y={y(tw.real[i] ?? b.real) - 4} className="chart-axis" style={{ fill: 'var(--foreground)' }}>
                            {b.items.filter((it) => it.state === 'real').sort((x, z) => (z.value || 0) - (x.value || 0)).map((it) => it.name).slice(0, 1).join('')}
                            {b.items.filter((it) => it.state === 'real').length > 1 ? ` y ${b.items.filter((it) => it.state === 'real').length - 1} más` : ''}
                          </text>
                        )}
                      </g>
                    ))}

                    {/* Cursor: línea vertical y marcador */}
                    {shown && (
                      <g>
                        <line x1={xc(active)} x2={xc(active)} y1={M.top} y2={H - M.bottom} stroke="var(--chart-ink)" strokeOpacity="0.35" />
                        {tw.real[active] != null && !splitOn && <circle cx={xc(active)} cy={y(tw.real[active])} r="4.5" fill="var(--panel)" stroke="var(--chart-ink)" strokeWidth="1.5" />}
                        {tw.proj[active] != null && <circle cx={xc(active)} cy={y(tw.proj[active])} r="4" fill="var(--panel)" stroke="var(--proj)" strokeWidth="1.5" strokeDasharray="2 1.5" />}
                      </g>
                    )}
                    {pin && pinned !== active && (
                      <g>
                        <line x1={xc(pinned)} x2={xc(pinned)} y1={M.top} y2={H - M.bottom} stroke="var(--chart-ink)" strokeOpacity="0.5" strokeDasharray="3 3" />
                        {tw.real[pinned] != null && pin.hasReal && <circle cx={xc(pinned)} cy={y(tw.real[pinned])} r="5" fill="var(--panel)" stroke="var(--chart-ink)" strokeWidth="1.75" />}
                        {tw.proj[pinned] != null && <circle cx={xc(pinned)} cy={y(tw.proj[pinned])} r="5" fill="var(--panel)" stroke="var(--proj)" strokeWidth="1.75" />}
                      </g>
                    )}

                    {/* Eje X */}
                    {buckets.map((b, i) => (i % every === 0 || i === n - 1) && (i === n - 1 ? (n - 1) % every >= every / 2 || every === 1 : true) && (
                      <text key={'x' + i} x={xc(i)} y={H - 6} textAnchor="middle" className="chart-axis">{tickLabel(b.key, group, multiYear)}</text>
                    ))}
                  </svg>
                  {emptyDomain && (
                    <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-[13px] text-muted-foreground">
                      {nextDate ? `Sin valores todavía. Próxima fecha: ${nextDate.name}, ${dm(nextDate.date)}.` : 'Sin valores en este rango.'}
                    </p>
                  )}
                  <ChartTip H={H} b={pinned === active ? null : shown} idx={active} x={shown ? xc(active) : 0} yv={shown ? y(Math.max(tw.real[active] ?? 0, tw.proj[active] ?? 0)) : 0} width={width} group={group} metric={metric} brandSeries={brandSeries} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
          <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
      )}

      {/* Fechas del período elegido: todas, no sólo la primera */}
      <AnimatePresence initial={false}>
        {pin && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }} className="overflow-hidden">
            <PeriodDetail b={pin} group={group} onClose={() => setPinned(null)} onOpen={(id) => setDrawer({ type: 'event', id })} />
          </motion.div>
        )}
      </AnimatePresence>

      {showTable && !isCash && <DataTable buckets={buckets} group={group} metric={metric} />}

      {/* Leyenda y fuente */}
      {!isCash && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-divider pt-3 text-[12px] text-muted-foreground">
          {!metric.projOnly && !splitOn && R.hasReal && <Legend swatch={<i className="hatch-ink inline-block h-2.5 w-3.5 rounded-[2px] border-t-[1.5px] border-chart-ink" />}>Real</Legend>}
          {splitOn && brandSeries.map((s) => <Legend key={s.id} swatch={<i className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: brandColor(s.id) }} />}>{s.name}</Legend>)}
          {R.hasProj && <Legend swatch={<i className="proj-hatch inline-block h-2.5 w-3.5 rounded-[2px] border border-dashed border-proj" />}>Proyectado</Legend>}
          {R.missing + R.incomplete > 0 && <Legend swatch={<i className="hatch-muted inline-block h-2.5 w-3.5 rounded-[2px]" />}>Sin dato</Legend>}
          {compare && canCompare && <Legend swatch={<i className="inline-block w-3.5 border-t border-dashed border-faint" />}>Período anterior</Legend>}
          <span className="ml-auto">{source && <>{source.name}{source.lastSync ? <>, actualizado <time dateTime={source.lastSync}>{stamp(source.lastSync)}</time></> : null}</>}</span>
        </div>
      )}
    </section>
  );
}

const shortPeriod = (b, g) => (g === 'week' ? (b.key.slice(5, 7) === b.end.slice(5, 7) ? `${+b.key.slice(8, 10)}–${dm(b.end)}` : `${dm(b.key)}–${dm(b.end)}`) : g === 'day' ? dm(b.key) : periodLabel(b.key, g));
const stamp = (iso) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function describeBucket(b, group) {
  const parts = [periodLabel(b.key, group)];
  if (b.real === 0) parts.push(b.items.length ? 'real S/ 0' : 'sin fechas ni ventas (cero confirmado)');
  else if (b.real != null) parts.push(`real ${money(b.real)}`);
  else if (b.missing.length) parts.push('sin dato real');
  else if (b.future) parts.push('todavía no ocurre');
  if (b.proj != null) parts.push(`proyectado ${money(b.proj)}`);
  if (b.items.length) parts.push(`${b.items.length} fecha${b.items.length === 1 ? '' : 's'}`);
  return parts.join(', ');
}

// ---------- Cifra dominante ----------
function Figure({ metric, R, isCash, cash }) {
  const value = isCash ? (cash.ok ? cash.value : null) : metric.projOnly ? (R.hasProj ? R.projTotal : null) : R.hasReal ? R.total : null;
  const neg = value != null && value < 0;
  return (
    <p className="mt-2 flex min-h-[52px] items-baseline gap-2 md:min-h-[60px]">
      {value == null ? (
        <span className="text-[20px] leading-[52px] tracking-[-0.02em] text-muted-foreground md:leading-[60px]">
          {isCash ? 'No disponible' : metric.projOnly ? 'Sin proyección' : 'Sin datos reales en el período'}
        </span>
      ) : (
        <>
          <span className="text-[20px] text-muted-foreground" aria-hidden="true">{neg ? '−S/' : 'S/'}</span><span className="sr-only">{neg ? 'menos ' : ''}</span>
          <span className="sr-only">{money(Math.abs(value), 2)}</span>
          <NumberFlow aria-hidden="true" value={Math.abs(value)} locales="es-PE" format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
            className={cn('figure-hero text-[44px] md:text-[54px]', metric.projOnly && 'text-proj')} transformTiming={NUM} spinTiming={NUM} opacityTiming={{ duration: 250, easing: 'ease-out' }} willChange />
          {neg && <span className="ml-1 self-center rounded-md border border-bad/40 px-1.5 py-0.5 text-[12px] text-bad">Pérdida</span>}
        </>
      )}
    </p>
  );
}

function Context({ metric, R, change, prevR, unit, actual, onResult }) {
  const bits = [];
  // Ingresos sin su resultado engañan: si hubo cierres, el resultado real va al lado (con su signo y color real).
  if (metric.id === 'revenue' && actual && actual.count > 0 && actual.result != null) {
    bits.push(<button key="r" type="button" onClick={onResult} className="-my-1.5 rounded py-1.5 underline decoration-hairline underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring">Resultado real <span className={cn('num', actual.result < 0 ? 'text-bad' : 'text-good')}>{actual.result < 0 ? '−' : '+'}{money(Math.abs(actual.result))}</span></button>);
  }
  if (!metric.projOnly && R.hasReal && metric.source === 'events') bits.push(<span key="n" className="hidden sm:inline">{R.realItems} fecha{R.realItems === 1 ? '' : 's'} con cierre real</span>);
  if (!metric.projOnly && R.hasReal && metric.source !== 'events') bits.push(<span key="n">{R.realPeriods} {R.realPeriods === 1 ? unit[0] : unit[1]} con movimiento</span>);
  if (change != null) {
    bits.push(
      <span key="c" className={cn('inline-flex items-center gap-0.5', (metric.id === 'expenses' ? change <= 0 : change >= 0) ? 'text-good' : 'text-bad')}>
        {change >= 0 ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
        <NumberFlow value={Math.abs(change) / 100} locales="es-PE" format={{ style: 'percent', maximumFractionDigits: 1 }} className="num" />
        <span className="ml-1 text-muted-foreground">vs. {dm(prevR.from)} al {dm(prevR.to)}</span>
      </span>,
    );
  }
  if (!metric.projOnly && R.hasProj) bits.push(<span key="p" className="text-proj"><i className="proj-hatch mr-1.5 inline-block size-2.5 rounded-[2px] border border-dashed border-proj align-[-1px]" />Proyectado aparte: <span className="num">{money(R.projTotal)}</span> en {R.projCount} fecha{R.projCount === 1 ? '' : 's'}</span>);
  if (metric.projOnly && R.projCount) bits.push(<span key="pc" className="text-foreground">{R.incomplete ? `Parcial: ${R.projCount} de ${R.projCount + R.incomplete} fechas con presupuesto completo` : `${R.projCount} fecha${R.projCount === 1 ? '' : 's'} con presupuesto`}</span>);
  if (R.missing) bits.push(<span key="m">{R.missing} fecha{R.missing === 1 ? '' : 's'} sin liquidar</span>);
  if (R.incomplete) bits.push(<span key="i" className="hidden sm:inline">{R.incomplete} presupuesto{R.incomplete === 1 ? '' : 's'} incompleto{R.incomplete === 1 ? '' : 's'}</span>);
  if (R.best) bits.push(<span key="b">Mejor {unit[0]}: <span className="num text-foreground">{money(R.best.real)}</span></span>);
  if (R.avg != null) bits.push(<span key="a">Promedio: <span className="num text-foreground">{money(R.avg)}</span></span>);
  if (!bits.length) return <div className="h-5" />;
  return <p className="mt-2 flex min-h-5 flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted-foreground">{bits}</p>;
}

// ---------- Selector de métrica ----------
function MetricPicker({ metric, avail, onPick }) {
  const groups = [['Resultados', ['revenue', 'profit', 'expenses']], ['Caja', ['cash', 'cashflow']], ['Ventas', ['web']], ['Proyección', ['projRevenue', 'projProfit']]];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Métrica: ${metric.label}. Cambiar métrica`}
          className="press flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-panel-border px-2.5 text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent">
          {metric.projOnly && <i className="proj-hatch size-2.5 rounded-[2px] border border-dashed border-proj" aria-hidden />}
          {metric.label}<ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuRadioGroup value={metric.id} onValueChange={onPick}>
          {groups.map(([g, ids], gi) => (
            <React.Fragment key={g}>
              {gi > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">{g}</DropdownMenuLabel>
              {ids.map((id) => {
                const m = METRICS.find((x) => x.id === id); const a = avail[id];
                return (
                  <DropdownMenuRadioItem key={id} value={id} disabled={!a.ok} className="items-start py-1.5">
                    <span className="min-w-0">
                      <span className="block text-[13px]">{m.label}</span>
                      {!a.ok && <span className="block text-[12px] leading-snug text-muted-foreground">{a.reason}</span>}
                    </span>
                  </DropdownMenuRadioItem>
                );
              })}
            </React.Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlossaryButton({ g, onOpen, serverMetric }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Qué es ${g.label}`} className="press -my-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded sm:my-0 sm:size-6 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><InfoIcon className="size-3.5" /></button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 text-[13px]">
        <p className="font-medium">{g.label}</p>
        <p className="mt-1 text-muted-foreground">{g.formula}</p>
        {g.notes && <p className="mt-2 text-[12px] text-muted-foreground">{g.notes}</p>}
        {serverMetric && <button type="button" onClick={onOpen} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">Ver las fechas que lo componen<ArrowUpRightIcon className="size-3.5" /></button>}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Controles ----------
function Segmented({ value, onChange, options, label }) {
  return (
    <Highlight controlledItems mode="parent" value={value} hover={false} click={false}
      className="rounded-md bg-panel shadow-[0_0_0_1px_var(--panel-border)]" containerClassName="flex rounded-lg bg-muted p-0.5" transition={{ type: 'spring', stiffness: 520, damping: 42 }}>
      <div role="radiogroup" aria-label={label} className="flex">
        {options.map((o) => (
          <HighlightItem key={o.id} value={o.id} asChild>
            <button type="button" role="radio" aria-checked={value === o.id} disabled={o.disabled} title={o.disabled ? o.hint : undefined} onClick={() => onChange(o.id)}
              className={cn('relative z-10 flex h-9 items-center rounded-md px-3 text-[13px] sm:h-8 sm:px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40', value === o.id ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>{o.label}</button>
          </HighlightItem>
        ))}
      </div>
    </Highlight>
  );
}

function Toggle({ on, disabled, onClick, children, hint }) {
  if (disabled) return null; // aparece cuando hay datos para usarlo (sin controles muertos en la barra)
  // En móvil un control desactivado sólo ocupa espacio: se oculta (en escritorio queda con su explicación).
  const btn = (
    <button type="button" aria-pressed={on} aria-disabled={disabled || undefined} onClick={disabled ? undefined : onClick}
      className={cn('press flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        on ? 'border-hairline bg-accent text-foreground' : 'border-panel-border text-muted-foreground hover:text-foreground', disabled && 'hidden cursor-not-allowed border-dashed text-faint hover:text-faint sm:flex')}>
      {children}
    </button>
  );
  if (!hint) return btn;
  return <Tooltip><TooltipTrigger asChild>{btn}</TooltipTrigger><TooltipContent className="max-w-60">{hint}</TooltipContent></Tooltip>;
}

const Legend = ({ swatch, children }) => <span className="inline-flex items-center gap-1.5">{swatch}{children}</span>;

// ---------- Tooltip flotante ----------
function ChartTip({ b, idx, x, yv, width, group, metric, brandSeries, H }) {
  // Al lado del punto (como Midday), nunca encima de los controles: se queda dentro del área del gráfico.
  const W = 232;
  const left = x + 16 + W < width ? x + 16 : Math.max(0, x - 16 - W);
  const top = Math.max(0, Math.min(yv - 36, (H || 272) - 160));
  return (
    <AnimatePresence>
      {b && (
        <motion.div key="tip" role="presentation" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1, x: left, y: top }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
          transition={{ x: { duration: 0.18, ease: [0.2, 0, 0, 1] }, y: { duration: 0.18, ease: [0.2, 0, 0, 1] }, opacity: { duration: 0.12 } }}
          style={{ width: W }} className="float-shadow pointer-events-none absolute left-0 top-0 z-20 rounded-lg bg-tooltip px-3 py-2.5 text-[12px] text-tooltip-foreground">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[14px] font-light tracking-[-0.02em]">{b.real != null ? money(b.real, 2) : b.proj != null ? money(b.proj, 2) : '—'}</span>
            <span className="shrink-0 text-tooltip-muted">{shortPeriod(b, group)}</span>
          </div>
          {b.missing.length > 0 && <p className="mt-1 text-tooltip-muted">{b.future ? '' : 'Sin dato real: '}{b.future ? b.missing[0].note : b.missing[0].note.toLowerCase()}{b.missing.length > 1 ? ` (y ${b.missing.length - 1} más)` : ''}.</p>}
          {b.real === 0 && !b.missing.length && <p className="mt-1 text-tooltip-muted">{`${metric.source === 'events' ? 'Sin fechas cerradas' : 'Sin ventas'} ${{ day: 'este día', week: 'esta semana', month: 'este mes' }[group]}.`}</p>}
          {b.real == null && b.future && !b.missing.length && b.proj == null && <p className="mt-1 text-tooltip-muted">Todavía no ocurre.</p>}
          {b.real != null && b.proj != null && <p className="mt-1 flex justify-between gap-3"><span className="text-tooltip-muted">Proyectado aparte</span><span className="num">{money(b.proj)}</span></p>}
          {brandSeries.length > 0 && brandSeries.map((s) => s.values[idx] ? <p key={s.id} className="mt-0.5 flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-tooltip-muted"><i className="size-1.5 rounded-full" style={{ background: brandColor(s.id) }} />{s.name}</span><span className="num">{money(s.values[idx])}</span></p> : null)}
          {b.items.length > 0 && (
            <ul className="mt-2 border-t border-white/10 pt-1.5">
              {b.items.slice(0, 3).map((it, i) => (
                <li key={i} className="flex items-start gap-1.5 text-tooltip-muted">
                  <i className="mt-[5px] size-1.5 shrink-0 rounded-full" style={{ background: it.brand ? brandColor(it.brand) : 'currentColor' }} />
                  <span className="line-clamp-2">{it.name}</span>
                  {it.state !== 'real' && <span className="ml-auto shrink-0 text-[11px]">{it.state === 'proj' ? 'proyectado' : 'sin dato'}</span>}
                </li>
              ))}
              {b.items.length > 3 && <li className="text-tooltip-muted">y {b.items.length - 3} más</li>}
            </ul>
          )}
          {b.items.some((it) => it.id) && <p className="mt-1.5 text-[11px] text-tooltip-muted">Selecciona el período para ver {b.items.length === 1 ? 'la fecha' : `sus ${b.items.length} fechas`}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------- Detalle del período fijado ----------
function PeriodDetail({ b, group, onClose, onOpen }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); if (r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [b.key]);
  return (
    <div ref={ref} className="mt-3 rounded-lg bg-muted/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-medium">{periodLabel(b.key, group)}</p>
        <span className="text-[12px] text-muted-foreground">{b.items.length ? `${b.items.length} fecha${b.items.length === 1 ? '' : 's'}` : 'Sin fechas'}</span>
        <button type="button" onClick={onClose} aria-label="Cerrar detalle del período" className="press ml-auto flex size-9 sm:size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><XIcon className="size-3.5" /></button>
      </div>
      {b.items.length > 0 && (
        <ul className="mt-1.5 grid gap-0.5">
          {b.items.map((it, i) => (
            <li key={i}>
              <button type="button" disabled={!it.id} onClick={() => it.id && onOpen(it.id)}
                className="press flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:bg-transparent">
                <i className="size-2 shrink-0 rounded-full" style={{ background: it.brand ? brandColor(it.brand) : 'var(--faint)' }} />
                <span className="min-w-0 flex-1 truncate">{it.name}</span>
                <span className={cn('num shrink-0', it.state === 'proj' && 'text-proj', it.state === 'missing' && 'text-muted-foreground')}>{it.state === 'missing' ? it.note : money(it.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Alternativa en tabla ----------
function DataTable({ buckets, group, metric }) {
  const rows = buckets.filter((b) => b.hasReal || b.proj != null || b.missing.length);
  return (
    <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label={`Datos de ${metric.long}`}>
      <table className="w-full min-w-[480px] text-[13px]">
        <caption className="sr-only">{metric.long} por {UNIT[group][0]}</caption>
        <thead><tr className="text-left text-[12px] text-muted-foreground [&>th]:h-8 [&>th]:border-b [&>th]:border-divider [&>th]:font-normal"><th>Período</th><th className="text-right">Real</th><th className="text-right">Proyectado</th><th className="pl-4">Fechas</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="py-3 text-muted-foreground">Sin períodos con datos.</td></tr>}
          {rows.map((b) => (
            <tr key={b.key} className="border-b border-divider">
              <td className="py-2">{periodLabel(b.key, group)}</td>
              <td className="num text-right">{b.real != null ? money(b.real) : <span className="text-muted-foreground">sin dato</span>}</td>
              <td className="num text-right text-proj">{b.proj != null ? money(b.proj) : ''}</td>
              <td className="truncate pl-4 text-muted-foreground">{b.items.map((i) => i.name).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
