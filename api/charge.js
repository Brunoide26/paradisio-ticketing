const { getCounters, createTicket, sendTicketEmail, qrDataUrl, calcAge, PAID_CAP } = require('../lib/tickets');

const TICKET_PRICE_SOLES = 45;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { token, name, phone, email, dni, dob } = req.body || {};
    const qty = Math.min(10, Math.max(1, parseInt(req.body?.qty, 10) || 1));
    if (!token || !name || !phone || !email || !dni || !dob) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const age = calcAge(dob);
    if (age === null || age < 18) {
      return res.status(403).json({ error: 'underage' });
    }

    const counters = await getCounters();
    if ((counters.paid || 0) + qty > PAID_CAP) return res.status(409).json({ error: 'sold_out' });

    // Charge the card server-side ONCE for the full amount, using the Culqi secret key —
    // a Culqi token is single-use, so multi-ticket orders must be one charge, not one per ticket.
    // Culqi amounts are in cents ("céntimos"): S/45.00 -> 4500
    const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: TICKET_PRICE_SOLES * qty * 100,
        currency_code: 'PEN',
        email,
        source_id: token,
        description: 'Paradisio - Entrada Apertura 28 Ago' + (qty > 1 ? ` x${qty}` : ''),
      }),
    });

    const culqiData = await culqiRes.json();

    if (!culqiRes.ok) {
      console.error('Culqi charge failed:', culqiData);
      return res.status(402).json({ error: 'payment_failed', detail: culqiData.user_message || culqiData.merchant_message });
    }

    // Payment succeeded -> issue one ticket per unit purchased
    const tickets = [];
    for (let i = 0; i < qty; i++) {
      const t = await createTicket({ name, phone, email, dni, dob, type: 'paid', amount: TICKET_PRICE_SOLES });
      t.culqiChargeId = culqiData.id;
      tickets.push(t);
    }

    try {
      await Promise.all(tickets.map((t) => sendTicketEmail(t)));
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    const qrs = await Promise.all(tickets.map((t) => qrDataUrl(t.id)));
    return res.status(200).json({ ticket: tickets[0], qr: qrs[0], tickets, qrs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
