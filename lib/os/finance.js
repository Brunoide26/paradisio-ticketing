// Capa de cálculo financiero de Paradisio OS.
//
// Todas las cifras que muestra el OS (evento, marca, grupo) salen de aquí, en
// el servidor. El frontend no recalcula totales: sólo los muestra. Cada
// métrica está definida en METRICS y cada total devuelve de qué eventos sale.
//
// Reglas (ver docs/paradisio-os/01-auditoria-y-plan.md §2.3 y §6):
// - Real y presupuesto nunca se suman entre sí.
// - La utilidad proyectada sólo existe si el presupuesto tiene costos.
// - Inventario: resultado = ingresos − costos + stock final − stock inicial.
//   Si el evento usa stock de una fecha anterior y no lo registra como
//   inventario inicial, se avisa; no se inventa el número.
// - Lo que no hay (caja, por pagar, por cobrar) es `null` con un motivo,
//   nunca cero.
// - Montos en soles; se suman en céntimos para no arrastrar errores de coma.

const { stageOf, isActualStage, STAGES } = require('./stages');

const cents = (n) => Math.round((Number(n) || 0) * 100);
const soles = (c) => c / 100;
const sumC = (arr, f) => arr.reduce((s, x) => s + cents(f(x)), 0);
const TAX = 'Impuestos';
// Formato Perú para los textos que arma el servidor.
const PEN = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPEN = (n) => (n < 0 ? '−' : '') + PEN.format(Math.abs(Number(n) || 0));
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = (iso) => { const [, m, d] = String(iso).split('-').map(Number); return `${d} ${MES[m - 1]}`; };
const WEB_INCOME = new Set(['Entradas', 'Boxes y mesas']);

const METRICS = {
  revenue: { label: 'Ingresos reales', formula: 'Suma de las líneas de ingreso de eventos en Liquidación o Cerrados.', notes: 'No incluye presupuestos, aportes de capital ni cobros de fechas que todavía no ocurren.' },
  costs: { label: 'Costos reales', formula: 'Suma de las líneas de costo de eventos en Liquidación o Cerrados (sin la categoría Impuestos si el interruptor está apagado).', notes: 'Las compras de barra se cargan completas; el sobrante se corrige con el stock final.' },
  result: { label: 'Resultado real', formula: 'Ingresos − costos + stock final − stock inicial.', notes: 'La inversión en marca no entra: es un activo que se reusa.' },
  margin: { label: 'Margen', formula: 'Resultado / ingresos.', notes: 'No disponible si no hay ingresos.' },
  stock: { label: 'Stock final', formula: 'Inventario que quedó al cierre, valorizado a costo.' },
  brandInvestment: { label: 'Inversión en marca', formula: 'Suma de activos comprados para la marca (cartel, POS, mobiliario…).', notes: 'Se muestra aparte: no es costo del evento.' },
  projRevenue: { label: 'Ingresos proyectados', formula: 'Suma de los ingresos presupuestados de eventos que no están en Liquidación, Cerrados ni Cancelados.' },
  projProfit: { label: 'Utilidad proyectada', formula: 'Ingresos − costos presupuestados, sólo de presupuestos completos (con costos).', notes: 'Los presupuestos sin costos se excluyen y se cuentan aparte: nunca se toma su ingreso como utilidad.' },
  variance: { label: 'Real vs. presupuesto', formula: 'Resultado real − utilidad presupuestada aprobada, por evento.', notes: 'Sólo para eventos que tenían presupuesto guardado al pasar a Liquidación.' },
  cash: { label: 'Caja disponible', formula: 'Saldo de cuentas bancarias y de caja.', notes: 'Requiere registrar cuentas y saldos (Fase 2).' },
  payables: { label: 'Por pagar', formula: 'Obligaciones devengadas no pagadas.', notes: 'Requiere registrar fechas de pago de cada costo (Fase 2).' },
  receivables: { label: 'Por cobrar', formula: 'Ventas devengadas no cobradas.', notes: 'Requiere registrar cobranzas (Fase 2).' },
};

function lines(e, withTaxes) {
  const income = (e.income || []).map((l) => ({ label: l.label, category: l.category || 'Otros', amount: Number(l.amount) || 0 }));
  const allCosts = (e.costs || []).map((l) => ({ label: l.label, category: l.category || 'Otros', amount: Number(l.amount) || 0 }));
  const costs = allCosts.filter((l) => withTaxes || l.category !== TAX);
  return { income, costs, allCosts };
}

function computeBlock({ income, costs }, closing, opening) {
  const rev = sumC(income, (l) => l.amount);
  const cost = sumC(costs, (l) => l.amount);
  const res = rev - cost + cents(closing) - cents(opening);
  return { revenue: soles(rev), costs: soles(cost), result: soles(res), margin: rev ? (res / rev) * 100 : null };
}

