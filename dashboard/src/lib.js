import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...a) => twMerge(clsx(a));

// Identidad visual de cada marca: manda sobre lo guardado en los datos.
export const BRAND_STYLE = {
  club: { color: '#F0441A', soft: '#FDE8E1', logo: '/administracion/logos/paradisio-orange.png', tile: 'club' },
  beats: { color: '#0F9BB0', soft: '#DFF3F6', logo: '/administracion/logos/beats.png', tile: 'beats' },
  icon: { color: '#7B45FF', soft: '#EDE6FF', logo: '/administracion/logos/icon-mark.png', tile: 'icon' },
};
export const brandColor = (id) => (BRAND_STYLE[id] || {}).color || '#8B8881';

export const CATEGORIES = ['Local', 'Talento', 'Personal', 'Barra', 'Promotores', 'Producción', 'Marketing', 'Comisiones', 'Impuestos', 'Boxes y mesas', 'Entradas', 'Otros'];
export const STATUSES = ['planificación', 'confirmado', 'presupuesto', 'realizado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Formato Perú: soles (PEN) por defecto, USD disponible. `null` = no disponible.
const NF = {};
const nf = (cur, dec) => (NF[cur + dec] ||= new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: dec, maximumFractionDigits: dec }));
export function money(n, dec = 0, cur = 'PEN') {
  if (n == null || (typeof n === 'number' && !isFinite(n))) return '—';
  const v = Number(n) || 0;
  return (v < 0 ? '−' : '') + nf(cur, dec).format(Math.abs(v));
}
export function short(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  const s = a >= 1000 ? (a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(a));
  return (v < 0 ? '−' : '') + 'S/ ' + s;
}
export const pct = (n) => (n == null || !isFinite(n) ? '—' : (Math.round(Number(n) * 10) / 10).toLocaleString('es-PE') + '%');
export const sum = (arr, f = (x) => x) => (arr || []).reduce((s, x) => s + (Number(f(x)) || 0), 0);

export const parseDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
export const fmtDate = (d) => { const x = parseDate(d); return `${DAYS_LONG[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const fmtShort = (d) => { const x = parseDate(d); return `${x.getDate()} ${MONTHS[x.getMonth()]}`; };
export const dayName = (d) => DAYS[parseDate(d).getDay()];
export const monthName = (d) => MONTHS[parseDate(d).getMonth()];
// "Hoy" en Lima, aunque el navegador esté en otra zona horaria.
export const limaISO = (d = new Date()) => new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
export const today = () => parseDate(limaISO());
export const daysTo = (d) => Math.round((parseDate(d) - today()) / 86400000);
// Números reales sólo desde Liquidación (ver lib/os/stages.js en el servidor).
export const ACTUAL_STAGES = ['settlement', 'closed'];
const LEGACY = { 'planificación': 'concept', presupuesto: 'evaluation', confirmado: 'confirmed', realizado: 'closed', cancelado: 'cancelled' };
export const stageOf = (e) => (e && e.stage) || LEGACY[e && e.status] || 'concept';
export const isActual = (e) => ACTUAL_STAGES.includes(stageOf(e));

export function totals(e, withTaxes) {
  const costs = (e.costs || []).filter((c) => withTaxes || c.category !== 'Impuestos');
  const income = sum(e.income, (x) => x.amount);
  const cost = sum(costs, (x) => x.amount);
  // Mismo criterio que lib/os/finance.js: stock final sólo en eventos reales, menos inventario inicial.
  const stock = isActual(e) ? Number(e.stockLeft) || 0 : 0;
  const opening = Number(e.openingStock) || 0;
  const inv = sum(e.brandInvestment, (x) => x.amount);
  const result = income - cost + stock - opening;
  return {
    income, cost, stock, opening, inv, result, costs,
    margin: income ? (result / income) * 100 : 0,
    coverage: cost ? ((income + stock) / cost) * 100 : 0,
  };
}

export function byCategory(costs) {
  const m = new Map();
  costs.forEach((x) => { const k = x.category || 'Otros'; const g = m.get(k) || { name: k, value: 0, items: [] }; g.value += Number(x.amount) || 0; g.items.push(x); m.set(k, g); });
  return [...m.values()].sort((a, b) => b.value - a.value);
}

export const ss = (k, v) => {
  try {
    if (v === undefined) return sessionStorage.getItem(k);
    if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v);
  } catch { return null; }
  return null;
};
