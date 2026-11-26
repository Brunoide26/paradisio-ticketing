// Series del gráfico principal del resumen. Funciones puras: aquí viven las reglas de verdad del gráfico.
//  - Lo real y lo proyectado van en series separadas y nunca se suman entre sí.
//  - Un dato faltante (fecha pasada sin liquidar, presupuesto sin costos) es "missing": se dibuja como hueco, nunca como cero.
//  - Un cero confirmado (semana sin fechas, día sin ventas web) sí es cero: la línea toca la base.
//  - Las dos fuentes de ingreso (liquidación por fecha y venta web por día) son métricas distintas: jamás se suman.
// No calcula finanzas: toma los números ya calculados por el servidor (summary, ledgerSummary, sales).

const DAY = 86400000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const utc = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
export const iso = (t) => new Date(t).toISOString().slice(0, 10);
export const startOf = (d, g) => (g === 'day' ? d : g === 'month' ? d.slice(0, 7) + '-01' : iso(utc(d) - ((new Date(utc(d)).getUTCDay() + 6) % 7) * DAY));
export const nextOf = (d, g) => {
  if (g === 'day') return iso(utc(d) + DAY);
  if (g === 'week') return iso(utc(d) + 7 * DAY);
  const y = +d.slice(0, 4), m = +d.slice(5, 7);
  return iso(Date.UTC(m === 12 ? y + 1 : y, m % 12, 1));
};
export const endOf = (d, g) => iso(utc(nextOf(d, g)) - DAY);
export const dm = (d) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`;
export function tickLabel(d, g, multiYear) {
  if (g === 'month') return `${MONTHS[+d.slice(5, 7) - 1]}${multiYear ? ` ${d.slice(2, 4)}` : ''}`;
  return dm(d);
}
export function periodLabel(d, g) {
  if (g === 'day') return `${dm(d)} ${d.slice(0, 4)}`;
  if (g === 'week') return `${dm(d)} al ${dm(endOf(d, g))} ${endOf(d, g).slice(0, 4)}`;
  const m = MONTHS_LONG[+d.slice(5, 7) - 1];
  return `${m[0].toUpperCase()}${m.slice(1)} ${d.slice(0, 4)}`;
}

// ---------- Catálogo de métricas ----------
// `kind`: event (ocurre en la fecha del evento), daily (serie diaria continua), flow (semanal), balance (saldo).
// `curve`: step para datos discretos por fecha, smooth (monótona) para series continuas.
export const METRICS = [
  { id: 'revenue', label: 'Ingresos', long: 'Ingresos reales', kind: 'event', curve: 'step', glossary: 'revenue', source: 'events' },
  { id: 'profit', label: 'Utilidad neta', long: 'Utilidad neta real', kind: 'event', curve: 'step', glossary: 'result', source: 'events', signed: true },
  { id: 'expenses', label: 'Gastos', long: 'Costos reales', kind: 'event', curve: 'step', glossary: 'costs', source: 'events' },
  { id: 'cash', label: 'Caja disponible', long: 'Caja disponible', kind: 'balance', glossary: 'cash', source: 'ledger' },
  { id: 'cashflow', label: 'Flujo de caja', long: 'Flujo de caja neto', kind: 'flow', curve: 'step', glossary: 'cashflow', source: 'ledger', signed: true, groups: ['week', 'month'] },
  { id: 'web', label: 'Venta web', long: 'Venta web cobrada', kind: 'daily', curve: 'smooth', glossary: 'web', source: 'tickets' },
  { id: 'projRevenue', label: 'Ingresos proyectados', long: 'Ingresos proyectados', kind: 'event', curve: 'step', glossary: 'projRevenue', source: 'events', projOnly: true },
  { id: 'projProfit', label: 'Rentabilidad proyectada', long: 'Rentabilidad proyectada', kind: 'event', curve: 'step', glossary: 'projProfit', source: 'events', projOnly: true, signed: true },
];
export const metricById = (id) => METRICS.find((m) => m.id === id) || METRICS[0];

// Definiciones que el servidor no trae (las demás vienen en data.os.metrics).
export const LOCAL_GLOSSARY = {
  cash: { label: 'Caja disponible', formula: 'Saldo inicial de cada cuenta (bancos, caja, Culqi) más cobros menos pagos registrados.', notes: 'Sin cuentas con saldo inicial no se puede calcular: se muestra "no disponible", nunca cero.' },
  cashflow: { label: 'Flujo de caja', formula: 'Entradas menos salidas de dinero por semana, según las transacciones del libro.', notes: 'Lo proyectado (presupuestos por cobrar o pagar) va aparte y rayado.' },
  web: { label: 'Venta web', formula: 'Entradas y mesas cobradas en la web de tickets, por día de venta.', notes: 'Es otra fuente que la liquidación: no incluye barra ni puerta y nunca se suma a los ingresos por fecha (sería contarla dos veces).' },
};

const isPastStage = (f, today) => f.date < today;

// Puntos de una métrica: { date, value, state: real|proj|missing, id, name, brand, note }.
export function pointsFor(metric, { events, sales, financeEvents, ledger, brand, today }) {
  const inScope = (b) => !brand || b === brand;
  const out = [];
  const ev = (events || []).filter((f) => inScope(f.brand) && f.kind !== 'cancelled');
  const push = (f, value, state, note) => out.push({ date: f.date, value, state, id: f.id, name: f.name, brand: f.brand, note });
  if (metric === 'revenue' || metric === 'expenses' || metric === 'profit') {
    ev.forEach((f) => {
      if (f.kind === 'actual') {
        if (metric === 'revenue') f.hasIncome ? push(f, f.revenue, 'real') : push(f, null, 'missing', 'Sin ingresos cargados');
        if (metric === 'expenses') f.hasCosts ? push(f, f.costs, 'real') : push(f, null, 'missing', 'Sin costos cargados');
        if (metric === 'profit') f.result != null ? push(f, f.result, 'real') : push(f, null, 'missing', 'Liquidación incompleta');
      } else if (f.kind === 'budget') {
        if (isPastStage(f, today)) { push(f, null, 'missing', 'Fecha pasada sin liquidar'); return; }
        if (metric === 'revenue') f.hasIncome ? push(f, f.revenue, 'proj') : push(f, null, 'missing', 'Presupuesto sin ingresos');
        if (metric === 'expenses') f.hasCosts ? push(f, f.costs, 'proj') : push(f, null, 'missing', 'Presupuesto sin costos');
        if (metric === 'profit') f.complete && f.result != null ? push(f, f.result, 'proj') : push(f, null, 'missing', 'Presupuesto sin costos: sin utilidad');
      }
    });
  } else if (metric === 'projRevenue' || metric === 'projProfit') {
    ev.filter((f) => f.kind === 'budget' && !isPastStage(f, today)).forEach((f) => {
      if (metric === 'projRevenue') f.hasIncome ? push(f, f.revenue, 'proj') : push(f, null, 'missing', 'Presupuesto sin ingresos');
      else f.complete && f.result != null ? push(f, f.result, 'proj') : push(f, null, 'missing', 'Presupuesto sin costos: sin utilidad');
    });
  } else if (metric === 'web') {
    Object.entries(sales || {}).forEach(([id, s]) => {
      const e = (financeEvents || []).find((x) => x.id === id);
      if (!e || !inScope(e.brand)) return;
      (s.velocity || []).forEach((v) => out.push({ date: v.d, value: Number(v.revenue) || 0, state: 'real', id, name: e.name, brand: e.brand }));
    });
  } else if (metric === 'cashflow' && ledger && ledger.cashflow) {
    // El servidor ya agrupa por semana (lunes). Sólo alcance de grupo: el libro no se divide por marca aquí.
    (ledger.cashflow.weeks || []).forEach((w) => {
      const real = (Number(w.inflow) || 0) - (Number(w.outflow) || 0);
      const proj = (Number(w.projInflow) || 0) - (Number(w.projOutflow) || 0);
      if (w.inflow || w.outflow) out.push({ date: w.week, value: real, state: w.week > today ? 'proj' : 'real', id: null, name: w.week > today ? 'Cobros y pagos programados' : 'Movimientos registrados' });
      if (w.projInflow || w.projOutflow) out.push({ date: w.week, value: proj, state: 'proj', id: null, name: 'Presupuestos por cobrar y pagar' });
    });
  }
  return out;
}

// Disponibilidad de cada métrica con los datos que existen hoy (sin inventar nada).
export function availability(metric, ctx) {
  if (metric === 'cash') {
    const L = ctx.ledger;
    if (!L || !L.accounts || !L.accounts.length) return { ok: false, reason: 'Registra tus cuentas (BCP, caja, Culqi) para calcularla' };
    if (L.cash == null) return { ok: false, reason: 'Falta el saldo inicial de una cuenta' };
    return { ok: true, value: L.cash };
  }
  if (metric === 'cashflow' && ctx.brand) return { ok: false, reason: 'El flujo de caja es del grupo: cambia a "Grupo" para verlo' };
  const pts = pointsFor(metric, ctx);
  if (!pts.length) return { ok: false, reason: metric === 'web' ? 'La web de tickets aún no registra ventas pagadas' : metric.startsWith('proj') ? 'No hay presupuestos de fechas por venir' : 'Todavía no hay datos' };
  if (metric === 'cashflow' && !pts.some((p) => p.value)) return { ok: false, reason: 'Sin movimientos de dinero registrados' };
  return { ok: true };
}

// Agrupa los puntos en períodos. Cada período: real (suma real o null), proj (suma proyectada o null), missing[], items[].
// `coverage` (para series continuas): fuera de ella no hay dato (null), dentro un período sin puntos es cero confirmado.
export function buildBuckets(points, { group, from, to, today, continuous }) {
  const dated = points.filter((p) => p.date);
  if (!dated.length && !from) return [];
  const dates = dated.map((p) => p.date).sort();
  let start = from || dates[0];
  let end = to || (dates[dates.length - 1] > today ? dates[dates.length - 1] : today);
  if (continuous && !to) end = dates[dates.length - 1] > today ? dates[dates.length - 1] : today;
  if (!start || start > end) return [];
  // Sin inicio fijado y con pocos períodos: se amplía hacia atrás hasta 6 (ahí no hubo fechas: cero confirmado),
  // para que una sola fecha no ocupe todo el ancho como si fuera una barra gigante.
  if (!from && !continuous) {
    let s0 = startOf(start, group), count = 0;
    for (let d = s0; d <= end && count < 7; d = nextOf(d, group)) count++;
    const prevOf = (d) => (group === 'day' ? iso(utc(d) - DAY) : group === 'week' ? iso(utc(d) - 7 * DAY) : startOf(iso(utc(d) - DAY), 'month'));
    while (count < 6) { s0 = prevOf(s0); count++; }
    start = s0;
  }
  const covFrom = continuous ? dates[0] : null;
  const covTo = continuous ? dates[dates.length - 1] : null;
  const out = [];
  for (let d = startOf(start, group), i = 0; d <= end && i < 900; d = nextOf(d, group), i++) {
    const e = endOf(d, group);
    const covered = !continuous || (e >= covFrom && d <= covTo);
    out.push({ key: d, end: e, real: covered ? 0 : null, proj: null, hasReal: false, missing: [], items: [], future: d > today, covered });
  }
  const idx = new Map(out.map((b, i) => [b.key, i]));
  points.forEach((p) => {
    if (!p.date || p.date < start || p.date > end) return;
    const b = out[idx.get(startOf(p.date, group))];
    if (!b) return;
    if (p.state === 'real') { b.real = (b.real || 0) + p.value; if (p.value) b.hasReal = true; }
    else if (p.state === 'proj') b.proj = (b.proj || 0) + p.value;
    else b.missing.push(p);
    if (p.id || p.name) {
      const it = b.items.find((x) => x.id === p.id && x.state === p.state && x.name === p.name);
      if (it) it.value = (it.value || 0) + (p.value || 0);
      else b.items.push({ id: p.id, name: p.name, brand: p.brand, value: p.value, state: p.state, note: p.note, date: p.date });
    }
  });
  // Futuro sin datos reales: no es cero, todavía no ocurrió.
  out.forEach((b) => { if (b.future && !b.hasReal) b.real = null; if (b.missing.length && !b.hasReal) b.real = null; });
  return out;
}

// Lectura del rango: total real, proyectado aparte, conteos y estadísticas sólo cuando significan algo.
export function readout(buckets) {
  const realB = buckets.filter((b) => b.real != null);
  const withValue = buckets.filter((b) => b.hasReal);
  const total = realB.reduce((s, b) => s + b.real, 0);
  const projTotal = buckets.reduce((s, b) => s + (b.proj || 0), 0);
  const projCount = buckets.reduce((s, b) => s + b.items.filter((i) => i.state === 'proj').length, 0);
  const realItems = buckets.reduce((s, b) => s + b.items.filter((i) => i.state === 'real' && i.value).length, 0);
  const missing = buckets.reduce((s, b) => s + (b.future ? 0 : b.missing.length), 0);
  const incomplete = buckets.reduce((s, b) => s + (b.future ? b.missing.length : 0), 0);
  // Mejor, peor y promedio sólo con 3 o más períodos con valor: con menos no dicen nada.
  const meaningful = withValue.length >= 3;
  const best = meaningful ? withValue.reduce((m, b) => (b.real > m.real ? b : m)) : null;
  const low = meaningful ? withValue.reduce((m, b) => (b.real < m.real ? b : m)) : null;
  const avg = meaningful ? withValue.reduce((s, b) => s + b.real, 0) / withValue.length : null;
  return { total, hasReal: withValue.length > 0, realPeriods: withValue.length, realItems, projTotal, projCount, hasProj: buckets.some((b) => b.proj != null), missing, incomplete, best, low, avg };
}

// Período anterior del mismo largo, sólo si el rango tiene inicio.
export function previousRange(from, to, today) {
  if (!from) return null;
  const len = utc(to || today) - utc(from) + DAY;
  return { from: iso(utc(from) - len), to: iso(utc(from) - DAY) };
}

// ---------- Geometría ----------
// Interpolación monótona (Fritsch–Carlson, como d3.curveMonotoneX): suave sin pasarse de los datos.
function slope3(x0, y0, x1, y1, x2, y2) {
  const h0 = x1 - x0, h1 = x2 - x1;
  const s0 = (y1 - y0) / (h0 || 1e-9), s1 = (y2 - y1) / (h1 || 1e-9);
  const p = (s0 * h1 + s1 * h0) / (h0 + h1 || 1e-9);
  return (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
}
const slope2 = (x0, y0, x1, y1, t) => { const h = x1 - x0; return h ? (3 * (y1 - y0) / h - t) / 2 : t; };
export function monotonePath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`;
  if (pts.length === 2) return `M${pts[0][0]},${pts[0][1]}L${pts[1][0]},${pts[1][1]}`;
  const t = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? null : slope3(pts[i - 1][0], pts[i - 1][1], p[0], p[1], pts[i + 1][0], pts[i + 1][1])));
  t[0] = slope2(pts[0][0], pts[0][1], pts[1][0], pts[1][1], t[1]);
  const n = pts.length - 1;
  t[n] = slope2(pts[n - 1][0], pts[n - 1][1], pts[n][0], pts[n][1], t[n - 1]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = (x1 - x0) / 3;
    d += `C${x0 + dx},${y0 + dx * t[i]},${x1 - dx},${y1 - dx * t[i + 1]},${x1},${y1}`;
  }
  return d;
}

// Tramos contiguos de valores no nulos: [{ from, to }] por índice.
export function runs(values) {
  const out = []; let s = null;
  values.forEach((v, i) => { if (v != null && s == null) s = i; if ((v == null || i === values.length - 1) && s != null) { out.push({ from: s, to: v == null ? i - 1 : i }); s = null; } });
  return out;
}

// Escala "bonita" para el eje Y, incluyendo el cero.
export function niceDomain(values) {
  const v = values.filter((x) => x != null && isFinite(x));
  let lo = Math.min(0, ...v), hi = Math.max(0, ...v);
  if (hi === lo) hi = lo + 1;
  const span = hi - lo, step0 = span / 4, mag = 10 ** Math.floor(Math.log10(step0)), r = step0 / mag;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const ticks = []; for (let x = lo; x <= hi + step / 2; x += step) ticks.push(Math.round(x * 100) / 100);
  return { lo, hi, ticks };
}
