const { checkInTicket } = require('../lib/tickets');
const { getPromoter } = require('../lib/promoters');

// Simple shared-secret protection so random people can't check tickets in.
// Set STAFF_PASSCODE in your Vercel environment variables.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { ticketId, passcode, allowExpiredCortesia, lateCharged, dryRun } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!ticketId) return res.status(400).json({ error: 'missing_ticket_id' });

    // Sent only when door staff tapped "DEJAR ENTRAR IGUAL" on the red
    // QR EXPIRADO screen -- one deliberate tap, one entry. Behind the same
    // STAFF_PASSCODE check as any other check-in, so it isn't a way in for
    // anyone who couldn't already check tickets in. See checkInTicket: it
    // relaxes the Cortesia expiry branch only.
    const result = await checkInTicket(ticketId, {
      allowExpiredCortesia: allowExpiredCortesia === true,
      lateCharged: lateCharged === true,
      dryRun: dryRun === true,
    });
    // De parte de quién viene: nombre del promotor del registro (si tiene).
    // Si la búsqueda falla, el escáner muestra el código; nunca bloquea.
    if (result && result.ticket && result.ticket.promoterCode) {
      try {
        const p = await getPromoter(result.ticket.promoterCode);
        if (p && p.name) result.promoterName = p.name;
      } catch (e) { /* sin nombre: queda el código */ }
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
