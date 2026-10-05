const {
  createTicket, sendTicketEmail, qrDataUrl, calcAge, findConflictingFreeTicket, getClientIp,
  EVENT_NAME, EVENT_DATE_LABEL, EVENT_ADDRESS, EVENT_MAPS_URL, ticketTypeLabel, ticketValidityLabel, genTicketId,
} = require('../lib/tickets');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');
const { cleanCode, getInvite, claimInvite, releaseInvite, markInviteUsed } = require('../lib/invites');
const { CURRENT_EVENT_ID, eventIdOfInvite } = require('../lib/events');

// "@usuario", "usuario", "instagram.com/usuario/" -> "usuario"
function cleanInstagram(raw) {
  let v = String(raw || '').trim();
  v = v.replace(/^https?:\/\//i, '').replace(/^(www\.)?instagram\.com\//i, '');
  v = v.split(/[/?#]/)[0].replace(/^@+/, '');
  return v.toLowerCase();
}
const INSTAGRAM_RE = /^[a-z0-9._]{1,30}$/;

function cleanPhone(raw) {
  return String(raw || '').replace(/[^\d+]/g, '');
}

// Canje de un código de promotor por una entrada (type 'promo').
// Orden: validar todo lo barato primero, después el código, y recién al final
// reservar el código con un candado atómico -- así un formulario mal llenado
// nunca quema un código.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const code = cleanCode(body.code);
    const nombre = String(body.nombre || '').trim();
    const apellido = String(body.apellido || '').trim();
    const dni = String(body.dni || '').trim().toUpperCase();
    const dob = String(body.dob || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = cleanPhone(body.phone);
    const instagram = cleanInstagram(body.instagram);

    if (!code) return res.status(400).json({ error: 'missing_code' });
    if (!nombre || !apellido || !dni || !dob || !email || !phone || !instagram) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!body.accepted) return res.status(400).json({ error: 'not_accepted' });
    if (!isValidNamePart(nombre) || !isValidNamePart(apellido)) {
      return res.status(400).json({ error: 'invalid_name' });
    }
    // DNI (8 dígitos) o, para extranjeros, CE/pasaporte (8-12 alfanuméricos).
    if (!isValidDocument(dni)) return res.status(400).json({ error: 'invalid_document' });
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'invalid_phone' });
    if (!INSTAGRAM_RE.test(instagram)) return res.status(400).json({ error: 'invalid_instagram' });

    const age = calcAge(dob);
    if (age === null) return res.status(400).json({ error: 'invalid_dob' });
    if (age < 18) return res.status(403).json({ error: 'underage' });

    const emailCheck = await validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason });

    const invite = await getInvite(code);
    if (!invite) return res.status(404).json({ error: 'code_not_found' });
    if (invite.revoked) return res.status(410).json({ error: 'code_revoked' });
    if (invite.ticketId) return res.status(409).json({ error: 'code_used' });
    if (eventIdOfInvite(invite) !== CURRENT_EVENT_ID) return res.status(410).json({ error: 'code_revoked' });

    // Una entrada por persona: el mismo DNI o correo no puede juntar varios
    // códigos. Se compara sólo contra invitaciones vigentes.
    const conflict = await findConflictingFreeTicket(email, dni, 'promo');
    if (conflict) {
      const field = (conflict.email || '').trim().toLowerCase() === email ? 'email' : 'dni';
      return res.status(409).json({ error: 'already_has_ticket', field });
    }

    // Candado: sólo el primer canje de este código pasa de aquí.
    const placeholder = 'pending-' + genTicketId();
    if (!(await claimInvite(code, placeholder))) {
      return res.status(409).json({ error: 'code_used' });
    }

    let ticket;
    try {
      ticket = await createTicket({
        name: `${nombre} ${apellido}`,
        phone, email, dni, dob,
        docType: /^\d{8}$/.test(dni) ? 'DNI' : 'CE/Pasaporte',
        type: 'promo',
        amount: 0,
        skuLabel: 'Invitación',
        promoterCode: invite.promoterCode || null,
        instagram,
        inviteCode: code,
        ip: getClientIp(req),
      });
      await markInviteUsed(code, ticket.id);
    } catch (err) {
      await releaseInvite(code);
      throw err;
    }

    try {
      await sendTicketEmail(ticket);
    } catch (emailErr) {
      console.error('Email send failed:', emailErr);
    }

    const qr = await qrDataUrl(ticket.id);
    return res.status(200).json({
      ticket: {
        id: ticket.id, name: ticket.name, token: ticket.token,
        tierLabel: ticketTypeLabel(ticket), validityLabel: ticketValidityLabel(ticket),
      },
      qr,
      event: { name: EVENT_NAME, dateLabel: EVENT_DATE_LABEL, address: EVENT_ADDRESS, mapsUrl: EVENT_MAPS_URL },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
