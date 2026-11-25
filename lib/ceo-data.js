// Lectura de datos del dashboard de CEO / Paradisio OS, compartida por
// api/ceo.js y api/os.js. Movido tal cual desde api/ceo.js: mismo
// comportamiento, mismas llaves de Redis.

const { redis, listAllTickets } = require('./tickets');
const { eventIdOfTicket, CURRENT_EVENT_ID } = require('./events');
const { listPromoters } = require('./promoters');
const { SEED } = require('./ceo-seed');
const { culqiForEvents } = require('./culqi-sync');

const FINANCE_KEY = 'ceo:finance';
const MAX_BYTES = 250000;

function ceoPasscode() {
  return process.env.CEO_PASSCODE || process.env.STAFF_PASSCODE;
}

function ageAt(dob, at) {
  if (!dob) return null;
  const d = new Date(dob + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  let a = at.getFullYear() - d.getFullYear();
  const m = at.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getDate())) a--;
  return a >= 10 && a <= 90 ? a : null;
}

const AGE_BUCKETS = [
  { label: '18–20', min: 0, max: 20 },
  { label: '21–23', min: 21, max: 23 },
  { label: '24–26', min: 24, max: 26 },
  { label: '27–30', min: 27, max: 30 },
  { label: '31+', min: 31, max: 200 },
];

// Hora de Lima (UTC-5, sin horario de verano) en minutos desde las 18:00 del
// día del evento, para poder ordenar la noche de corrido pasada la medianoche.
function limaSlot(iso, slotMin) {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return null;
  const lima = new Date(t.getTime() - 5 * 3600 * 1000);
  let mins = lima.getUTCHours() * 60 + lima.getUTCMinutes();
  if (mins < 12 * 60) mins += 24 * 60; // madrugada = después de medianoche
  return Math.floor(mins / slotMin) * slotMin;
}

function slotLabel(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

function limaDay(iso) {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return null;
  return new Date(t.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

function summarize(tickets, eventId, promoterNames) {
  const at = new Date(eventId + 'T23:00:00-05:00');
  const valid = tickets.filter((t) => !t.voided);
  const byType = { free: 0, promo: 0, paid: 0, table: 0 };
  valid.forEach((t) => { if (byType[t.type] !== undefined) byType[t.type]++; });
  const pending = valid.filter((t) => t.pending).length;
  const issued = valid.filter((t) => !t.pending).length;
  const inside = valid.filter((t) => t.checkedIn);
  const late = inside.filter((t) => t.lateEntry);
  const lateCharged = late.filter((t) => t.lateCharged).length;

  // Curva de ingreso por la puerta, cada 15 minutos.
  const checkinMap = new Map();
  inside.forEach((t) => {
    const s = t.checkedInAt ? limaSlot(t.checkedInAt, 15) : null;
    if (s !== null) checkinMap.set(s, (checkinMap.get(s) || 0) + 1);
  });
  const slots = [...checkinMap.keys()].sort((a, b) => a - b);
  const checkins = [];
  if (slots.length) {
    let acc = 0;
    for (let s = slots[0]; s <= slots[slots.length - 1]; s += 15) {
      const n = checkinMap.get(s) || 0;
      acc += n;
      checkins.push({ t: slotLabel(s), n, acc });
    }
  }

  // Registros por día (incluye anulados: es la demanda que hubo).
  const dayMap = new Map();
  tickets.forEach((t) => {
    const d = limaDay(t.createdAt);
    if (d) dayMap.set(d, (dayMap.get(d) || 0) + 1);
  });
  const registrations = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, n]) => ({ d, n }));

  const ageCount = (list) => AGE_BUCKETS.map((b) => ({
    label: b.label,
    n: list.filter((t) => { const a = ageAt(t.dob, at); return a !== null && a >= b.min && a <= b.max; }).length,
  }));

  // Ranking de promotores: QRs emitidos e ingresos por la puerta.
  const promo = new Map();
  valid.forEach((t) => {
    if (!t.promoterCode) return;
    const p = promo.get(t.promoterCode) || { code: t.promoterCode, registros: 0, qrs: 0, ingresaron: 0 };
    p.registros++;
    if (!t.pending) p.qrs++;
    if (t.checkedIn) p.ingresaron++;
    promo.set(t.promoterCode, p);
  });
  const promoters = [...promo.values()]
    .map((p) => ({ ...p, name: promoterNames.get(p.code) || p.code }))
    .sort((a, b) => b.qrs - a.qrs || b.ingresaron - a.ingresaron);
  const withPromoter = valid.filter((t) => t.promoterCode && !t.pending).length;

  // Venta web: cada entrada pagada guarda su monto; las mesas también.
  const webSales = valid.filter((t) => t.type === 'paid' || t.type === 'table')
    .reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return {
    eventId,
    registros: tickets.length,
    anulados: tickets.length - valid.length,
    vigentes: valid.length,
    byType,
    pending,
    issued,
    ingresaron: inside.length,
    aTiempo: inside.length - late.length,
    tarde: late.length,
    tardeCobrado: lateCharged,
    conversion: issued ? Math.round((inside.length / issued) * 1000) / 10 : 0,
    withPromoter,
    withoutPromoter: issued - withPromoter,
    webSales: Math.round(webSales * 100) / 100,
    checkins,
    registrations,
    agesAttended: ageCount(inside),
    agesRegistered: ageCount(valid),
    promoters,
  };
}

async function loadFinance() {
  const saved = await redis.get(FINANCE_KEY);
  if (saved && typeof saved === 'object' && Array.isArray(saved.events)) return { finance: saved, seeded: false };
  return { finance: SEED, seeded: true };
}

function validFinance(f) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.events) || !Array.isArray(f.brands)) return false;
  if (JSON.stringify(f).length > MAX_BYTES) return false;
  const lineOk = (l) => l && typeof l.label === 'string' && Number.isFinite(Number(l.amount));
  return f.events.every((e) => e && typeof e.id === 'string' && typeof e.brand === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(e.date || '')
    && Array.isArray(e.income) && e.income.every(lineOk)
    && Array.isArray(e.costs) && e.costs.every(lineOk));
}


// Lo que devuelve un GET del dashboard: finanzas + agregados en vivo + Culqi.
async function loadPayload() {
  const [{ finance, seeded }, tickets, promoters] = await Promise.all([
    loadFinance(), listAllTickets(), listPromoters({ includeRemoved: true }),
  ]);
  const names = new Map(promoters.map((p) => [p.code, p.name]));
  const byEvent = new Map();
  tickets.forEach((t) => {
    const id = eventIdOfTicket(t);
    if (!id) return;
    if (!byEvent.has(id)) byEvent.set(id, []);
    byEvent.get(id).push(t);
  });
  const live = {};
  byEvent.forEach((list, id) => { live[id] = summarize(list, id, names); });
  let culqi = { connected: false, reason: 'error' };
  try { culqi = await culqiForEvents(redis, finance.events || []); } catch (e) { console.error('culqi', e); }
  return {
    finance,
    seeded,
    live,
    culqi,
    currentEventId: CURRENT_EVENT_ID,
    usingStaffPasscode: !process.env.CEO_PASSCODE,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { redis, SEED, FINANCE_KEY, MAX_BYTES, ceoPasscode, summarize, loadFinance, validFinance, loadPayload };
