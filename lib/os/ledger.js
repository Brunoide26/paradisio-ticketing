// Libro de transacciones de Paradisio OS: cuentas (BCP, caja, Culqi, Yape…)
// y movimientos de dinero. Ver docs/paradisio-os/04-fase-2.md.
//
// Regla contra el doble conteo:
// - El resultado de un EVENTO sale de su liquidación (ingresos y costos del
//   evento en ceo:finance). Una transacción ligada a un evento (cobro de una
//   venta, pago de un costo) es sólo el movimiento de dinero: nunca se vuelve
//   a sumar al resultado.
// - Al estado de resultados del grupo entran desde aquí sólo los gastos e
//   ingresos CORPORATIVOS (sin evento).
// - Aportes de capital, préstamos, anticipos de clientes, transferencias y
//   compras de inventario nunca son ingreso ni gasto.

const { stageOf, isActualStage } = require('./stages');

const KINDS = {
  sale: { label: 'Venta / cobro', dir: 1 },
  other_income: { label: 'Otro ingreso', dir: 1 },
  deposit: { label: 'Anticipo de cliente', dir: 1 },
  capital: { label: 'Aporte de capital', dir: 1 },
  loan_in: { label: 'Préstamo recibido', dir: 1 },
  cost: { label: 'Costo de evento', dir: -1 },
  expense: { label: 'Gasto corporativo', dir: -1 },
  inventory: { label: 'Compra de inventario', dir: -1 },
  loan_out: { label: 'Pago de préstamo', dir: -1 },
  refund: { label: 'Devolución a cliente', dir: -1 },
  transfer: { label: 'Transferencia entre cuentas', dir: 0 },
};
const ACCOUNT_TYPES = { bank: 'Banco', cash: 'Caja', processor: 'Procesador de pagos', wallet: 'Billetera digital' };
const CURRENCIES = ['PEN', 'USD'];
const DOC_TYPES = ['factura', 'boleta', 'recibo_honorarios', 'ticket', 'ninguno'];

const cents = (n) => Math.round((Number(n) || 0) * 100);
const soles = (c) => c / 100;
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const str = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function cleanAccount(a, existing) {
  if (!a || !str(a.name)) throw new Error('bad_account_name');
  if (!ACCOUNT_TYPES[a.type]) throw new Error('bad_account_type');
  if (!CURRENCIES.includes(a.currency || 'PEN')) throw new Error('bad_currency');
  const opening = a.openingBalance === '' || a.openingBalance == null ? null : Number(a.openingBalance);
  if (opening !== null && !Number.isFinite(opening)) throw new Error('bad_amount');
  if (opening !== null && !isDate(a.openingDate)) throw new Error('bad_opening_date');
  const fx = a.fxRate === '' || a.fxRate == null ? null : Number(a.fxRate);
  if (fx !== null && !(fx > 0)) throw new Error('bad_fx');
  return {
    id: (existing && existing.id) || genId('acc'),
    name: str(a.name, 80), type: a.type, currency: a.currency || 'PEN',
    institution: str(a.institution, 80), number: str(a.number, 40),
    openingBalance: opening, openingDate: opening === null ? null : a.openingDate,
    fxRate: a.currency === 'USD' ? fx : null,
    archived: !!a.archived,
  };
}

