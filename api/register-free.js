const { getCounters, createTicket, sendTicketEmail, qrDataUrl, calcAge, FREE_CAP, findConflictingFreeTicket } = require('../lib/tickets');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const { nombre, apellido, phone, email, tipoDocumento, dni, dob } = req.body || {};
    // Cortesía is one per person — fixed at qty 1, regardless of what the client sends.
    const qty = 1;
    if (!nombre || !apellido || !phone || !email || !tipoDocumento || !dni || !dob) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    if (!['DNI', 'CE', 'Pasaporte'].includes(tipoDocumento)) {
      return res.status(400).json({ error: 'invalid_document' });
    }
    if (!isValidNamePart(nombre) || !isValidNamePart(apellido)) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    if (!isValidDocument(dni, tipoDocumento)) {
      return res.status(400).json({ error: 'invalid_document' });
    }

    const emailCheck = await validateEmail(email);
    if (!emailCheck.ok) {
      return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason });
    }

    const age = calcAge(dob);
    if (age === null || age < 18) {
      return res.status(403).json({ error: 'underage' });
    }

    const name = `${nombre.trim()} ${apellido.trim()}`.trim();

    // Email and document must be unique among active Cortesía tickets — this uniqueness
    // never crosses into paid tickets, which are a separate product.
    const conflict = await findConflictingFreeTicket(email, dni);
    if (conflict) {
      const field = conflict.email.trim().toLowerCase() === email.trim().toLowerCase() ? 'email' : 'dni';
      return res.status(409).json({ error: 'free_already_claimed', field });
    }

    const counters = await getCounters();
    if ((counters.free || 0) + qty > FREE_CAP) return res.status(409).json({ error: 'sold_out' });

    const tickets = [];
    for (let i = 0; i < qty; i++) {
      tickets.push(await createTicket({ name, phone, email, dni, docType: tipoDocumento, dob, type: 'free', amount: 0 }));
    }

    // Send email(s), but don't fail the request if email delivery has an issue —
    // the person still gets their QR(s) on screen either way.
    try {
      await Promise.all(tickets.map((t) => sendTicketEmail(t)));
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    const qrs = await Promise.all(tickets.map((t) => qrDataUrl(t.id)));
    return res.status(200).json({ ticket: tickets[0], qr: qrs[0], tickets, qrs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
