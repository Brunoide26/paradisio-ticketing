const { listAllTickets, getCounters } = require('../lib/tickets');

module.exports = async (req, res) => {
  try {
    const passcode = req.method === 'POST' ? (req.body || {}).passcode : req.query.passcode;
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const tickets = await listAllTickets();
    const counters = await getCounters();
    return res.status(200).json({ tickets, counters });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
