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

// Etapas: texto neutro con un punto de color (sin pastillas de colores por todas partes).
const STAGE_DOT = {
  concept: 'bg-faint', evaluation: 'bg-warn', confirmed: 'bg-sky-500', preproduction: 'bg-indigo-500',
  on_sale: 'bg-violet-500', live: 'bg-bad animate-pulse', settlement: 'bg-teal-500', closed: 'bg-good', cancelled: 'bg-faint',
};
export function StageBadge({ stage, stages, className }) {
  const s = (stages || []).find((x) => x.id === stage);
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border/70 bg-background px-1.5 py-px text-[11.5px] text-foreground/80', stage === 'cancelled' && 'text-muted-foreground line-through', className)}>
      <i className={cn('size-1.5 shrink-0 rounded-full', STAGE_DOT[stage] || 'bg-faint')} />{s ? s.label : stage}
    </span>
  );
}

export function BrandDot({ id, className }) {
  return <i className={cn('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: brandColor(id) }} />;
}

// Valor faltante: se dice que falta y por qué. Nunca se muestra como cero.
export function Unavailable({ reason, className }) {
  return <span title={reason} className={cn('inline-flex items-center gap-1 text-[13px] font-normal text-muted-foreground', className)}>No disponible{reason && <InfoIcon className="size-3.5" />}</span>;
}

// Indicador compacto; al hacer clic abre de dónde sale el número.
// Dentro de una fila .kpi-strip se ve como celdas separadas por líneas finas (sin una tarjeta por cifra).
export function Kpi({ label, value, sub, tone, proj, onClick, unavailable, className }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} type={onClick ? 'button' : undefined}
      className={cn('group flex min-w-0 flex-col gap-1.5 rounded-lg border bg-card px-4 py-3.5 text-left transition-colors',
        proj && 'border-dashed border-proj-line bg-proj-soft/50',
        onClick && 'hover:bg-muted/40', className)}>
      <span className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground transition-colors group-hover:text-foreground">
        {proj && <i className="proj-hatch inline-block size-2 shrink-0 rounded-[2px] border border-proj-line" />}{label}
      </span>
      {unavailable ? <Unavailable reason={unavailable} className="py-[3px] text-[14px]" />
        : <span className={cn('num truncate text-[22px] font-medium leading-tight tracking-[-0.025em]', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad', proj && 'text-foreground/80')}>{value}</span>}
      {sub && <span className="truncate text-[11.5px] text-muted-foreground">{sub}</span>}
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
            {title && <h2 className="text-[14px] font-medium tracking-tight">{title}</h2>}
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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em]">{title}</h1>
        {description && <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
      {children}
    </div>
  );
}

export const sel = 'h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30';

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
