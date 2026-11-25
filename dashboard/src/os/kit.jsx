import React from 'react';
import { InfoIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn, money, pct, brandColor, parseDate } from '../lib.js';
import { useOS as useOSLazy } from './store.jsx';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export const fmtDay = (iso) => { if (!iso) return '—'; const d = parseDate(iso); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtDayYear = (iso) => { if (!iso) return '—'; const d = parseDate(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export const fmtStamp = (iso) => new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const relDays = (n) => (n == null ? '' : n === 0 ? 'hoy' : n === 1 ? 'mañana' : n > 0 ? `en ${n} días` : n === -1 ? 'ayer' : `hace ${-n} días`);

const STAGE_TONE = {
  concept: 'bg-muted text-muted-foreground',
  evaluation: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  confirmed: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  preproduction: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  on_sale: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
  live: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  settlement: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  closed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  cancelled: 'bg-muted text-muted-foreground line-through',
};
export function StageBadge({ stage, stages, className }) {
  const s = (stages || []).find((x) => x.id === stage);
  return <Badge variant="secondary" className={cn('rounded-md px-1.5 text-[11px] font-medium', STAGE_TONE[stage], className)}>{s ? s.label : stage}</Badge>;
}

export function BrandDot({ id, className }) {
  return <i className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: brandColor(id) }} />;
}

// Valor faltante: se dice que falta y por qué. Nunca se muestra como cero.
export function Unavailable({ reason, className }) {
  return <span title={reason} className={cn('inline-flex items-center gap-1 text-[13px] font-normal text-muted-foreground', className)}>No disponible{reason && <InfoIcon className="size-3.5" />}</span>;
}

// Tarjeta de KPI compacta; al hacer clic abre de dónde sale el número.
export function Kpi({ label, value, sub, tone, proj, onClick, unavailable, className }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} type={onClick ? 'button' : undefined}
      className={cn('flex min-w-0 flex-col gap-1 rounded-lg border bg-card px-3.5 py-3 text-left shadow-xs transition-colors',
        proj && 'border-dashed border-proj-line bg-proj-soft/50 shadow-none dark:bg-transparent',
        onClick && 'hover:border-ring', className)}>
      <span className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
        {proj && <i className="size-1.5 shrink-0 rounded-full border border-proj" />}{label}
      </span>
      {unavailable ? <Unavailable reason={unavailable} className="py-[3px]" />
        : <span className={cn('mono truncate text-[22px] font-semibold leading-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', proj && 'text-foreground/80')}>{value}</span>}
      {sub && <span className="truncate text-[12px] text-muted-foreground">{sub}</span>}
    </Comp>
  );
}

export const moneyOrNA = (v) => (v == null ? null : money(v));
export const signTone = (v) => (v == null ? undefined : v >= 0 ? 'good' : 'bad');
export { pct };

export function Section({ title, description, action, children, className }) {
  return (
    <section className={cn('flex min-w-0 flex-col gap-2', className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>}
            {description && <p className="text-[12px] text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, description, actions, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {children}
    </div>
  );
}

export const sel = 'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30';

export function Field({ label, children, className, hint }) {
  return (
    <Label className={cn('flex flex-col items-stretch gap-1.5 text-xs font-normal text-muted-foreground', className)}>
      {label}{children}{hint && <span className="text-[11px]">{hint}</span>}
    </Label>
  );
}

// Alcance actual (grupo o marca) para títulos y estados vacíos.
export function useScope() {
  const { data, workspace } = useOSLazy();
  const brand = workspace === 'group' ? null : (data.finance.brands || []).find((b) => b.id === workspace) || null;
  return { brandId: brand ? brand.id : null, brand, name: brand ? brand.name : 'Todo el grupo', inScope: (brandId) => !brand || brandId === brand.id };
}
