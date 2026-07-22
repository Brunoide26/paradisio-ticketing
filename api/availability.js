const { getCounters, FREE_CAP, PAID_CAP } = require('../lib/tickets');

module.exports = async (req, res) => {
  try {
    const c = await getCounters();
    return res.status(200).json({
      free: c.free || 0,
      paid: c.paid || 0,
      checkedin: c.checkedin || 0,
      freeLeft: Math.max(0, FREE_CAP - (c.free || 0)),
      paidLeft: Math.max(0, PAID_CAP - (c.paid || 0)),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
