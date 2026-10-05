const { Redis } = require('@upstash/redis');
const { Resend } = require('resend');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CORTESIA_CAP, isCortesiaEntryValid } = require('./catalog');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const FREE_CAP = parseInt(process.env.FREE_CAP || String(CORTESIA_CAP), 10);
const PAID_CAP = parseInt(process.env.PAID_CAP || '150', 10);
// Datos de la fecha. Los valores por defecto son los del after hours del
// 17 de octubre; cualquiera se puede pisar con su variable de entorno en
// Vercel para la próxima fecha sin tocar código.
const EVENT_NAME = process.env.EVENT_NAME || 'Paradisio Club — After Hours';
const EVENT_DATE_LABEL = process.env.EVENT_DATE_LABEL || 'Sábado 17 de octubre · 10 PM';
const EVENT_SHORT_DATE = process.env.EVENT_SHORT_DATE || '17 Octubre';
const EVENT_ADDRESS = process.env.EVENT_ADDRESS || 'Catalino Miranda 162 - Barranco';
const EVENT_MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(EVENT_ADDRESS.replace(/\s*-\s*/, ', ') + ', Lima, Perú');
const EVENT_DATE_ISO = process.env.EVENT_DATE_ISO || '2026-10-17';
const CONTACT_EMAIL = 'info@paradisioclub.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `Paradisio <${CONTACT_EMAIL}>`;
const EMAIL_SUBJECT = process.env.EMAIL_SUBJECT || 'Tu entrada — Paradisio Club, 17 de octubre';
// Horario de las invitaciones de promotor: el texto que ven (correo, página,
// /entrada) y el corte real que aplica la puerta. Se configuran juntos.
const PROMO_VALIDITY_LABEL = process.env.PROMO_VALIDITY_LABEL || 'hasta las 11:00 p.m.';
const PROMO_ENTRY_CUTOFF = new Date(process.env.PROMO_ENTRY_CUTOFF || '2026-10-17T23:00:00-05:00');

// Hora del servidor, nunca la del celular que escanea.
function isPromoEntryValid(now = new Date()) {
  if (isNaN(PROMO_ENTRY_CUTOFF.getTime())) return true;
  return now.getTime() < PROMO_ENTRY_CUTOFF.getTime();
}
const SITE_URL = (process.env.SITE_URL || 'https://paradisioclub.com').replace(/\/$/, '');

function genCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + '-' + s;
}

function genTicketId() {
  return genCode('PDS');
}

function genOrderId() {
  return genCode('ORD');
}

// Cryptographically random, 64 hex chars — well past the 32-char minimum,
// and never derived from (or convertible back to) the sequential PDS/ORD code.
function genSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

function entradaUrl(token) {
  return `${SITE_URL}/entrada?t=${token}`;
}

// Vercel sits in front of every function as a proxy, so the real client IP is
// the first entry of x-forwarded-for, not req.socket — only used for the
// duplicate-registration heuristic in the admin panel, never to block anyone.
function getClientIp(req) {
  const header = req.headers && req.headers['x-forwarded-for'];
  if (!header) return '';
  return String(header).split(',')[0].trim();
}

function ordenUrl(token) {
  return `${SITE_URL}/orden?t=${token}`;
}

async function getCounters() {
  const c = await redis.get('counters');
  return c || { free: 0, paid: 0, checkedin: 0 };
}

async function incrCounter(type) {
  const c = await getCounters();
  c[type] = (c[type] || 0) + 1;
  await redis.set('counters', c);
  return c;
}

// Mirrors incrCounter -- same get/mutate/set shape as every other counter
// write in this file, clamped so a counter can never go negative.
async function decrCounter(type) {
  const c = await getCounters();
  c[type] = Math.max(0, (c[type] || 0) - 1);
  await redis.set('counters', c);
  return c;
}

async function checkCapacity(type) {
  const c = await getCounters();
  if (type === 'free') return (c.free || 0) < FREE_CAP;
  if (type === 'paid') return (c.paid || 0) < PAID_CAP;
  return true;
}

