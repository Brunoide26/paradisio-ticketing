const { checkCapacity, createTicket, sendTicketEmail, qrDataUrl } = require('../lib/tickets');

const TICKET_PRICE_SOLES = 45;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { token, name, phone, email } = req.body || {};
    if (!token || !name || !phone || !email) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const ok = await checkCapacity('paid');
    if (!ok) return res.status(409).json({ error: 'sold_out' });

    // Charge the card server-side using the Culqi secret key.
    // Culqi amounts are in cents ("céntimos"): S/45.00 -> 4500
    const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: TICKET_PRICE_SOLES * 100,
        currency_code: 'PEN',
        email,
        source_id: token,
        description: 'Paradisio - Entrada Apertura 28 Ago',
      }),
    });

    const culqiData = await culqiRes.json();

    if (!culqiRes.ok) {
      console.error('Culqi charge failed:', culqiData);
      return res.status(402).json({ error: 'payment_failed', detail: culqiData.user_message || culqiData.merchant_message });
    }

    // Payment succeeded -> issue the ticket
    const ticket = await createTicket({ name, phone, email, type: 'paid', amount: TICKET_PRICE_SOLES });
    ticket.culqiChargeId = culqiData.id;

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
