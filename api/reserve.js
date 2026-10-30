const {
  createTicket, MIN_AGE, sendPurchaseReceiptEmail, calcAge, getClientIp, claimTable, releaseTable, tableKey, redis, EVENT_DATE_LABEL,
} = require('../lib/tickets');
const { PAYMENTS_ENABLED } = require('../lib/config');
const { findTableUnit, isSalesOpen } = require('../lib/catalog');
const { CURRENT_EVENT_ID } = require('../lib/events');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');
const { resolveActivePromoter, applyDiscount } = require('../lib/promoters');

const TIPO_DOCUMENTO = ['DNI', 'CE', 'Pasaporte'];

// Reserva de una mesa o box del mapa. Orden de operaciones:
//   1. validar todo lo barato,
//   2. tomar la mesa con un candado atómico (NX): si dos personas pagan la
//      misma mesa a la vez, sólo una pasa de aquí y a la otra no se le cobra,
//   3. cobrar en Culqi; si el cobro falla se libera la mesa,
//   4. emitir UN QR a nombre del titular, válido para todo su grupo.
//
// body: { token, unitId, holder: { nombre, apellido, tipoDocumento,
//         numeroDocumento, dob, email, phone }, ref }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!PAYMENTS_ENABLED || !isSalesOpen()) return res.status(403).json({ error: 'sales_closed' });

  try {
    const { token, unitId, holder, ref } = req.body || {};
    const unit = findTableUnit(unitId);
    if (!unit) return res.status(400).json({ error: 'invalid_table' });
    if (!token || !holder) return res.status(400).json({ error: 'missing_fields' });

    const h = {
      nombre: String(holder.nombre || '').trim(),
      apellido: String(holder.apellido || '').trim(),
      tipoDocumento: holder.tipoDocumento,
      numeroDocumento: String(holder.numeroDocumento || '').trim().toUpperCase(),
      dob: String(holder.dob || ''),
      email: String(holder.email || '').trim().toLowerCase(),
      phone: String(holder.phone || '').replace(/[^\d+]/g, ''),
    };
    if (!h.nombre || !h.apellido || !TIPO_DOCUMENTO.includes(h.tipoDocumento) || !h.numeroDocumento || !h.dob || !h.email || !h.phone) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!isValidNamePart(h.nombre) || !isValidNamePart(h.apellido)) return res.status(400).json({ error: 'invalid_name' });
    if (!isValidDocument(h.numeroDocumento, h.tipoDocumento)) return res.status(400).json({ error: 'invalid_document' });
    const digits = h.phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'invalid_phone' });
    const age = calcAge(h.dob);
    if (age === null || age < MIN_AGE) return res.status(403).json({ error: 'underage' });
    const emailCheck = await validateEmail(h.email);
    if (!emailCheck.ok) return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason });

    const promoter = ref ? await resolveActivePromoter(ref) : null;
    const { subtotalCents, totalCents } = applyDiscount(unit.typeInfo.price);
    const chargeCents = promoter ? totalCents : subtotalCents;

    // Candado: la mesa queda tomada ANTES de cobrar.
    const holdId = 'hold-' + Date.now();
    if (!(await claimTable(CURRENT_EVENT_ID, unit.id, holdId))) {
      return res.status(409).json({ error: 'table_taken' });
    }

    let culqiData;
    try {
      const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}` },
        body: JSON.stringify({
          amount: chargeCents,
          currency_code: 'PEN',
          email: h.email,
          source_id: token,
          description: `Paradisio - ${unit.typeInfo.name} ${unit.label || unit.id}`.slice(0, 80),
        }),
      });
      culqiData = await culqiRes.json();
      if (!culqiRes.ok) {
        await releaseTable(CURRENT_EVENT_ID, unit.id);
        console.error('Culqi charge failed:', culqiData);
        return res.status(402).json({ error: 'payment_failed', detail: culqiData.user_message || culqiData.merchant_message });
      }
    } catch (err) {
      await releaseTable(CURRENT_EVENT_ID, unit.id);
      throw err;
    }

    // Cobrado: de aquí en adelante la mesa NO se libera aunque algo falle
    // (el admin la ve y la resuelve a mano).
    const ticket = await createTicket({
      name: `${h.nombre} ${h.apellido}`,
      email: h.email,
      phone: h.phone,
      dni: h.numeroDocumento,
      docType: h.tipoDocumento,
      dob: h.dob,
      type: 'table',
      amount: chargeCents / 100,
      sku: unit.typeInfo.type,
      skuLabel: `${unit.typeInfo.name} · ${unit.label || unit.id} · ${unit.typeInfo.people} personas`,
      unitId: unit.id,
      partySize: unit.typeInfo.people,
      promoterCode: promoter ? promoter.code : null,
      ip: getClientIp(req),
      // Sin QR al toque: se envía días antes del evento, previa aprobación.
      pending: true,
    });
    ticket.culqiChargeId = culqiData.id;
    await redis.set('ticket:' + ticket.id, ticket);
    await redis.set(tableKey(CURRENT_EVENT_ID, unit.id), ticket.id);

    let emailSent = true;
    try {
      await sendPurchaseReceiptEmail({
        to: h.email, name: h.nombre,
        lines: [{ label: ticket.skuLabel, amount: unit.typeInfo.price }]
          .concat(chargeCents < subtotalCents ? [{ label: 'Descuento de promotor', amount: (chargeCents - subtotalCents) / 100 }] : []),
        total: chargeCents / 100,
        isTable: true,
      });
    } catch (emailErr) {
      emailSent = false;
      console.error('Receipt email failed:', emailErr);
    }

    return res.status(200).json({
      ticket: { name: ticket.name, skuLabel: ticket.skuLabel, partySize: ticket.partySize },
      pending: true,
      emailSent,
      eventDateLabel: EVENT_DATE_LABEL,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
