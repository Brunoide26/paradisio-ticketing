const { resyncFreeCounter, getCortesiaStatus } = require('../lib/tickets');

// On-demand only -- scans every ticket to recompute counters.free from the
// actual vigente Cortesía tickets. Never called automatically or from the
// registration path; an admin triggers this explicitly from the panel when
// they suspect drift (e.g. tickets voided before decrement-on-void existed).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const { before, after } = await resyncFreeCounter();
    const status = await getCortesiaStatus();
    return res.status(200).json({ ok: true, before, after, ...status });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
