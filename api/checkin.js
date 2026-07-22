const { checkInTicket } = require('../lib/tickets');

// Simple shared-secret protection so random people can't check tickets in.
// Set STAFF_PASSCODE in your Vercel environment variables.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { ticketId, passcode } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ticketId) return res.status(400).json({ error: 'missing_ticket_id' });

    const result = await checkInTicket(ticketId);
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
