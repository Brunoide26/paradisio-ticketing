const test = require('node:test');
const assert = require('node:assert/strict');
const { SEED } = require('../lib/ceo-seed');
const L = require('../lib/os/ledger');
const I = require('../lib/os/inventory');

const fin = () => JSON.parse(JSON.stringify(SEED));
const ctx = (f, accounts) => ({ accounts, events: f.events, brands: f.brands });
const TODAY = '2026-11-25';

function setup() {
  const f = fin();
  const bcp = L.cleanAccount({ name: 'BCP Soles', type: 'bank', currency: 'PEN', openingBalance: 10000, openingDate: '2026-11-01' });
  const caja = L.cleanAccount({ name: 'Caja', type: 'cash', currency: 'PEN', openingBalance: 500, openingDate: '2026-11-01' });
  return { f, ledger: { accounts: [bcp, caja], transactions: [] }, bcp, caja };
}
const add = (s, t) => s.ledger.transactions.push(L.cleanTx(t, ctx(s.f, s.ledger.accounts)));

test('saldos: inicial + entradas − salidas, transferencias entre cuentas', () => {
  const s = setup();
  add(s, { kind: 'cost', amount: 6000, date: '2026-11-14', paidOn: '2026-11-15', accountId: s.bcp.id, eventId: 'club-2026-11-14' });
  add(s, { kind: 'sale', amount: 3400, date: '2026-11-14', paidOn: '2026-11-14', accountId: s.bcp.id, eventId: 'club-2026-11-14' });
  add(s, { kind: 'transfer', amount: 200, date: '2026-11-16', paidOn: '2026-11-16', accountId: s.bcp.id, toAccountId: s.caja.id });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.accounts.find((a) => a.id === s.bcp.id).balance, 7200);
  assert.equal(r.accounts.find((a) => a.id === s.caja.id).balance, 700);
  assert.equal(r.cash, 7900);
});

test('sin saldo inicial la caja es null, no cero', () => {
  const f = fin();
  const a = L.cleanAccount({ name: 'BCP', type: 'bank' });
  const r = L.ledgerSummary({ accounts: [a], transactions: [] }, { finance: f, today: TODAY });
  assert.equal(r.cash, null);
});

test('un costo de evento pagado no entra al P&L corporativo (ya está en la liquidación)', () => {
  const s = setup();
  add(s, { kind: 'cost', amount: 6000, date: '2026-11-14', paidOn: '2026-11-15', accountId: s.bcp.id, eventId: 'club-2026-11-14' });
  add(s, { kind: 'expense', amount: 300, date: '2026-11-20', paidOn: '2026-11-20', accountId: s.bcp.id, category: 'Contador' });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.corporate.expenses, 300);
});

test('aporte de capital entra a caja pero nunca es ingreso', () => {
  const s = setup();
  add(s, { kind: 'capital', amount: 5000, date: '2026-11-20', paidOn: '2026-11-20', accountId: s.bcp.id });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.capital, 5000);
  assert.equal(r.corporate.income, 0);
  assert.equal(r.cash, 15500);
});

test('anticipo de cliente de un evento futuro es pasivo, no ingreso', () => {
  const s = setup();
  add(s, { kind: 'deposit', amount: 1500, date: '2026-11-22', paidOn: '2026-11-22', accountId: s.bcp.id, eventId: 'club-2026-12-05' });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.deposits.total, 1500);
  assert.equal(r.corporate.income, 0);
});

test('por pagar, comprometido y vencido', () => {
  const s = setup();
  add(s, { kind: 'cost', amount: 5000, date: '2026-12-05', dueDate: '2026-11-20', eventId: 'club-2026-12-05' });
  add(s, { kind: 'cost', amount: 800, date: '2026-12-05', dueDate: '2026-12-06', eventId: 'club-2026-12-05', committed: true });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.payables.total, 5000);
  assert.equal(r.payables.overdue, 1);
  assert.equal(r.committed.total, 800);
  const p = L.eventPayments(s.ledger, 'club-2026-12-05');
  assert.equal(p.pendingCost, 5000);
  assert.equal(p.committed, 800);
});

