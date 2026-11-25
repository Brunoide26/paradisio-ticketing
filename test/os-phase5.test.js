const test = require('node:test');
const assert = require('node:assert/strict');
const { SEED } = require('../lib/ceo-seed');
const INT = require('../lib/os/intel');
const L = require('../lib/os/ledger');

const fin = () => JSON.parse(JSON.stringify(SEED));

test('analítica: indicadores por asistente sólo con asistencia verificada', () => {
  const live = { '2026-11-14': { ingresaron: 181 } };
  const a = INT.eventAnalytics(fin(), { live });
  const r = a.rows.find((x) => x.id === 'club-2026-11-14');
  assert.equal(r.attendees, 181);
  assert.equal(r.revenuePerAttendee, Math.round((12038 / 181) * 100) / 100);
  assert.equal(r.barPerAttendee, Math.round((8638 / 181) * 100) / 100);
  assert.equal(r.cac, null); // sin gasto de marketing ni clientes nuevos
  assert.equal(a.enough, false); // una sola fecha real: sin comparativos
  const sin = INT.eventAnalytics(fin(), { live: {} }).rows[0];
  assert.equal(sin.revenuePerAttendee, null);
});

test('analítica: costo de adquisición y crecimiento con dos fechas', () => {
  const f = fin();
  const e2 = f.events.find((x) => x.id === 'club-2026-12-05');
  e2.stage = 'closed';
  e2.costs.push({ label: 'Ads', category: 'Marketing', amount: 600 });
  const audience = { byEvent: [{ osId: 'club-2026-12-05', new: 120, returning: 60, attended: 180 }] };
  const a = INT.eventAnalytics(f, { live: { '2026-11-14': { ingresaron: 181 }, '2026-12-05': { ingresaron: 200 } }, audience });
  const r = a.rows.find((x) => x.id === 'club-2026-12-05');
  assert.equal(r.cac, 5);
  assert.equal(r.repeatShare, 33.33);
  assert.equal(r.growth.attendees, Math.round(((200 - 181) / 181) * 10000) / 100);
  assert.equal(a.enough, true);
  assert.equal(a.byBrand.find((b) => b.key === 'club').events, 2);
});

test('Culqi → libro: cobro + comisión, y no se importa dos veces', () => {
  const f = fin();
  const acc = L.cleanAccount({ name: 'Culqi', type: 'processor' });
  const charges = [{ id: 'chr_1', eventId: 'club-2026-11-14', date: '2026-11-10', amount: 1500, fee: 63.6, method: 'Visa' }, { id: 'chr_2', eventId: 'club-2026-11-14', date: '2026-11-12', amount: 55, fee: 0, method: 'Yape' }];
  const plan = INT.culqiImportPlan(charges, { accountId: acc.id, existing: [], events: f.events });
  assert.equal(plan.length, 3);
  const txs = plan.map((t) => L.cleanTx(t, { accounts: [acc], events: f.events, brands: f.brands }));
  assert.equal(txs[0].kind, 'sale');
  assert.equal(txs[1].kind, 'cost');
  const again = INT.culqiImportPlan(charges, { accountId: acc.id, existing: txs, events: f.events });
  assert.equal(again.length, 0);
});

test('integraciones: nunca exponen el valor de las llaves', () => {
  const env = { CULQI_SECRET_KEY: 'sk_live_secreto', OS_API_TOKEN: 'x'.repeat(40), RESEND_API_KEY: 're_secreto' };
  const s = INT.integrationsStatus({ culqi: { connected: true, mode: 'live', at: Date.now() }, ticketsByEvent: new Map(), audit: [], env });
  assert.ok(!/sk_live_secreto|re_secreto|xxxxxxxx/.test(JSON.stringify(s)));
  assert.equal(s.find((x) => x.id === 'access').status, 'warn');
});

test('incidentes: validación', () => {
  const events = fin().events;
  assert.throws(() => INT.cleanIncident({ eventId: 'club-2026-11-14', text: '  ' }, { events }), /bad_incident/);
  const i = INT.cleanIncident({ eventId: 'club-2026-11-14', text: 'Pelea en la puerta', severity: 'high', area: 'Puerta' }, { events });
  assert.equal(i.resolved, false);
  assert.equal(i.severity, 'high');
});
