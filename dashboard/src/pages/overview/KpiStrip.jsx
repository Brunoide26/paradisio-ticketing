// Indicadores bajo el gráfico principal (dirección Dashtrans para las miniaturas).
// Una sola franja con celdas, no una tarjeta por cifra. Cada celda abre de dónde sale su número.
// Las miniaturas sólo se dibujan con serie real de 3 o más puntos; si no, la cifra va limpia.
import React, { useId } from 'react';
import NumberFlow from '@number-flow/react';
import { ChevronRightIcon } from 'lucide-react';
import { cn, money, pct, brandColor } from '../../lib.js';

const NUM = { duration: 450, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

export function Sparkline({ values, kind = 'line', tone, className, label }) {
  const id = useId().replace(/:/g, '');
  const v = (values || []).filter((x) => x != null && isFinite(x));
  if (v.length < 3) return null;
  const W = 88, H = 28, lo = Math.min(0, ...v), hi = Math.max(0, ...v) || 1;
  const x = (i) => (i / (v.length - 1)) * (W - 4) + 2;
  const y = (val) => H - 2 - ((val - lo) / (hi - lo || 1)) * (H - 4);
  const stroke = tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--chart-ink)';
  if (kind === 'bar') {
    const bw = (W - 4) / v.length;
    return (
      <svg width={W} height={H} role="img" aria-label={label} className={className}>
        {v.map((val, i) => <rect key={i} x={2 + i * bw + bw * 0.18} width={bw * 0.64} y={Math.min(y(val), y(0))} height={Math.max(1, Math.abs(y(val) - y(0)))} rx="1" fill={val < 0 ? 'var(--bad)' : 'var(--chart-ink)'} opacity={i === v.length - 1 ? 1 : 0.55} />)}
      </svg>
    );
  }
  const line = v.map((val, i) => `${i ? 'L' : 'M'}${x(i)},${y(val)}`).join('');
  return (
    <svg width={W} height={H} role="img" aria-label={label} className={className}>
      <defs><pattern id={`${id}-h`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--chart-hatch)" /></pattern></defs>
      {kind === 'area' && <path d={`${line}L${x(v.length - 1)},${H}L${x(0)},${H}Z`} fill={`url(#${id}-h)`} />}
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinejoin="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r="2" fill={stroke} />
    </svg>
  );
}

// Miniaturas sin historia inventada: comparan cifras reales que ya existen.
function Versus({ income, cost }) {
  const max = Math.max(income, cost, 1);
  return (
    <span className="grid w-[120px] shrink-0 grid-cols-[38px_1fr] items-center gap-x-1.5 gap-y-1 pb-0.5 text-[11px] text-muted-foreground" role="img" aria-label={`Ingresos ${money(income)} contra costos ${money(cost)}`}>
      <span aria-hidden>ingresos</span><span className="block h-1.5 rounded-full bg-chart-ink" style={{ width: `${(income / max) * 100}%` }} />
      <span aria-hidden>costos</span><span className="hatch-ink block h-1.5 rounded-full border border-chart-ink/60" style={{ width: `${(cost / max) * 100}%` }} />
    </span>
  );
}
function Readiness({ done, total }) {
  return (
    <span className="flex shrink-0 gap-1 pb-1.5" role="img" aria-label={`${done} de ${total} presupuestos con costos`}>
      {Array.from({ length: total }).map((_, i) => <i key={i} className={cn('h-2 w-5 rounded-[2px]', i < done ? 'bg-proj' : 'proj-hatch border border-dashed border-proj')} />)}
    </span>
  );
}

function Cell({ label, children, sub, onClick, proj, spark, className }) {
  return (
    <button type="button" onClick={onClick}
      className={cn('group relative flex min-w-0 flex-col items-start gap-1 px-3 py-3 text-left sm:px-4 sm:py-3.5 outline-none transition-colors hover:bg-accent/60 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5', className)}>
      <span className="flex w-full items-center gap-1.5 text-[13px] text-muted-foreground">
        {proj && <i className="proj-hatch size-2.5 shrink-0 rounded-[2px] border border-dashed border-proj" aria-hidden />}
        <span className="truncate">{label}</span>
        <ChevronRightIcon aria-hidden className="ml-auto size-3.5 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
      </span>
      <span className="flex w-full items-end justify-between gap-3">
        <span className="min-w-0 truncate text-[20px] leading-[1.15] tracking-[-0.03em] sm:text-[24px]">{children}</span>
        {spark && <span className="hidden sm:block">{spark}</span>}
      </span>
      {sub && <span className="line-clamp-2 w-full text-[12px] text-muted-foreground sm:truncate">{sub}</span>}
    </button>
  );
}

