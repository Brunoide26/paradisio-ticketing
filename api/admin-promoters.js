const { listAllTickets } = require('../lib/tickets');
const { listPromoters } = require('../lib/promoters');

// Per-promoter rollup for the admin "Promotores" tab. Voided tickets never
// count toward any promoter's numbers — a voided ticket isn't a real sale
// or a real attendee, same "vigente" treatment used everywhere else in the
// admin panel. Bounced-email tickets ARE still counted here (a QR that was
// generated and, for paid, actually charged, still happened, whether or not
// the delivery email bounced) — "Ingresaron" is the number that ultimately
// matters, and that's driven by checkedIn, not email delivery.
module.exports = async (req, res) => {
  try {
    const passcode = req.method === 'POST' ? (req.body || {}).passcode : req.query.passcode;
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const [tickets, promoters] = await Promise.all([listAllTickets(), listPromoters()]);

    const stats = promoters.map((p) => {
      const own = tickets.filter((t) => t.promoterCode === p.code && !t.voided);
      const cortesias = own.filter((t) => t.type === 'free').length;
      const pagadas = own.filter((t) => t.type === 'paid').length;
      const personas = cortesias + pagadas;
      // Revenue is per ORDER, not per ticket: a Duo/Trio charges once (see
      // api/charge.js) and stores that same order total as `amount` on
      // EVERY ticket in the order, so summing amount per ticket would
      // double/triple-count a group sale's revenue. Count each order's
      // amount exactly once (keyed by orderId) instead -- an individual
      // sale has no other ticket sharing its orderId, so it's unaffected.
      const paidOrderAmounts = new Map();
      own.filter((t) => t.type === 'paid').forEach((t) => {
        const key = t.orderId || t.id;
        if (!paidOrderAmounts.has(key)) paidOrderAmounts.set(key, t.amount || 0);
      });
      const ingreso = [...paidOrderAmounts.values()].reduce((sum, a) => sum + a, 0);
      const ingresaron = own.filter((t) => t.checkedIn).length;
      const conversion = personas > 0 ? Math.round((ingresaron / personas) * 1000) / 10 : 0;
      return {
        code: p.code, name: p.name, active: p.active,
        cortesias, pagadas, personas, ingreso, ingresaron, conversion,
      };
    });

    return res.status(200).json({ promoters: stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