test('USD se convierte con el tipo de cambio de la transacción', () => {
  const s = setup();
  add(s, { kind: 'expense', amount: 100, currency: 'USD', fxRate: 3.75, date: '2026-11-20', paidOn: '2026-11-20', accountId: s.bcp.id, category: 'Software' });
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  assert.equal(r.corporate.expenses, 375);
});

test('validaciones: costo sin evento, gasto con evento, RUC inválido, referencia duplicada', () => {
  const s = setup();
  const c = ctx(s.f, s.ledger.accounts);
  assert.throws(() => L.cleanTx({ kind: 'cost', amount: 1, date: '2026-11-01' }, c), /cost_needs_event/);
  assert.throws(() => L.cleanTx({ kind: 'expense', amount: 1, date: '2026-11-01', eventId: 'club-2026-11-14' }, c), /expense_has_event/);
  assert.throws(() => L.cleanTx({ kind: 'expense', amount: 1, date: '2026-11-01', ruc: '123' }, c), /bad_ruc/);
  add(s, { kind: 'sale', amount: 50, date: '2026-11-14', eventId: 'club-2026-11-14', source: 'culqi', externalRef: 'chr_1' });
  const dup = L.cleanTx({ kind: 'sale', amount: 50, date: '2026-11-14', eventId: 'club-2026-11-14', source: 'culqi', externalRef: 'chr_1' }, c);
  assert.throws(() => L.assertUniqueRef(s.ledger.transactions, dup), /duplicate_external_ref/);
});

test('flujo proyectado sale de presupuestos completos, aparte de lo real', () => {
  const s = setup();
  const r = L.ledgerSummary(s.ledger, { finance: s.f, today: TODAY });
  const w = r.cashflow.weeks.find((x) => x.projInflow > 0);
  assert.equal(w.projInflow, 16038); // 05/12, único presupuesto completo
  assert.equal(w.inflow, 0);
});

test('inventario: comprar no es consumir; consumo = apertura + compras − cierre', () => {
  const f = fin();
  const gin = I.cleanProduct({ name: 'Gin', unit: 'botella', unitCost: 60, minStock: 4 });
  const inv = { products: [gin], movements: [] };
  const mv = (m) => inv.movements.push(I.cleanMove({ productId: gin.id, ...m }, { products: inv.products, events: f.events }));
  mv({ type: 'purchase', qty: 10, date: '2026-11-10' });
  assert.equal(I.onHand(gin, inv.movements), 10);
  mv({ type: 'count', qty: 10, date: '2026-11-14', eventId: 'club-2026-11-14', phase: 'open' });
  mv({ type: 'count', qty: 3.75, date: '2026-11-15', eventId: 'club-2026-11-14', phase: 'close' });
  const c = I.eventConsumption(inv, 'club-2026-11-14');
  assert.equal(c.rows[0].consumed, 6.25);
  assert.equal(c.consumedCost, 375);
  assert.equal(c.closeValue, 225);
  const sum = I.inventorySummary(inv);
  assert.equal(sum.products[0].onHand, 3.75);
  assert.deepEqual(sum.low, [gin.id]);
});

test('inventario sin conteo de cierre: consumo no disponible', () => {
  const f = fin();
  const p = I.cleanProduct({ name: 'Ron', unitCost: 40 });
  const inv = { products: [p], movements: [I.cleanMove({ productId: p.id, type: 'count', qty: 5, date: '2026-11-14', eventId: 'club-2026-11-14', phase: 'open' }, { products: [p], events: f.events })] };
  const c = I.eventConsumption(inv, 'club-2026-11-14');
  assert.equal(c.rows[0].consumed, null);
  assert.equal(c.consumedCost, null);
});
