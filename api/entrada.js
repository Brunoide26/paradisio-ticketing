const { getTicketByToken, qrDataUrl, EVENT_NAME, EVENT_DATE_LABEL, tierTypeLabel, tierValidityLabel } = require('../lib/tickets');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const token = (req.query && req.query.t) || '';
    if (!token) return res.status(404).json({ error: 'not_found' });

    const ticket = await getTicketByToken(token);
    if (!ticket) return res.status(404).json({ error: 'not_found' });

    const isFree = ticket.type === 'free';
    const qr = await qrDataUrl(ticket.id);

    return res.status(200).json({
      name: ticket.name,
      dni: ticket.dni,
      code: ticket.id,
      tierLabel: tierTypeLabel(isFree),
      eventName: EVENT_NAME,
      eventDateLabel: EVENT_DATE_LABEL,
      validityLabel: tierValidityLabel(isFree),
      qr,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
