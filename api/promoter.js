const { resolveActivePromoter } = require('../lib/promoters');

// Used by both the /p/{codigo} landing and the inline promo-code field in
// checkout step 2. Always 200 — an unknown or deactivated code is not an
// error, just "no match", so the caller can show a non-blocking message
// instead of treating it as a failed request.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const promoter = await resolveActivePromoter(req.query && req.query.code);
  if (!promoter) return res.status(200).json({ ok: false });
  return res.status(200).json({ ok: true, code: promoter.code, name: promoter.name });
};
