const { listInvites, generateInvites, setInviteRevoked, MAX_BATCH } = require('../lib/invites');
const { getPromoter } = require('../lib/promoters');

// Códigos de invitación por promotor (pestaña "Códigos" del admin).
//   { passcode, action: 'list' }
//   { passcode, action: 'generate', promoterCode, count }
//   { passcode, action: 'revoke' | 'unrevoke', code }
// Revocar un código sin usar lo deja inservible; uno ya canjeado no se toca
// -- para invalidar esa entrada se anula el ticket como siempre.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, action } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) return res.status(401).json({ error: 'unauthorized' });

    if (action === 'generate') {
      const { promoterCode, count } = req.body;
      const promoter = await getPromoter(promoterCode);
      if (!promoter) return res.status(400).json({ error: 'invalid_promoter' });
      const n = parseInt(count, 10);
      if (!n || n < 1 || n > MAX_BATCH) return res.status(400).json({ error: 'invalid_count', max: MAX_BATCH });
      const created = await generateInvites(promoter.code, n);
      return res.status(200).json({ ok: true, created });
    }

    if (action === 'revoke' || action === 'unrevoke') {
      const result = await setInviteRevoked(req.body.code, action === 'revoke');
      if (!result.ok) return res.status(404).json({ error: 'not_found' });
      return res.status(200).json({ ok: true, invite: result.invite });
    }

    const invites = await listInvites();
    return res.status(200).json({ invites, maxBatch: MAX_BATCH });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
