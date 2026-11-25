// Fase 5 de Paradisio OS: analítica, integraciones, conciliación con Culqi e
// incidentes del día del evento.
//
// Analítica: sólo con fechas reales (Liquidación o Cerrado). Cada indicador
// es `null` si falta el dato (por ejemplo, ingreso por asistente sin
// asistencia verificada). Los comparativos piden al menos dos fechas.

const { isActualStage, stageOf } = require('./stages');
const { eventFinancials } = require('./finance');

const r2 = (n) => (n == null || !isFinite(n) ? null : Math.round(n * 100) / 100);
const div = (a, b) => (a == null || !b ? null : a / b);
const sumC = (lines, cat) => (lines || []).filter((l) => !cat || l.category === cat).reduce((s, l) => s + (Number(l.amount) || 0), 0);

// ---------- Analítica por fecha ----------
function eventAnalytics(finance, { live = {}, sales = {}, promoters = {}, audience = null, ledger = { transactions: [] }, withTaxes = true } = {}) {
  const events = (finance.events || []).filter((e) => isActualStage(stageOf(e))).sort((a, b) => a.date.localeCompare(b.date));
  const byLive = new Map(((audience && audience.byEvent) || []).map((x) => [x.osId || x.id, x]));
  const rows = events.map((e) => {
    const f = eventFinancials(e, { withTaxes, events: finance.events });
    const L = e.liveEventId ? live[e.liveEventId] : null;
    const attendees = L && L.ingresaron ? L.ingresaron : null;
    const bar = sumC(e.income, 'Barra') || null;
    const tx = ledger.transactions.filter((t) => t.eventId === e.id);
    const mktLines = sumC(e.costs, 'Marketing');
    const mktLedger = tx.filter((t) => t.campaignId || t.category === 'Marketing').reduce((s, t) => s + t.amount * (t.currency === 'USD' ? t.fxRate : 1), 0);
    const marketing = mktLines || mktLedger || null; // la liquidación manda; si no tiene línea de marketing, el libro
    const aud = byLive.get(e.id) || byLive.get(e.liveEventId);
    const newCustomers = aud ? aud.new : null;
    const P = promoters[e.id];
    const S = sales[e.id];
    let velocity = null;
    if (S && S.velocity.length) {
      const total = S.velocity[S.velocity.length - 1].accRegistrations;
      const weekBefore = new Date(new Date(e.date + 'T12:00:00Z').getTime() - 7 * 86400000).toISOString().slice(0, 10);
      const last7 = S.velocity.filter((v) => v.d > weekBefore && v.d <= e.date).reduce((s, v) => s + v.registrations, 0);
      velocity = { total, lastWeekShare: total ? r2((last7 / total) * 100) : null, days: S.velocity.length };
    }
    return {
      id: e.id, name: e.name, date: e.date, brand: e.brand, venue: e.venue || 'Sin local',
      attendees, revenue: f.revenue, costs: f.costs, result: f.result, margin: r2(f.margin),
      revenuePerAttendee: r2(div(f.revenue, attendees)), barPerAttendee: r2(div(bar, attendees)), costPerAttendee: r2(div(f.costs, attendees)), profitPerAttendee: r2(div(f.result, attendees)),
      marketing: r2(marketing), newCustomers, cac: r2(div(marketing, newCustomers)),
      returning: aud ? aud.returning : null, repeatShare: aud && aud.attended ? r2((aud.returning / aud.attended) * 100) : null,
      promoterConversion: P && P.totals.qrs ? r2((P.totals.attended / P.totals.qrs) * 100) : null,
      showRate: S ? S.showRate : null, velocity,
      budgetVariance: f.budget && f.budget.result != null ? r2(f.result - f.budget.result) : null,
    };
  });
  // Crecimiento contra la fecha anterior de la misma marca.
  rows.forEach((r) => {
    const prev = rows.filter((x) => x.brand === r.brand && x.date < r.date).pop();
    r.growth = prev ? {
      prevId: prev.id, revenue: prev.revenue ? r2(((r.revenue - prev.revenue) / prev.revenue) * 100) : null,
      attendees: prev.attendees && r.attendees ? r2(((r.attendees - prev.attendees) / prev.attendees) * 100) : null,
    } : null;
  });
  const groupBy = (key) => {
    const m = new Map();
    rows.forEach((r) => {
      const k = r[key];
      const o = m.get(k) || { key: k, events: 0, revenue: 0, result: 0, attendees: 0, withAttendance: 0 };
      o.events++; o.revenue += r.revenue; o.result += r.result;
      if (r.attendees) { o.attendees += r.attendees; o.withAttendance++; }
      m.set(k, o);
    });
    return [...m.values()].map((o) => ({ ...o, revenue: r2(o.revenue), result: r2(o.result), margin: o.revenue ? r2((o.result / o.revenue) * 100) : null, avgResult: r2(o.result / o.events), revenuePerAttendee: o.attendees ? r2(o.revenue / o.attendees) : null }));
  };
  const byPeriod = (() => {
    const m = new Map();
    rows.forEach((r) => { const k = r.date.slice(0, 7); const o = m.get(k) || { key: k, events: 0, revenue: 0, result: 0 }; o.events++; o.revenue += r.revenue; o.result += r.result; m.set(k, o); });
    return [...m.values()].map((o) => ({ ...o, revenue: r2(o.revenue), result: r2(o.result) }));
  })();
  return { rows, byBrand: groupBy('brand'), byVenue: groupBy('venue'), byPeriod, enough: rows.length >= 2 };
}

