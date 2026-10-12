const {
  createTicket, reserveOrderIdentity, createOrder, sendTicketEmail, sendOrderEmail, calcAge, PAID_CAP,
  getClientIp, qrDataUrl, listEventTickets, EVENT_DATE_LABEL,
} = require('../lib/tickets');
const { PAYMENTS_ENABLED } = require('../lib/config');
const { findTicketType, MAX_TICKETS_PER_ORDER } = require('../lib/catalog');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');
const { resolveActivePromoter, applyDiscount } = require('../lib/promoters');

const TIPO_DOCUMENTO = ['DNI', 'CE', 'Pasaporte'];

// Compra de entradas pagadas. Un carrito puede mezclar tipos (p. ej. 2 Early
// + 1 General); cada entrada es nominal (un asistente por entrada) y todo se
// cobra en UN solo cargo de Culqi. Precio y cupos salen siempre del catálogo
// del servidor, nunca del navegador.
//
// body: { token, items: [{ sku, qty }], assistants: [{ sku, nombre, apellido,
//         tipoDocumento, numeroDocumento, dob, email }], ref }
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!PAYMENTS_ENABLED) return res.status(403).json({ error: 'payments_disabled' });

  try {
    const { token, items, assistants, ref } = req.body || {};
    if (!token || !Array.isArray(items) || !Array.isArray(assistants)) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    // Resolver el carrito contra el catálogo vigente.
    const lines = [];
    for (const it of items) {
      const type = findTicketType(it && it.sku);
      const qty = parseInt(it && it.qty, 10);
      if (!type) return res.status(403).json({ error: 'sales_closed', sku: it && it.sku });
      if (!qty || qty < 1) return res.status(400).json({ error: 'invalid_qty' });
      lines.push({ type, qty });
    }
    const totalQty = lines.reduce((s, l) => s + l.qty, 0);
    if (!totalQty || totalQty > MAX_TICKETS_PER_ORDER) return res.status(400).json({ error: 'invalid_qty' });
    if (assistants.length !== totalQty) return res.status(400).json({ error: 'missing_fields' });

    // Cada asistente debe pertenecer a una línea, en la cantidad exacta.
    const perSku = new Map(lines.map((l) => [l.type.sku, l.qty]));
    for (const a of assistants) {
      const left = perSku.get(a && a.sku);
      if (!left) return res.status(400).json({ error: 'missing_fields' });
      perSku.set(a.sku, left - 1);
    }

    const cleaned = assistants.map((a) => ({
      sku: a.sku,
      nombre: String(a.nombre || '').trim(),
      apellido: String(a.apellido || '').trim(),
      tipoDocumento: a.tipoDocumento,
      numeroDocumento: String(a.numeroDocumento || '').trim().toUpperCase(),
      dob: String(a.dob || ''),
      email: String(a.email || '').trim().toLowerCase(),
      phone: String(a.phone || '').replace(/[^\d+]/g, ''),
    }));

    for (let i = 0; i < cleaned.length; i++) {
      const a = cleaned[i];
      if (!a.nombre || !a.apellido || !TIPO_DOCUMENTO.includes(a.tipoDocumento) || !a.numeroDocumento || !a.dob) {
        return res.status(400).json({ error: 'missing_fields', index: i });
      }
      if (!isValidNamePart(a.nombre) || !isValidNamePart(a.apellido)) return res.status(400).json({ error: 'invalid_name', index: i });
      if (!isValidDocument(a.numeroDocumento, a.tipoDocumento)) return res.status(400).json({ error: 'invalid_document', index: i });
      if (i === 0 && !a.email) return res.status(400).json({ error: 'missing_buyer_email' });
      if (i === 0) {
        const digits = a.phone.replace(/\D/g, '');
        if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'invalid_phone', index: 0 });
      }
      if (a.email) {
        const emailCheck = await validateEmail(a.email);
        if (!emailCheck.ok) return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason, index: i });
      }
      const age = calcAge(a.dob);
      if (age === null || age < 18) return res.status(403).json({ error: 'underage', index: i });
    }
    const docKeys = cleaned.map((a) => a.numeroDocumento.toLowerCase());
    if (new Set(docKeys).size !== docKeys.length) return res.status(400).json({ error: 'duplicate_document' });

    // Cupos: global de pagadas de la fecha y, si el tipo tiene, su propio cupo.
    const sold = (await listEventTickets()).filter((t) => t.type === 'paid' && !t.voided);
    if (sold.length + totalQty > PAID_CAP) return res.status(409).json({ error: 'sold_out' });
    for (const l of lines) {
      if (l.type.cap != null) {
        const soldOfType = sold.filter((t) => t.sku === l.type.sku).length;
        if (soldOfType + l.qty > l.type.cap) return res.status(409).json({ error: 'sold_out', sku: l.type.sku });
      }
    }

    const subtotalSoles = lines.reduce((s, l) => s + l.type.price * l.qty, 0);
    const promoter = ref ? await resolveActivePromoter(ref) : null;
    const { subtotalCents, discountCents, totalCents } = applyDiscount(subtotalSoles);
    const chargeCents = promoter ? totalCents : subtotalCents;
    const appliedDiscountCents = promoter ? discountCents : 0;

    const buyer = cleaned[0];
    const skuLabel = lines.map((l) => (l.qty > 1 ? `${l.type.name} ×${l.qty}` : l.type.name)).join(' · ');

    const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}` },
      body: JSON.stringify({
        amount: chargeCents,
        currency_code: 'PEN',
        email: buyer.email,
        source_id: token,
        description: `Paradisio - ${skuLabel}`.slice(0, 80),
      }),
    });
    const culqiData = await culqiRes.json();
    if (!culqiRes.ok) {
      console.error('Culqi charge failed:', culqiData);
      return res.status(402).json({ error: 'payment_failed', detail: culqiData.user_message || culqiData.merchant_message });
    }

    // Monto por entrada = su precio menos su parte del descuento.
    const factor = subtotalCents ? chargeCents / subtotalCents : 1;
    const priceOf = (sku) => Math.round(lines.find((l) => l.type.sku === sku).type.price * factor * 100) / 100;

    const { id: orderId, token: orderToken } = reserveOrderIdentity();
    const ip = getClientIp(req);
    const tickets = [];
    for (const a of cleaned) {
      const type = lines.find((l) => l.type.sku === a.sku).type;
      const t = await createTicket({
        name: `${a.nombre} ${a.apellido}`.trim(),
        email: a.email,
        phone: a === buyer ? a.phone : '',
        dni: a.numeroDocumento,
        docType: a.tipoDocumento,
        dob: a.dob,
        type: 'paid',
        amount: priceOf(a.sku),
        sku: type.sku,
        skuLabel: type.name,
        orderId,
        ip,
        promoterCode: promoter ? promoter.code : null,
      });
      t.culqiChargeId = culqiData.id;
      tickets.push(t);
    }

    const order = await createOrder({
      id: orderId,
      token: orderToken,
      buyerName: `${buyer.nombre} ${buyer.apellido}`.trim(),
      buyerEmail: buyer.email,
      ticketIds: tickets.map((t) => t.id),
      amount: chargeCents / 100,
      qty: totalQty,
      skuLabel,
      promoterCode: promoter ? promoter.code : null,
      subtotal: subtotalSoles,
      discountAmount: appliedDiscountCents / 100,
    });

    try {
      await Promise.all([
        ...tickets.filter((t) => t.email).map((t) => sendTicketEmail(t)),
        tickets.length > 1 ? sendOrderEmail(order, tickets) : Promise.resolve(),
      ]);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    const ticketsWithQr = await Promise.all(tickets.map(async (t) => ({
      id: t.id, name: t.name, token: t.token, skuLabel: t.skuLabel, qr: await qrDataUrl(t.id),
    })));
    return res.status(200).json({
      order: { id: order.id, token: order.token, amount: order.amount, qty: order.qty },
      tickets: ticketsWithQr,
      eventDateLabel: EVENT_DATE_LABEL,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
