const { listEventTickets, sendTicketEmail } = require('../lib/tickets');

// Envío de los QRs del Free Entry, desde el admin, días antes del evento.
//   { passcode, action: 'status' }           -> cuántos pendientes / enviados
//   { passcode, action: 'send', limit: 8 }   -> envía la próxima tanda
//
// Se manda en tandas chicas porque Resend limita envíos por segundo y una
// función de Vercel tiene tiempo máximo: el admin llama 'send' en bucle
// hasta que 'remaining' llega a 0. Enviar el QR es lo que aprueba el
// registro (sendTicketEmail le quita el pending). Los anulados no se envían:
// para rechazar a alguien antes del envío, se anula su registro.
function isPendingFree(t) {
  return t.type === 'promo' && t.pending && !t.voided;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, action } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) return res.status(401).json({ error: 'unauthorized' });

    const tickets = await listEventTickets();
    const freeEntries = tickets.filter((t) => t.type === 'promo' && !t.voided);
    const pending = freeEntries.filter(isPendingFree)
      // Primero los que se registraron antes.
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (action === 'send') {
      const limit = Math.max(1, Math.min(15, parseInt(req.body.limit, 10) || 8));
      // Los que ya fallaron en esta misma corrida se saltan con skip para no
      // quedar en bucle sobre un correo que rebota.
      const skip = new Set(Array.isArray(req.body.skip) ? req.body.skip : []);
      const batch = pending.filter((t) => !skip.has(t.id)).slice(0, limit);
      const failed = [];
      let sent = 0;
      for (const t of batch) {
        try {
          await sendTicketEmail(t);
          sent++;
        } catch (err) {
          failed.push({ id: t.id, email: t.email, reason: String(err.message || err).slice(0, 200) });
        }
      }
      const remaining = pending.filter((t) => !skip.has(t.id)).length - batch.length;
      return res.status(200).json({ ok: true, sent, failed, remaining: Math.max(0, remaining) });
    }

    return res.status(200).json({
      ok: true,
      pending: pending.length,
      approved: freeEntries.filter((t) => !t.pending).length,
      total: freeEntries.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