// Cifras de un evento. `ctx` trae los demás eventos (para detectar stock
// heredado) y Culqi (para conciliar, nunca para sumar).
function eventFinancials(e, { withTaxes = true, events = [], culqi = null, today = new Date() } = {}) {
  const stage = stageOf(e);
  const actual = isActualStage(stage);
  const L = lines(e, withTaxes);
  const opening = e.openingStock == null || e.openingStock === '' ? null : Number(e.openingStock) || 0;
  const closing = Number(e.stockLeft) || 0;
  const block = computeBlock(L, actual ? closing : 0, opening || 0);
  const hasCosts = L.allCosts.length > 0;
  const hasIncome = L.income.length > 0;
  const complete = hasIncome && hasCosts;
  const kind = stage === 'cancelled' ? 'cancelled' : actual ? 'actual' : 'budget';
  const warnings = [];

  if (!actual && !complete) {
    // Presupuesto incompleto: hay ingreso estimado pero no costos (o al revés).
    block.result = null; block.margin = null;
    if (hasIncome || hasCosts) warnings.push({ code: 'budget_incomplete', level: 'warn', text: hasIncome ? 'Presupuesto sin costos: la utilidad no se calcula.' : 'Presupuesto sin ingresos.' });
  }
  // Stock heredado: la fecha anterior real de la marca cerró con stock y esta no registra inventario inicial.
  const prev = events.filter((x) => x.brand === e.brand && x.date < e.date && isActualStage(stageOf(x)) && Number(x.stockLeft) > 0).pop();
  // Sólo la fecha que sigue al cierre puede heredar ese stock; las siguientes no se marcan.
  const heir = prev && events.filter((x) => x.brand === e.brand && x.date > prev.date && stageOf(x) !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date))[0];
  if (prev && heir && heir.id === e.id && opening == null && stage !== 'cancelled') {
    warnings.push({ code: 'opening_stock', level: 'warn', text: `La fecha del ${fmtDate(prev.date)} cerró con ${fmtPEN(prev.stockLeft)} de stock. Si esta fecha lo usa, regístralo como inventario inicial o su resultado queda inflado.`, amount: Number(prev.stockLeft), from: prev.id });
  }
  if (actual && hasIncome && !L.allCosts.some((l) => l.category === TAX)) {
    warnings.push({ code: 'no_tax_lines', level: 'info', text: 'Sin líneas de IGV/renta: el resultado "sin impuestos" es igual al "con impuestos" y los ingresos podrían estar con IGV incluido.' });
  }
  const cq = culqi && culqi.connected && culqi.byEvent ? culqi.byEvent[e.id] : null;
  let reconciliation = null;
  if (cq && cq.amount) {
    const manualWeb = soles(sumC(L.income.filter((l) => WEB_INCOME.has(l.category)), (l) => l.amount));
    reconciliation = { culqi: cq.amount, culqiNet: cq.net, manualWeb, diff: Math.round((cq.amount - manualWeb) * 100) / 100 };
    if (Math.abs(reconciliation.diff) >= 1) warnings.push({ code: 'culqi_diff', level: 'info', text: `Culqi cobró ${fmtPEN(cq.amount)}; las líneas de entradas, boxes y mesas cargadas suman ${fmtPEN(manualWeb)}. No se suman entre sí: revisa cuál es el dato correcto.` });
  }

  let budget = null;
  if (e.budget && (e.budget.income || e.budget.costs)) {
    const B = lines(e.budget, withTaxes);
    budget = { ...computeBlock(B, 0, 0), approvedAt: e.budget.approvedAt || null, complete: B.income.length > 0 && B.allCosts.length > 0 };
    if (!budget.complete) budget.result = null;
  }

  return {
    id: e.id, brand: e.brand, date: e.date, name: e.name, venue: e.venue || '', stage, kind,
    ...block,
    closingStock: actual ? closing : null,
    openingStock: opening,
    brandInvestment: soles(sumC(e.brandInvestment || [], (l) => l.amount)),
    complete, hasIncome, hasCosts,
    daysTo: Math.round((new Date(e.date + 'T00:00:00-05:00') - startOfLimaDay(today)) / 86400000),
    budget, reconciliation, warnings,
  };
}

function startOfLimaDay(d) {
  const iso = new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return new Date(iso + 'T00:00:00-05:00');
}

function groupBy(list, key, val) {
  const m = new Map();
  list.forEach((x) => { const k = key(x); m.set(k, (m.get(k) || 0) + cents(val(x))); });
  return [...m.entries()].map(([k, v]) => ({ key: k, value: soles(v) })).sort((a, b) => b.value - a.value);
}

