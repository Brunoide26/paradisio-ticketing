const { listAllTickets } = require('../lib/tickets');
const { listPromoters, addPromoter, removePromoter } = require('../lib/promoters');
const { setInviteRevoked } = require('../lib/invites');
const { addQuota, resetPassword, createMissingLogins, adminPortalStats, DEFAULT_QUOTA, INVITE_DEADLINE } = require('../lib/promoter-portal');
const { listInvites } = require('../lib/invites');
const { CURRENT_EVENT_ID, eventIdOfTicket, eventIdOfInvite } = require('../lib/events');

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

    // Agregar un promotor nuevo desde el admin (queda activo y listo para
    // recibir códigos, sin redeploy).
    // Agregar devuelve también su usuario y clave del portal (se ven una vez).
    if (req.method === 'POST' && (req.body || {}).action === 'add') {
      const result = await addPromoter(req.body.name);
      if (!result.ok) return res.status(400).json({ error: result.reason });
      const access = await resetPassword(result.promoter.code);
      return res.status(200).json({ ok: true, promoter: result.promoter, access: access.ok ? access : null });
    }

    // Portal de promotores: sumar cupo de códigos, crear accesos, nueva clave.
    const action = req.method === 'POST' ? (req.body || {}).action : null;
    if (action === 'quota') {
      const r = await addQuota(req.body.code, req.body.add);
      if (!r.ok) return res.status(400).json({ error: r.reason });
      return res.status(200).json(r);
    }
    if (action === 'create-logins') {
      return res.status(200).json({ ok: true, created: await createMissingLogins() });
    }
    if (action === 'reset-password') {
      const r = await resetPassword(req.body.code);
      if (!r.ok) return res.status(404).json({ error: r.reason });
      return res.status(200).json({ ok: true, access: r });
    }

    // Todo por fecha: sólo los tickets y códigos del evento pedido (por
    // defecto, el vigente).
    // Eliminar un promotor: desaparece de la lista y sus códigos sin usar se
    // revocan (no se pueden canjear). Las entradas que ya sacaron sus
    // invitados siguen válidas y atribuidas a él.
    if (req.method === 'POST' && (req.body || {}).action === 'remove') {
      const result = await removePromoter(req.body.code);
      if (!result.ok) return res.status(404).json({ error: result.reason });
      const pending = (await listInvites()).filter((i) => i.promoterCode === result.code && !i.ticketId && !i.revoked);
      for (const i of pending) await setInviteRevoked(i.code, true);
      return res.status(200).json({ ok: true, code: result.code, revokedCodes: pending.length });
    }

    const eventId = (req.body && req.body.eventId) || (req.query && req.query.eventId) || CURRENT_EVENT_ID;
    const [allT, allP, allI] = await Promise.all([listAllTickets(), listPromoters({ includeRemoved: true }), listInvites()]);
    const tickets = allT.filter((t) => eventIdOfTicket(t) === eventId);
    const invites = allI.filter((i) => eventIdOfInvite(i) === eventId);
    // Un eliminado sólo se muestra si tuvo movimiento en la fecha consultada.
    const promoters = allP.filter((p) => !p.removed
      || tickets.some((t) => t.promoterCode === p.code) || invites.some((i) => i.promoterCode === p.code));

    const portal = await Promise.all(promoters.map((p) => adminPortalStats(p.code, eventId)));
    const stats = promoters.map((p, idx) => {
      const own = tickets.filter((t) => t.promoterCode === p.code && !t.voided);
      const cortesias = own.filter((t) => t.type === 'free').length;
      const pagadas = own.filter((t) => t.type === 'paid').length;
      const invitaciones = own.filter((t) => t.type === 'promo').length;
      const pendientes = own.filter((t) => t.type === 'promo' && t.pending).length;
      const mesas = own.filter((t) => t.type === 'table').length;
      const personas = cortesias + pagadas + invitaciones;
      const ownCodes = invites.filter((i) => i.promoterCode === p.code && !i.revoked);
      const codigos = ownCodes.length;
      const codigosLibres = ownCodes.filter((i) => !i.ticketId).length;
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
      // Las entradas pagadas guardan su propio monto (una por asistente); las
      // órdenes viejas (28/08) guardaban el total de la orden en cada ticket,
      // de ahí la deduplicación por orden de arriba para esas.
      const ingresoEntradas = own.some((t) => t.type === 'paid' && t.sku)
        ? own.filter((t) => t.type === 'paid').reduce((sum, t) => sum + (t.amount || 0), 0)
        : [...paidOrderAmounts.values()].reduce((sum, a) => sum + a, 0);
      const ingresoMesas = own.filter((t) => t.type === 'table').reduce((sum, t) => sum + (t.amount || 0), 0);
      const ingreso = Math.round((ingresoEntradas + ingresoMesas) * 100) / 100;
      // Todo el que cruzó la puerta cuenta como ingreso, haya llegado a tiempo
      // o después del corte. Los tardíos se separan en cobrados y gratis
      // según lo que marcó el staff en el scanner.
      const ingresaron = own.filter((t) => t.checkedIn).length;
      const late = own.filter((t) => t.checkedIn && t.lateEntry);
      const tardeCobrado = late.filter((t) => t.lateCharged).length;
      const tardeGratis = late.length - tardeCobrado;
      const aTiempo = ingresaron - late.length;
      const conversion = personas > 0 ? Math.round((ingresaron / personas) * 1000) / 10 : 0;
      return {
        code: p.code, name: p.name, active: p.active,
        cortesias, pagadas, invitaciones, pendientes, mesas, codigos, codigosLibres, personas, ingreso, ingresaron, conversion,
        aTiempo, tardeCobrado, tardeGratis, custom: !!p.custom, removed: !!p.removed,
        // Portal: cupo y códigos de la fecha. registrados/aprobados/entraronCodigo
        // cuentan sólo lo que entró con sus códigos.
        ...portal[idx],
      };
    });

    return res.status(200).json({ promoters: stats, eventId, defaultQuota: DEFAULT_QUOTA, inviteDeadline: INVITE_DEADLINE.toISOString() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
