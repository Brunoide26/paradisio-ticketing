import React, { useState } from 'react';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { cn, money, BRAND_STYLE } from './lib.js';

// ---------- Contenedores (estilo efferd / shadcn) ----------
export function Card({ className, children, delay = 0, dashed, ...p }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 0.84, 0.3, 1] }}
      className={cn('min-w-0 overflow-hidden rounded-xl border bg-panel', dashed ? 'border-dashed border-[#D6D6D2]' : 'border-line', className)}
      {...p}
    >
      {children}
    </motion.section>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3.5', className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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

// Píldora de variación: ▲ / ▼. `good` decide el color (no siempre subir es bueno).
export function DeltaPill({ value, label, good, format = 'pct', className }) {
  if (value == null || !isFinite(value)) return null;
  const up = value >= 0;
  const ok = good == null ? up : good;
  const Icon = up ? TrendingUp : TrendingDown;
  const text = format === 'money' ? money(Math.abs(value)) : `${Math.abs(Math.round(value * 10) / 10)}%`;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', ok ? 'bg-[#E7F6EF] text-good' : 'bg-[#FDEBE6] text-bad', className)}>
      <Icon className="h-3 w-3" />{text}{label && <span className="font-normal opacity-80">{label}</span>}
    </span>
  );
}

export function StatusBadge({ status, className }) {
  const real = status === 'realizado';
  const tone = {
    realizado: 'bg-[#E7F6EF] text-[#047857]',
    presupuesto: 'bg-[#FFF4E5] text-[#9A5B06]',
    confirmado: 'bg-[#E6F4F7] text-[#0B6B7B]',
    'planificación': 'bg-line-soft text-ink-2',
  }[status] || 'bg-line-soft text-ink-2';
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium capitalize', tone, className)}>{real ? 'Real' : status}</span>;
}

export function KindTag({ real }) {
  return real
    ? <span className="inline-flex items-center gap-1.5 rounded-md border border-[#CDEBDD] bg-[#F1FAF5] px-1.5 py-0.5 text-[11px] font-medium text-[#047857]"><i className="h-1.5 w-1.5 rounded-full bg-good" />Real</span>
    : <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#E9C892] bg-[#FFF9F0] px-1.5 py-0.5 text-[11px] font-medium text-[#9A5B06]"><i className="h-1.5 w-1.5 rounded-full border border-[#C58A2E]" />Proyectado</span>;
}

