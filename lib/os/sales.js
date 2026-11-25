// Ventas y reservas de Paradisio OS: lectura de la ticketera (Redis
// `ticket:*`), sin escribir nada. Nunca devuelve nombres, DNI, correos ni
// teléfonos de asistentes: sólo agregados por fecha, tipo, fase, canal, mesa
// y promotor (código).

const { TICKET_TYPES, TABLE_TYPES, TABLE_UNITS, DOOR_PRICE_SOLES } = require('../catalog');

const TYPE_LABEL = { free: 'Lista gratis', promo: 'Invitación de promotor', paid: 'Entrada pagada (web)', table: 'Mesa / box (web)' };
const r2 = (n) => Math.round(n * 100) / 100;
const limaDay = (iso) => { const t = new Date(iso); return isNaN(t) ? null : new Date(t.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10); };

function salesForEvent(tickets, eventDate) {
  const all = tickets || [];
  const valid = all.filter((t) => !t.voided);
  const issued = valid.filter((t) => !t.pending);
  const inside = valid.filter((t) => t.checkedIn);
  const money = (list) => r2(list.reduce((s, t) => s + (Number(t.amount) || 0), 0));
  const persons = (list) => list.reduce((s, t) => s + (t.type === 'table' ? Number(t.partySize) || 1 : 1), 0);

  const byType = Object.keys(TYPE_LABEL).map((type) => {
    const v = valid.filter((t) => t.type === type);
    return { type, label: TYPE_LABEL[type], tickets: v.length, issued: v.filter((t) => !t.pending).length, attended: v.filter((t) => t.checkedIn).length, revenue: money(v) };
  }).filter((x) => x.tickets);

  // Fases / precios: por SKU (entradas pagadas) y por tipo de mesa.
  const skuMap = new Map();
  valid.filter((t) => t.type === 'paid').forEach((t) => {
    const k = t.sku || t.skuLabel || 'sin fase';
    const def = TICKET_TYPES.find((x) => x.sku === t.sku);
    const o = skuMap.get(k) || { sku: k, label: (def && def.name) || t.skuLabel || k, price: def ? def.price : null, tickets: 0, attended: 0, revenue: 0 };
    o.tickets++; if (t.checkedIn) o.attended++; o.revenue = r2(o.revenue + (Number(t.amount) || 0));
    skuMap.set(k, o);
  });

  // Mesas: cada unidad del plano con su estado según los tickets de mesa no anulados.
  const tableTickets = valid.filter((t) => t.type === 'table');
  const tables = TABLE_UNITS.map((u) => {
    const tt = TABLE_TYPES.find((x) => x.type === u.type) || {};
    const ts = tableTickets.filter((t) => t.unitId === u.id);
    return {
      id: u.id, label: u.label, type: u.type, typeName: tt.name, price: tt.price || null, people: tt.people || null, color: tt.color || null,
      x: u.x, y: u.y, w: u.w, h: u.h,
      status: ts.length ? 'sold' : 'free', amount: money(ts), partySize: ts.reduce((s, t) => s + (Number(t.partySize) || 0), 0) || null,
      attended: ts.some((t) => t.checkedIn), promoterCode: (ts.find((t) => t.promoterCode) || {}).promoterCode || null,
    };
  });
  const tableTypes = TABLE_TYPES.map((tt) => {
    const units = tables.filter((u) => u.type === tt.type);
    return { type: tt.type, name: tt.name, price: tt.price, people: tt.people, units: units.length, sold: units.filter((u) => u.status === 'sold').length, revenue: r2(units.reduce((s, u) => s + u.amount, 0)) };
  });
  // Mesas vendidas que no están en el plano actual (catálogo cambiado): se cuentan aparte.
  const offMap = tableTickets.filter((t) => !TABLE_UNITS.some((u) => u.id === t.unitId));

  // Velocidad de venta: registros y dinero por día (hora de Lima), acumulado.
  const days = new Map();
  valid.forEach((t) => {
    const d = limaDay(t.createdAt); if (!d) return;
    const o = days.get(d) || { d, registrations: 0, sales: 0, revenue: 0 };
    o.registrations++;
    if (t.type === 'paid' || t.type === 'table') { o.sales++; o.revenue = r2(o.revenue + (Number(t.amount) || 0)); }
    days.set(d, o);
  });
  let accR = 0, accM = 0;
  const velocity = [...days.values()].sort((a, b) => a.d.localeCompare(b.d)).map((o) => { accR += o.registrations; accM = r2(accM + o.revenue); return { ...o, accRegistrations: accR, accRevenue: accM }; });

  const late = inside.filter((t) => t.lateEntry);
  const lastScan = inside.reduce((m, t) => (t.checkedInAt && (!m || t.checkedInAt > m) ? t.checkedInAt : m), null);
  const lastRegistration = all.reduce((m, t) => (t.createdAt && (!m || t.createdAt > m) ? t.createdAt : m), null);
  const lateCharged = late.filter((t) => t.lateCharged).length;
  return {
    lastScan, lastRegistration,
    registrations: all.length, voided: all.length - valid.length, valid: valid.length,
    pending: valid.length - issued.length, issued: issued.length,
    attended: inside.length, attendedPersons: persons(inside),
    noShow: issued.length - inside.filter((t) => !t.pending).length,
    showRate: issued.length ? r2((inside.length / issued.length) * 100) : null,
    late: late.length, lateCharged, doorRevenueEstimate: lateCharged * DOOR_PRICE_SOLES, doorPrice: DOOR_PRICE_SOLES,
    webRevenue: money(valid.filter((t) => t.type === 'paid' || t.type === 'table')),
    byType, bySku: [...skuMap.values()], tables, tableTypes,
    tablesSold: tables.filter((u) => u.status === 'sold').length, tablesTotal: tables.length,
    offMapTables: offMap.length,
    velocity,
    daysBefore: velocity.length && eventDate ? velocity.map((v) => ({ ...v, daysToEvent: Math.round((new Date(eventDate + 'T00:00:00Z') - new Date(v.d + 'T00:00:00Z')) / 86400000) })) : [],
  };
}

module.exports = { salesForEvent, TYPE_LABEL };
