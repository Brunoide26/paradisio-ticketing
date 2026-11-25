const test = require('node:test');
const assert = require('node:assert/strict');
const { SEED } = require('../lib/ceo-seed');
const { salesForEvent } = require('../lib/os/sales');
const PR = require('../lib/os/promoters');
const OPS = require('../lib/os/ops');

const t = (o) => ({ id: Math.random().toString(36).slice(2), createdAt: '2026-11-10T20:00:00Z', voided: false, pending: false, checkedIn: false, amount: 0, ...o });
const TICKETS = [
  t({ type: 'promo', promoterCode: 'ANTONIA', checkedIn: true }),
  t({ type: 'promo', promoterCode: 'ANTONIA', checkedIn: true }),
  t({ type: 'promo', promoterCode: 'ANTONIA' }),
  t({ type: 'promo', promoterCode: 'MARLO', pending: true }),
  t({ type: 'paid', sku: 'early', amount: 40, promoterCode: 'MARLO', checkedIn: true }),
  t({ type: 'paid', sku: 'allnight', amount: 55, createdAt: '2026-11-12T20:00:00Z' }),
  t({ type: 'table', unitId: 'BOX5', amount: 1500, partySize: 10, promoterCode: 'ANTONIA', checkedIn: true }),
  t({ type: 'free', voided: true }),
  t({ type: 'free', checkedIn: true, lateEntry: true, lateCharged: true }),
];

test('ventas: registrados, emitidos, asistentes, no-show, web', () => {
  const s = salesForEvent(TICKETS, '2026-11-14');
  assert.equal(s.registrations, 9);
  assert.equal(s.voided, 1);
  assert.equal(s.pending, 1);
  assert.equal(s.issued, 7);
  assert.equal(s.attended, 5);
  assert.equal(s.attendedPersons, 14); // la mesa cuenta 10 personas
  assert.equal(s.noShow, 2);
  assert.equal(s.webRevenue, 1595);
  assert.equal(s.lateCharged, 1);
});

test('ventas: fases por SKU y mesas en el plano', () => {
  const s = salesForEvent(TICKETS, '2026-11-14');
  assert.deepEqual(s.bySku.map((x) => [x.sku, x.tickets, x.revenue]).sort(), [['allnight', 1, 55], ['early', 1, 40]]);
  const box5 = s.tables.find((u) => u.id === 'BOX5');
  assert.equal(box5.status, 'sold');
  assert.equal(box5.amount, 1500);
  assert.equal(s.tablesSold, 1);
  assert.equal(s.tables.find((u) => u.id === 'M1').status, 'free');
  assert.equal(s.velocity[s.velocity.length - 1].accRevenue, 1595);
});

test('ventas: nunca expone datos personales', () => {
  const s = salesForEvent(TICKETS.map((x) => ({ ...x, name: 'Ana Pérez', dni: '12345678', email: 'a@b.pe', phone: '999' })), '2026-11-14');
  const txt = JSON.stringify(s);
  assert.ok(!/Ana Pérez|12345678|a@b\.pe/.test(txt));
});

test('promotores: comisión sólo con asistencia verificada y regla del evento', () => {
  const promo = { teams: [{ id: 'team_a', name: 'Equipo A', leader: 'ANTONIA' }], members: { ANTONIA: 'team_a' }, rules: { ev1: PR.cleanRule({ perAttendee: 10, pctTables: 10, pctPaid: 0, fixed: 50 }) }, targets: { ev1: { ANTONIA: 4 } } };
  const ledger = { transactions: [{ eventId: 'ev1', promoterCode: 'ANTONIA', paidOn: '2026-11-16', amount: 100, currency: 'PEN', fxRate: 1 }] };
  const roster = new Map([['ANTONIA', { name: 'Antonia' }], ['MARLO', { name: 'Marlo' }]]);
  const p = PR.performance(TICKETS, { promoters: roster, promo, finEventId: 'ev1', ledger });
  const a = p.rows.find((r) => r.code === 'ANTONIA');
  assert.equal(a.attended, 3); // 2 promo + 1 mesa, no cuenta el que no entró
  assert.equal(a.commission, 50 + 30 + 150);
  assert.equal(a.paid, 100);
  assert.equal(a.pending, 130);
  assert.equal(a.attainment, 75);
  assert.equal(a.team, 'Equipo A');
  assert.ok(a.leader);
  const m = p.rows.find((r) => r.code === 'MARLO');
  assert.equal(m.qrs, 1); // el pendiente no tiene QR
  assert.equal(m.commission, 50 + 10);
});

test('promotores: sin regla, la comisión no se inventa', () => {
  const p = PR.performance(TICKETS, { promoters: new Map(), promo: { teams: [], members: {}, rules: {}, targets: {} }, finEventId: 'ev1', ledger: { transactions: [] } });
  assert.ok(p.rows.every((r) => r.commission === null && r.pending === null));
  assert.equal(p.totals.commission, null);
});

test('operaciones: checklist estándar con fechas relativas y sin duplicar', () => {
  const ev = SEED.events.find((e) => e.id === 'club-2026-12-05');
  const first = OPS.templateTasks(ev, []);
  assert.equal(first.length, OPS.TEMPLATE.length);
  assert.equal(first.find((x) => x.title.startsWith('Conteo de apertura')).due, '2026-12-05');
  assert.equal(first.find((x) => x.title.startsWith('Confirmar local')).due, '2026-11-07');
  assert.equal(OPS.templateTasks(ev, first).length, 0);
});

test('operaciones: dependencias bloquean y se detectan vencidas', () => {
  const ops = { tasks: [
    { id: 'a', title: 'Presupuesto', status: 'todo', due: '2026-11-20', dependsOn: [] },
    { id: 'b', title: 'Abrir venta', status: 'todo', due: '2026-11-30', dependsOn: ['a'] },
    { id: 'c', title: 'Hecha', status: 'done', due: '2026-11-01', dependsOn: [] },
  ] };
  const v = OPS.tasksView(ops, '2026-11-25');
  assert.equal(v.find((x) => x.id === 'a').overdue, true);
  assert.equal(v.find((x) => x.id === 'b').effective, 'blocked');
  assert.equal(v.find((x) => x.id === 'c').overdue, false);
  assert.throws(() => OPS.cleanTask({ title: 'A', dependsOn: ['b'] }, { events: [], tasks: [{ id: 'b', dependsOn: ['x'] }, { id: 'x', dependsOn: [] }] }, { id: 'x' }), /dependency_cycle/);
});

test('operaciones: run of show ordena pasada la medianoche', () => {
  const r = OPS.cleanRunOfShow([{ time: '01:30', title: 'Headliner' }, { time: '23:00', title: 'Puertas' }, { time: '00:15', title: 'Warm up' }]);
  assert.deepEqual(r.map((x) => x.time), ['23:00', '00:15', '01:30']);
});
