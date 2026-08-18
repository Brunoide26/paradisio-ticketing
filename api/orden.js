const { getOrderByToken, getTicket, qrDataUrl, EVENT_NAME, EVENT_DATE_LABEL, tierTypeLabel, tierValidityLabel } = require('../lib/tickets');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const token = (req.query && req.query.t) || '';
    if (!token) return res.status(404).json({ error: 'not_found' });

    const order = await getOrderByToken(token);
    if (!order) return res.status(404).json({ error: 'not_found' });

    const tickets = await Promise.all(order.ticketIds.map((id) => getTicket(id)));
    const entries = await Promise.all(tickets.filter(Boolean).map(async (t) => ({
      name: t.name,
      dni: t.dni,
      code: t.id,
      tierLabel: t.skuLabel || tierTypeLabel(false),
      eventName: EVENT_NAME,
      eventDateLabel: EVENT_DATE_LABEL,
      validityLabel: tierValidityLabel(false),
      qr: await qrDataUrl(t.id),
      entradaToken: t.token,
    })));

    return res.status(200).json({ qty: order.qty, entries });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
