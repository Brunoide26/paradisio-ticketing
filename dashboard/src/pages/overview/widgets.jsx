// Widgets del resumen ejecutivo. Sólo datos reales del OS: si falta un dato se dice, nunca se rellena.
// Lo real y lo proyectado nunca se suman ni se mezclan en el mismo indicador.
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { ArrowUpRightIcon, ChevronRightIcon, CheckIcon, XIcon, ClockIcon, PlusIcon } from 'lucide-react';
import { useOS } from '../../os/store.jsx';
import { fmtDay, fmtStamp, relDays } from '../../os/kit.jsx';
import { t as tr, ease } from '../../os/motion.jsx';
import { cn, money, pct, brandColor, totals, byCategory, parseDate } from '../../lib.js';

// ---------- Primitivas ----------
const NUM_TIMING = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
export function Fig({ value, currency = true, decimals = 0, suffix, className }) {
  if (value == null || !isFinite(value)) return null;
  return (
    <NumberFlow className={cn('num', className)} value={value} locales="es-PE" suffix={suffix} willChange
      format={currency ? { style: 'currency', currency: 'PEN', minimumFractionDigits: decimals, maximumFractionDigits: decimals } : { minimumFractionDigits: 0, maximumFractionDigits: decimals }}
      transformTiming={NUM_TIMING} spinTiming={NUM_TIMING} opacityTiming={{ duration: 250, easing: 'ease-out' }} />
  );
}

export function NA({ children = 'No disponible', reason, className }) {
  return <span title={reason} className={cn('text-muted-foreground', className)}>{children}</span>;
}

