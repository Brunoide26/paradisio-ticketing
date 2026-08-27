const { getTicket, sendTicketEmail } = require('../lib/tickets');

// Re-sends the existing QR email for any ticket, unchanged (same ticket,
// same QR, same token). Used from the admin panel's manual-issue lists
// when a first send didn't arrive.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, ticketId } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ticketId) return res.status(400).json({ error: 'missing_ticket_id' });

    const ticket = await getTicket(ticketId);
    if (!ticket) return res.status(404).json({ error: 'not_found' });
    if (!ticket.email) return res.status(400).json({ error: 'no_email' });

    await sendTicketEmail(ticket);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
