const fs = require('fs');
const path = require('path');
const { resolveActivePromoter } = require('../../lib/promoters');

// The public-facing /p/{codigo} URL (vercel.json rewrites it here) used to
// point straight at the static index.html file and 404'd in production for
// reasons that didn't reproduce from the repo's config alone. Routing it
// through a real function instead means: (a) an invalid/inactive code
// redirects authoritatively server-side, before any page content ships —
// more robust than the previous client-side JS check — and (b) this is a
// materially different Vercel routing path (Functions, not static-file
// serving), which sidesteps whatever was swallowing the old rewrite.
//
// This intentionally serves index.html's bytes as-is rather than injecting
// the promoter's name server-side — the existing client-side JS in
// index.html already detects /p/{codigo} from location.pathname (unaffected
// by this being a rewrite target instead of the real file) and fetches
// /api/promoter for the display name. Keeping that path unchanged avoids
// duplicating/hand-rolling HTML injection for what's already a tested flow.
module.exports = async (req, res) => {
  const code = req.query && req.query.code;
  const promoter = await resolveActivePromoter(code);

  if (!promoter) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  try {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(html);
  } catch (err) {
    console.error('Failed to read index.html for /p/{codigo}:', err);
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
};
