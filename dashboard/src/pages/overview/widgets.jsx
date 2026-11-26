// Widgets del resumen ejecutivo. Sólo datos reales del OS: si falta un dato se dice, nunca se rellena.
// Lo real y lo proyectado nunca se suman ni se mezclan en el mismo indicador.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { ArrowUpRightIcon, ChevronRightIcon, CheckIcon, XIcon, ClockIcon, PlusIcon } from 'lucide-react';
import { useOS } from '../../os/store.jsx';
import { fmtDay, fmtStamp, relDays, StageBadge } from '../../os/kit.jsx';
import { t as tr, ease } from '../../os/motion.jsx';
import { cn, money, pct, brandColor, totals, byCategory, parseDate } from '../../lib.js';

// ---------- Primitivas ----------
const NUM_TIMING = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
export function Fig({ value, currency = true, decimals = 0, suffix, className }) {
  if (value == null || !isFinite(value)) return null;
  return (
    <><span className="sr-only">{currency ? money(value, decimals) : `${value}${suffix || ''}`}</span><NumberFlow aria-hidden="true" className={cn('num', className)} value={value} locales="es-PE" suffix={suffix} willChange
      format={currency ? { style: 'currency', currency: 'PEN', minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { minimumFractionDigits: 0, maximumFractionDigits: decimals }}
      transformTiming={NUM_TIMING} spinTiming={NUM_TIMING} opacityTiming={{ duration: 250, easing: 'ease-out' }} /></>
  );
}

export function NA({ children = 'No disponible', reason, className }) {
  return <span title={reason} className={cn('text-muted-foreground', className)}>{children}</span>;
}

export const ProjTag = ({ className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-proj', className)}>
    <i className="proj-hatch inline-block size-2.5 rounded-[2px] border border-proj-line" />Proyectado
  </span>
);
export const RealTag = ({ className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-[12px] text-muted-foreground', className)}>
    <i className="inline-block size-2.5 rounded-[2px] bg-foreground" />Real
  </span>
);

// Rampa monocromática para categorías (de más oscuro a más claro).
const shade = (i, n) => `color-mix(in oklab, var(--foreground) ${Math.round(88 - (i * 66) / Math.max(1, n - 1))}%, var(--background))`;

// Barra apilada horizontal con resaltado al pasar el mouse. `scale` permite comparar dos barras en la misma escala.
function StackBar({ items, total, scale, hover, setHover, label, proj }) {
  const w = scale ? (total / scale) * 100 : 100;
  return (
    <div className="h-7 w-full">
      <motion.div className={cn('flex h-full gap-px overflow-hidden rounded-[4px]', proj && 'proj-hatch')} initial={false} animate={{ width: `${Math.max(w, 0.5)}%` }} transition={{ duration: 0.45, ease: ease.standard }} aria-label={label}>
        {items.map((it, i) => (
          <motion.div key={it.key} initial={false} animate={{ flexGrow: Math.max(it.value, 0), opacity: hover && hover !== it.key ? 0.35 : 1 }} transition={{ duration: 0.3, ease: ease.standard }}
            onMouseEnter={() => setHover(it.key)} onMouseLeave={() => setHover(null)}
            className="h-full min-w-[2px] basis-0 cursor-default" style={{ background: it.color || shade(i, items.length) }} />
        ))}
      </motion.div>
    </div>
  );
}

// ---------- Composición del resultado (real) ----------
export function BreakdownWidget({ S }) {
  const A = S.actual;
  const [hover, setHover] = useState(null);
  const inc = A.byIncomeCategory || [];
  const cost = A.byCostCategory || [];
  if (!A.count) return <EmptyState text="No hay fechas cerradas en este período. Cuando una fecha pase a Liquidación, aquí verás de dónde vino el ingreso y a dónde se fue." />;
  const scale = Math.max(A.revenue, A.costs, 1);
  const incItems = inc.map((x, i) => ({ ...x, color: shade(i, Math.max(inc.length, 2)) }));
  const costItems = cost.map((x, i) => ({ ...x, color: shade(i, Math.max(cost.length, 2)) }));
  const hovered = [...incItems.map((x) => ({ ...x, side: 'Ingreso', base: A.revenue })), ...costItems.map((x) => ({ ...x, side: 'Costo', base: A.costs }))].find((x) => x.key === hover);
  const Row = ({ title, value, items, list, base }) => (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted-foreground">{title}</span>
        <Fig value={value} className="text-[14px] font-medium" />
      </div>
      <StackBar items={items} total={value} scale={scale} hover={hover} setHover={setHover} label={title} />
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {list.map((x) => (
          <li key={x.key} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)}
            className={cn('flex min-w-0 items-center gap-1.5 text-[12px] transition-opacity', hover && hover !== x.key && 'opacity-40')}>
            <i className="size-2 shrink-0 rounded-[2px]" style={{ background: x.color }} />
            <span className="truncate text-muted-foreground">{x.key}</span>
            <span className="num ml-1 shrink-0 text-foreground">{Math.round((x.value / (base || 1)) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="flex h-full flex-col gap-5 p-4 pt-3">
      <Row title="Ingresos" value={A.revenue} items={incItems} list={incItems} base={A.revenue} />
      <Row title="Costos" value={A.costs} items={costItems} list={costItems} base={A.costs} />
      <div className="mt-auto grid grid-cols-3 gap-3 border-t border-divider pt-3 text-[12px]">
        <div><p className="text-muted-foreground">Stock final</p><p className="num mt-0.5 text-[13px]">{A.stock ? `+${money(A.stock)}` : '—'}</p></div>
        <div><p className="text-muted-foreground">Resultado</p><p className={cn('num mt-0.5 text-[13px] font-medium', A.result < 0 ? 'text-bad' : 'text-good')}>{money(A.result)}</p></div>
        <div className="min-h-9">
          <AnimatePresence mode="wait" initial={false}>
            {hovered ? (
              <motion.div key={hovered.key} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tr.micro}>
                <p className="truncate text-muted-foreground">{hovered.side}: {hovered.key}</p>
                <p className="num mt-0.5 text-[13px]">{money(hovered.value)}</p>
              </motion.div>
            ) : (
              <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tr.micro}>
                <p className="text-muted-foreground">Cobertura</p>
                <p className="num mt-0.5 text-[13px]">{A.costs ? `${Math.round(((A.revenue + A.stock) / A.costs) * 100)}% de costos` : '—'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------- Rendimiento por fecha (real, filas expandibles) ----------
export function EventsWidget({ S }) {
  const { data, setDrawer, withTaxes } = useOS();
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);
  const rows = S.events.filter((f) => f.kind === 'actual' && S.actual.events.includes(f.id)).sort((a, b) => b.date.localeCompare(a.date));
  if (!rows.length) return <EmptyState text="Sin fechas cerradas en este período." />;
  return (
    <div className="overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" tabIndex={0} role="region" aria-label="Rendimiento por fecha, desplazable">
      <table className="w-full min-w-[340px] text-[13px] sm:min-w-[560px]">
        <thead>
          <tr className="text-left text-[12px] text-muted-foreground [&>th]:h-8 [&>th]:border-b [&>th]:border-divider [&>th]:font-normal">
            <th className="pl-4">Fecha</th><th className="text-right">Ingresos</th><th className="hidden text-right sm:table-cell">Costos</th><th className="text-right">Resultado</th><th className="hidden text-right sm:table-cell">Margen</th><th className="w-10 pr-2"><span className="sr-only">Detalle</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => {
            const on = open === f.id;
            const ev = data.finance.events.find((e) => e.id === f.id);
            const tt = ev ? totals(ev, withTaxes) : null;
            return (
              <React.Fragment key={f.id}>
                <tr onClick={() => setOpen(on ? null : f.id)} aria-expanded={on} className={cn('cursor-pointer border-b border-divider transition-colors hover:bg-muted/50', on && 'bg-muted/40')}>
                  <td className="py-2.5 pl-4">
                    <span className="flex items-center gap-2.5">
                      <i className="size-2 shrink-0 rounded-full" style={{ background: brandColor(f.brand) }} aria-hidden />
                      <span className="min-w-0"><span className="block truncate font-medium">{f.name}</span><span className="block text-[12px] text-muted-foreground">{fmtDay(f.date)}, {f.venue || 'sin local'}</span></span>
                    </span>
                  </td>
                  <td className="num text-right">{money(f.revenue)}</td>
                  <td className="num hidden text-right text-muted-foreground sm:table-cell">{money(f.costs)}</td>
                  <td className={cn('num text-right font-medium', f.result < 0 ? 'text-bad' : 'text-good')}>{money(f.result)}</td>
                  <td className="num hidden text-right text-muted-foreground sm:table-cell">{pct(f.margin).replace('-', '−')}</td>
                  <td className="pr-2 text-right"><ChevronRightIcon className={cn('ml-auto size-4 text-muted-foreground transition-transform duration-[var(--dur-standard)]', on && 'rotate-90')} /></td>
                </tr>
                <tr>
                  <td colSpan={6} className="p-0">
                    <AnimatePresence initial={false}>
                      {on && tt && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={tr.layout} className="overflow-hidden border-b border-divider bg-surface">
                          <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
                            <MiniLines title="Ingresos" lines={(ev.income || []).map((l) => ({ key: l.label, value: Number(l.amount) || 0 }))} />
                            <MiniLines title="Costos por categoría" lines={byCategory(tt.costs).map((c) => ({ key: c.name, value: c.value }))} />
                          </div>
                          {f.warnings.length > 0 && <ul className="space-y-1 px-4 pb-2 text-[12px] text-muted-foreground">{f.warnings.map((w, i) => <li key={i} className="flex gap-2"><i className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', w.level === 'warn' ? 'bg-warn' : 'bg-faint')} />{w.text}</li>)}</ul>}
                          <div className="flex gap-1.5 px-4 pb-3">
                            <Btn onClick={() => setDrawer({ type: 'event', id: f.id })}>Revisar</Btn>
                            <Btn onClick={() => navigate(`/eventos/${f.id}`)}>Abrir evento<ArrowUpRightIcon className="size-3" /></Btn>
                            <Btn onClick={() => navigate(`/finanzas/datos?evento=${f.id}`)}>Editar números</Btn>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function MiniLines({ title, lines }) {
  const tot = lines.reduce((s, l) => s + l.value, 0) || 1;
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {lines.slice(0, 6).map((l) => (
          <li key={l.key} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-[12px]">
            <span className="truncate">{l.key}</span><span className="num">{money(l.value)}</span>
            <span className="col-span-2 h-[3px] overflow-hidden rounded-full bg-border/70"><motion.span className="block h-full rounded-full bg-foreground/70" initial={{ width: 0 }} animate={{ width: `${(l.value / tot) * 100}%` }} transition={{ duration: 0.45, ease: ease.standard }} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TextBtn = ({ children, muted, ...p }) => <button type="button" className={cn('inline-flex h-9 items-center sm:h-7 gap-1 rounded-md text-[13px] font-medium underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring', muted ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')} {...p}>{children}</button>;
const Btn = ({ children, className, ...p }) => <button type="button" className={cn('press inline-flex h-9 items-center sm:h-7 gap-1 rounded-md border bg-background px-2 text-[12px] transition-colors hover:bg-muted', className)} {...p}>{children}</button>;

// ---------- Agenda de producción (próximas fechas) ----------
// Una cinta de las próximas 6 semanas con cada fecha en su día, y debajo la corrida de producción:
// etapa, cuenta regresiva, qué falta para estar lista y lo proyectado (rayado, nunca en verde o rojo).
const WD = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function UpcomingWidget({ S }) {
  const { data, setDrawer } = useOS();
  const items = S.events.filter((f) => f.kind === 'budget' && f.daysTo >= 0).sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return <EmptyState text="No hay fechas por venir. Crea la próxima para empezar su presupuesto y su plan de producción." action={<CreateEventBtn />} />;
  const span = 42;
  const inRibbon = items.filter((f) => f.daysTo <= span);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-1">
        <div className="relative h-11" aria-hidden>
          <div className="absolute inset-x-0 top-[22px] h-px bg-divider" />
          {Array.from({ length: span / 7 + 1 }).map((_, w) => (
            <span key={w} className="absolute top-[18px] h-[9px] w-px bg-hairline" style={{ left: `${(w * 7 / span) * 100}%` }} />
          ))}
          <span className="absolute left-0 top-0 text-[11px] text-muted-foreground">hoy</span>
          <span className="absolute right-0 top-0 text-[11px] text-muted-foreground">6 semanas</span>
          {inRibbon.map((f) => (
            <span key={f.id} className="absolute top-[16px] -translate-x-1/2" style={{ left: `${(f.daysTo / span) * 100}%` }}>
              <span className="block size-3 rounded-full ring-2 ring-panel" style={{ background: brandColor(f.brand) }} />
            </span>
          ))}
          {inRibbon.map((f) => (
            <span key={f.id + 'l'} className="num absolute top-[30px] -translate-x-1/2 whitespace-nowrap text-[11px] text-muted-foreground" style={{ left: `clamp(16px, ${(f.daysTo / span) * 100}%, calc(100% - 16px))` }}>{parseDate(f.date).getDate()}</span>
          ))}
        </div>
      </div>
      <ol className="flex-1">
        {items.map((f) => {
          const d = parseDate(f.date);
          const checks = [['ingresos', f.hasIncome], ['costos', f.hasCosts], ['local', !!f.venue && !/confirmar/i.test(f.venue)]];
          const ready = checks.filter((c) => c[1]).length;
          const missing = checks.filter((c) => !c[1]).map((c) => c[0]);
          const brand = data.finance.brands.find((b) => b.id === f.brand);
          return (
            <li key={f.id} className="border-t border-divider">
              <button type="button" onClick={() => setDrawer({ type: 'event', id: f.id })}
                className="grid w-full grid-cols-[48px_minmax(0,1fr)] items-start gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[48px_minmax(0,1fr)_auto]">
                <span className="flex flex-col items-center rounded-md border border-panel-border py-1 leading-none">
                  <span className="text-[11px] text-muted-foreground">{WD[d.getDay()]}</span>
                  <span className="num mt-0.5 text-[20px] font-medium tracking-[-0.03em]">{d.getDate()}</span>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">{MO[d.getMonth()]}</span>
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <i className="size-2 shrink-0 rounded-full" style={{ background: brandColor(f.brand) }} aria-hidden />{brand?.name}
                    <span className="ml-1 text-foreground/80">{relDays(f.daysTo)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[14px] font-medium tracking-[-0.01em]">{f.name}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StageBadge stage={f.stage} stages={data.os.stages} />
                    <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span className="flex gap-0.5" aria-hidden>{checks.map(([l, ok]) => <i key={l} className={cn('h-1.5 w-3 rounded-full', ok ? 'bg-foreground/70' : 'bg-bad/70')} />)}</span>
                      {ready === 3 ? 'Lista para producir' : `${missing.length > 1 ? 'Faltan' : 'Falta'} ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}` : missing[0]}`}
                    </span>
                  </span>
                </span>
                <span className="col-start-2 flex gap-5 sm:col-start-auto sm:block sm:text-right">
                  <span className="block">
                    <span className="block text-[12px] text-muted-foreground">Ingreso proyectado</span>
                    {f.hasIncome ? <span className="num block text-[14px] text-proj">{money(f.revenue)}</span> : <span className="block text-[13px] text-muted-foreground">Sin cargar</span>}
                  </span>
                  <span className="block sm:mt-1">
                    <span className="block text-[12px] text-muted-foreground">Utilidad proyectada</span>
                    {f.result == null ? <span className="block text-[13px] text-muted-foreground">Sin costos</span> : <span className="num block text-[14px] text-proj">{f.result < 0 ? '−' : '+'}{money(Math.abs(f.result))}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CreateEventBtn() {
  const { setCreating } = useOS();
  return <Btn onClick={() => setCreating(true)}><PlusIcon className="size-3" />Nuevo evento</Btn>;
}

// ---------- Bandeja de atención ----------
// Cada alerta dice qué pasó (título), por qué importa, a qué fecha o marca afecta y qué hacer (acción principal).
// El "por qué" y la acción salen de esta guía por tipo de alerta; el texto del servidor queda como detalle.
const SNOOZE_KEY = 'os_snoozed';
const readSnoozed = () => { try { const o = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); const now = Date.now(); return Object.fromEntries(Object.entries(o).filter(([, until]) => until > now)); } catch { return {}; } };
const keyOf = (a) => `${a.title}|${a.event || a.route || ''}`;
// El nivel se lee por forma y palabra, no por un ámbar que se confunda con lo proyectado:
// urgente = punto rojo lleno; importante = anillo en tinta; aviso = punto gris pequeño.
const LEVEL = { high: { label: 'Urgente', dot: 'size-2 bg-bad', text: 'text-bad' }, med: { label: 'Importante', dot: 'size-2 border-[1.5px] border-foreground', text: 'text-foreground/80' }, low: { label: 'Aviso', dot: 'size-1.5 mt-[8px] bg-faint', text: 'text-muted-foreground' } };
const numbers = (a) => `/finanzas/datos?evento=${a.event}`;
export const ATTENTION_GUIDE = {
  'Presupuesto sin costos': { why: 'Sin costos no hay utilidad proyectada: no sabes si la fecha será rentable.', action: 'Cargar costos', to: numbers },
  'Fecha pasada sin liquidar': { why: 'Sus números reales no entran en el resultado ni en las comparaciones.', action: 'Cargar la liquidación', to: numbers },
  'Cierre con pérdida': { why: 'La fecha perdió dinero; revisa qué costos superaron lo previsto antes de repetir el formato.', action: 'Revisar el cierre', drawer: true },
  'Inventario inicial sin registrar': { why: 'Si la fecha usa stock anterior y no se registra, su resultado queda inflado.', action: 'Registrar inventario inicial', drawer: true },
  'Local por confirmar': { why: 'Sin local no se pueden cerrar costos, permisos ni la comunicación.', action: 'Confirmar el local', drawer: true },
  'Clave compartida con el staff': { why: 'Cualquiera con la clave del staff puede ver las finanzas del grupo.', action: 'Ver cómo crearla', to: () => '/integraciones' },
  'Pagos vencidos': { why: 'Un pago vencido afecta la relación con proveedores y puede generar recargos.', action: 'Ver pagos', to: () => '/finanzas/por-pagar' },
  'Stock bajo': { why: 'La barra puede quedarse sin productos la próxima fecha.', action: 'Ver inventario', to: () => '/inventario' },
  'Cuentas sin saldo inicial': { why: 'Sin saldo inicial no se puede calcular la caja disponible.', action: 'Completar saldos', to: () => '/finanzas/cuentas' },
  'Tareas vencidas': { why: 'La producción de la próxima fecha va atrasada.', action: 'Ver tareas', to: () => '/tareas' },
  'Tareas bloqueadas por vencer': { why: 'Dependen de otras tareas sin terminar y vencen pronto.', action: 'Ver tareas', to: () => '/tareas' },
  'Comisiones de promotores por pagar': { why: 'Los promotores esperan su pago según la regla de comisión.', action: 'Ver promotores', to: () => '/promotores' },
};

// Agrupa alertas repetidas (mismo título) en una sola fila con su lista.
export function groupAlerts(items) {
  const m = new Map();
  items.forEach((a) => { const g = m.get(a.title) || { title: a.title, level: a.level, items: [] }; g.items.push(a); if (a.level === 'high') g.level = 'high'; m.set(a.title, g); });
  const order = { high: 0, med: 1, low: 2 };
  return [...m.values()].sort((a, b) => order[a.level] - order[b.level]);
}

export function AttentionWidget({ items, compact = false }) {
  const { data, setDrawer } = useOS();
  const navigate = useNavigate();
  const [snoozed, setSnoozed] = useState(readSnoozed);
  const [filter, setFilter] = useState('all');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [open, setOpen] = useState(null);
  const snooze = (list) => { const n = { ...snoozed }; list.forEach((a) => { n[keyOf(a)] = Date.now() + 24 * 3600 * 1000; }); setSnoozed(n); try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(n)); } catch { /* */ } };
  const active = items.filter((a) => showSnoozed || !snoozed[keyOf(a)]);
  const scoped = filter === 'high' ? active.filter((a) => a.level === 'high') : active;
  const groups = groupAlerts(compact ? scoped.filter((a) => a.level !== 'low') : scoped);
  const hidden = items.length - items.filter((a) => !snoozed[keyOf(a)]).length;
  const evOf = (id) => data.finance.events.find((e) => e.id === id);
  const brandName = (id) => (data.finance.brands.find((b) => b.id === id) || {}).name;
  const act = (a) => {
    const g = ATTENTION_GUIDE[a.title] || {};
    if (g.drawer && a.event) return setDrawer({ type: 'event', id: a.event });
    if (g.to) return navigate(g.to(a));
    if (a.event) return setDrawer({ type: 'event', id: a.event });
    return navigate(a.route || '/atencion');
  };
  const highCount = active.filter((a) => a.level === 'high').length;
  return (
    <div className="flex h-full flex-col">
      {!compact && (
        <div role="radiogroup" aria-label="Filtrar alertas" className="flex items-center gap-1 px-4 pb-2">
          {[['all', 'Todas', active.length], ['high', 'Urgentes', highCount]].map(([k, l, n]) => (
            <button key={k} type="button" role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cn('press rounded-md px-2 py-1 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', filter === k ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l} <span className="num">{n}</span></button>
          ))}
          {hidden > 0 && <button type="button" onClick={() => setShowSnoozed(!showSnoozed)} className="ml-auto text-[12px] text-muted-foreground hover:text-foreground">{showSnoozed ? 'Ocultar pospuestas' : `${hidden} pospuesta${hidden === 1 ? '' : 's'}`}</button>}
        </div>
      )}
      {groups.length === 0 ? (
        <p className="px-4 pb-5 pt-2 text-[13px] text-muted-foreground">Nada requiere tu atención{filter === 'high' ? ' con urgencia' : ''}.</p>
      ) : (
        <ul className="flex-1">
          <AnimatePresence initial={false}>
            {groups.map((g) => {
              const a = g.items[0];
              const guide = ATTENTION_GUIDE[g.title] || {};
              const lv = LEVEL[g.level] || LEVEL.low;
              const many = g.items.length > 1;
              const ev = !many && a.event ? evOf(a.event) : null;
              const isOpen = open === g.title;
              return (
                <motion.li key={g.title} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tr.layout} className="overflow-hidden border-t border-divider first:border-t-0">
                  <div className="flex gap-3 px-4 py-3">
                    <span className={cn('mt-[7px] shrink-0 rounded-full', lv.dot)} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-medium leading-snug">
                        <span>{g.title}{many && <span className="num font-normal text-muted-foreground"> ({g.items.length})</span>}</span>
                        <span className={cn('text-[12px] font-normal', lv.text)}>{lv.label}</span>
                      </p>
                      {ev && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                          <i className="size-1.5 rounded-full" style={{ background: brandColor(ev.brand) }} aria-hidden />
                          <span className="truncate">{ev.name}</span><span className="shrink-0">{fmtDay(ev.date)}</span>
                        </p>
                      )}
                      {!a.event && !many && <p className="mt-0.5 text-[13px] text-muted-foreground">Todo el grupo</p>}
                      <p className="mt-1 text-[13px] leading-snug text-foreground/85" title={guide.why ? a.text : undefined}>{guide.why || a.text}</p>
                      
                      {many && (
                        <button type="button" onClick={() => setOpen(isOpen ? null : g.title)} aria-expanded={isOpen} className="mt-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                          <ChevronRightIcon className={cn('size-3.5 transition-transform duration-[var(--dur-standard)]', isOpen && 'rotate-90')} />{isOpen ? 'Ocultar' : `Ver las ${g.items.length}`}
                        </button>
                      )}
                      {many && isOpen && (
                        <ul className="mt-1.5 grid gap-1">
                          {g.items.map((x, i) => {
                            const e2 = x.event ? evOf(x.event) : null;
                            return (
                              <li key={i}><button type="button" onClick={() => act(x)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] hover:bg-accent">
                                {e2 && <i className="size-1.5 shrink-0 rounded-full" style={{ background: brandColor(e2.brand) }} />}
                                <span className="min-w-0 flex-1 truncate">{e2 ? e2.name : x.text}</span>
                                {e2 && <span className="shrink-0 text-muted-foreground">{brandName(e2.brand)}</span>}
                              </button></li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {!many && <button type="button" onClick={() => act(a)} className="press inline-flex h-9 items-center gap-1 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-foreground outline-none hover:opacity-90 sm:h-7 dark:border dark:border-hairline dark:bg-accent dark:text-foreground dark:hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">{guide.action || 'Revisar'}</button>}
                        {!many && a.event && guide.to && <TextBtn muted onClick={() => setDrawer({ type: 'event', id: a.event })}>Ver la fecha</TextBtn>}
                        {!compact && !g.items.every((x) => snoozed[keyOf(x)]) && <TextBtn muted onClick={() => snooze(g.items)}><ClockIcon className="size-3" />Posponer 24 h</TextBtn>}
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

// ---------- Caja y obligaciones ----------
export function CashWidget({ LS }) {
  const { setDrawer } = useOS();
  const navigate = useNavigate();
  if (!LS) return <EmptyState text="Calculando…" />;
  if (!LS.accounts.length) {
    return (
      <EmptyState text="Aún no hay cuentas registradas. Con tus cuentas (BCP, caja, Culqi) y su saldo inicial, aquí verás la caja disponible, lo que debes y lo que te deben."
        action={<div className="flex gap-1.5"><Btn onClick={() => setDrawer({ type: 'account' })}><PlusIcon className="size-3" />Registrar cuenta</Btn><Btn onClick={() => setDrawer({ type: 'tx' })}>Registrar pago</Btn></div>} />
    );
  }
  return (
    <div className="flex h-full flex-col">
      <ul className="px-4">
        {LS.accounts.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 border-b border-divider py-2 text-[13px] last:border-0">
            <span className="truncate">{a.name}</span>
            {a.balance == null ? <NA className="text-[12px]" reason="Falta el saldo inicial">sin saldo inicial</NA> : <span className="num">{money(a.pen ?? a.balance)}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-auto grid grid-cols-3 gap-3 border-t border-divider px-4 py-3 text-[12px]">
        <button type="button" onClick={() => navigate('/finanzas/por-pagar')} className="text-left"><p className="text-muted-foreground">Por pagar</p><p className={cn('num mt-0.5 text-[13px]', LS.payables.overdue && 'text-bad')}>{money(LS.payables.total)}</p>{LS.payables.overdue > 0 && <p className="text-[11px] text-bad">{LS.payables.overdue} vencido(s)</p>}</button>
        <button type="button" onClick={() => navigate('/finanzas/por-pagar')} className="text-left"><p className="text-muted-foreground">Por cobrar</p><p className="num mt-0.5 text-[13px]">{money(LS.receivables.total)}</p></button>
        <button type="button" onClick={() => navigate('/finanzas/flujo')} className="text-left"><p className="text-muted-foreground">Comprometido</p><p className="num mt-0.5 text-[13px]">{LS.committed && LS.committed.total != null ? money(LS.committed.total) : '—'}</p></button>
      </div>
    </div>
  );
}

// ---------- Personal (real) ----------
export function StaffWidget({ S }) {
  const rows = S.actual.byStaffArea || [];
  if (!rows.length) return <EmptyState text="Sin costos de personal en fechas cerradas de este período." />;
  const tot = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="px-4 pb-4">
      <p className="mb-3 text-[12px] text-muted-foreground"><Fig value={tot} className="text-[20px] font-medium text-foreground" /> <span className="ml-1">en {S.actual.count} fecha{S.actual.count === 1 ? '' : 's'}</span></p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-[13px]">
            <span className="truncate text-muted-foreground">{r.key}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted"><motion.span className="block h-full rounded-full bg-foreground" initial={{ width: 0 }} animate={{ width: `${(r.value / max) * 100}%` }} transition={{ duration: 0.45, ease: ease.standard }} /></span>
            <span className="num w-16 text-right">{money(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Marcas ----------
export function PortfolioWidget({ S }) {
  const { data } = useOS();
  const navigate = useNavigate();
  return (
    <ul>
      {S.actual.byBrand.map((b) => {
        const br = data.finance.brands.find((x) => x.id === b.brand);
        const up = S.events.filter((f) => f.kind === 'budget' && f.brand === b.brand).length;
        return (
          <li key={b.brand}>
            <button type="button" onClick={() => navigate(`/marcas/${b.brand}`)} className="group flex w-full items-center gap-3 border-t border-divider px-4 py-2.5 text-left transition-colors first:border-0 hover:bg-muted/50">
              <i className="size-2 shrink-0 rounded-full" style={{ background: brandColor(b.brand) }} aria-hidden />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{br?.name}</span><span className="block text-[12px] text-muted-foreground">{b.count} cerrada{b.count === 1 ? '' : 's'}, {up} por venir</span></span>
              <span className="text-right">
                {b.count ? <><span className={cn('num block text-[13px] font-medium', b.result < 0 ? 'text-bad' : 'text-good')}>{money(b.result)}</span><span className="num block text-[12px] text-muted-foreground">{money(b.revenue)} de ingresos</span></> : <NA className="text-[12px]">sin fechas cerradas</NA>}
              </span>
              <ChevronRightIcon className="size-4 text-faint transition-transform group-hover:translate-x-0.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Real vs. presupuesto ----------
export function VarianceWidget({ S }) {
  const { setDrawer } = useOS();
  if (!S.variance) return <EmptyState text="Todavía no hay comparaciones: las fechas cerradas no tenían presupuesto guardado. Desde ahora, al pasar una fecha a Liquidación su presupuesto queda guardado y aparece aquí." />;
  return (
    <ul>
      {S.variance.events.map((v) => {
        const f = S.events.find((x) => x.id === v.id) || {};
        return (
          <li key={v.id}>
            <button type="button" onClick={() => setDrawer({ type: 'event', id: v.id })} className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-t border-divider px-4 py-2.5 text-left text-[13px] first:border-0 hover:bg-muted/50">
              <span className="flex min-w-0 items-center gap-2"><i className="size-2 shrink-0 rounded-full" style={{ background: brandColor(f.brand) }} /><span className="truncate">{f.name}</span></span>
              <span className="num text-proj">{money(v.budget)}</span><span className="num">{money(v.actual)}</span>
              <span className={cn('num font-medium', v.diff >= 0 ? 'text-good' : 'text-bad')}>{v.diff >= 0 ? '+' : ''}{money(v.diff)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Actividad ----------
const ACTIONS = {
  'event.update': 'Editó', 'event.create': 'Creó', 'event.duplicate': 'Duplicó', 'finance.save': 'Guardó datos financieros', 'event.numbers': 'Cargó números de',
  'tx.upsert': 'Registró un movimiento', 'tx.delete': 'Eliminó un movimiento', 'account.upsert': 'Guardó la cuenta',
  'inv.product.upsert': 'Guardó el producto', 'inv.move.add': 'Registró movimientos de inventario', 'inv.move.delete': 'Eliminó un movimiento de inventario',
  'ops.contact.upsert': 'Guardó el contacto', 'ops.task.upsert': 'Guardó la tarea', 'ops.task.delete': 'Eliminó una tarea', 'ops.task.template': 'Creó el plan de producción de', 'ops.ros.set': 'Actualizó el run of show de', 'ops.staff.set': 'Asignó staff a',
  'promo.team.upsert': 'Guardó el equipo', 'promo.member.set': 'Actualizó promotor', 'promo.rule.set': 'Cambió la comisión de', 'promo.target.set': 'Fijó la meta de',
  'mkt.content.upsert': 'Guardó contenido', 'mkt.campaign.upsert': 'Guardó la campaña', 'mkt.asset.upsert': 'Guardó el recurso', 'sp.deal.upsert': 'Guardó el sponsor', 'sp.deliverable.toggle': 'Marcó un entregable de',
  'doc.item.upsert': 'Guardó el documento', 'int.culqi.import': 'Importó cobros de Culqi', 'inc.upsert': 'Registró un incidente', 'inc.delete': 'Eliminó un incidente',
};
export const actionLabel = (a) => ACTIONS[a] || a;
// Agrupa entradas seguidas del mismo actor y acción (p. ej. Claude cargando 12 productos) en una sola línea.
const GROUPED = { 'inv.product.upsert': ['guardó', 'productos'], 'tx.upsert': ['registró', 'movimientos de dinero'], 'tx.delete': ['eliminó', 'movimientos de dinero'], 'ops.task.upsert': ['guardó', 'tareas'], 'ops.contact.upsert': ['guardó', 'contactos'], 'inv.move.add': ['registró', 'cargas de inventario'], 'ops.staff.set': ['asignó staff a', 'fechas'], 'promo.member.set': ['actualizó', 'promotores'] };
export function groupActivity(list) {
  const out = [];
  list.forEach((a) => {
    const last = out[out.length - 1];
    if (last && last.actor === a.actor && last.action === a.action && Math.abs(new Date(last.at) - new Date(a.at)) < 15 * 60000 && a.action !== 'event.update') { last.group.push(a); return; }
    out.push({ ...a, group: [a] });
  });
  return out;
}
export function ActivityWidget() {
  const { data, setDrawer } = useOS();
  const items = groupActivity(data.os.activity || []).slice(0, 6);
  if (!items.length) return <EmptyState text="Sin cambios todavía. Cada cambio hecho desde el OS queda registrado aquí." />;
  return (
    <ol className="px-4 pb-3">
      {items.map((a, i) => {
        const many = a.group.length > 1;
        const names = a.group.map((x) => x.name).filter(Boolean);
        return (
          <li key={i} className="flex gap-3 border-t border-divider py-2 first:border-t-0">
            <span className={cn('mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', a.actor === 'claude' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground')} aria-hidden>{a.actor === 'claude' ? 'C' : 'D'}</span>
            <span className="min-w-0 flex-1 text-[13px] leading-snug">
              <span className="text-muted-foreground">{a.actor === 'claude' ? 'Claude' : 'Dirección'} </span>
              {many ? (
                <><span className="text-muted-foreground">{(GROUPED[a.action] || ['hizo'])[0]} </span><span className="font-medium">{a.group.length} {(GROUPED[a.action] || [null, 'cambios'])[1]}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{names.slice(0, 4).join(', ')}{names.length > 4 ? ` y ${names.length - 4} más` : ''}</span></>
              ) : (
                <><span className="text-muted-foreground">{actionLabel(a.action).toLowerCase()} </span>
                  {a.event && a.action?.startsWith('event') ? <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setDrawer({ type: 'event', id: a.event })}>{a.name || a.event}</button> : <span className="font-medium">{a.name || (a.events ? `${a.events} eventos` : '')}</span>}</>
              )}
            </span>
            <time dateTime={a.at} className="num shrink-0 pt-px text-[12px] text-muted-foreground">{fmtStamp(a.at)}</time>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Inventario ----------
export function InventoryWidget() {
  const { data } = useOS();
  const navigate = useNavigate();
  const I = data.os.inventorySummary;
  if (!I.hasData) return <EmptyState text="Sin productos de barra registrados." action={<Btn onClick={() => navigate('/inventario')}>Ir a inventario</Btn>} />;
  const top = I.products.filter((p) => !p.archived).sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 5);
  return (
    <div className="px-4 pb-3">
      <p className="text-[12px] text-muted-foreground"><Fig value={I.value} className="text-[20px] font-medium text-foreground" /><span className="ml-1.5">en stock a costo, {I.products.length} productos</span></p>
      {I.low.length > 0 && <p className="mt-1 text-[12px] text-bad">{I.low.length} bajo el mínimo</p>}
      <ul className="mt-3">
        {top.map((p) => <li key={p.id} className="flex justify-between gap-3 border-t border-divider py-1.5 text-[13px]"><span className="truncate">{p.name}</span><span className="num text-muted-foreground">{money(p.value)}</span></li>)}
      </ul>
    </div>
  );
}

// ---------- Producción ----------
export function TasksWidget() {
  const { data, workspace, setDrawer } = useOS();
  const brandOf = (id) => (data.finance.events.find((e) => e.id === id) || {}).brand;
  const tasks = (data.os.tasks || []).filter((x) => x.effective !== 'done' && (workspace === 'group' || !x.eventId || brandOf(x.eventId) === workspace)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 7);
  if (!tasks.length) return <EmptyState text="Sin tareas pendientes. Crea el plan de producción desde la página de cada evento." action={<Btn onClick={() => setDrawer({ type: 'task' })}><PlusIcon className="size-3" />Nueva tarea</Btn>} />;
  return (
    <ul>
      {tasks.map((x) => (
        <li key={x.id}>
          <button type="button" onClick={() => setDrawer({ type: 'task', id: x.id })} className="flex w-full items-center gap-3 border-t border-divider px-4 py-2 text-left text-[13px] first:border-0 hover:bg-muted/50">
            <span className={cn('size-3.5 shrink-0 rounded-full border-[1.5px]', x.overdue ? 'border-bad' : x.effective === 'blocked' ? 'border-warn border-dashed' : 'border-faint')} />
            <span className="min-w-0 flex-1 truncate">{x.title}</span>
            <span className={cn('num shrink-0 text-[12px]', x.overdue ? 'text-bad' : 'text-muted-foreground')}>{x.due ? fmtDay(x.due) : 'sin fecha'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------- Audiencia (sin datos personales) ----------
export function AudienceWidget() {
  const { data, workspace } = useOS();
  const navigate = useNavigate();
  const A = (data.os.audience || {})[workspace] || null;
  if (!A || !A.people) return <EmptyState text="Sin registros de público para este alcance." />;
  const stats = [['Personas', A.people, false], ['Asistieron', A.attended, false], ['Volvieron', A.repeat, false], ['Recurrencia', A.repeatRate, true]];
  return (
    <div className="px-4 pb-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map(([l, v, p]) => <div key={l}><dt className="text-[12px] text-muted-foreground">{l}</dt><dd className="mt-0.5 text-[20px] font-medium"><Fig value={v} currency={false} decimals={p ? 1 : 0} suffix={p ? '%' : ''} /></dd></div>)}
      </dl>
      <p className="mt-3 text-[12px] text-muted-foreground">{A.consent ? `${A.consent} con consentimiento de marketing.` : 'Nadie ha dado consentimiento de marketing todavía: no hay exportación de contactos.'}</p>
      <button type="button" onClick={() => navigate('/audiencia')} className="mt-2 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">Ver audiencia<ArrowUpRightIcon className="size-3" /></button>
    </div>
  );
}

// ---------- Sponsors ----------
export function SponsorsWidget() {
  const { data, setDrawer } = useOS();
  const deals = (data.os.deals || []).filter((d) => d.stage !== 'lost');
  const labels = (data.os.enums && data.os.enums.dealStages) || {};
  if (!deals.length) return <EmptyState text="Sin sponsors en curso." action={<Btn onClick={() => setDrawer({ type: 'deal' })}><PlusIcon className="size-3" />Nuevo sponsor</Btn>} />;
  return (
    <ul>
      {deals.slice(0, 6).map((d) => (
        <li key={d.id}>
          <button type="button" onClick={() => setDrawer({ type: 'deal', id: d.id })} className="flex w-full items-center gap-3 border-t border-divider px-4 py-2 text-left text-[13px] first:border-0 hover:bg-muted/50">
            <span className="min-w-0 flex-1 truncate">{d.sponsor}</span>
            <span className="text-[12px] text-muted-foreground">{labels[d.stage] || d.stage}</span>
            <span className="num w-20 text-right text-proj">{d.cash != null ? money(d.cash) : '—'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EmptyState({ text, action }) {
  return (
    <div className="flex flex-col items-start gap-3 px-4 pb-5 pt-1">
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