// Resumen para un alcance (grupo o marca) y un rango de fechas (sólo filtra lo real).
function summarize(finance, { brand = null, from = null, to = null, withTaxes = true, culqi = null, today = new Date() } = {}) {
  const all = (finance.events || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const scoped = all.filter((e) => !brand || e.brand === brand);
  const fin = scoped.map((e) => eventFinancials(e, { withTaxes, events: all, culqi, today }));
  const byId = new Map(scoped.map((e) => [e.id, e]));

  const actual = fin.filter((f) => f.kind === 'actual' && (!from || f.date >= from) && (!to || f.date <= to));
  const budget = fin.filter((f) => f.kind === 'budget');
  const complete = budget.filter((f) => f.complete);

  const A = {
    count: actual.length,
    revenue: soles(sumC(actual, (f) => f.revenue)),
    costs: soles(sumC(actual, (f) => f.costs)),
    result: soles(sumC(actual, (f) => f.result)),
    stock: soles(sumC(actual, (f) => f.closingStock)),
    brandInvestment: soles(sumC(actual, (f) => f.brandInvestment)),
    events: actual.map((f) => f.id),
  };
  A.margin = cents(A.revenue) ? (A.result / A.revenue) * 100 : null;
  const actualLines = actual.map((f) => lines(byId.get(f.id), withTaxes));
  A.byIncomeCategory = groupBy(actualLines.flatMap((l) => l.income), (l) => l.category, (l) => l.amount);
  A.byCostCategory = groupBy(actualLines.flatMap((l) => l.costs), (l) => l.category, (l) => l.amount);
  A.byBrand = (finance.brands || []).filter((b) => !brand || b.id === brand).map((b) => {
    const xs = actual.filter((f) => f.brand === b.id);
    const rev = sumC(xs, (f) => f.revenue), res = sumC(xs, (f) => f.result);
    return { brand: b.id, count: xs.length, revenue: soles(rev), result: soles(res), margin: rev ? (res / rev) * 100 : null };
  });

  const P = {
    count: budget.length,
    revenue: soles(sumC(budget, (f) => f.revenue)),
    completeCount: complete.length,
    incomplete: budget.filter((f) => !f.complete).map((f) => f.id),
    costs: soles(sumC(complete, (f) => f.costs)),
    profit: complete.length ? soles(sumC(complete, (f) => f.result)) : null,
    events: budget.map((f) => f.id),
  };

  const withBudget = actual.filter((f) => f.budget && f.budget.result != null);
  const variance = withBudget.length ? {
    events: withBudget.map((f) => ({ id: f.id, budget: f.budget.result, actual: f.result, diff: Math.round((f.result - f.budget.result) * 100) / 100 })),
    total: soles(sumC(withBudget, (f) => f.result) - sumC(withBudget, (f) => f.budget.result)),
  } : null;

  return {
    scope: { brand, from, to, withTaxes },
    actual: A,
    projected: P,
    variance,
    unavailable: { cash: METRICS.cash.notes, payables: METRICS.payables.notes, receivables: METRICS.receivables.notes },
    events: fin,
  };
}

// Lo que requiere atención hoy. Cada ítem apunta a un evento o a una ruta.
function attention(summary, { culqi = null, usingStaffPasscode = false } = {}) {
  const out = [];
  summary.events.forEach((f) => {
    if (f.kind === 'budget' && f.daysTo < 0) out.push({ level: 'high', title: 'Fecha pasada sin liquidar', text: `${f.name} fue hace ${-f.daysTo} días y sigue en ${stageLabel(f.stage)}. Pásala a Liquidación y carga los números reales.`, event: f.id });
    if (f.kind === 'budget' && f.daysTo >= 0 && f.daysTo <= 21 && !f.hasCosts) out.push({ level: 'high', title: 'Presupuesto sin costos', text: `${f.name} es en ${f.daysTo} días y no tiene costos cargados.`, event: f.id });
    if (f.kind === 'budget' && f.daysTo >= 0 && f.daysTo <= 21 && (!f.venue || /confirmar/i.test(f.venue))) out.push({ level: 'med', title: 'Local por confirmar', text: `${f.name} es en ${f.daysTo} días y no tiene local confirmado.`, event: f.id });
    f.warnings.filter((w) => w.code === 'opening_stock' || w.code === 'culqi_diff').forEach((w) => out.push({ level: 'med', title: w.code === 'opening_stock' ? 'Inventario inicial sin registrar' : 'Culqi no cuadra con lo cargado', text: w.text, event: f.id }));
    if (f.kind === 'actual' && f.result != null && f.result < 0) out.push({ level: 'med', title: 'Cierre con pérdida', text: `${f.name}: resultado de ${fmtPEN(f.result)}.`, event: f.id });
  });
  if (culqi && !culqi.connected) out.push({ level: 'low', title: 'Culqi no conectado', text: `No se pudieron leer los cobros (${culqi.reason || 'sin conexión'}).`, route: '/' });
  if (usingStaffPasscode) out.push({ level: 'low', title: 'Clave compartida con el staff', text: 'El OS acepta la clave del staff porque no existe CEO_PASSCODE en Vercel. Créala para que solo tú puedas entrar.', route: '/' });
  const rank = { high: 0, med: 1, low: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

const stageLabel = (id) => (STAGES.find((s) => s.id === id) || {}).label || id;

module.exports = { METRICS, eventFinancials, summarize, attention };
