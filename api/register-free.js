const { checkCapacity, createTicket, sendTicketEmail, qrDataUrl } = require('../lib/tickets');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { name, phone, email } = req.body || {};
    if (!name || !phone || !email) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const ok = await checkCapacity('free');
    if (!ok) return res.status(409).json({ error: 'sold_out' });

    const ticket = await createTicket({ name, phone, email, type: 'free', amount: 0 });

    // Send email, but don't fail the request if email delivery has an issue —
    // the person still gets their QR on screen either way.
    try {
      await sendTicketEmail(ticket);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    const qr = await qrDataUrl(ticket.id);
    return res.status(200).json({ ticket, qr });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
