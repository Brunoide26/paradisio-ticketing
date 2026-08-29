const { checkInTicket } = require('../lib/tickets');

// Simple shared-secret protection so random people can't check tickets in.
// Set STAFF_PASSCODE in your Vercel environment variables.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { ticketId, passcode, allowExpiredCortesia } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ticketId) return res.status(400).json({ error: 'missing_ticket_id' });

    // Sent only when door staff tapped "DEJAR ENTRAR IGUAL" on the red
    // QR EXPIRADO screen -- one deliberate tap, one entry. Behind the same
    // STAFF_PASSCODE check as any other check-in, so it isn't a way in for
    // anyone who couldn't already check tickets in. See checkInTicket: it
    // relaxes the Cortesia expiry branch only.
    const result = await checkInTicket(ticketId, {
      allowExpiredCortesia: allowExpiredCortesia === true,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
