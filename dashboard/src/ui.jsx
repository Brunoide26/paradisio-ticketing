import React, { useState } from 'react';
import NumberFlow from '@number-flow/react';
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
    <Card className={cn('gap-0 overflow-hidden py-0', proj && 'border-dashed border-proj-line bg-[#FFFDF9] shadow-none', className)} {...p}>
      {children}
    </Card>
  );
}

export function PanelHeader({ title, description, action, className, big }) {
  return (
    <CardHeader className={cn('border-b py-4 [.border-b]:pb-4', className)}>
      <CardTitle className={cn(big ? 'font-mono text-2xl font-medium tabular-nums tracking-tight' : 'text-balance text-[15px] font-medium')}>{title}</CardTitle>
      {description && <CardDescription className="text-pretty text-[13px]">{description}</CardDescription>}
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
    ? <Badge variant="outline" className="rounded-md border-emerald-200 bg-emerald-50 text-emerald-700"><i className="size-1.5 rounded-full bg-good" />Real</Badge>
    : <Badge variant="outline" className="rounded-md border-dashed border-proj-line bg-proj-soft text-proj"><i className="size-1.5 rounded-full border border-proj" />Proyectado</Badge>;
}

// ---------- Lista con barras (ShareBarList del bloque) ----------
export function Bars({ items, format = (v) => money(v), color = '#737370', dashed, className, empty = 'Sin datos todavía.' }) {
  if (!items.length) return <p className={cn('px-6 py-5 text-[13px] text-muted-foreground', className)}>{empty}</p>;
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <ShareBarList className={cn('py-1', className)}>
      {items.map((it, i) => (
        <ShareBarListItem key={it.label + i} value={(Math.abs(it.value) / max) * 62} title={it.title} className="h-11">
          <ShareBarListContent>
            <ShareBarListLabel className="truncate font-medium">{it.label}</ShareBarListLabel>
            <ShareBarListValue className="shrink-0">
              <span className="mono font-normal text-foreground/80">{format(it.value)}</span>
              {it.extra && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{it.extra}</span>}
            </ShareBarListValue>
          </ShareBarListContent>
          <ShareBarListFill color={it.color || color} dashed={dashed} />
        </ShareBarListItem>
      ))}
    </ShareBarList>
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
          <p className={cn('mono text-balance text-2xl font-semibold', m.tone === 'good' && 'text-good', m.tone === 'bad' && 'text-bad')}>{m.value}</p>
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
    <div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
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
