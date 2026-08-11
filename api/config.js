const { PAYMENTS_ENABLED } = require('../lib/config');
const { EVENT_DATE_ISO } = require('../lib/tickets');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json({ paymentsEnabled: PAYMENTS_ENABLED, eventDateIso: EVENT_DATE_ISO });
};