// Returns why Cortesia registration is closed right now, or null if it's
// open: 'manual' (an admin forced it closed from the admin panel) or 'cap'
// (the PUBLIC portion of counters.free has ever reached FREE_CAP -- see
// below).
//
// cortesia_manual_state is a tri-state override: {state:'open'}, {state:
// 'closed'}, or absent (auto, the default before anyone ever touches the
// admin toggle). Once set, it's unconditional in BOTH directions -- 'open'
// keeps registration open no matter what counters.free says, and 'closed'
// keeps it closed no matter what -- because the admin toggle is meant to
// override the cap entirely, not just nudge it. Only while this key is
// absent does the automatic FREE_CAP latch below apply, exactly as before
// this admin control existed.
//
// counters.free counts every currently-active Cortesia ticket, manual
// admin issuances (api/admin-issue-ticket.js) included -- that's what the
// admin panel's "vigentes" numbers are meant to show. counters.free_manual
// tracks only the manual slice of that same total, so the cap check here
// can subtract it back out: (free - free_manual) is the public-registration
// count, and only THAT is compared against FREE_CAP. This is what keeps a
// manual issuance from ever being able to trigger the automatic closure --
// it moves counters.free and counters.free_manual together, so the
// difference the cap actually looks at never changes.
//
// Once the public count has ever reached FREE_CAP (and no manual override
// is set), the cap makes registration stay sold out permanently -- even
// after voids free up slots -- until an admin opens it from the panel
// (setCortesiaManualOverride) or clears cortesia_permanently_closed
// directly in Redis. That's deliberate: freed slots are meant to be
// re-offered manually, not auto-reopened the moment the count dips.
// Checked in the cheap order (manual first, cap latch second) so the
// common already-decided path costs just one or two GETs, never a KEYS
// scan -- reading free_manual off the same getCounters() call adds no
// extra Redis command.
async function getCortesiaClosedReason() {
  const manual = await redis.get('cortesia_manual_state');
  if (manual) return manual.state === 'closed' ? 'manual' : null;
  const capFlag = await redis.get('cortesia_permanently_closed');
  if (capFlag && capFlag.closed) return 'cap';
  const counters = await getCounters();
  const publicFree = (counters.free || 0) - (counters.free_manual || 0);
  if (publicFree >= FREE_CAP) {
    await redis.set('cortesia_permanently_closed', { closed: true });
    return 'cap';
  }
  return null;
}

async function isCortesiaSoldOut() {
  return (await getCortesiaClosedReason()) !== null;
}

// Everything the admin panel's Cortesía control card needs in one call:
// whether it's open, why it's closed if not, and the raw counters.free vs
// FREE_CAP so an admin can spot drift between the two at a glance.
async function getCortesiaStatus() {
  const reason = await getCortesiaClosedReason();
  const counters = await getCounters();
  return {
    state: reason ? 'closed' : 'open',
    reason,
    countersFree: counters.free || 0,
    freeCap: FREE_CAP,
  };
}

// The admin panel's manual open/closed toggle. Both directions set
// cortesia_manual_state, which then unconditionally decides the outcome
// (see getCortesiaClosedReason) regardless of counters.free -- opening does
// NOT require counters.free to be under FREE_CAP first, and once open it
// stays open even if registrations later push counters.free past the cap;
// that's the whole point of "manda sobre el cierre automático por cap".
// Opening also deletes cortesia_permanently_closed so that flag doesn't
// linger stale -- it's irrelevant while the manual override is 'open', but
// clearing it now means the automatic cap check starts fresh from
// counters.free if the manual override is ever removed directly in Redis.
async function setCortesiaManualOverride(open) {
  if (open) {
    await redis.set('cortesia_manual_state', { state: 'open' });
    await redis.del('cortesia_permanently_closed');
  } else {
    await redis.set('cortesia_manual_state', { state: 'closed' });
  }
}

function calcAgeAsOf(dobStr, asOfDate) {
  const dob = new Date(dobStr + 'T00:00:00');
  if (isNaN(dob.getTime())) return null;
  let age = asOfDate.getFullYear() - dob.getFullYear();
  const m = asOfDate.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOfDate.getDate() < dob.getDate())) age--;
  return age;
}