function cleanTx(t, { accounts, events, brands }, existing) {
  if (!t || !KINDS[t.kind]) throw new Error('bad_kind');
  if (!isDate(t.date)) throw new Error('bad_date');
  const amount = Number(t.amount);
  if (!(amount > 0)) throw new Error('bad_amount');
  const currency = t.currency || 'PEN';
  if (!CURRENCIES.includes(currency)) throw new Error('bad_currency');
  const fxRate = currency === 'USD' ? Number(t.fxRate) : 1;
  if (!(fxRate > 0)) throw new Error('bad_fx');
  const accIds = new Set(accounts.map((a) => a.id));
  const paidOn = t.paidOn ? t.paidOn : null;
  if (paidOn && !isDate(paidOn)) throw new Error('bad_paid_on');
  if (paidOn && !accIds.has(t.accountId)) throw new Error('bad_account');
  if (t.kind === 'transfer') {
    if (!paidOn) throw new Error('transfer_needs_date');
    if (!accIds.has(t.toAccountId) || t.toAccountId === t.accountId) throw new Error('bad_to_account');
  }
  const eventId = t.eventId || null;
  if (eventId && !events.some((e) => e.id === eventId)) throw new Error('bad_event');
  if (t.kind === 'cost' && !eventId) throw new Error('cost_needs_event');
  if (t.kind === 'expense' && eventId) throw new Error('expense_has_event');
  const brand = t.brand || (eventId ? (events.find((e) => e.id === eventId) || {}).brand : null) || null;
  if (brand && !brands.some((b) => b.id === brand)) throw new Error('bad_brand');
  if (t.dueDate && !isDate(t.dueDate)) throw new Error('bad_due_date');
  const ruc = str(t.ruc, 11);
  if (ruc && !/^\d{8}(\d{3})?$/.test(ruc)) throw new Error('bad_ruc'); // DNI (8) o RUC (11)
  if (t.docType && !DOC_TYPES.includes(t.docType)) throw new Error('bad_doc_type');
  const igv = t.igv === '' || t.igv == null ? null : Number(t.igv);
  if (igv !== null && !(igv >= 0 && igv <= amount)) throw new Error('bad_igv');
  return {
    id: (existing && existing.id) || genId('tx'),
    kind: t.kind, description: str(t.description) || KINDS[t.kind].label,
    date: t.date, dueDate: t.dueDate || null, paidOn,
    committed: (t.kind === 'cost' || t.kind === 'expense') && !paidOn ? !!t.committed : false,
    amount: Math.round(amount * 100) / 100, currency, fxRate,
    accountId: paidOn ? t.accountId : null, toAccountId: t.kind === 'transfer' ? t.toAccountId : null,
    brand, eventId, category: str(t.category, 60),
    counterparty: str(t.counterparty, 120), ruc, docType: t.docType || null, docNumber: str(t.docNumber, 40),
    igv, method: str(t.method, 40), notes: str(t.notes, 500),
    promoterCode: str(t.promoterCode, 40).toUpperCase() || null,
    source: str(t.source, 80) || 'manual', externalRef: str(t.externalRef, 80) || null,
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
  };
}

// Evita registrar dos veces el mismo cobro/pago importado (Culqi, POS, banco).
function assertUniqueRef(transactions, tx) {
  if (!tx.externalRef) return;
  if (transactions.some((x) => x.id !== tx.id && x.source === tx.source && x.externalRef === tx.externalRef)) throw new Error('duplicate_external_ref');
}

const pen = (t) => cents(t.amount) * (t.currency === 'USD' ? t.fxRate : 1);