// ---------- Lista con barras de participación (efferd "share bar list") ----------
export function ShareBarList({ items, format = (v) => money(v), color, className }) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
  return (
    <div className={cn('space-y-1.5 py-3', className)}>
      {items.map((it, i) => {
        const c = it.color || color || '#A3A3A0';
        const w = (Math.abs(it.value) / max) * 100;
        return (
          <div key={it.label + i} className="relative flex h-9 items-center justify-between pr-4" title={it.title}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(w, 1.5)}%` }} transition={{ duration: 0.9, delay: 0.05 * i, ease: [0.16, 0.84, 0.3, 1] }}
              className="absolute inset-y-0 left-0 max-w-[calc(100%-120px)] rounded-r-md border-r-2"
              style={{ background: `linear-gradient(90deg, ${c}10 0%, ${c}40 100%)`, borderColor: c }} />
            <span className="relative z-10 truncate pl-3 text-[13px] font-medium text-ink">{it.label}</span>
            <span className="relative z-10 shrink-0 pl-3 text-[13px] text-ink-2"><span className="mono">{format(it.value)}</span>{it.extra && <span className="ml-1.5 text-[11px] text-muted">{it.extra}</span>}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------- Tabla con desvanecido y "Ver todo" ----------
export function DataTable({ columns, rows, limit = 6, empty = 'Sin datos', className, footer }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, limit);
  const more = rows.length > limit;
  return (
    <div className={className}>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => <th key={c.key} className={cn('whitespace-nowrap px-4 py-2.5 text-left font-medium text-ink', c.align === 'right' && 'text-right')}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody className={cn(more && !all && 'fade-last')}>
            {shown.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-6 text-muted">{empty}</td></tr>}
            {shown.map((r, i) => (
              <tr key={i} className={cn('border-b border-line-soft last:border-0', r._strong && 'bg-[#FAFAF9] font-medium')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 py-2', c.align === 'right' && 'text-right', c.mono && 'mono', c.className)}>{c.render ? c.render(r) : r[c.key]}</td>)}
              </tr>
            ))}
          </tbody>
          {footer}
        </table>
      </div>
      {more && (
        <button onClick={() => setAll(!all)} className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-[13px] font-medium text-ink hover:bg-[#FAFAF9]">
          {all ? 'Ver menos' : `Ver todo (${rows.length})`} <ArrowRight className={cn('h-3.5 w-3.5 transition-transform', all && '-rotate-90')} />
        </button>
      )}
    </div>
  );
}

// ---------- Franja de métricas (efferd "web vitals") ----------
export function MetricStrip({ items }) {
  return (
    <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      {items.map((m) => (
        <div key={m.label} className="px-4 py-4">
          <p className="text-[13px] font-medium">{m.label}</p>
          <p className="text-[12px] text-muted">{m.sub}</p>
          <p className={cn('mono mt-2 text-2xl font-medium', m.tone === 'good' && 'text-good', m.tone === 'bad' && 'text-bad')}>{m.value}</p>
          {m.foot && <p className="mt-1 text-[12px] text-muted">{m.foot}</p>}
        </div>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 text-[13px] text-ink-2">
      <span className={cn('relative h-[18px] w-8 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-cost')}>
        <span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all" style={{ left: checked ? 16 : 2 }} />
      </span>
      {label}
    </button>
  );
}

export function Button({ className, variant = 'solid', size = 'md', ...p }) {
  const v = {
    solid: 'bg-ink text-white hover:bg-[#262626]',
    outline: 'border border-line bg-panel text-ink hover:bg-[#F5F5F4]',
    ghost: 'text-ink-2 hover:bg-[#F5F5F4] hover:text-ink',
    danger: 'border border-line text-bad hover:border-bad',
  }[variant];
  const s = size === 'sm' ? 'h-8 px-2.5 text-[13px]' : size === 'icon' ? 'h-8 w-8' : 'h-9 px-3.5 text-sm';
  return <button className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50', v, s, className)} {...p} />;
}

export function BrandTile({ id, size = 'md', className }) {
  const st = BRAND_STYLE[id];
  const dims = { xs: 'h-5 w-5 rounded', sm: 'h-7 w-7 rounded-md', md: 'h-10 w-10 rounded-lg', lg: 'h-16 w-16 rounded-xl' }[size];
  if (!st) return <div className={cn(dims, 'bg-line', className)} />;
  if (id === 'club') return (
    <div className={cn(dims, 'flex shrink-0 flex-col items-center justify-center bg-[#0B0B0B] px-[3px]', className)}>
      <img src={st.logo} alt="" className="w-full" />
      {(size === 'md' || size === 'lg') && <span className="mt-0.5 font-semibold uppercase text-white" style={{ fontSize: size === 'lg' ? 9 : 6.5, letterSpacing: '0.3em' }}>club</span>}
    </div>
  );
  if (id === 'icon') return <div className={cn(dims, 'flex shrink-0 items-center justify-center bg-[#7B45FF] p-[3px]', className)}><img src={st.logo} alt="" className="w-full" /></div>;
  return <div className={cn(dims, 'flex shrink-0 items-center justify-center border border-line bg-white p-[3px]', className)}><img src={st.logo} alt="" className="w-full" /></div>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="flex flex-col items-start gap-2 px-4 py-8">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-[13px] text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function TooltipBox({ title, rows, foot }) {
  return (
    <div className="min-w-44 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1 font-medium text-ink">{title}</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5 text-ink-2">
          <span className="flex items-center gap-1.5">{r.color && <i className={cn('h-2 w-2 rounded-[2px]', r.dashed && 'border border-dashed bg-white')} style={r.dashed ? { borderColor: r.color } : { background: r.color }} />}{r.label}</span>
          <span className="mono text-ink">{r.value}</span>
        </div>
      ))}
      {foot && <p className="mt-1 border-t border-line pt-1 text-muted">{foot}</p>}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-[#FAFAF9] p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn('rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors', value === o.value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink-2')}>{o.label}</button>
      ))}
    </div>
  );
}
