const test = require('node:test');
const assert = require('node:assert/strict');
const { SEED } = require('../lib/ceo-seed');
const COM = require('../lib/os/commercial');
const { audience } = require('../lib/os/crm');

const ctx = { events: SEED.events, brands: SEED.brands };
const T = '2026-11-25';

test('CRM: agrega por persona sin exponer datos personales', () => {
  const tk = (o) => ({ voided: false, createdAt: '2026-08-20T00:00:00Z', type: 'free', ...o });
  const by = new Map([
    ['2026-08-28', [tk({ email: 'Ana@Mail.com', name: 'Ana Pérez', dni: '11111111', dob: '2003-05-01', checkedIn: true }), tk({ email: 'luis@mail.com', name: 'Luis Soto', checkedIn: true, type: 'paid', amount: 40 })]],
    ['2026-11-14', [tk({ email: 'ana@mail.com', name: 'Ana Pérez', checkedIn: true, type: 'table', amount: 1500, createdAt: '2026-11-10T00:00:00Z' }), tk({ email: 'nuevo@mail.com', name: 'Nuevo', checkedIn: false, type: 'promo', promoterCode: 'ANTONIA' })]],
  ]);
  const meta = (id) => ({ name: id, date: id, brand: 'club' });
  const a = audience(by, meta);
  assert.equal(a.people, 3);
  assert.equal(a.attended, 2);
  assert.equal(a.repeat, 1); // Ana fue a las dos (el correo se normaliza)
  assert.equal(a.repeatRate, 50);
  assert.deepEqual(a.retention.map((r) => [r.base, r.returned, r.rate]), [[2, 1, 50]]);
  assert.equal(a.byEvent[1].returning, 1);
  assert.equal(a.segments.find((s) => s.id === 'noshow').size, 1);
  assert.equal(a.consent, 0);
  assert.equal(a.top[0].initials, 'A. P.');
  const txt = JSON.stringify(a);
  assert.ok(!/Ana Pérez|ana@mail|11111111|Luis Soto|luis@mail/.test(txt));
});

test('sponsors: valor del acuerdo es proyectado; real sólo lo cobrado en el libro', () => {
  const deal = COM.cleanDeal({ sponsor: 'Marca X', stage: 'signed', cash: 5000, inKind: '20 cajas', inKindValue: 1200, brands: ['club', 'icon'], deliverables: [{ title: 'Logo en flyer', due: '2026-11-20' }, { title: 'Activación', due: '2026-12-30' }], renewalDate: '2026-12-10' }, ctx);
  const ledger = { transactions: [{ sponsorId: deal.id, paidOn: '2026-11-20', amount: 2000, currency: 'PEN', fxRate: 1 }, { sponsorId: deal.id, paidOn: null, amount: 3000, currency: 'PEN', fxRate: 1 }] };
  const [v] = COM.dealsView({ deals: [deal] }, { ledger, today: T });
  assert.equal(v.collected, 2000);
  assert.equal(v.pending, 3000);
  assert.equal(v.overdueDeliverables, 1);
  assert.equal(v.renewalSoon, true);
  assert.deepEqual(v.brands, ['club', 'icon']);
});

test('campañas: gasto desde el libro y registros en la ventana', () => {
  const c = COM.cleanCampaign({ name: 'Lanzamiento 5/12', eventId: 'club-2026-12-05', budget: 1000, start: '2026-11-20', end: '2026-12-04' }, ctx);
  const ledger = { transactions: [{ campaignId: c.id, paidOn: '2026-11-21', amount: 400, currency: 'PEN', fxRate: 1 }, { campaignId: c.id, paidOn: null, amount: 700, currency: 'PEN', fxRate: 1 }] };
  const sales = { 'club-2026-12-05': { velocity: [{ d: '2026-11-19', registrations: 5 }, { d: '2026-11-21', registrations: 30 }, { d: '2026-11-25', registrations: 10 }] } };
  const [v] = COM.campaignsView({ campaigns: [c], content: [] }, { ledger, sales, today: T });
  assert.equal(v.brand, 'club');
  assert.equal(v.spent, 400);
  assert.equal(v.committed, 700);
  assert.equal(v.over, true);
  assert.equal(v.registrations, 40);
  assert.equal(v.costPerRegistration, 10);
});

test('validaciones: URLs, fechas y rangos', () => {
  assert.throws(() => COM.cleanDocument({ title: 'Contrato', url: 'javascript:alert(1)' }, ctx), /bad_url/);
  assert.throws(() => COM.cleanCampaign({ name: 'X', start: '2026-12-10', end: '2026-12-01' }, ctx), /bad_range/);
  assert.throws(() => COM.cleanContent({ title: 'X', eventId: 'no-existe' }, ctx), /bad_event/);
});

test('alertas: contenido atrasado, entregables vencidos y documentos por vencer', () => {
  const mkt = { content: [COM.cleanContent({ title: 'Reel', due: '2026-11-20', status: 'design' }, ctx)] };
  const deal = COM.cleanDeal({ sponsor: 'Y', stage: 'active', deliverables: [{ title: 'Post', due: '2026-11-01' }] }, ctx);
  const sponsors = COM.dealsView({ deals: [deal] }, { ledger: { transactions: [] }, today: T });
  const documents = { documents: [COM.cleanDocument({ title: 'Licencia municipal', type: 'permit', url: 'https://drive.google.com/x', expires: '2026-12-01' }, ctx)] };
  const a = COM.commercialAttention({ mkt, sponsors, documents, today: T });
  assert.deepEqual(a.map((x) => x.title).sort(), ['Contenido atrasado', 'Documentos por vencer', 'Entregables vencidos · Y']);
});
