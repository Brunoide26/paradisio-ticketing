// Single on/off switch for the paid ticket flow. Both the API (api/charge.js)
// and the UI (index.html, via GET /api/config) read this single value — flip
// to false to fall back to Cortesía-only sales without touching anything else.
const PAYMENTS_ENABLED = true;

// Unlocks a hidden S/1 test SKU (see lib/catalog.js) so the real Culqi + ticket
// + email flow can be rehearsed without paying full price. Off by default —
// turn on only via the TEST_SKU_ENABLED=true env var in Vercel, and remove
// that env var once the event's testing is done; nothing else needs to change.
const TEST_SKU_ENABLED = process.env.TEST_SKU_ENABLED === 'true';

module.exports = { PAYMENTS_ENABLED, TEST_SKU_ENABLED };
