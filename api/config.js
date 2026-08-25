const { PAYMENTS_ENABLED } = require('../lib/config');
const { EVENT_DATE_ISO, FREE_CAP, getCounters } = require('../lib/tickets');
const { getSalesWindow, getPaidSkus, isCortesiaDateOpen, TEST_SKU_ENABLED, TEST_SKU } = require('../lib/catalog');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const now = new Date();
  const salesWindow = getSalesWindow(now);
  const paidSkus = PAYMENTS_ENABLED ? getPaidSkus(now) : [];

  // The test SKU is never in paidSkus and is only ever sent over the wire when
  // both the server flag is on AND the caller already knows to ask for it —
  // a plain page load never triggers this branch, so it never appears in a
  // normal visitor's network traffic either.
  const testSku = (PAYMENTS_ENABLED && TEST_SKU_ENABLED && req.query && req.query.qa === '1') ? TEST_SKU : undefined;

  // cortesiaState never exposes the raw QR count (no visible capacity counter) —
  // only whether registration is still open, sold out at the cap, or closed by date.
  // Compares against FREE_CAP (lib/tickets.js) -- the same value register-free.js
  // actually enforces (it respects a FREE_CAP env var override; the raw
  // CORTESIA_CAP constant this used to compare against does not) -- so the
  // badge shown here can never say "open" while the real gate rejects.
  let cortesiaState = 'closed';
  if (isCortesiaDateOpen(now)) {
    const counters = await getCounters();
    cortesiaState = (counters.free || 0) >= FREE_CAP ? 'soldout' : 'open';
  }

  return res.status(200).json({
    paymentsEnabled: PAYMENTS_ENABLED,
    eventDateIso: EVENT_DATE_ISO,
    salesWindow,
    paidSkus,
    cortesiaState,
    culqiPublicKey: process.env.CULQI_PUBLIC_KEY || '',
    ...(testSku ? { testSku } : {}),
  });
};