// The 18+ gate checks age as of the event date, not the registration date — someone
// who's 17 today but turns 18 before August 28 is allowed to register. The admin
// panel separately flags that gap so door staff know to look closer at their ID.
function calcAge(dobStr) {
  return calcAgeAsOf(dobStr, new Date(EVENT_DATE_ISO + 'T00:00:00'));
}

async function createTicket({ name, phone, email, dni, dob, type, amount, docType, orderId, ip, skuLabel, promoterCode, instagram, inviteCode }) {
  const id = genTicketId();
  const token = genSecureToken();
  const ticket = {
    id, name, phone: phone || '', email, dni: dni || '', dob: dob || '', type,
    amount: amount || 0,
    docType: docType || '',
    orderId: orderId || null,
    skuLabel: skuLabel || '',
    promoterCode: promoterCode || null,
    instagram: instagram || '',
    inviteCode: inviteCode || null,
    ip: ip || '',
    token,
    createdAt: new Date().toISOString(),
    checkedIn: false,
    voided: false,
    emailStatus: 'pending', // 'pending' | 'delivered' | 'bounced', set from the Resend webhook
    resendEmailId: null,
  };
  await redis.set('ticket:' + id, ticket);
  await redis.set('entrada_token:' + token, id);
  await redis.sadd('all_ticket_ids', id);
  await incrCounter(type);
  return ticket;
}

// Reserves an order id/token pair up front, so the caller can stamp it onto each
// ticket as it's created — before the order record itself (which needs those
// ticket ids) is written.
function reserveOrderIdentity() {
  return { id: genOrderId(), token: genSecureToken() };
}

// One order groups the N nominal tickets from a single paid, multi-assistant purchase.
// `amount` is what was actually charged (post-discount, if any); `subtotal`/
// `discountAmount` are kept alongside it so the order/email/admin can show
// the breakdown without recomputing it from the promoter code later.
async function createOrder({ id, token, buyerName, buyerEmail, ticketIds, amount, qty, skuLabel, promoterCode, subtotal, discountAmount }) {
  const order = {
    id, token, buyerName, buyerEmail, ticketIds, amount, qty,
    skuLabel: skuLabel || '',
    promoterCode: promoterCode || null,
    subtotal: subtotal != null ? subtotal : amount,
    discountAmount: discountAmount || 0,
    createdAt: new Date().toISOString(),
  };
  await redis.set('order:' + id, order);
  await redis.set('order_token:' + token, id);
  return order;
}

async function getOrder(id) {
  return await redis.get('order:' + id.toUpperCase());
}

// Looks up an order by its opaque orden token — never by the sequential ORD code.
async function getOrderByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const id = await redis.get('order_token:' + token);
  if (!id) return null;
  return await getOrder(id);
}

// Cortesía tickets are one-per-person and never mix with paid ones: reject a new
// free registration if the email or document is already tied to an active (non-voided)
// free ticket. Small enough volume (FREE_CAP) that a full scan is fine here — same
// non-atomic read-then-write tradeoff checkCapacity already makes.
async function findConflictingFreeTicket(email, dni, type = 'free') {
  const all = await listAllTickets();
  const normEmail = (email || '').trim().toLowerCase();
  const normDni = (dni || '').trim().toLowerCase();
  return all.find((t) =>
    t.type === type && !t.voided && (
      (t.email || '').trim().toLowerCase() === normEmail ||
      (t.dni || '').trim().toLowerCase() === normDni
    )
  ) || null;
}

async function getTicket(id) {
  return await redis.get('ticket:' + id.toUpperCase());
}

// Looks up a ticket by its opaque entrada token — never by the sequential PDS code.
async function getTicketByToken(token) {
  if (!token || typeof token !== 'string') return null;
  const id = await redis.get('entrada_token:' + token);
  if (!id) return null;
  return await getTicket(id);
}

