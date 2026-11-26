// Reglas de verdad del gráfico principal del resumen (dashboard/src/pages/overview/metrics.js).
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const load = () => import(pathToFileURL(path.join(__dirname, '../dashboard/src/pages/overview/metrics.js')).href);
const today = '2026-11-26';
const ev = (o) => ({ brand: 'club', name: o.id, hasIncome: true, hasCosts: true, complete: true, ...o });

test('real y proyectado nunca se suman en el mismo período', async () => {
  const M = await load();
  const pts = [
    { date: '2026-11-30', value: 100, state: 'real', id: 'a', name: 'A' },
    { date: '2026-12-01', value: 500, state: 'proj', id: 'b', name: 'B' },
  ];
  const b = M.buildBuckets(pts, { group: 'week', from: '2026-11-30', to: '2026-12-06', today: '2026-12-02' });
  assert.equal(b.length, 1);
  assert.equal(b[0].real, 100);
  assert.equal(b[0].proj, 500);
  const r = M.readout(b);
  assert.equal(r.total, 100);
  assert.equal(r.projTotal, 500);
});

test('una fecha pasada sin liquidar es un faltante, nunca cero', async () => {
  const M = await load();
  const events = [ev({ id: 'x', date: '2026-11-20', kind: 'budget', revenue: 900 })];
  const pts = M.pointsFor('revenue', { events, today });
  assert.deepEqual(pts.map((p) => [p.state, p.value]), [['missing', null]]);
  const b = M.buildBuckets(pts, { group: 'week', from: '2026-11-16', to: '2026-11-22', today });
  assert.equal(b[0].real, null);
  assert.equal(M.readout(b).hasReal, false);
});

test('presupuesto sin costos: sin utilidad proyectada (faltante), no cero', async () => {
  const M = await load();
  const events = [ev({ id: 'y', date: '2026-12-10', kind: 'budget', revenue: 600, hasCosts: false, complete: false, result: null })];
  assert.deepEqual(M.pointsFor('projProfit', { events, today }).map((p) => p.state), ['missing']);
  assert.deepEqual(M.pointsFor('projRevenue', { events, today }).map((p) => [p.state, p.value]), [['proj', 600]]);
});

test('el futuro sin datos reales no es cero', async () => {
  const M = await load();
  const b = M.buildBuckets([{ date: '2026-12-20', value: 10, state: 'proj', id: 'p' }], { group: 'week', from: '2026-11-23', to: '2026-12-27', today });
  assert.equal(b.find((x) => x.key === '2026-12-07').real, null);
  assert.equal(b.find((x) => x.key === '2026-11-23').real, 0);
});

test('mejor, peor y promedio sólo con 3 o más períodos con valor', async () => {
  const M = await load();
  const one = M.readout(M.buildBuckets([{ date: '2026-11-10', value: 5, state: 'real' }], { group: 'week', from: '2026-11-01', to: '2026-11-25', today }));
  assert.equal(one.best, null); assert.equal(one.avg, null);
  const three = M.readout(M.buildBuckets(['2026-11-03', '2026-11-10', '2026-11-17'].map((d, i) => ({ date: d, value: i + 1, state: 'real' })), { group: 'week', from: '2026-11-01', to: '2026-11-25', today }));
  assert.equal(three.best.real, 3); assert.equal(three.low.real, 1); assert.equal(three.avg, 2);
});

test('venta web: fuera de la cobertura de la ticketera no hay dato', async () => {
  const M = await load();
  const b = M.buildBuckets([{ date: '2026-11-06', value: 55, state: 'real' }, { date: '2026-11-10', value: 0, state: 'real' }], { group: 'day', from: null, to: null, today, continuous: true });
  assert.equal(b.find((x) => x.key === '2026-11-08').real, 0);
  assert.equal(b.find((x) => x.key === '2026-11-20').real, null);
});

test('las dos fuentes de ingreso son métricas distintas', async () => {
  const M = await load();
  const events = [ev({ id: 'c', date: '2026-11-14', kind: 'actual', revenue: 12038 })];
  const sales = { c: { velocity: [{ d: '2026-11-06', revenue: 55 }] } };
  const financeEvents = [{ id: 'c', brand: 'club', name: 'c' }];
  const rev = M.pointsFor('revenue', { events, sales, financeEvents, today });
  const web = M.pointsFor('web', { events, sales, financeEvents, today });
  assert.equal(rev.reduce((s, p) => s + p.value, 0), 12038);
  assert.equal(web.reduce((s, p) => s + p.value, 0), 55);
});

test('caja: no disponible sin cuentas, con el motivo', async () => {
  const M = await load();
  const a = M.availability('cash', { ledger: { accounts: [], cash: null }, today });
  assert.equal(a.ok, false);
  assert.match(a.reason, /cuentas/);
});
