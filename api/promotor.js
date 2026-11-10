const {
  login, logout, sessionPromoter, generateInvites, promoterDashboard,
} = require('../lib/promoter-portal');

// API del portal de promotores (/promotor). Todo por POST:
//   { action: 'login', username, password }  -> { token, promoter }
//   { action: 'me' }        + Authorization: Bearer <token> -> panel
//   { action: 'generate', count }  + token -> 1 a 10 códigos nuevos (+ panel actualizado)
//   { action: 'logout' }    + token
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  res.setHeader('Cache-Control', 'no-store');
  try {
    const body = req.body || {};
    const auth = String((req.headers && req.headers.authorization) || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';

    if (body.action === 'login') {
      const r = await login(body.username, body.password);
      if (!r.ok) return res.status(r.reason === 'locked' ? 429 : 401).json({ error: r.reason === 'locked' ? 'locked' : 'invalid_login' });
      return res.status(200).json({ ok: true, token: r.token, promoter: r.promoter });
    }

    if (body.action === 'logout') {
      await logout(token);
      return res.status(200).json({ ok: true });
    }

    const promoter = await sessionPromoter(token);
    if (!promoter) return res.status(401).json({ error: 'unauthorized' });

    if (body.action === 'generate') {
      const r = await generateInvites(promoter, body.count);
      if (!r.ok) {
        const status = r.reason === 'server_error' ? 500 : 409;
        return res.status(status).json({ error: r.reason, dashboard: await promoterDashboard(promoter) });
      }
      return res.status(200).json({ ok: true, invites: r.invites, requested: r.requested, dashboard: await promoterDashboard(promoter) });
    }

    return res.status(200).json(await promoterDashboard(promoter));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