// Cortesia QRs stop admitting entry at midnight the night of the event
// (CORTESIA_ENTRY_CUTOFF) -- paid tickets never expire at the door, so this
// only ever applies to type 'free'. Checked with the server's own clock
// (isCortesiaEntryValid defaults to `new Date()`), never a value from the
// scanning device -- a phone with a wrong clock can't affect this. An
// expired scan leaves the ticket completely untouched: not checked in, not
// voided, no write at all, so it's still there to charge at the door.
//
// allowExpiredCortesia is the door override: staff at the scanner saw the
// red QR EXPIRADO screen and deliberately tapped "DEJAR ENTRAR IGUAL" for
// this one person. It ONLY relaxes the expiry branch -- not_found, voided
// and already_used still reject exactly as before, and it can never apply
// to a paid or VIP ticket since only type 'free' reaches that branch. The
// admitted ticket is written with lateEntry: true so these are separable
// from on-time entries afterwards. Never default this to true: it has to
// stay a per-scan decision, so an override can't be left on by accident.
async function checkInTicket(id, { allowExpiredCortesia = false, lateCharged = false } = {}) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  if (ticket.voided) return { ok: false, reason: 'voided', ticket };
  if (ticket.checkedIn) return { ok: false, reason: 'already_used', ticket };
  // Las invitaciones de promotor (promo) vencen en PROMO_ENTRY_CUTOFF y usan
  // el mismo rechazo + override de puerta que la cortesía.
  const expired = (ticket.type === 'free' && !isCortesiaEntryValid())
    || (ticket.type === 'promo' && !isPromoEntryValid());
  if (expired) {
    if (!allowExpiredCortesia) return { ok: false, reason: 'cortesia_expired', ticket };
    ticket.lateEntry = true;
    // El staff elige en el scanner si a esta persona se le cobró la entrada
    // o entró gratis. Las dos cuentan como ingreso.
    ticket.lateCharged = !!lateCharged;
  }
  ticket.checkedIn = true;
  ticket.checkedInAt = new Date().toISOString();
  await redis.set('ticket:' + ticket.id, ticket);
  const c = await getCounters();
  c.checkedin = (c.checkedin || 0) + 1;
  await redis.set('counters', c);
  return { ok: true, ticket };
}

// Cortesia tickets occupy FREE_CAP for as long as they're vigente -- voiding
// one frees up its slot, same as it never having been issued. Paid tickets
// are untouched either way: a voided paid ticket still counts against
// PAID_CAP forever, since the charge already happened. Gated on the actual
// state transition (ticket.voided was false) so calling void twice in a row
// never decrements twice, and symmetric with unvoidTicket below so
// reactivating a cortesia gives its slot back -- otherwise every void+unvoid
// cycle would permanently shrink capacity by one.
//
// A manually-issued Cortesia (ticket.manualIssue, see
// api/admin-issue-ticket.js) also moves counters.free_manual in lockstep
// with counters.free -- otherwise voiding a manual ticket would shrink the
// panel-facing total (free) without shrinking the manual-only tally
// (free_manual), and getCortesiaClosedReason's "public only" subtraction
// (free - free_manual) would drift wrong, making the cap check think fewer
// public registrations exist than actually do.
async function voidTicket(id) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  const wasVoided = ticket.voided;
  ticket.voided = true;
  ticket.voidedAt = new Date().toISOString();
  await redis.set('ticket:' + ticket.id, ticket);
  if (!wasVoided && ticket.type === 'free') {
    await decrCounter('free');
    if (ticket.manualIssue) await decrCounter('free_manual');
  }
  return { ok: true, ticket };
}

async function unvoidTicket(id) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  const wasVoided = ticket.voided;
  ticket.voided = false;
  delete ticket.voidedAt;
  await redis.set('ticket:' + ticket.id, ticket);
  if (wasVoided && ticket.type === 'free') {
    await incrCounter('free');
    if (ticket.manualIssue) await incrCounter('free_manual');
  }
  return { ok: true, ticket };
}

