// Pruebas de la capa de cálculo de Paradisio OS. Correr con: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { SEED } = require('../lib/ceo-seed');
const { summarize, eventFinancials, attention } = require('../lib/os/finance');
const { stageOf, statusForStage } = require('../lib/os/stages');

const seed = () => JSON.parse(JSON.stringify(SEED));
const TODAY = new Date('2026-11-25T12:00:00-05:00');

test('etapas: el estado viejo se traduce y se mantiene sincronizado', () => {
  assert.equal(stageOf({ status: 'realizado' }), 'closed');
  assert.equal(stageOf({ status: 'presupuesto' }), 'evaluation');
  assert.equal(stageOf({ status: 'realizado', stage: 'live' }), 'live');
  assert.equal(statusForStage('settlement'), 'realizado');
  assert.equal(statusForStage('on_sale'), 'confirmado');
});

test('real: 14/11 = ingresos − costos + stock final', () => {
  const s = summarize(seed(), { today: TODAY });
  assert.equal(s.actual.count, 1);
  assert.equal(s.actual.revenue, 12038);
  assert.equal(s.actual.costs, 15278.69);
  assert.equal(s.actual.result, -1682.11); // 12038 − 15278.69 + 1558.58
});

test('proyectado: nunca toma el ingreso de un presupuesto sin costos como utilidad', () => {
  const s = summarize(seed(), { today: TODAY });
  assert.equal(s.projected.revenue, 16638); // 600 + 16038 + 0
  assert.equal(s.projected.profit, 4207.06); // sólo el 05/12, el único completo
  assert.deepEqual(s.projected.incomplete.sort(), ['beats-2026-12-03', 'icon-2026-12-19']);
  const beats = s.events.find((e) => e.id === 'beats-2026-12-03');
  assert.equal(beats.result, null);
});

test('real y proyectado no se mezclan', () => {
  const s = summarize(seed(), { today: TODAY });
  assert.ok(!s.actual.events.some((id) => s.projected.events.includes(id)));
});

test('inventario: el stock heredado se avisa una sola vez y descuenta si se registra', () => {
  const d = seed();
  d.events.push({ id: 'club-later', brand: 'club', date: '2026-12-12', name: 'x', status: 'planificación', income: [], costs: [] });
  const s = summarize(d, { today: TODAY });
  const warned = s.events.filter((e) => e.warnings.some((w) => w.code === 'opening_stock')).map((e) => e.id);
  assert.deepEqual(warned, ['club-2026-12-05']);
  d.events.find((e) => e.id === 'club-2026-12-05').openingStock = 1558.58;
  const f = eventFinancials(d.events.find((e) => e.id === 'club-2026-12-05'), { events: d.events, today: TODAY });
  assert.equal(f.result, 2648.48);
  assert.ok(!f.warnings.some((w) => w.code === 'opening_stock'));
});

test('impuestos: sin IGV/renta el 05/12 sube exactamente lo que suman esas líneas', () => {
  const con = summarize(seed(), { today: TODAY, withTaxes: true });
  const sin = summarize(seed(), { today: TODAY, withTaxes: false });
  assert.equal(Math.round((sin.projected.profit - con.projected.profit) * 100) / 100, 2650.34); // 2446.47 + 203.87
});

test('lo que no existe es null, no cero', () => {
  const s = summarize(seed(), { today: TODAY });
  assert.ok(s.unavailable.cash && s.unavailable.payables && s.unavailable.receivables);
  const icon = s.events.find((e) => e.id === 'icon-2026-12-19');
  assert.equal(icon.margin, null);
});

test('cancelado no entra en ningún total', () => {
  const d = seed();
  d.events.find((e) => e.id === 'club-2026-12-05').stage = 'cancelled';
  const s = summarize(d, { today: TODAY });
  assert.equal(s.projected.revenue, 600);
  assert.equal(s.projected.profit, null);
});

test('variación: sólo con presupuesto aprobado guardado', () => {
  const d = seed();
  const e = d.events.find((x) => x.id === 'club-2026-12-05');
  e.budget = { approvedAt: '2026-12-06T00:00:00Z', income: e.income, costs: e.costs };
  e.stage = 'closed';
  e.income = e.income.map((l) => ({ ...l, amount: l.amount - 100 }));
  const s = summarize(d, { today: TODAY });
  assert.equal(s.variance.events.length, 1);
  assert.equal(s.variance.events[0].diff, -400);
});

test('atención: fecha pasada sin liquidar es urgente', () => {
  const d = seed();
  d.events.find((e) => e.id === 'beats-2026-12-03').date = '2026-11-20';
  const a = attention(summarize(d, { today: TODAY }));
  assert.equal(a[0].level, 'high');
  assert.ok(a.some((x) => x.title === 'Fecha pasada sin liquidar' && x.event === 'beats-2026-12-03'));
});

test('Culqi se concilia pero nunca se suma a los ingresos', () => {
  const culqi = { connected: true, byEvent: { 'club-2026-11-14': { amount: 4000, net: 3840 } } };
  const s = summarize(seed(), { today: TODAY, culqi });
  assert.equal(s.actual.revenue, 12038);
  const f = s.events.find((e) => e.id === 'club-2026-11-14');
  assert.equal(f.reconciliation.diff, 600); // 4000 − 3400 de boxes y mesas
  assert.ok(f.warnings.some((w) => w.code === 'culqi_diff'));
});