// NumberFlow anima dígito por dígito: el lector de pantalla recibe la cifra completa aparte.
const Fig = ({ value, className }) => (
  <><span className="sr-only">{money(value)}</span><NumberFlow aria-hidden="true" value={value} locales="es-PE" format={{ style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }} className={cn('num', className)} transformTiming={NUM} spinTiming={NUM} willChange /></>
);
const NA = ({ children = 'No disponible' }) => <span className="text-[20px] text-muted-foreground">{children}</span>;

export default function KpiStrip({ S, LS, onMetric, navigate, setDrawer }) {
  const A = S.actual, P = S.projected;
  const actualEvents = S.events.filter((f) => f.kind === 'actual' && A.events.includes(f.id)).sort((a, b) => a.date.localeCompare(b.date));
  const results = actualEvents.map((f) => f.result);
  const cashOk = LS && LS.cash != null;
  const hasAccounts = LS && LS.accounts && LS.accounts.length;
  return (
    <section aria-label="Indicadores" className="surface grid grid-cols-2 overflow-hidden xl:grid-cols-4 [&>*]:border-divider [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b xl:[&>*]:border-b-0 xl:[&>*:not(:last-child)]:border-r">
      <Cell label="Resultado real" onClick={onMetric('result')}
        sub={A.count ? (A.margin != null ? `Margen ${pct(A.margin).replace('-', '−')} en ${A.count} fecha${A.count === 1 ? '' : 's'} cerrada${A.count === 1 ? '' : 's'}` : `${A.count} fecha${A.count === 1 ? '' : 's'} cerrada${A.count === 1 ? '' : 's'}`) : 'Sin fechas cerradas en el período'}
        spark={results.length >= 3 ? <Sparkline values={results} kind="bar" label={`Resultado por fecha: ${results.map((r) => money(r)).join(', ')}`} /> : A.count ? <Versus income={A.revenue} cost={A.costs} /> : null}>
        {A.count ? <span className={cn(A.result < 0 && 'text-bad')}>{A.result < 0 ? '−' : ''}<Fig value={Math.abs(A.result)} /></span> : <NA>Sin cierres</NA>}
      </Cell>
      <Cell label="Caja disponible" onClick={() => (hasAccounts ? navigate('/finanzas/cuentas') : setDrawer({ type: 'account' }))}
        sub={cashOk ? `${LS.accounts.length} cuenta${LS.accounts.length === 1 ? '' : 's'}` : hasAccounts ? 'Falta el saldo inicial de una cuenta: complétalo' : 'Registra tus cuentas para calcularla'}>
        {cashOk ? <Fig value={LS.cash} /> : <NA />}
      </Cell>
      <Cell label="Por cobrar" onClick={() => navigate('/finanzas/por-pagar')}
        sub={LS && LS.hasData ? `${LS.receivables.count} cobro${LS.receivables.count === 1 ? '' : 's'} pendiente${LS.receivables.count === 1 ? '' : 's'}` : 'Sin movimientos registrados'}
        spark={null}>
        {LS && LS.hasData ? <Fig value={LS.receivables.total} /> : <NA />}
      </Cell>
      <Cell proj label="Utilidad proyectada" onClick={onMetric('projProfit')}
        sub={P.count ? `${P.completeCount} de ${P.count} fecha${P.count === 1 ? '' : 's'} con costos presupuestados` : 'Sin fechas por venir'}
        spark={P.count ? <Readiness done={P.completeCount} total={P.count} /> : null}
        className="bg-proj-soft/40">
        {P.profit == null ? <NA>Incompleta</NA> : <span className="text-proj">{P.profit < 0 ? '−' : '+'}<Fig value={Math.abs(P.profit)} />{P.completeCount < P.count && <span className="ml-1.5 text-[13px] tracking-normal text-foreground">parcial</span>}</span>}
      </Cell>
    </section>
  );
}

export const brandDot = brandColor;
