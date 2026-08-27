const { createTicket, decrCounter, sendTicketEmail, redis } = require('../lib/tickets');

const VALID_KINDS = { free: 'free', vip: 'vip' };

// Manual, admin-decided issuance -- deliberately bypasses every Cortesia
// cap/closure check. It never calls isCortesiaSoldOut()/checkCapacity(), so
// FREE_CAP, cortesia_permanently_closed, and the manual open/closed toggle
// (api/admin-cortesia-toggle.js) simply don't apply here: this endpoint is
// the override, not a normal registration.
//
// type:'free' is used for the Cortesia case specifically so the existing
// midnight door cutoff in checkInTicket (gated on ticket.type === 'free')
// and the existing email copy (buildTicketEmailHtml/Text, gated the same
// way) apply automatically -- no changes needed there. Since createTicket
// always increments counters.free for a 'free' ticket, that increment is
// immediately undone with decrCounter so this manual issuance can never
// itself push counters.free toward FREE_CAP or contribute to the automatic
// cap latch. type:'vip' needs no such correction: it increments a separate
// counters.vip that no cap check reads, and it's never type:'free' so the
// midnight cutoff never applies to it either.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, nombre, email, kind } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const type = VALID_KINDS[kind];
    if (!type) return res.status(400).json({ error: 'invalid_kind' });

    const name = (nombre || '').trim();
    const cleanEmail = (email || '').trim();
    if (!name || !cleanEmail) return res.status(400).json({ error: 'missing_fields' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const ticket = await createTicket({
      name, email: cleanEmail, type, amount: 0,
      skuLabel: type === 'vip' ? 'VIP' : '',
    });

    if (type === 'free') {
      await decrCounter('free');
    }

    ticket.manualIssue = true;
    await redis.set('ticket:' + ticket.id, ticket);

    // Don't fail the request if email delivery has an issue -- the ticket
    // still exists and can be resent from the admin panel either way.
    try {
      await sendTicketEmail(ticket);
    } catch (emailErr) {
      console.error('Manual issue email send failed:', emailErr);
    }

    return res.status(200).json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
