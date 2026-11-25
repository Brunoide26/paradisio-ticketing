import React, { useEffect, useRef } from 'react';
import { motion, animate } from 'motion/react';
import { cn, money, pct, BRAND_STYLE } from './lib.js';

export function Card({ className, children, delay = 0, ...p }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 0.84, 0.3, 1] }}
      className={cn('min-w-0 rounded-xl border border-line bg-panel', className)}
      {...p}
    >
      {children}
    </motion.section>
  );
}

export function CardHead({ title, hint, right, className }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-line-soft px-5 py-3.5', className)}>
      <div className="min-w-0">
        <h3 className="text-[13px] font-medium tracking-tight text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

export function Count({ value, format = 'money', className }) {
  const ref = useRef(null);
  const fmt = format === 'int' ? (x) => Math.round(x).toLocaleString('en-US') : format === 'pct' ? pct : (x) => money(x);
  useEffect(() => {
    if (!ref.current) return;
    const c = animate(0, Number(value) || 0, { duration: 1.1, ease: [0.16, 0.84, 0.3, 1], onUpdate: (v) => { if (ref.current) ref.current.textContent = fmt(v); } });
    return () => c.stop();
  }, [value, format]);
  return <span ref={ref} className={cn('num', className)}>{fmt(value)}</span>;
}

export function Badge({ children, tone = 'neutral', className }) {
  const tones = {
    neutral: 'bg-line-soft text-ink-2',
    realizado: 'bg-[#E2F2EA] text-[#0F6A4C]',
    presupuesto: 'bg-[#FCEEDC] text-[#8A4B0C]',
    confirmado: 'bg-[#DFF0F7] text-[#0B5F73]',
    'planificación': 'bg-line-soft text-ink-2',
  };
  return <span className={cn('inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium', tones[tone] || tones.neutral, className)}>{children}</span>;
}

export function Segmented({ value, onChange, options, className }) {
  return (
    <div className={cn('inline-flex rounded-lg border border-line bg-panel p-0.5', className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={cn('relative rounded-md px-2.5 py-1 text-xs font-medium transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-ink-2')}>
          {value === o.value && <motion.span layoutId={'seg-' + options.map((x) => x.value).join('')} className="absolute inset-0 rounded-md bg-line-soft" transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2 text-xs text-ink-2">
      <span className={cn('relative h-[18px] w-8 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-cost')}>
        <motion.span layout className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow" style={{ left: checked ? 16 : 2 }} />
      </span>
      {label}
    </button>
  );
}

export function Button({ className, variant = 'solid', size = 'md', ...p }) {
  const v = {
    solid: 'bg-ink text-white hover:bg-[#2a2a28]',
    outline: 'border border-line bg-panel text-ink hover:bg-line-soft',
    ghost: 'text-ink-2 hover:bg-line-soft',
    danger: 'border border-line text-bad hover:border-bad',
  }[variant];
  const s = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm';
  return <button className={cn('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50', v, s, className)} {...p} />;
}

// Logo de cada marca en su "ficha".
export function BrandTile({ id, size = 'md', className }) {
  const st = BRAND_STYLE[id];
  const dims = { sm: 'h-7 w-7 rounded-md', md: 'h-10 w-10 rounded-lg', lg: 'h-16 w-16 rounded-xl' }[size];
  if (!st) return <div className={cn(dims, 'bg-line', className)} />;
  if (id === 'club') return (
    <div className={cn(dims, 'flex flex-col items-center justify-center bg-[#0B0B0B] px-1', className)}>
      <img src={st.logo} alt="" className="w-full" />
      {size !== 'sm' && <span className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.3em] text-white" style={size === 'lg' ? { fontSize: 9 } : null}>club</span>}
    </div>
  );
  if (id === 'icon') return (
    <div className={cn(dims, 'flex items-center justify-center bg-[#7B45FF] p-1', className)}>
      <img src={st.logo} alt="" className="w-full" />
    </div>
  );
  return (
    <div className={cn(dims, 'flex items-center justify-center border border-line bg-white p-1', className)}>
      <img src={st.logo} alt="" className="w-full" />
    </div>
  );
}

export function Delta({ value, suffix = '' }) {
  const pos = value >= 0;
  return <span className={cn('num text-xs font-medium', pos ? 'text-good' : 'text-bad')}>{pos ? '▲' : '▼'} {suffix ? value : money(Math.abs(value))}{suffix}</span>;
}

export function Empty({ title, children, action }) {
  return (
    <div className="flex flex-col items-start gap-2 px-5 py-8">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
      {action}
    </div>
  );
}

export function TooltipBox({ title, rows, foot }) {
  return (
    <div className="min-w-44 rounded-lg border border-[#2b2b29] bg-ink px-3 py-2 text-xs text-[#E6E4DF] shadow-xl">
      {title && <p className="mb-1 font-medium text-white">{title}</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">{r.color && <i className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} />}{r.label}</span>
          <span className="num text-white">{r.value}</span>
        </div>
      ))}
      {foot && <p className="mt-1 border-t border-[#2b2b29] pt-1 text-[#B9B6AE]">{foot}</p>}
    </div>
  );
}
