const { setCortesiaManualOverride, getCortesiaStatus } = require('../lib/tickets');

// Manual open/closed control for Cortesía registration, independent of the
// FREE_CAP-driven latch. Opening clears the cap latch too (see
// setCortesiaManualOverride), so this is also the "un-close" action for a
// cap-triggered closure. Takes effect immediately -- api/config.js and
// api/register-free.js both read the same flags on every request.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, open } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    await setCortesiaManualOverride(!!open);
    const status = await getCortesiaStatus();
    return res.status(200).json({ ok: true, ...status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
