// Portal de promotores (paradisioclub.com/promotor).
//
// Cada promotor entra con usuario y contraseña y genera sus propios códigos
// de invitación, uno por invitado, hasta su cupo de la fecha (80 por defecto;
// el admin lo sube). El invitado abre el link del código, se registra con
// todos sus datos y queda PENDIENTE: el QR sale cuando el admin lo aprueba
// ("Enviar QRs pendientes"). El promotor ve sus códigos, quién se registró
// con cada uno y si ya se le mandó el QR; nunca ve DNI, correo ni celular,
// ni si su invitado entró (eso sólo lo ve el admin).
//
// Llaves en Redis:
//   promoter_login:{CODE}                 -> { salt, hash, createdAt }
//   promoter_session:{token}              -> { code, at }   (expira en 30 días)
//   promoter_login_fail:{CODE}            -> intentos fallidos (expira en 15 min)
//   promoter_quota:{eventId}:{CODE}       -> { quota }
//   promoter_gen:{eventId}:{CODE}         -> contador de códigos generados
//   promoter_invites:{eventId}:{CODE}     -> set con sus códigos de la fecha
//   invite:{CODE}                          -> el código (lib/invites.js), con portal: true
//
// El repo es público: las contraseñas NUNCA se escriben en el código. Se
// generan en el servidor (admin → Promotores → "Crear accesos"). Se guardan
// dos veces: como hash scrypt (para validar el login) y cifradas con
// AES-256-GCM con una llave derivada de STAFF_PASSCODE, para que el admin
// pueda verlas. Sin STAFF_PASSCODE nadie puede descifrarlas; si se cambia
// STAFF_PASSCODE, las claves dejan de verse (siguen funcionando) y se rehacen
// con "Nueva clave".
const crypto = require('crypto');
const { redis } = require('./tickets');
const { CURRENT_EVENT_ID } = require('./events');
const { getPromoter, listPromoters, normalizeCode } = require('./promoters');
const { ALPHABET, CODE_LENGTH, cleanCode } = require('./invites');

const DEFAULT_QUOTA = parseInt(process.env.PROMOTER_DEFAULT_QUOTA || '80', 10);
// Hasta cuándo se pueden generar y usar los códigos de la fecha: sábado 14/11
// a las 8 p.m. (hora de Lima).
const INVITE_DEADLINE = new Date(process.env.INVITE_DEADLINE || '2026-11-14T20:00:00-05:00');
const SESSION_TTL = 60 * 60 * 24 * 30;
const MAX_FAILS = 10;
const FAIL_WINDOW = 60 * 15;
const SITE_URL = (process.env.SITE_URL || 'https://paradisioclub.com').replace(/\/$/, '');

function invitesOpen(now = new Date()) {
  return isNaN(INVITE_DEADLINE.getTime()) || now.getTime() < INVITE_DEADLINE.getTime();
}

function usernameOf(code) { return String(code || '').toLowerCase(); }
function codeFromUsername(u) { return normalizeCode(String(u || '').replace(/\s+/g, '')); }

// ---------- Contraseñas ----------
// Fáciles de dictar y de escribir en el celular: palabra + 3 dígitos
// ("luna473"). Con el límite de intentos de abajo no se pueden adivinar.
const WORDS = ['luna', 'disco', 'ritmo', 'fuego', 'palma', 'mango', 'coco', 'salsa', 'neon', 'playa', 'verano', 'cielo',
  'brisa', 'ola', 'sol', 'tango', 'mambo', 'conga', 'samba', 'bongo', 'lima', 'rumba', 'piña', 'cereza', 'menta',
  'trueno', 'estrella', 'cometa', 'jazz', 'groove', 'vinilo', 'faro', 'puma', 'condor', 'tigre', 'loro', 'delfin'];
function easyPassword() {
  const w = WORDS[crypto.randomInt(WORDS.length)].replace('ñ', 'n');
  return w + String(crypto.randomInt(100, 1000));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 32).toString('hex');
}

async function getLogin(code) {
  return await redis.get('promoter_login:' + code);
}

