// Single on/off switch for the paid ticket flow. Both the API (api/charge.js)
// and the UI (index.html, via GET /api/config) read this single value — flip
// to false to fall back to Cortesía-only sales without touching anything else.
const PAYMENTS_ENABLED = true;

// Unlocks a hidden S/1 test SKU (see lib/catalog.js) so the real Culqi + ticket
// + email flow can be rehearsed without paying full price. Off by default —
// turn on only via the TEST_SKU_ENABLED=true env var in Vercel, and remove
// that env var once the event's testing is done; nothing else needs to change.
const TEST_SKU_ENABLED = process.env.TEST_SKU_ENABLED === 'true';

// Pre Opening 14/11: la venta online de entradas está cerrada ("Closed") y
// las mesas/boxes salen "Sold out". Se siguen mostrando en la página pero no
// se pueden comprar, y el servidor rechaza cualquier cobro. Para reabrir:
// TICKET_SALES_CLOSED=false / TABLES_SOLD_OUT=false en Vercel.
const TICKET_SALES_CLOSED = process.env.TICKET_SALES_CLOSED !== 'false';
const TABLES_SOLD_OUT = process.env.TABLES_SOLD_OUT !== 'false';

module.exports = { PAYMENTS_ENABLED, TEST_SKU_ENABLED, TICKET_SALES_CLOSED, TABLES_SOLD_OUT };
