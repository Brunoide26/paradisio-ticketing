import React, { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { ArrowRightIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Delta, DeltaIcon, DeltaValue } from '@/components/delta';
import { ShareBarList, ShareBarListContent, ShareBarListFill, ShareBarListItem, ShareBarListLabel, ShareBarListValue } from '@/components/share-bar-list';
import { cn, money, BRAND_STYLE } from './lib.js';

// ---------- Tarjetas: real (sólida) y proyectada (punteada) ----------
// Toda tarjeta con números estimados usa `proj`: borde punteado, fondo rayado suave y la etiqueta "Proyectado".
export function Panel({ proj, className, children, ...p }) {
  return (
    <Card className={cn('gap-0 overflow-hidden rounded-lg py-0 shadow-none', proj && 'border-dashed border-proj-line bg-proj-soft/30', className)} {...p}>
      {children}
    </Card>
  );
}

export function PanelHeader({ title, description, action, className, big }) {
  return (
    <CardHeader className={cn('gap-0.5 px-4 pb-3 pt-3.5', className)}>
      <CardTitle className={cn(big ? 'num text-2xl font-medium tracking-[-0.025em]' : 'text-balance text-[13.5px] font-medium tracking-tight')}>{title}</CardTitle>
      {description && <CardDescription className="text-pretty text-[12px]">{description}</CardDescription>}
      {action && <CardAction>{action}</CardAction>}
    </CardHeader>
  );
}

export { CardContent };

// Encabezado de sección. "Real" arriba y sólido; "Proyectado" aparte y punteado.
export function SectionTitle({ kind, title, description, className }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
      {kind && <KindTag real={kind === 'real'} />}
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      <div className={cn('h-px min-w-8 flex-1', kind === 'proj' ? 'border-t border-dashed border-proj-line' : 'bg-border')} />
    </div>
  );
}

// ---------- Números ----------
export function Money({ value, className, signed }) {
  const v = Number(value) || 0;
  return (
    <span className={cn('mono inline-flex items-baseline', className)}>
      {v < 0 && '−'}{signed && v > 0 && '+'}
      <NumberFlow value={Math.abs(v)} prefix="S/ " format={{ maximumFractionDigits: 0 }} willChange />
    </span>
  );
}
export function Num({ value, suffix = '', decimals = 0, className }) {
  return <NumberFlow className={cn('mono', className)} value={Number(value) || 0} suffix={suffix} format={{ maximumFractionDigits: decimals }} willChange />;
}

