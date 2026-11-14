const { listEventTickets, getOrder, voidTicket, sendRejectEmail, buildRejectEmailHtml, REJECT_SUBJECT } = require('../lib/tickets');

// Rechazo de registros desde el admin (casillas). SOLO a los ids elegidos.
//   { passcode, action: 'preview' }                -> HTML del correo (ejemplo)
//   { passcode, action: 'send', ids: [...], limit } -> próxima tanda de esos ids
//
// Por cada persona, en este orden:
//   1) se ANULA su registro (el QR deja de servir en la puerta);
//   2) se le envía el correo de rechazo, UNA sola vez (llave reject_sent:ID
//      en Redis, tomada antes de enviar; ver sendRejectEmail).
// Si el correo falla, igual queda anulada (lo importante es que no entre) y
// se puede reintentar: el admin la vuelve a marcar.
// Sin ids no hace nada: no existe "rechazar a todos".
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { passcode, action } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) return res.status(401).json({ error: 'unauthorized' });

    if (action === 'preview') {
      return res.status(200).json({ ok: true, subject: REJECT_SUBJECT, html: buildRejectEmailHtml({ name: 'Nombre Apellido' }, {}) });
    }
    if (action !== 'send') return res.status(400).json({ error: 'bad_action' });

    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter((x) => typeof x === 'string') : [];
    if (!ids.length) return res.status(400).json({ error: 'no_ids' });
    if (ids.length > 300) return res.status(400).json({ error: 'too_many' });
    const only = new Set(ids);
    const skip = new Set(Array.isArray(req.body.skip) ? req.body.skip : []);
    const limit = Math.max(1, Math.min(10, parseInt(req.body.limit, 10) || 8));

    const tickets = await listEventTickets();
    // Quedan por procesar: elegidos, sin rechazo enviado y no saltados.
    const todo = tickets
      .filter((t) => only.has(t.id) && !t.rejectSentAt && !skip.has(t.id))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const batch = todo.slice(0, limit);

    const sentIds = [];
    const already = [];
    const failed = [];
    let voided = 0;
    for (const t of batch) {
      try {
        if (!t.voided) { await voidTicket(t.id); voided++; }
        let to = t.email;
        if (!to && t.orderId) { const o = await getOrder(t.orderId); to = o && o.buyerEmail; }
        if (!to) throw new Error('Sin correo');
        const r = await sendRejectEmail(t, { to });
        if (r.sent) sentIds.push(t.id); else already.push(t.id);
      } catch (err) {
        failed.push({ id: t.id, email: t.email, reason: String(err.message || err).slice(0, 200) });
      }
    }
    return res.status(200).json({
      ok: true, sent: sentIds.length, sentIds, already, failed, voided,
      remaining: Math.max(0, todo.length - batch.length),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
