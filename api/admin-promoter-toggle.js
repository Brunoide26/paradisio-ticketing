const { setPromoterActive } = require('../lib/promoters');

// Deactivating a code only stops it working going forward (no more discount,
// /p/{codigo} redirects to the normal landing) — it never touches tickets
// already issued under that code, so past attribution stays intact.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { code, active, passcode } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const result = await setPromoterActive(code, !!active);
    if (!result.ok) return res.status(404).json(result);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