// Variación con el componente Delta del bloque. `good` decide el color (no siempre subir es bueno).
export function DeltaPill({ value, label, good, format = 'pct' }) {
  if (value == null || !isFinite(value)) return null;
  const ok = good == null ? value >= 0 : good;
  return (
    <Delta value={value} variant="badge" className={cn('rounded-md', ok ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-600')}>
      <DeltaIcon variant="trend" />
      {format === 'money' ? <span className="tabular-nums">{money(Math.abs(value))}</span> : <DeltaValue suffix="%" />}
      {label && <span className="font-normal opacity-80">{label}</span>}
    </Delta>
  );
}

export function StatusBadge({ status }) {
  const tone = {
    realizado: 'bg-emerald-500/10 text-emerald-700',
    presupuesto: 'bg-[#FFF4E5] text-proj',
    confirmado: 'bg-[#E6F4F7] text-[#0B6B7B]',
    'planificación': 'bg-muted text-muted-foreground',
  }[status] || 'bg-muted text-muted-foreground';
  return <Badge variant="secondary" className={cn('rounded-md capitalize', tone)}>{status === 'realizado' ? 'Real' : status}</Badge>;
}

export function KindTag({ real }) {
  return real
    ? <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><i className="inline-block size-2.5 rounded-[2px] bg-foreground" />Real</span>
    : <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-proj"><i className="proj-hatch inline-block size-2.5 rounded-[2px] border border-proj-line" />Proyectado</span>;
}

// ---------- Lista con barras finas (etiqueta, valor y una barra de proporción debajo) ----------
export function Bars({ items, format = (v) => money(v), color, dashed, className, empty = 'Sin datos todavía.' }) {
  const [hover, setHover] = useState(null);
  if (!items.length) return <p className={cn('px-4 py-5 text-[13px] text-muted-foreground', className)}>{empty}</p>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ul className={cn('space-y-2.5 px-4 pb-4 pt-1', className)}>
      {items.map((it, i) => (
        <li key={it.label + i} title={it.title} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cn('transition-opacity', hover != null && hover !== i && 'opacity-45')}>
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="truncate">{it.label}</span>
            <span className="shrink-0"><span className="num text-foreground/85">{format(it.value)}</span>{it.extra && <span className="ml-1.5 text-[11px] text-muted-foreground">{it.extra}</span>}</span>
          </div>
          <div className={cn('mt-1 h-[5px] overflow-hidden rounded-full bg-muted', dashed && 'proj-hatch bg-transparent')}>
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${(Math.abs(it.value) / max) * 100}%` }} transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
              style={{ background: dashed ? 'transparent' : it.color || color || 'var(--foreground)', border: dashed ? `1px dashed ${it.color || color || 'var(--proj-line)'}` : undefined, opacity: it.value < 0 ? 0.55 : 1 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Barras divergentes desde cero (positivos a la derecha, negativos a la izquierda): sirven con 1 o con 20 filas.
export function DivergingBars({ items, format = (v) => money(v), empty = 'Sin datos.' }) {
  const vals = items.filter((i) => i.value != null);
  if (!vals.length) return <p className="px-4 py-5 text-[13px] text-muted-foreground">{empty}</p>;
  const max = Math.max(...vals.map((i) => Math.abs(i.value)), 1);
  const hasNeg = vals.some((i) => i.value < 0), hasPos = vals.some((i) => i.value > 0);
  const zero = hasNeg && hasPos ? 50 : hasNeg ? 100 : 0;
  return (
    <ul className="space-y-3 px-4 pb-4 pt-1">
      {items.map((it) => {
        const w = it.value == null ? 0 : (Math.abs(it.value) / max) * (hasNeg && hasPos ? 50 : 100);
        return (
          <li key={it.label}>
            <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="flex min-w-0 items-center gap-1.5 truncate">{it.color && <i className="size-2 shrink-0 rounded-full" style={{ background: it.color }} />}{it.label}</span>
              {it.value == null ? <span className="text-[12px] text-muted-foreground">{it.na || 'sin datos'}</span> : <span className={cn('num', it.value < 0 ? 'text-bad' : 'text-good')}>{format(it.value)}</span>}
            </div>
            <div className="relative mt-1.5 h-2 rounded-full bg-muted">
              <span className="absolute inset-y-[-3px] w-px bg-border" style={{ left: `${zero}%` }} />
              <motion.span className="absolute inset-y-0 rounded-full" initial={false} animate={{ width: `${w}%`, left: it.value < 0 ? `${zero - w}%` : `${zero}%` }} transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
                style={{ background: it.color || 'var(--foreground)', opacity: it.value < 0 ? 0.6 : 1 }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Control segmentado con indicador que se desliza (pestañas locales de una página).
export function Segmented({ value, onChange, options, className, size = 'sm' }) {
  const gid = React.useId();
  return (
    <div role="tablist" className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}>
      {options.map(([k, l, n]) => {
        const on = value === k;
        return (
          <button key={k} type="button" role="tab" aria-selected={on} onClick={() => onChange(k)}
            className={cn('press relative rounded-md px-2.5 text-[12.5px] transition-colors', size === 'sm' ? 'h-7' : 'h-8', on ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {on && <motion.span layoutId={`seg-${gid}`} transition={{ type: 'spring', stiffness: 520, damping: 42 }} className="absolute inset-0 rounded-md bg-background shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_rgb(0_0_0/0.06)] dark:bg-accent" />}
            <span className="relative">{l}{n != null && <span className="num ml-1 text-muted-foreground">{n}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Tabla (Table del bloque) con desvanecido y "Ver todo" ----------
export function DataTable({ columns, rows, limit = 6, empty = 'Sin datos', footer, proj }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const more = rows.length > limit;
  return (
    <div className="relative">
      <Table className={cn(proj && '[&_tr]:border-dashed [&_tr]:border-proj-line/70')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c, i) => <TableHead key={c.key} className={cn('text-[12px]', i === 0 && 'pl-6', i === columns.length - 1 && 'pr-6', c.align === 'right' && 'text-end')}>{c.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody className={cn(more && !all && 'mask-b-from-60% mask-b-to-100%')}>
          {shown.length === 0 && <TableRow className="hover:bg-transparent"><TableCell colSpan={columns.length} className="px-6 py-6 text-muted-foreground">{empty}</TableCell></TableRow>}
          {shown.map((r, ri) => (
            <TableRow key={ri} className={cn('hover:bg-transparent', r._strong && 'bg-muted/60 font-medium')}>
              {columns.map((c, i) => <TableCell key={c.key} className={cn('text-[13px]', i === 0 && 'pl-6', i === columns.length - 1 && 'pr-6', c.align === 'right' && 'text-end', c.mono && 'mono', c.className)}>{c.render ? c.render(r) : r[c.key]}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
        {footer && <TableFooter className="bg-muted/60">{footer}</TableFooter>}
      </Table>
      {more && (
        <div className="flex justify-center border-t py-1.5">
          <Button variant="ghost" size="sm" onClick={() => setAll(!all)}>
            {all ? 'Ver menos' : `Ver todo (${rows.length})`}<ArrowRightIcon aria-hidden className={cn('transition-transform', all && '-rotate-90')} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Franja de indicadores (WebVitals del bloque) ----------
export function MetricStrip({ items }) {
  return (
    <ul className="grid gap-6 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((m) => (
        <li key={m.label} className="flex flex-col gap-1">
          <p className="text-pretty text-sm font-medium">{m.label}</p>
          <p className="text-pretty text-xs text-muted-foreground">{m.sub}</p>
          <p className={cn('num text-balance text-2xl font-medium tracking-[-0.025em]', m.tone === 'good' && 'text-good', m.tone === 'bad' && 'text-bad')}>{m.value}</p>
          {m.foot && <p className="text-xs text-muted-foreground">{m.foot}</p>}
        </li>
      ))}
    </ul>
  );
}

// ---------- Logos ----------
export function BrandTile({ id, size = 'md', className }) {
  const st = BRAND_STYLE[id];
  const dims = { xs: 'h-5 w-5 rounded', sm: 'h-7 w-7 rounded-md', md: 'h-10 w-10 rounded-lg', lg: 'h-14 w-14 rounded-xl' }[size];
  if (!st) return <div className={cn(dims, 'bg-border', className)} />;
  if (id === 'club') return (
    <div className={cn(dims, 'flex shrink-0 flex-col items-center justify-center bg-[#0B0B0B] px-[3px]', className)}>
      <img src={st.logo} alt="" className="w-full" />
      {(size === 'md' || size === 'lg') && <span className="mt-0.5 font-semibold uppercase text-white" style={{ fontSize: size === 'lg' ? 8 : 6.5, letterSpacing: '0.3em' }}>club</span>}
    </div>
  );
  if (id === 'icon') return <div className={cn(dims, 'flex shrink-0 items-center justify-center bg-[#7B45FF] p-[3px]', className)}><img src={st.logo} alt="" className="w-full" /></div>;
  return <div className={cn(dims, 'flex shrink-0 items-center justify-center border bg-white p-[3px]', className)}><img src={st.logo} alt="" className="w-full" /></div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="flex flex-col items-start gap-2 px-6 py-8">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-[13px] text-muted-foreground">{children}</div>}
      {action}
    </div>
  );
}

// Tooltip de gráficos con el mismo estilo que ChartTooltipContent.
export function TooltipBox({ title, rows, foot }) {
  return (
    <div className="grid min-w-44 gap-1.5 rounded-md border bg-popover px-2.5 py-2 text-xs shadow-lg">
      {title && <p className="font-medium">{title}</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">{r.color && <i className={cn('h-2.5 w-2.5 rounded-[2px]', r.dashed && 'border border-dashed bg-transparent')} style={r.dashed ? { borderColor: r.color } : { background: r.color }} />}{r.label}</span>
          <span className="mono font-medium text-foreground">{r.value}</span>
        </div>
      ))}
      {foot && <p className="border-t pt-1 text-muted-foreground">{foot}</p>}
    </div>
  );
}

// Leyenda bajo los gráficos.
export function Legend({ items }) {
  return (
    <div className="flex flex-wrap gap-4 border-t px-6 py-2.5 text-[12px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <i className={cn('h-2.5 w-2.5 rounded-[3px]', it.dashed && 'border border-dashed')} style={it.dashed ? { borderColor: it.color || '#9A5B06' } : { background: it.color || '#171717' }} />{it.label}
        </span>
      ))}
    </div>
  );
}

// Patrón rayado SVG para barras proyectadas.
export function HatchDefs({ id, color }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill={color} fillOpacity="0.06" />
      <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth="1.4" strokeOpacity="0.5" />
    </pattern>
  );
}