function revealKey() {
  return crypto.createHash('sha256').update('paradisio-promoter-pw:' + (process.env.STAFF_PASSCODE || '')).digest();
}
function encryptPassword(password) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', revealKey(), iv);
  const data = Buffer.concat([c.update(String(password), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}
// La clave en texto plano para el admin, o null si se creó antes de que se
// guardaran cifradas (o si cambió STAFF_PASSCODE).
function revealPassword(rec) {
  if (!rec || !rec.enc) return null;
  try {
    const [iv, tag, data] = rec.enc.split('.').map((x) => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', revealKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch (e) { return null; }
}

async function setPassword(code, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  await redis.set('promoter_login:' + code, {
    salt, hash: hashPassword(password, salt), enc: encryptPassword(password), createdAt: new Date().toISOString(),
  });
}

// Crea (o rehace) el acceso de un promotor y devuelve la clave en texto plano
// UNA sola vez, para que el admin la copie.
async function resetPassword(rawCode) {
  const p = await getPromoter(rawCode);
  if (!p || p.removed) return { ok: false, reason: 'not_found' };
  const password = easyPassword();
  await setPassword(p.code, password);
  return { ok: true, code: p.code, name: p.name, username: usernameOf(p.code), password };
}

// Accesos para todos los promotores activos que todavía no tienen uno.
// onlyHidden: rehace también las claves que existen pero no se pueden ver
// (creadas antes de guardarse cifradas). Eso cambia su clave.
async function createMissingLogins({ onlyHidden = false } = {}) {
  const list = (await listPromoters()).filter((p) => p.active);
  const created = [];
  for (const p of list) {
    const rec = await getLogin(p.code);
    if (rec && (!onlyHidden || revealPassword(rec))) continue;
    const r = await resetPassword(p.code);
    if (r.ok) created.push(r);
  }
  return created;
}

async function login(username, password) {
  const code = codeFromUsername(username);
  if (!code) return { ok: false, reason: 'invalid' };
  const failKey = 'promoter_login_fail:' + code;
  const fails = parseInt(await redis.get(failKey), 10) || 0;
  if (fails >= MAX_FAILS) return { ok: false, reason: 'locked' };
  const p = await getPromoter(code);
  const rec = p && p.active ? await getLogin(p.code) : null;
  const ok = !!rec && crypto.timingSafeEqual(Buffer.from(hashPassword(password, rec.salt), 'hex'), Buffer.from(rec.hash, 'hex'));
  if (!ok) {
    const n = await redis.incr(failKey);
    if (n === 1) await redis.expire(failKey, FAIL_WINDOW);
    return { ok: false, reason: 'invalid' };
  }
  await redis.del(failKey);
  const token = crypto.randomBytes(32).toString('hex');
  await redis.set('promoter_session:' + token, { code: p.code, at: new Date().toISOString() }, { ex: SESSION_TTL });
  return { ok: true, token, promoter: { code: p.code, name: p.name } };
}

async function logout(token) {
  if (token) await redis.del('promoter_session:' + token);
}

// Devuelve el promotor de la sesión, o null si la sesión no existe, venció o
// el promotor fue desactivado/eliminado (lo saca al instante).
async function sessionPromoter(token) {
  if (!token || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = await redis.get('promoter_session:' + token);
  if (!s || !s.code) return null;
  const p = await getPromoter(s.code);
  return p && p.active ? p : null;
}

// ---------- Cupos ----------
function quotaKey(code, eventId = CURRENT_EVENT_ID) { return `promoter_quota:${eventId}:${code}`; }
function genKey(code, eventId = CURRENT_EVENT_ID) { return `promoter_gen:${eventId}:${code}`; }
function setKey(code, eventId = CURRENT_EVENT_ID) { return `promoter_invites:${eventId}:${code}`; }

async function getQuota(code, eventId = CURRENT_EVENT_ID) {
  const q = await redis.get(quotaKey(code, eventId));
  return q && Number.isFinite(q.quota) ? q.quota : DEFAULT_QUOTA;
}

// Suma (o resta) cupo. Nunca baja de lo que ya generó.
async function addQuota(rawCode, delta) {
  const p = await getPromoter(rawCode);
  if (!p || p.removed) return { ok: false, reason: 'not_found' };
  const d = parseInt(delta, 10);
  if (!d || Math.abs(d) > 1000) return { ok: false, reason: 'invalid_amount' };
  const [current, generated] = await Promise.all([getQuota(p.code), generatedCount(p.code)]);
  const quota = Math.max(generated, current + d);
  await redis.set(quotaKey(p.code), { quota });
  return { ok: true, code: p.code, quota, generated };
}

async function generatedCount(code, eventId = CURRENT_EVENT_ID) {
  return parseInt(await redis.get(genKey(code, eventId)), 10) || 0;
}

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

function inviteLink(code) { return `${SITE_URL}/i/${code}`; }

// Máximo de códigos por clic (p. ej. 5 para un grupo de amigos).
const MAX_PER_CLICK = 10;

// Crea un código ya reservado contra el cupo.
async function createOne(promoter) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    const invite = {
      code, eventId: CURRENT_EVENT_ID, promoterCode: promoter.code, portal: true,
      createdAt: new Date().toISOString(), usedAt: null, ticketId: null, revoked: false,
    };
    const res = await redis.set('invite:' + code, invite, { nx: true });
    if (res !== 'OK') continue;
    await redis.sadd('invite_codes', code);
    await redis.sadd(setKey(promoter.code), code);
    return { ...invite, link: inviteLink(code) };
  }
  return null;
}

// Genera hasta `count` códigos (1 a 10) para el promotor. Cada uno se
// reserva contra el cupo con INCR (atómico): clics simultáneos nunca pasan
// el cupo. Si pide más de los que le quedan, recibe los que le quedan.
async function generateInvites(promoter, count = 1) {
  if (!invitesOpen()) return { ok: false, reason: 'closed' };
  const want = Math.max(1, Math.min(MAX_PER_CLICK, parseInt(count, 10) || 1));
  const quota = await getQuota(promoter.code);
  const invites = [];
  for (let i = 0; i < want; i++) {
    const n = await redis.incr(genKey(promoter.code));
    if (n > quota) { await redis.decr(genKey(promoter.code)); break; }
    const inv = await createOne(promoter);
    if (!inv) { await redis.decr(genKey(promoter.code)); break; }
    invites.push(inv);
  }
  if (!invites.length) return { ok: false, reason: 'quota_reached', quota };
  return { ok: true, invites, requested: want };
}

// Estado de un registro tal como lo ve el promotor.
function guestStatus(t) {
  if (!t) return 'registered';
  if (t.voided) return 'rejected';
  return t.pending ? 'registered' : 'approved';
}

// Códigos de la fecha de un promotor, con el invitado que usó cada uno.
async function promoterInvites(code, eventId = CURRENT_EVENT_ID) {
  const codes = (await redis.smembers(setKey(code, eventId))) || [];
  if (!codes.length) return [];
  const invites = [];
  for (let i = 0; i < codes.length; i += 200) {
    const rows = await redis.mget(...codes.slice(i, i + 200).map((c) => 'invite:' + c));
    rows.forEach((r) => { if (r) invites.push(r); });
  }
  const used = invites.filter((i) => i.ticketId);
  const tickets = new Map();
  for (let i = 0; i < used.length; i += 200) {
    const rows = await redis.mget(...used.slice(i, i + 200).map((u) => 'ticket:' + u.ticketId));
    rows.forEach((t) => { if (t) tickets.set(t.id, t); });
  }
  return invites
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((i) => ({ invite: i, ticket: i.ticketId ? tickets.get(i.ticketId) || null : null }));
}

// ¿Sirve este código para registrarse ahora? Sólo los códigos del portal, de
// la fecha vigente, sin usar, de un promotor activo y antes del cierre.
async function checkPortalInvite(raw) {
  const code = cleanCode(raw);
  if (!code) return { ok: false, reason: 'not_found' };
  const invite = await redis.get('invite:' + code);
  if (!invite || !invite.portal) return { ok: false, reason: 'not_found' };
  if (invite.eventId !== CURRENT_EVENT_ID) return { ok: false, reason: 'expired' };
  const promoter = await getPromoter(invite.promoterCode);
  const who = promoter ? { code: promoter.code, firstName: String(promoter.name || '').split(' ')[0] } : null;
  if (invite.revoked || !promoter || !promoter.active) return { ok: false, reason: 'revoked', promoter: who };
  if (invite.ticketId) return { ok: false, reason: 'used', promoter: who };
  if (!invitesOpen()) return { ok: false, reason: 'closed', promoter: who };
  return { ok: true, code, invite, promoter: who };
}

// Resumen para el panel del promotor. Sólo los datos que le tocan.
async function promoterDashboard(promoter) {
  const [quota, generated, rows] = await Promise.all([getQuota(promoter.code), generatedCount(promoter.code), promoterInvites(promoter.code)]);
  const codes = rows.map(({ invite, ticket }) => {
    const out = { code: invite.code, link: inviteLink(invite.code), createdAt: invite.createdAt, revoked: !!invite.revoked };
    if (invite.ticketId) {
      out.status = guestStatus(ticket);
      out.guest = ticket ? { name: ticket.name, instagram: ticket.instagram || '', registeredAt: ticket.createdAt } : null;
    } else {
      out.status = invite.revoked ? 'revoked' : 'unused';
    }
    return out;
  });
  const registered = codes.filter((c) => c.guest && c.status !== 'rejected').length;
  const approved = codes.filter((c) => c.status === 'approved').length;
  return {
    promoter: { code: promoter.code, name: promoter.name, username: usernameOf(promoter.code) },
    quota, generated, registered, approved,
    open: invitesOpen(), deadline: INVITE_DEADLINE.toISOString(),
    refLink: `${SITE_URL}/?ref=${promoter.code}`,
    codes,
  };
}

// Números por promotor para el admin (incluye si entró, que el promotor no ve).
async function adminPortalStats(code, eventId = CURRENT_EVENT_ID) {
  const [quota, generated, rows, login] = await Promise.all([
    getQuota(code, eventId), generatedCount(code, eventId), promoterInvites(code, eventId), getLogin(code),
  ]);
  const withGuest = rows.filter((r) => r.ticket && !r.ticket.voided);
  return {
    quota, generated,
    registrados: withGuest.length,
    aprobados: withGuest.filter((r) => !r.ticket.pending).length,
    entraronCodigo: withGuest.filter((r) => r.ticket.checkedIn).length,
    username: usernameOf(code),
    hasLogin: !!login,
    password: revealPassword(login),
  };
}

module.exports = {
  DEFAULT_QUOTA, INVITE_DEADLINE, invitesOpen, checkPortalInvite, usernameOf, inviteLink, cleanCode,
  login, logout, sessionPromoter, resetPassword, createMissingLogins, MAX_PER_CLICK,
  getQuota, addQuota, generateInvites, promoterDashboard, adminPortalStats,
};
