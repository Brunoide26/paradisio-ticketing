// Códigos de invitación de un solo uso. Cada promotor recibe un lote de
// códigos random (generados desde el admin) y le pasa UNO a cada invitado;
// el invitado lo canjea en la página principal por su QR. El código queda
// quemado al primer canje y la entrada queda atribuida al promotor dueño
// del código.
//
// Llaves en Redis:
//   invite:{CODE}        -> { code, promoterCode, createdAt, usedAt, ticketId, revoked }
//   invite_codes         -> set con todos los códigos (para listarlos en admin)
//   invite_claim:{CODE}  -> ticketId, escrito con NX: es el candado que hace
//                           que dos personas canjeando el mismo código al mismo
//                           tiempo no puedan sacar dos QRs.
const crypto = require('crypto');
const { redis } = require('./tickets');
const { normalizeCode } = require('./promoters');
const { CURRENT_EVENT_ID, eventIdOfInvite } = require('./events');

// Sin 0/O, 1/I/L: se dictan por WhatsApp y se escriben a mano en el celular.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_BATCH = 500;

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

// Acepta lo que la gente escribe de verdad: minúsculas, espacios, guiones.
// El alfabeto no tiene O, 0, I, 1 ni L, así que no hay letras ambiguas que
// resolver: sólo mayúsculas y sin separadores.
function cleanCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

async function getInvite(raw) {
  const code = cleanCode(raw);
  if (!code) return null;
  return await redis.get('invite:' + code);
}

// Estado público de un código, sin exponer a quién pertenece ni quién lo usó.
async function checkInvite(raw) {
  const invite = await getInvite(raw);
  if (!invite) return { ok: false, reason: 'not_found' };
  if (invite.revoked) return { ok: false, reason: 'revoked' };
  if (invite.ticketId) return { ok: false, reason: 'used' };
  // Los códigos son por fecha: uno sobrante de una fecha pasada ya no sirve.
  if (eventIdOfInvite(invite) !== CURRENT_EVENT_ID) return { ok: false, reason: 'expired' };
  return { ok: true, code: invite.code };
}

async function generateInvites(promoterCode, count) {
  const promoter = normalizeCode(promoterCode);
  const n = Math.max(1, Math.min(MAX_BATCH, parseInt(count, 10) || 0));
  const created = [];
  let attempts = 0;
  while (created.length < n && attempts < n * 5) {
    attempts++;
    const code = randomCode();
    const invite = { code, eventId: CURRENT_EVENT_ID, promoterCode: promoter, createdAt: new Date().toISOString(), usedAt: null, ticketId: null, revoked: false };
    // NX: si por azar el código ya existe, no se pisa; se genera otro.
    const res = await redis.set('invite:' + code, invite, { nx: true });
    if (res !== 'OK') continue;
    await redis.sadd('invite_codes', code);
    created.push(invite);
  }
  return created;
}

// Reserva atómica del código. Devuelve true sólo para el primer canje.
async function claimInvite(code, ticketId) {
  const res = await redis.set('invite_claim:' + code, ticketId, { nx: true });
  return res === 'OK';
}

// Si la creación del ticket falla después de reservar, se libera el candado
// para que la persona pueda volver a intentar con el mismo código.
async function releaseInvite(code) {
  await redis.del('invite_claim:' + code);
}

async function markInviteUsed(code, ticketId) {
  const invite = await redis.get('invite:' + code);
  if (!invite) return;
  invite.ticketId = ticketId;
  invite.usedAt = new Date().toISOString();
  await redis.set('invite:' + code, invite);
}

async function setInviteRevoked(raw, revoked) {
  const code = cleanCode(raw);
  const invite = await redis.get('invite:' + code);
  if (!invite) return { ok: false, reason: 'not_found' };
  invite.revoked = !!revoked;
  await redis.set('invite:' + code, invite);
  return { ok: true, invite };
}

async function listInvites() {
  const codes = await redis.smembers('invite_codes');
  if (!codes || codes.length === 0) return [];
  const invites = [];
  // mget en tandas para no armar un request gigante si hay miles de códigos.
  for (let i = 0; i < codes.length; i += 200) {
    const chunk = codes.slice(i, i + 200);
    const rows = await redis.mget(...chunk.map((c) => 'invite:' + c));
    rows.forEach((r) => { if (r) invites.push(r); });
  }
  invites.forEach((i) => { i.eventId = eventIdOfInvite(i); });
  return invites.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  ALPHABET, CODE_LENGTH, MAX_BATCH,
  cleanCode, getInvite, checkInvite, generateInvites, claimInvite, releaseInvite, markInviteUsed, setInviteRevoked, listInvites,
};
