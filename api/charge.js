const { getCounters, createTicket, reserveOrderIdentity, createOrder, sendTicketEmail, sendOrderEmail, calcAge, PAID_CAP, getClientIp } = require('../lib/tickets');
const { PAYMENTS_ENABLED } = require('../lib/config');
const { findPaidSku } = require('../lib/catalog');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');

const TIPO_DOCUMENTO = ['DNI', 'CE', 'Pasaporte'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!PAYMENTS_ENABLED) return res.status(403).json({ error: 'payments_disabled' });

  try {
    const { token, sku: skuId, assistants } = req.body || {};

    // Price and headcount are always read from the current window's catalog,
    // never from the client — a stale/forged sku id (wrong window, wrong price)
    // simply fails to resolve here.
    const sku = findPaidSku(skuId);
    if (!sku) return res.status(403).json({ error: 'sales_closed' });
    const qty = sku.qty;

    if (!token || !Array.isArray(assistants) || assistants.length !== qty) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const cleaned = assistants.map((a) => ({
      nombre: (a?.nombre || '').trim(),
      apellido: (a?.apellido || '').trim(),
      tipoDocumento: a?.tipoDocumento,
      numeroDocumento: (a?.numeroDocumento || '').trim(),
      dob: a?.dob || '',
      email: (a?.email || '').trim(),
    }));

    for (let i = 0; i < cleaned.length; i++) {
      const a = cleaned[i];
      if (!a.nombre || !a.apellido || !TIPO_DOCUMENTO.includes(a.tipoDocumento) || !a.numeroDocumento || !a.dob) {
        return res.status(400).json({ error: 'missing_fields', index: i });
      }
      if (!isValidNamePart(a.nombre) || !isValidNamePart(a.apellido)) {
        return res.status(400).json({ error: 'invalid_name', index: i });
      }
      if (!isValidDocument(a.numeroDocumento, a.tipoDocumento)) {
        return res.status(400).json({ error: 'invalid_document', index: i });
      }
      if (i === 0 && !a.email) {
        return res.status(400).json({ error: 'missing_buyer_email' });
      }
      if (a.email) {
        const emailCheck = await validateEmail(a.email);
        if (!emailCheck.ok) {
          return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason, index: i });
        }
      }
      const age = calcAge(a.dob);
      if (age === null || age < 18) {
        return res.status(403).json({ error: 'underage', index: i });
      }
    }

    const docKeys = cleaned.map((a) => a.numeroDocumento.trim().toLowerCase());
    const hasDuplicateDoc = new Set(docKeys).size !== docKeys.length;
    if (hasDuplicateDoc) {
      return res.status(400).json({ error: 'duplicate_document' });
    }

    const buyer = cleaned[0];

    const counters = await getCounters();
    if ((counters.paid || 0) + qty > PAID_CAP) return res.status(409).json({ error: 'sold_out' });

    const skuLabel = `${sku.tier} ${sku.name}`;

    // Charge the card server-side ONCE for the full bundle amount, using the Culqi
    // secret key — a Culqi token is single-use, so multi-ticket orders must be one
    // charge, not one per ticket. Culqi amounts are in cents ("céntimos").
    const culqiRes = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.CULQI_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: sku.price * 100,
        currency_code: 'PEN',
        email: buyer.email,
        source_id: token,
        description: `Paradisio - Entrada ${skuLabel}`,
      }),
    });

    const culqiData = await culqiRes.json();

    if (!culqiRes.ok) {
      console.error('Culqi charge failed:', culqiData);
      return res.status(402).json({ error: 'payment_failed', detail: culqiData.user_message || culqiData.merchant_message });
    }

    // Payment succeeded -> issue one nominal ticket per assistant, grouped under one order.
    const { id: orderId, token: orderToken } = reserveOrderIdentity();
    const ip = getClientIp(req);
    const tickets = [];
    for (const a of cleaned) {
      const t = await createTicket({
        name: `${a.nombre} ${a.apellido}`.trim(),
        email: a.email,
        dni: a.numeroDocumento,
        docType: a.tipoDocumento,
        dob: a.dob,
        type: 'paid',
        amount: sku.price,
        skuLabel,
        orderId,
        ip,
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
      amount: sku.price,
      qty,
      skuLabel,
    });

    try {
      await Promise.all([
        ...tickets.filter((t) => t.email).map((t) => sendTicketEmail(t)),
        sendOrderEmail(order, tickets),
      ]);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    return res.status(200).json({ order, tickets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
