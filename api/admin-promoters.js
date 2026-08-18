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
      const ingreso = own
        .filter((t) => t.type === 'paid')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
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
