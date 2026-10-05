const { listAllTickets, getCounters, getCortesiaStatus } = require('../lib/tickets');
const { CURRENT_EVENT_ID, eventIdOfTicket, listEvents } = require('../lib/events');

module.exports = async (req, res) => {
  try {
    const passcode = req.method === 'POST' ? (req.body || {}).passcode : req.query.passcode;
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const tickets = await listAllTickets();
    // Cada ticket sale con su fecha resuelta (los viejos no la tenían
    // guardada); el admin filtra por fecha del lado del cliente.
    tickets.forEach((t) => { t.eventId = eventIdOfTicket(t); });
    const counters = await getCounters();
    const cortesia = await getCortesiaStatus();
    const events = listEvents([...new Set(tickets.map((t) => t.eventId))]);
    return res.status(200).json({ tickets, counters, cortesia, events, currentEventId: CURRENT_EVENT_ID });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
