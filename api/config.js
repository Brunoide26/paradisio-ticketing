const { PAYMENTS_ENABLED } = require('../lib/config');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  return res.status(200).json({ paymentsEnabled: PAYMENTS_ENABLED });
};