// Saldos, por pagar/cobrar, anticipos, flujo de caja y P&L corporativo.
function ledgerSummary(ledger, { finance, brand = null, today, horizonDays = 56 } = {}) {
  const T = (ledger.transactions || []).filter((t) => !brand || t.brand === brand);
  const accounts = (ledger.accounts || []);
  const todayIso = today || new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

  // Saldos por cuenta (moneda de la cuenta). Sólo si la cuenta tiene saldo inicial.
  const all = ledger.transactions || [];
  const bal = accounts.map((a) => {
    if (a.openingBalance == null) return { ...a, balance: null, pen: null };
    let c = cents(a.openingBalance);
    all.forEach((t) => {
      if (!t.paidOn || t.paidOn < a.openingDate || t.paidOn > todayIso) return;
      const amt = cents(t.amount) * (t.currency === a.currency ? 1 : (t.currency === 'USD' ? t.fxRate : 1 / (a.fxRate || 1)));
      if (t.kind === 'transfer') { if (t.accountId === a.id) c -= amt; if (t.toAccountId === a.id) c += amt; return; }
      if (t.accountId === a.id) c += KINDS[t.kind].dir * amt;
    });
    const penC = a.currency === 'USD' ? (a.fxRate ? Math.round(c * a.fxRate) : null) : c;
    return { ...a, balance: soles(Math.round(c)), pen: penC == null ? null : soles(penC) };
  });
  const active = bal.filter((a) => !a.archived);
  const cashKnown = active.length > 0 && active.every((a) => a.pen != null);
  const cash = cashKnown ? soles(active.reduce((s, a) => s + cents(a.pen), 0)) : null;

  const pendingOut = T.filter((t) => KINDS[t.kind].dir < 0 && !t.paidOn);
  const pendingIn = T.filter((t) => (t.kind === 'sale' || t.kind === 'other_income') && !t.paidOn);
  const payables = pendingOut.filter((t) => !t.committed);
  const committed = pendingOut.filter((t) => t.committed);
  const evDate = new Map(((finance && finance.events) || []).map((e) => [e.id, e.date]));
  // Anticipos de clientes cobrados para eventos que todavía no ocurren: es un pasivo, no ingreso.
  const deposits = T.filter((t) => t.kind === 'deposit' && t.paidOn && (!t.eventId || (evDate.get(t.eventId) || '') >= todayIso));
  const overdue = payables.filter((t) => (t.dueDate || t.date) < todayIso);

  // P&L corporativo: sólo lo que no pertenece a un evento.
  const corp = T.filter((t) => !t.eventId && (t.kind === 'expense' || t.kind === 'other_income'));

  // Flujo de caja mensual (base caja) y proyección por semanas.
  const months = new Map();
  T.forEach((t) => {
    if (!t.paidOn || t.kind === 'transfer') return;
    const m = t.paidOn.slice(0, 7);
    const o = months.get(m) || { month: m, inflow: 0, outflow: 0 };
    if (KINDS[t.kind].dir > 0) o.inflow += pen(t); else o.outflow += pen(t);
    months.set(m, o);
  });
  const weekOf = (iso) => { const d = new Date(iso + 'T12:00:00Z'); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); };
  const end = new Date(new Date(todayIso + 'T12:00:00Z').getTime() + horizonDays * 86400000).toISOString().slice(0, 10);
  const weeks = new Map();
  const addW = (iso, field, c) => {
    const k = iso < todayIso ? weekOf(todayIso) : weekOf(iso);
    if (iso > end) return;
    const o = weeks.get(k) || { week: k, inflow: 0, outflow: 0, projInflow: 0, projOutflow: 0 };
    o[field] += c; weeks.set(k, o);
  };
  pendingIn.forEach((t) => addW(t.dueDate || t.date, 'inflow', pen(t)));
  payables.concat(committed).forEach((t) => addW(t.dueDate || t.date, 'outflow', pen(t)));
  // Proyectado aparte: presupuestos completos de eventos por venir, en la fecha del evento.
  ((finance && finance.events) || []).forEach((e) => {
    if ((brand && e.brand !== brand) || isActualStage(stageOf(e)) || stageOf(e) === 'cancelled' || e.date < todayIso) return;
    if (!(e.income || []).length || !(e.costs || []).length) return;
    addW(e.date, 'projInflow', (e.income || []).reduce((s2, l) => s2 + cents(l.amount), 0));
    addW(e.date, 'projOutflow', (e.costs || []).reduce((s2, l) => s2 + cents(l.amount), 0));
  });

  return {
    hasData: accounts.length > 0 || (ledger.transactions || []).length > 0,
    accounts: bal,
    cash, cashKnown,
    payables: { total: soles(payables.reduce((s, t) => s + pen(t), 0)), count: payables.length, overdue: overdue.length, items: payables.map((t) => t.id) },
    committed: { total: soles(committed.reduce((s, t) => s + pen(t), 0)), count: committed.length, items: committed.map((t) => t.id) },
    receivables: { total: soles(pendingIn.reduce((s, t) => s + pen(t), 0)), count: pendingIn.length, items: pendingIn.map((t) => t.id) },
    deposits: { total: soles(deposits.reduce((s, t) => s + pen(t), 0)), count: deposits.length, items: deposits.map((t) => t.id) },
    corporate: {
      income: soles(corp.filter((t) => t.kind === 'other_income').reduce((s, t) => s + pen(t), 0)),
      expenses: soles(corp.filter((t) => t.kind === 'expense').reduce((s, t) => s + pen(t), 0)),
      byCategory: [...corp.filter((t) => t.kind === 'expense').reduce((m, t) => m.set(t.category || 'Otros', (m.get(t.category || 'Otros') || 0) + pen(t)), new Map())]
        .map(([key, c]) => ({ key, value: soles(c) })).sort((a, b) => b.value - a.value),
      items: corp.map((t) => t.id),
    },
    capital: soles(T.filter((t) => t.kind === 'capital' && t.paidOn).reduce((s, t) => s + pen(t), 0)),
    cashflow: {
      months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ month: m.month, inflow: soles(m.inflow), outflow: soles(m.outflow), net: soles(m.inflow - m.outflow) })),
      weeks: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).map((w) => ({ week: w.week, inflow: soles(w.inflow), outflow: soles(w.outflow), projInflow: soles(w.projInflow), projOutflow: soles(w.projOutflow) })),
    },
  };
}

// Pagado / cobrado de un evento según las transacciones ligadas a él.
function eventPayments(ledger, eventId) {
  const T = (ledger.transactions || []).filter((t) => t.eventId === eventId);
  if (!T.length) return null;
  const sum = (f) => soles(T.filter(f).reduce((s, t) => s + pen(t), 0));
  return {
    count: T.length,
    paid: sum((t) => t.kind === 'cost' && t.paidOn),
    pendingCost: sum((t) => t.kind === 'cost' && !t.paidOn && !t.committed),
    committed: sum((t) => t.kind === 'cost' && !t.paidOn && t.committed),
    collected: sum((t) => (t.kind === 'sale' || t.kind === 'deposit') && t.paidOn),
    toCollect: sum((t) => t.kind === 'sale' && !t.paidOn),
    inventory: sum((t) => t.kind === 'inventory'),
  };
}

module.exports = { KINDS, ACCOUNT_TYPES, CURRENCIES, DOC_TYPES, cleanAccount, cleanTx, assertUniqueRef, ledgerSummary, eventPayments, genId };