// ---------- Integraciones: estado sin exponer secretos ----------
function integrationsStatus({ culqi, ticketsByEvent, audit, env = process.env }) {
  let lastTicket = null, lastScan = null, count = 0;
  (ticketsByEvent ? [...ticketsByEvent.values()] : []).forEach((list) => list.forEach((t) => {
    count++;
    if (t.createdAt && (!lastTicket || t.createdAt > lastTicket)) lastTicket = t.createdAt;
    if (t.checkedInAt && (!lastScan || t.checkedInAt > lastScan)) lastScan = t.checkedInAt;
  }));
  const lastClaude = (audit || []).find((a) => a.actor === 'claude');
  return [
    { id: 'tickets', name: 'Web de tickets', kind: 'auto', status: count ? 'ok' : 'empty', detail: `${count} tickets · registros, QRs, puerta y promotores en tiempo real`, lastSync: new Date().toISOString(), lastEvent: lastTicket, lastScan },
    { id: 'culqi', name: 'Culqi (venta online)', kind: 'auto', status: !env.CULQI_SECRET_KEY ? 'off' : culqi && culqi.connected ? 'ok' : 'error', detail: !env.CULQI_SECRET_KEY ? 'Falta CULQI_SECRET_KEY' : culqi && culqi.connected ? `Modo ${culqi.mode === 'live' ? 'producción' : 'prueba'} · ${culqi.diag ? culqi.diag.fetched + ' cobros leídos' : ''} · se actualiza cada 10 min` : `Error: ${(culqi && culqi.reason) || 'sin conexión'}`, lastSync: culqi && culqi.at ? new Date(culqi.at).toISOString() : null },
    { id: 'culqi-pos', name: 'Culqi POS (barra)', kind: 'manual', status: 'manual', detail: 'Sin API pública para el POS: el reporte se carga después de cada fecha (Claude con la llave, o Datos de eventos).' },
    { id: 'wally', name: 'Wally', kind: 'manual', status: 'manual', detail: 'Sin API: el cierre se carga después de cada fecha.' },
    { id: 'bcp', name: 'BCP', kind: 'manual', status: 'manual', detail: 'Sin API para empresas pequeñas: el estado de cuenta (Excel) se carga como transacciones.' },
    { id: 'email', name: 'Correo (Resend)', kind: 'auto', status: env.RESEND_API_KEY ? 'ok' : 'off', detail: env.RESEND_API_KEY ? 'Envío de QRs y respuestas de reclamos' : 'Falta RESEND_API_KEY' },
    { id: 'claude', name: 'Llave de Claude (OS_API_TOKEN)', kind: 'auto', status: (env.OS_API_TOKEN || '').length >= 32 ? 'ok' : 'off', detail: (env.OS_API_TOKEN || '').length >= 32 ? 'Carga de reportes post-evento activa' : 'No configurada', lastSync: lastClaude ? lastClaude.at : null },
    { id: 'access', name: 'Clave propia del OS (CEO_PASSCODE)', kind: 'auto', status: env.CEO_PASSCODE ? 'ok' : 'warn', detail: env.CEO_PASSCODE ? 'Solo tú entras al OS' : 'No existe: la clave del staff también abre el OS' },
  ];
}

// ---------- Conciliación Culqi → libro ----------
// Devuelve las transacciones a crear: un cobro por cargo y su comisión, con
// referencia externa única (no se importa dos veces).
function culqiImportPlan(charges, { accountId, existing, events }) {
  const have = new Set(existing.filter((t) => t.source === 'culqi').map((t) => t.externalRef));
  const brandOf = new Map(events.map((e) => [e.id, e.brand]));
  const out = [];
  charges.forEach((c) => {
    if (!have.has(c.id)) out.push({ kind: 'sale', description: `Cobro Culqi ${c.method}`, date: c.date, paidOn: c.date, amount: c.amount, currency: 'PEN', accountId, eventId: c.eventId, brand: brandOf.get(c.eventId), method: c.method, category: 'Entradas y mesas (web)', source: 'culqi', externalRef: c.id });
    if (c.fee > 0 && !have.has('fee:' + c.id)) out.push({ kind: 'cost', description: 'Comisión Culqi', date: c.date, paidOn: c.date, amount: c.fee, currency: 'PEN', accountId, eventId: c.eventId, brand: brandOf.get(c.eventId), category: 'Comisiones', counterparty: 'Culqi', source: 'culqi', externalRef: 'fee:' + c.id });
  });
  return out;
}

// ---------- Incidentes del día del evento ----------
const SEVERITY = { low: 'Baja', med: 'Media', high: 'Alta' };
function cleanIncident(i, { events }) {
  if (!i || !String(i.text || '').trim()) throw new Error('bad_incident');
  if (!events.some((e) => e.id === i.eventId)) throw new Error('bad_event');
  if (!SEVERITY[i.severity || 'low']) throw new Error('bad_severity');
  return {
    id: i.id || 'inc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    eventId: i.eventId, at: i.at || new Date().toISOString(), severity: i.severity || 'low',
    area: String(i.area || '').slice(0, 40), text: String(i.text).trim().slice(0, 500), resolved: !!i.resolved,
  };
}

module.exports = { eventAnalytics, integrationsStatus, culqiImportPlan, cleanIncident, SEVERITY };
