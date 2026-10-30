const { listEventTickets, sendTicketEmail, getOrder } = require('../lib/tickets');

// Envío de los QRs pendientes (Free Entry, entradas pagadas y reservas),
// desde el admin, días antes del evento. Ninguno recibe su QR al registrarse
// o comprar: lo recibe aquí, y eso lo aprueba.
//   { passcode, action: 'status' }           -> cuántos pendientes / enviados
//   { passcode, action: 'send', limit: 8 }   -> envía la próxima tanda
//
// Se manda en tandas chicas porque Resend limita envíos por segundo y una
// función de Vercel tiene tiempo máximo: el admin llama 'send' en bucle
// hasta que 'remaining' llega a 0. Enviar el QR es lo que aprueba el
// registro (sendTicketEmail le quita el pending). Los anulados no se envían:
// para rechazar a alguien antes del envío, se anula su registro.
const QR_TYPES = ['promo', 'paid', 'table'];
function isPending(t) {
  return QR_TYPES.includes(t.type) && t.pending && !t.voided;
}

// Un asistente de una compra que no dejó correo recibe su QR en el correo
// del comprador.
async function destinationOf(t) {
  if (t.email) return null;
  if (t.orderId) {
    const order = await getOrder(t.orderId);
    if (order && order.buyerEmail) return order.buyerEmail;
  }
  throw new Error('Sin correo para enviar el QR');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, action } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) return res.status(401).json({ error: 'unauthorized' });

    const tickets = await listEventTickets();
    const withQr = tickets.filter((t) => QR_TYPES.includes(t.type) && !t.voided);
    const pending = withQr.filter(isPending)
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
          const to = await destinationOf(t);
          await sendTicketEmail(t, to ? { to } : {});
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
      approved: withQr.filter((t) => !t.pending).length,
      total: withQr.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
