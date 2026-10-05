const { listAllTickets } = require('../lib/tickets');
const { CURRENT_EVENT_ID, eventIdOfTicket } = require('../lib/events');

// Números del scanner de puerta, sólo de la fecha vigente (los contadores
// globales de Redis mezclan todas las fechas).
module.exports = async (req, res) => {
  try {
    const tickets = (await listAllTickets()).filter((t) => eventIdOfTicket(t) === CURRENT_EVENT_ID && !t.voided);
    const count = (type) => tickets.filter((t) => t.type === type).length;
    return res.status(200).json({
      eventId: CURRENT_EVENT_ID,
      free: count('free'),
      paid: count('paid'),
      promo: count('promo'),
      checkedin: tickets.filter((t) => t.checkedIn).length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
