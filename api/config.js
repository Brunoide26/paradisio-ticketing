const { PAYMENTS_ENABLED } = require('../lib/config');
const { EVENT_DATE_ISO, getCounters } = require('../lib/tickets');
const { getSalesWindow, getPaidSkus, isCortesiaDateOpen, CORTESIA_CAP, TEST_SKU_ENABLED, TEST_SKU } = require('../lib/catalog');

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
  let cortesiaState = 'closed';
  if (isCortesiaDateOpen(now)) {
    const counters = await getCounters();
    cortesiaState = (counters.free || 0) >= CORTESIA_CAP ? 'soldout' : 'open';
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