export const ProjTag = ({ className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-proj', className)}>
    <i className="proj-hatch inline-block size-2.5 rounded-[2px] border border-proj-line" />Proyectado
  </span>
);
export const RealTag = ({ className }) => (
  <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground', className)}>
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
        <Fig value={value} className="text-[15px] font-medium" />
      </div>
      <StackBar items={items} total={value} scale={scale} hover={hover} setHover={setHover} label={title} />
      <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {list.map((x) => (
          <li key={x.key} onMouseEnter={() => setHover(x.key)} onMouseLeave={() => setHover(null)}
            className={cn('flex min-w-0 items-center gap-1.5 text-[12px] transition-opacity', hover && hover !== x.key && 'opacity-40')}>
            <i className="size-2 shrink-0 rounded-[2px]" style={{ background: x.color }} />
            <span className="truncate text-muted-foreground">{x.key}</span>
            <span className="num ml-auto shrink-0">{Math.round((x.value / (base || 1)) * 100)}%</span>
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
        <div><p className="text-muted-foreground">Stock final</p><p className="num mt-0.5 text-[13px]">{A.stock ? `+ ${money(A.stock)}` : '—'}</p></div>
        <div><p className="text-muted-foreground">Resultado</p><p className={cn('num mt-0.5 text-[13px] font-medium', A.result < 0 ? 'text-bad' : 'text-good')}>{money(A.result)}</p></div>
        <div className="min-h-9">
          <AnimatePresence mode="wait" initial={false}>
            {hovered ? (
              <motion.div key={hovered.key} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={tr.micro}>
                <p className="truncate text-muted-foreground">{hovered.side} · {hovered.key}</p>
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="text-left text-[11.5px] text-muted-foreground [&>th]:h-8 [&>th]:border-b [&>th]:border-divider [&>th]:font-normal">
            <th className="pl-4">Fecha</th><th className="text-right">Ingresos</th><th className="text-right">Costos</th><th className="text-right">Resultado</th><th className="text-right">Margen</th><th className="w-10 pr-2" />
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
                      <i className="h-6 w-[3px] shrink-0 rounded-full" style={{ background: brandColor(f.brand) }} />
                      <span className="min-w-0"><span className="block truncate font-medium">{f.name}</span><span className="block text-[11.5px] text-muted-foreground">{fmtDay(f.date)} · {f.venue || 'sin local'}</span></span>
                    </span>
                  </td>
                  <td className="num text-right">{money(f.revenue)}</td>
                  <td className="num text-right text-muted-foreground">{money(f.costs)}</td>
                  <td className={cn('num text-right font-medium', f.result < 0 ? 'text-bad' : 'text-good')}>{money(f.result)}</td>
                  <td className="num text-right text-muted-foreground">{pct(f.margin)}</td>
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

function MiniLines({ title, lines }) {
  const tot = lines.reduce((s, l) => s + l.value, 0) || 1;
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-muted-foreground">{title}</p>
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

const TextBtn = ({ children, muted, ...p }) => <button type="button" className={cn('inline-flex items-center gap-1 font-medium underline-offset-4 transition-colors hover:underline', muted ? 'text-muted-foreground hover:text-foreground' : 'text-foreground')} {...p}>{children}</button>;
const Btn = ({ children, className, ...p }) => <button type="button" className={cn('press inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-[12px] transition-colors hover:bg-muted', className)} {...p}>{children}</button>;

// ---------- Próximas fechas (proyectado, línea de tiempo) ----------
export function UpcomingWidget({ S }) {
  const { data, setDrawer } = useOS();
  const items = S.events.filter((f) => f.kind === 'budget').sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return <EmptyState text="No hay fechas por venir." action={<CreateEventBtn />} />;
  const stageLabel = (id) => (data.os.stages.find((s) => s.id === id) || {}).label || id;
  return (
    <ol className="relative px-2 py-1.5">
      {items.map((f, i) => {
        const d = parseDate(f.date);
        const checks = [['Ingresos', f.hasIncome], ['Costos', f.hasCosts], ['Local', !!f.venue]];
        return (
          <li key={f.id}>
            <button type="button" onClick={() => setDrawer({ type: 'event', id: f.id })} className="group grid w-full grid-cols-[44px_1fr_auto] items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-muted/60">
              <span className="flex flex-col items-center leading-none">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{fmtDay(f.date).split(' ')[0]}</span>
                <span className="num mt-1 text-[20px] font-semibold tracking-tight">{d.getDate()}</span>
                <span className="mt-0.5 text-[10.5px] text-muted-foreground">{fmtDay(f.date).split(' ')[2]}</span>
              </span>
              <span className="relative min-w-0 border-l-2 pl-3" style={{ borderColor: brandColor(f.brand) }}>
                <span className="block truncate text-[13px] font-medium">{f.name}</span>
                <span className="block truncate text-[12px] text-muted-foreground">{stageLabel(f.stage)} · {f.venue || 'local por confirmar'} · {relDays(f.daysTo)}</span>
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {checks.map(([l, ok]) => (
                    <span key={l} className={cn('inline-flex items-center gap-0.5 rounded px-1 py-px text-[10.5px]', ok ? 'bg-muted text-muted-foreground' : 'bg-bad/10 text-bad')}>
                      {ok ? <CheckIcon className="size-2.5" /> : <XIcon className="size-2.5" />}{l}
                    </span>
                  ))}
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[11px] text-proj">Ingreso proy.</span>
                {f.hasIncome ? <span className="num block text-[13px] text-foreground/80">{money(f.revenue)}</span> : <NA className="text-[12px]">sin cargar</NA>}
                <span className="mt-1 block text-[11px] text-proj">Utilidad proy.</span>
                {f.result == null ? <span className="text-[12px] text-proj">Incompleto</span> : <span className={cn('num block text-[13px]', f.result >= 0 ? 'text-good' : 'text-bad')}>{money(f.result)}</span>}
              </span>
            </button>
            {i < items.length - 1 && <div className="mx-2 border-t border-dashed border-divider" />}
          </li>
        );
      })}
    </ol>
  );
}

function CreateEventBtn() {
  const { setCreating } = useOS();
  return <Btn onClick={() => setCreating(true)}><PlusIcon className="size-3" />Nuevo evento</Btn>;
}

// ---------- Bandeja de atención con acciones ----------
const SNOOZE_KEY = 'os_snoozed';
const readSnoozed = () => { try { const o = JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); const now = Date.now(); return Object.fromEntries(Object.entries(o).filter(([, until]) => until > now)); } catch { return {}; } };
const keyOf = (a) => `${a.title}|${a.event || a.route || ''}`;
export function AttentionWidget({ items }) {
  const { setDrawer } = useOS();
  const navigate = useNavigate();
  const [snoozed, setSnoozed] = useState(readSnoozed);
  const [filter, setFilter] = useState('all');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const snooze = (a) => { const n = { ...snoozed, [keyOf(a)]: Date.now() + 24 * 3600 * 1000 }; setSnoozed(n); try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(n)); } catch { /* */ } };
  const active = items.filter((a) => showSnoozed || !snoozed[keyOf(a)]);
  const list = filter === 'high' ? active.filter((a) => a.level === 'high') : active;
  const hidden = items.length - items.filter((a) => !snoozed[keyOf(a)]).length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-4 pb-2">
        {[['all', 'Todo', active.length], ['high', 'Urgente', active.filter((a) => a.level === 'high').length]].map(([k, l, n]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={cn('press rounded-md px-2 py-1 text-[12px] transition-colors', filter === k ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l} <span className="num text-muted-foreground">{n}</span></button>
        ))}
        {hidden > 0 && <button type="button" onClick={() => setShowSnoozed(!showSnoozed)} className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground">{showSnoozed ? 'Ocultar pospuestas' : `${hidden} pospuesta${hidden === 1 ? '' : 's'}`}</button>}
      </div>
      <ul className="scroll-thin max-h-[320px] flex-1 overflow-y-auto">
        {list.length === 0 && <li className="px-4 py-8 text-center text-[13px] text-muted-foreground">Todo en orden.</li>}
        <AnimatePresence initial={false}>
          {list.map((a) => (
            <motion.li key={keyOf(a)} layout="position" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={tr.layout} className="overflow-hidden">
              <div className="group flex gap-3 border-t border-divider px-4 py-2.5">
                <span className={cn('mt-[6px] size-1.5 shrink-0 rounded-full', a.level === 'high' ? 'bg-bad' : a.level === 'med' ? 'bg-warn' : 'bg-faint')} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-snug">{a.title}</p>
                  <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{a.text}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    {a.event && <TextBtn onClick={() => setDrawer({ type: 'event', id: a.event })}>Revisar</TextBtn>}
                    {a.event && <TextBtn onClick={() => navigate(`/finanzas/datos?evento=${a.event}`)}>Editar números</TextBtn>}
                    {!a.event && <TextBtn onClick={() => navigate(a.route || '/atencion')}>Ir a la sección</TextBtn>}
                    {!snoozed[keyOf(a)] && <TextBtn muted onClick={() => snooze(a)}><ClockIcon className="size-3" />Posponer 24 h</TextBtn>}
                  </div>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
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
          <li key={r.key} className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-[12.5px]">
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
              <i className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: brandColor(b.brand) }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{br?.name}</span><span className="block text-[11.5px] text-muted-foreground">{b.count} cerrada{b.count === 1 ? '' : 's'} · {up} por venir</span></span>
              <span className="text-right">
                {b.count ? <><span className={cn('num block text-[13px] font-medium', b.result < 0 ? 'text-bad' : 'text-good')}>{money(b.result)}</span><span className="num block text-[11.5px] text-muted-foreground">{money(b.revenue)} · {pct(b.margin)}</span></> : <NA className="text-[12px]">sin fechas cerradas</NA>}
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
export function ActivityWidget() {
  const { data, setDrawer } = useOS();
  const items = (data.os.activity || []).slice(0, 8);
  if (!items.length) return <EmptyState text="Sin cambios todavía. Cada cambio hecho desde el OS queda registrado aquí." />;
  return (
    <ol className="relative px-4 pb-3">
      <span aria-hidden className="absolute bottom-4 left-[19px] top-2 w-px bg-divider" />
      {items.map((a, i) => (
        <li key={i} className="relative flex gap-3 py-1.5">
          <span className={cn('relative z-10 mt-[5px] size-[7px] shrink-0 rounded-full ring-[3px] ring-background', a.actor === 'claude' ? 'bg-foreground' : 'bg-faint')} />
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
            <span className="text-muted-foreground">{actionLabel(a.action)} </span>
            {a.event && a.action?.startsWith('event') ? <button type="button" className="font-medium hover:underline" onClick={() => setDrawer({ type: 'event', id: a.event })}>{a.name || a.event}</button> : <span className="font-medium">{a.name || (a.events ? `${a.events} eventos` : '')}</span>}
            {a.actor === 'claude' && <span className="ml-1.5 rounded border px-1 text-[10px] text-muted-foreground">Claude</span>}
          </span>
          <span className="num shrink-0 text-[11px] text-faint">{fmtStamp(a.at)}</span>
        </li>
      ))}
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
      <p className="text-[12px] text-muted-foreground"><Fig value={I.value} className="text-[20px] font-medium text-foreground" /><span className="ml-1.5">en stock a costo · {I.products.length} productos</span></p>
      {I.low.length > 0 && <p className="mt-1 text-[12px] text-bad">{I.low.length} bajo el mínimo</p>}
      <ul className="mt-3">
        {top.map((p) => <li key={p.id} className="flex justify-between gap-3 border-t border-divider py-1.5 text-[12.5px]"><span className="truncate">{p.name}</span><span className="num text-muted-foreground">{money(p.value)}</span></li>)}
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
            <span className={cn('num shrink-0 text-[11.5px]', x.overdue ? 'text-bad' : 'text-muted-foreground')}>{x.due ? fmtDay(x.due) : 'sin fecha'}</span>
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
        {stats.map(([l, v, p]) => <div key={l}><dt className="text-[12px] text-muted-foreground">{l}</dt><dd className="mt-0.5 text-[18px] font-medium"><Fig value={v} currency={false} decimals={p ? 1 : 0} suffix={p ? '%' : ''} /></dd></div>)}
      </dl>
      <p className="mt-3 text-[11.5px] text-muted-foreground">{A.consent ? `${A.consent} con consentimiento de marketing.` : 'Nadie ha dado consentimiento de marketing todavía: no hay exportación de contactos.'}</p>
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
            <span className="text-[11.5px] text-muted-foreground">{labels[d.stage] || d.stage}</span>
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
      <p className="max-w-md text-[12.5px] leading-relaxed text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

