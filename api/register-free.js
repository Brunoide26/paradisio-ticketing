const {
  createTicket, REGISTER_MIN_AGE, calcAge, isCortesiaSoldOut, findConflictingFreeTicket, getClientIp, PROMO_VALIDITY_LABEL,
} = require('../lib/tickets');
const { validateEmail } = require('../lib/email-validation');
const { isValidNamePart, isValidDocument } = require('../lib/identity-validation');
const { FREE_ENTRY } = require('../lib/catalog');
const { resolveActivePromoter } = require('../lib/promoters');
const { checkPortalInvite, FREE_ENTRY_INVITE_ONLY } = require('../lib/promoter-portal');
const { claimInvite, releaseInvite, markInviteUsed } = require('../lib/invites');

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

// Registro de Free Entry. NO entrega QR: el registro queda pendiente
// (type 'promo', pending: true) y el QR se manda desde el admin días antes
// del evento ("Enviar QRs"). Queda atribuido al promotor del link (?ref=).
//
// Con código de invitación (body.code, del portal de promotores): el registro
// queda a nombre del promotor dueño del código y el código se quema (un
// código = una persona). Sin código: sólo si la lista pública está abierta
// (FREE_ENTRY_INVITE_ONLY=false y el control de cortesías del admin abierto).
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const body = req.body || {};
    const nombre = String(body.nombre || '').trim();
    const apellido = String(body.apellido || '').trim();
    const dni = String(body.dni || '').trim().toUpperCase();
    const dob = String(body.dob || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = cleanPhone(body.phone);
    const instagram = cleanInstagram(body.instagram);

    if (!nombre || !apellido || !dni || !dob || !email || !phone || !instagram) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!body.accepted) return res.status(400).json({ error: 'not_accepted' });
    if (!isValidNamePart(nombre) || !isValidNamePart(apellido)) return res.status(400).json({ error: 'invalid_name' });
    if (!isValidDocument(dni)) return res.status(400).json({ error: 'invalid_document' });
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) return res.status(400).json({ error: 'invalid_phone' });
    if (!INSTAGRAM_RE.test(instagram)) return res.status(400).json({ error: 'invalid_instagram' });

    const age = calcAge(dob);
    if (age === null) return res.status(400).json({ error: 'invalid_dob' });
    if (age < REGISTER_MIN_AGE) return res.status(403).json({ error: 'underage' });

    // Código de invitación: se valida antes que nada caro, se quema al final.
    let invite = null;
    if (body.code) {
      invite = await checkPortalInvite(body.code);
      if (!invite.ok) return res.status(409).json({ error: 'code_' + invite.reason });
    } else if (FREE_ENTRY_INVITE_ONLY || await isCortesiaSoldOut()) {
      return res.status(409).json({ error: 'closed' });
    }

    const emailCheck = await validateEmail(email);
    if (!emailCheck.ok) return res.status(400).json({ error: 'invalid_email', reason: emailCheck.reason });

    // Un registro por persona en la fecha (mismo DNI o correo).
    const conflict = await findConflictingFreeTicket(email, dni, 'promo');
    if (conflict) {
      const field = (conflict.email || '').trim().toLowerCase() === email ? 'email' : 'dni';
      return res.status(409).json({ error: 'already_registered', field });
    }

    // Un ref desconocido o inactivo no bloquea: queda sin promotor. Con
    // código, manda el promotor dueño del código.
    const promoter = invite ? invite.promoter : (body.ref ? await resolveActivePromoter(body.ref) : null);

    // Candado: si dos personas usan el mismo código a la vez, sólo pasa una.
    if (invite && !(await claimInvite(invite.code, 'pending'))) {
      return res.status(409).json({ error: 'code_used' });
    }
    try {
      const ticket = await createTicket({
        name: `${nombre} ${apellido}`,
        phone, email, dni, dob,
        docType: /^\d{8}$/.test(dni) ? 'DNI' : 'CE/Pasaporte',
        type: 'promo',
        amount: 0,
        skuLabel: FREE_ENTRY.name,
        promoterCode: promoter ? promoter.code : null,
        instagram,
        inviteCode: invite ? invite.code : null,
        pending: true,
        ip: getClientIp(req),
      });
      if (invite) await markInviteUsed(invite.code, ticket.id);
    } catch (err) {
      if (invite) await releaseInvite(invite.code);
      throw err;
    }

    return res.status(200).json({ ok: true, validityLabel: PROMO_VALIDITY_LABEL });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
