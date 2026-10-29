const { PAYMENTS_ENABLED } = require('../lib/config');
const {
  EVENT_NAME, EVENT_DATE_LABEL, EVENT_SHORT_DATE, EVENT_DATE_ISO, EVENT_ADDRESS, EVENT_MAPS_URL, PROMO_VALIDITY_LABEL,
  PAID_CAP, MIN_AGE, isCortesiaSoldOut, listEventTickets, soldTableUnits,
} = require('../lib/tickets');
const {
  getTicketTypes, TABLE_TYPES, TABLE_UNITS, TABLE_MAP, BOTELLAS_A_ELECCION, FREE_ENTRY, DOOR_PRICE_SOLES, MAX_TICKETS_PER_ORDER,
  TEST_SKU_ENABLED, TEST_SKU,
} = require('../lib/catalog');
const { CURRENT_EVENT_ID } = require('../lib/events');
const { DISCOUNT_RATE } = require('../lib/promoters');

// Todo lo que la página pública necesita para pintarse: datos de la fecha,
// entradas (con agotado / quedan pocas), free entry abierto o cerrado, y qué
// mesas del mapa ya están vendidas. Nunca expone cuántos registros hay.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const now = new Date();
    const types = PAYMENTS_ENABLED ? getTicketTypes(now) : [];
    const paid = (await listEventTickets()).filter((t) => t.type === 'paid' && !t.voided);
    const globalLeft = Math.max(0, PAID_CAP - paid.length);

    const tickets = types.map((t) => {
      const left = t.cap != null ? Math.max(0, t.cap - paid.filter((p) => p.sku === t.sku).length) : globalLeft;
      const capped = Math.min(left, globalLeft);
      return {
        sku: t.sku, name: t.name, price: t.price, description: t.description,
        soldOut: capped <= 0,
        // Sólo se avisa "últimas" cuando quedan pocas; el número exacto no sale.
        fewLeft: capped > 0 && capped <= 15,
        maxQty: Math.min(MAX_TICKETS_PER_ORDER, capped),
      };
    });
    if (PAYMENTS_ENABLED && TEST_SKU_ENABLED && req.query && req.query.qa === '1') {
      tickets.push({ sku: TEST_SKU.sku, name: TEST_SKU.name, price: TEST_SKU.price, description: 'Solo pruebas', soldOut: false, fewLeft: false, maxQty: 1 });
    }

    const sold = new Set(await soldTableUnits(CURRENT_EVENT_ID, TABLE_UNITS.map((u) => u.id)));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      event: {
        name: EVENT_NAME, dateLabel: EVENT_DATE_LABEL, shortDate: EVENT_SHORT_DATE, dateIso: EVENT_DATE_ISO,
        address: EVENT_ADDRESS, mapsUrl: EVENT_MAPS_URL,
      },
      minAge: MIN_AGE,
      paymentsEnabled: PAYMENTS_ENABLED,
      culqiPublicKey: process.env.CULQI_PUBLIC_KEY || '',
      promoterDiscountRate: DISCOUNT_RATE,
      freeEntry: {
        name: FREE_ENTRY.name,
        description: FREE_ENTRY.description,
        validityLabel: PROMO_VALIDITY_LABEL,
        open: !(await isCortesiaSoldOut()),
        doorPrice: DOOR_PRICE_SOLES,
      },
      tickets,
      maxTicketsPerOrder: MAX_TICKETS_PER_ORDER,
      tables: {
        map: TABLE_MAP,
        bottles: BOTELLAS_A_ELECCION,
        types: PAYMENTS_ENABLED ? TABLE_TYPES : [],
        units: PAYMENTS_ENABLED ? TABLE_UNITS.map((u) => ({ ...u, sold: sold.has(u.id) })) : [],
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