async function listAllTickets() {
  const keys = await redis.keys('ticket:*');
  if (!keys || keys.length === 0) return [];
  // mget is one round-trip regardless of key count, instead of N parallel
  // GETs -- same order/shape as before (null for anything missing).
  const tickets = await redis.mget(...keys);
  return tickets
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// Recomputes counters.free (and its manual-issuance slice, free_manual)
// from the ticket records themselves -- the actual source of truth -- and
// overwrites both stored counters to match. Exists to correct drift like
// tickets that were voided before the decrement-on-void logic existed,
// which left counters.free higher than the real vigente count. Re-deriving
// free_manual here too (same scan, no extra pass) keeps
// getCortesiaClosedReason's "public only" subtraction accurate even if it
// had drifted for some other reason. This scans the full keyspace via
// listAllTickets, so it must only ever be triggered by an explicit admin
// action, never automatically and never from the registration critical path.
async function resyncFreeCounter() {
  const tickets = await listAllTickets();
  const freeTickets = tickets.filter((t) => t.type === 'free' && !t.voided);
  const vigentes = freeTickets.length;
  const manualVigentes = freeTickets.filter((t) => t.manualIssue).length;
  const counters = await getCounters();
  const before = counters.free || 0;
  counters.free = vigentes;
  counters.free_manual = manualVigentes;
  await redis.set('counters', counters);
  return { before, after: vigentes };
}

async function qrDataUrl(text) {
  return await QRCode.toDataURL(text, { width: 360, margin: 1 });
}

function tierValidityLabel(isFree) {
  return isFree ? 'hasta la medianoche' : 'a cualquier hora de la noche';
}

function tierTypeLabel(isFree) {
  return isFree ? 'Cortesía Opening' : 'Entrada pagada';
}

// Etiqueta y horario por ticket. Las invitaciones de promotor (type 'promo')
// tienen su propia etiqueta y sólo muestran horario si PROMO_VALIDITY_LABEL
// está definido -- nunca heredan el "hasta la medianoche" de la cortesía ni
// el "a cualquier hora" de las pagadas.
function ticketTypeLabel(ticket) {
  if (ticket.type === 'promo') return ticket.skuLabel || 'Invitación';
  const isFree = ticket.type === 'free';
  return isFree ? tierTypeLabel(true) : (ticket.skuLabel || tierTypeLabel(false));
}

function ticketValidityLabel(ticket) {
  if (ticket.type === 'promo') return PROMO_VALIDITY_LABEL;
  return tierValidityLabel(ticket.type === 'free');
}

// Wraps an email's body fragment into a full HTML document with an explicit
// color-scheme declaration. Without this, clients that "smart-invert"
// unrecognized dark HTML (Apple Mail, Outlook.com, some Android mail apps)
// swap our colors unpredictably depending on the reader's system theme —
// this brand is dark by design (see DESIGN.md), not something that should
// flip. The `@media (prefers-color-scheme: dark)` block reasserts the exact
// same brand colors so the email looks intentional in both system themes
// instead of accidentally inverted in one of them. The QR's light quiet-zone
// box (`.pd-qr-wrap`) is reasserted the same way — if a client inverted it,
// the QR would stop scanning.
function wrapEmailHtml(bodyContent) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>Paradisio</title>
<style>
  body { margin:0; padding:0; background:#0A0909; }
  .pd-card { background:#141414; }
  .pd-text { color:#F4F0EA; }
  .pd-muted { color:#888880; }
  .pd-footer-text { color:#55554f; }
  .pd-accent { color:#E2361F; }
  .pd-btn { background:#FF2800; color:#0A0A0A; }
  .pd-qr-wrap { background:#F4F0EA; }
  @media (prefers-color-scheme: dark) {
    body { background:#0A0909 !important; }
    .pd-card { background:#141414 !important; }
    .pd-text { color:#F4F0EA !important; }
    .pd-muted { color:#888880 !important; }
    .pd-footer-text { color:#55554f !important; }
    .pd-accent { color:#E2361F !important; }
    .pd-btn { background:#FF2800 !important; color:#0A0A0A !important; }
    .pd-qr-wrap { background:#F4F0EA !important; }
    .pd-btn-outline { color:#F4F0EA !important; border-color:#8C877F !important; }
  }
</style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

function buildTicketEmailHtml(ticket, { logoBase64 }) {
  const typeLabel = ticketTypeLabel(ticket);
  const validity = ticketValidityLabel(ticket);
  const serif = "'Bodoni 72','Didot','Bodoni MT',Georgia,'Times New Roman',serif";
  const sans = "'Futura','Jost','Helvetica Neue',Arial,sans-serif";
  const cap = `font-family:${sans};font-size:10px;letter-spacing:4px;text-transform:uppercase;`;
  return wrapEmailHtml(`
  <div style="background:#0A0909;padding:44px 16px;color:#F4F0EA;">
    <div style="max-width:440px;margin:0 auto;text-align:center;">
      ${logoBase64
        ? '<img src="cid:logo" alt="Paradisio" style="width:180px;max-width:55%;margin:0 auto 6px;display:block;" />'
        : `<div class="pd-text" style="font-family:${serif};font-style:italic;font-size:34px;color:#F4F0EA;">paradisio</div>`}
      <p class="pd-accent" style="margin:0 0 34px;font-family:${serif};font-size:20px;letter-spacing:1px;color:#E2361F;">CLUB</p>

      <p class="pd-accent" style="margin:0 0 10px;${cap}color:#E2361F;">${typeLabel}</p>
      <p class="pd-text" style="margin:0 0 28px;font-family:${serif};font-size:26px;line-height:1.15;color:#F4F0EA;">${ticket.name}</p>

      <div class="pd-qr-wrap" style="background:#F4F0EA;display:inline-block;padding:14px;margin-bottom:16px;">
        <img src="cid:qrcode" alt="Código QR de tu entrada" width="210" height="210" style="display:block;" />
      </div>
      <p class="pd-muted" style="margin:0 0 30px;font-family:${sans};font-size:12px;letter-spacing:4px;color:#8C877F;">${ticket.id}</p>

      <div style="border-top:1px solid #2A2725;border-bottom:1px solid #2A2725;padding:18px 0;margin-bottom:28px;">
        <p class="pd-text" style="margin:0 0 8px;${cap}color:#F4F0EA;">${EVENT_DATE_LABEL}</p>
        <p style="margin:0 0 8px;${cap}"><a class="pd-text" href="${EVENT_MAPS_URL}" style="color:#F4F0EA;text-decoration:underline;">${EVENT_ADDRESS}</a></p>
        ${validity ? `<p class="pd-accent" style="margin:0;${cap}color:#E2361F;">QR válido ${validity}</p>` : ''}
      </div>

      <a class="pd-btn-outline" href="${entradaUrl(ticket.token)}" style="display:inline-block;border:1px solid #8C877F;color:#F4F0EA;${cap}font-size:10px;text-decoration:none;padding:15px 30px;margin-bottom:30px;">Ver mi entrada</a>

      <p class="pd-muted" style="margin:0;font-family:${sans};font-size:12.5px;line-height:1.7;color:#8C877F;">
        Un solo ingreso. Presenta este QR con tu documento de identidad físico y original. Solo mayores de 18 años.
      </p>
      <p class="pd-footer-text" style="margin:34px 0 0;${cap}font-size:9px;color:#55514c;">Paradisio Club · ${CONTACT_EMAIL}</p>
    </div>
  </div>`);
}

function buildTicketEmailText(ticket) {
  const typeLabel = ticketTypeLabel(ticket);
  const validity = ticketValidityLabel(ticket);
  return [
    'PARADISIO',
    typeLabel.toUpperCase(),
    '',
    ticket.name,
    `Código: ${ticket.id}`,
    'El código QR adjunto es válido para un solo ingreso.',
    '',
    `Ver mi entrada: ${entradaUrl(ticket.token)}`,
    '',
    EVENT_NAME,
    EVENT_DATE_LABEL,
    `${EVENT_ADDRESS} (${EVENT_MAPS_URL})`,
    ...(validity ? [`QR válido ${validity}`] : []),
    '',
    'Presenta este QR junto con tu documento de identidad físico y original en la puerta.',
    'Evento exclusivo para mayores de 18 años.',
    '',
    '—',
    'Paradisio',
    CONTACT_EMAIL,
    'Jr. 28 de Julio 277, Barranco, Lima',
  ].join('\n');
}

async function sendTicketEmail(ticket) {
  const qr = await qrDataUrl(ticket.id);
  const qrBase64 = qr.split(',')[1];

  let logoBase64 = null;
  try {
    logoBase64 = fs.readFileSync(path.join(__dirname, '..', 'logo-script-white.png')).toString('base64');
  } catch (e) {
    console.error('Could not read logo for email:', e);
  }

  const html = buildTicketEmailHtml(ticket, { logoBase64 });
  const text = buildTicketEmailText(ticket);

  const attachments = [
    {
      filename: 'qr.png',
      content: qrBase64,
      content_id: 'qrcode',
    },
  ];
  if (logoBase64) {
    attachments.push({
      filename: 'logo.png',
      content: logoBase64,
      content_id: 'logo',
    });
  }

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: ticket.email,
    reply_to: CONTACT_EMAIL,
    subject: EMAIL_SUBJECT,
    html,
    text,
    attachments,
  });
  if (error) throw new Error(error.message || 'Resend send failed');

  // Remember the Resend message id so the delivery webhook (bounced/delivered)
  // can find its way back to this ticket.
  if (data && data.id) {
    ticket.resendEmailId = data.id;
    await redis.set('ticket:' + ticket.id, ticket);
    await redis.set('resend_email_id:' + data.id, ticket.id);
  }
}

// Called from the Resend webhook once a delivery outcome is known. A bounce means
// the QR never reached anyone — that registration isn't a real expected attendee.
async function markEmailStatus(resendEmailId, status) {
  const ticketId = await redis.get('resend_email_id:' + resendEmailId);
  if (!ticketId) return { ok: false, reason: 'not_found' };
  const ticket = await getTicket(ticketId);
  if (!ticket) return { ok: false, reason: 'not_found' };
  ticket.emailStatus = status;
  await redis.set('ticket:' + ticket.id, ticket);
  return { ok: true, ticket };
}

const ORDER_EMAIL_SUBJECT = 'Tu compra de entradas para Paradisio — 28 de agosto';

function buildOrderEmailHtml(order, tickets, { logoBase64 }) {
  const skuLabel = order.skuLabel || 'Club';
  const rows = tickets.map((t, i) =>
    `<tr>
      <td class="pd-text" style="padding:8px 0;border-bottom:1px solid rgba(255,40,0,0.2);font-size:13px;color:#F2EDE4;">${i + 1}. ${t.name}</td>
      <td class="pd-muted" style="padding:8px 0;border-bottom:1px solid rgba(255,40,0,0.2);font-size:13px;color:#888880;font-family:monospace;text-align:right;">${t.id}</td>
    </tr>`
  ).join('');

  return wrapEmailHtml(`
  <div style="background:#090909;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#F2EDE4;">
    <div style="max-width:460px;margin:0 auto;">
      <div style="height:4px;background:#FF2800;"></div>
      <div class="pd-card" style="background:#141414;padding:36px 28px;text-align:center;">
        ${logoBase64 ? '<img src="cid:logo" alt="Paradisio" style="max-width:200px;width:55%;margin:0 auto 28px;display:block;" />' : '<div class="pd-text" style="font-size:24px;font-weight:900;letter-spacing:1px;margin-bottom:28px;color:#F2EDE4;">PARADISIO</div>'}

        <p class="pd-accent" style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#FF2800;font-weight:700;">Compra confirmada</p>
        <p class="pd-text" style="margin:0 0 24px;font-size:20px;font-weight:800;color:#F2EDE4;">${order.qty} entrada${order.qty > 1 ? 's' : ''} ${skuLabel}</p>

        <table style="width:100%;border-collapse:collapse;text-align:left;margin-bottom:24px;">
          ${rows}
        </table>

        <a class="pd-btn" href="${ordenUrl(order.token)}" style="display:inline-block;background:#FF2800;color:#0A0A0A;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:13px 26px;margin-bottom:26px;">Ver mi orden</a>

        <div style="border-top:1px solid rgba(255,40,0,0.25);padding-top:20px;text-align:left;">
          <p class="pd-text" style="margin:0 0 8px;font-size:14px;font-weight:700;color:#F2EDE4;">${EVENT_NAME}</p>
          <p class="pd-muted" style="margin:0 0 4px;font-size:13px;color:#888880;">${EVENT_DATE_LABEL}</p>
          <p class="pd-muted" style="margin:0 0 18px;font-size:13px;color:#888880;">Válida ${tierValidityLabel(false)}</p>
          <p class="pd-muted" style="margin:0;font-size:12.5px;line-height:1.7;color:#888880;">
            Cada asistente que registró su correo recibió su propio código QR. Los demás pueden ver su entrada desde tu página de orden — cada QR es de un solo ingreso y requiere <strong class="pd-text" style="color:#F2EDE4;">documento de identidad físico y original</strong> en la puerta. Evento exclusivo para <strong class="pd-text" style="color:#F2EDE4;">mayores de 18 años</strong>.
          </p>
        </div>
      </div>
      <div class="pd-footer-text" style="padding:18px 8px 0;text-align:center;font-size:11px;line-height:1.6;color:#55554f;">
        Paradisio · ${CONTACT_EMAIL} · Jr. 28 de Julio 277, Barranco, Lima
      </div>
    </div>
  </div>`);
}

function buildOrderEmailText(order, tickets) {
  const skuLabel = order.skuLabel || 'Club';
  const lines = tickets.map((t, i) => `${i + 1}. ${t.name} — ${t.id}`);
  return [
    'PARADISIO',
    'COMPRA CONFIRMADA',
    '',
    `${order.qty} entrada${order.qty > 1 ? 's' : ''} ${skuLabel}`,
    ...lines,
    '',
    `Ver mi orden: ${ordenUrl(order.token)}`,
    '',
    EVENT_NAME,
    EVENT_DATE_LABEL,
    `Válida ${tierValidityLabel(false)}`,
    '',
    'Cada asistente que registró su correo recibió su propio código QR. Los demás pueden ver',
    'su entrada desde tu página de orden. Cada QR es de un solo ingreso y requiere documento',
    'de identidad físico y original en la puerta. Evento exclusivo para mayores de 18 años.',
    '',
    '—',
    'Paradisio',
    CONTACT_EMAIL,
    'Jr. 28 de Julio 277, Barranco, Lima',
  ].join('\n');
}

async function sendOrderEmail(order, tickets) {
  let logoBase64 = null;
  try {
    logoBase64 = fs.readFileSync(path.join(__dirname, '..', 'logo-white.png')).toString('base64');
  } catch (e) {
    console.error('Could not read logo for email:', e);
  }

  const html = buildOrderEmailHtml(order, tickets, { logoBase64 });
  const text = buildOrderEmailText(order, tickets);

  const attachments = [];
  if (logoBase64) {
    attachments.push({ filename: 'logo.png', content: logoBase64, content_id: 'logo' });
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: order.buyerEmail,
    reply_to: CONTACT_EMAIL,
    subject: ORDER_EMAIL_SUBJECT,
    html,
    text,
    attachments,
  });
}

module.exports = {
  redis, FREE_CAP, PAID_CAP, EVENT_NAME, EVENT_DATE_LABEL, EVENT_SHORT_DATE, EVENT_ADDRESS, EVENT_MAPS_URL, EVENT_DATE_ISO, isPromoEntryValid, CONTACT_EMAIL, EMAIL_SUBJECT, SITE_URL,
  genTicketId, getCounters, incrCounter, decrCounter, checkCapacity, isCortesiaSoldOut, calcAge,
  getCortesiaStatus, setCortesiaManualOverride, resyncFreeCounter,
  createTicket, getTicket, getTicketByToken, checkInTicket, qrDataUrl, sendTicketEmail, markEmailStatus,
  voidTicket, unvoidTicket, listAllTickets, findConflictingFreeTicket,
  reserveOrderIdentity, createOrder, getOrder, getOrderByToken, sendOrderEmail,
  buildTicketEmailHtml, buildTicketEmailText, tierValidityLabel, tierTypeLabel, ticketTypeLabel, ticketValidityLabel, entradaUrl, ordenUrl, getClientIp,
};
