const { Redis } = require('@upstash/redis');
const { Resend } = require('resend');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const FREE_CAP = parseInt(process.env.FREE_CAP || '200', 10);
const PAID_CAP = parseInt(process.env.PAID_CAP || '150', 10);
const EVENT_NAME = 'Paradisio — Apertura';
const EVENT_DATE_LABEL = 'Viernes 28 de agosto · Espacio NHN, Barranco, Lima';
const EVENT_DATE_ISO = '2026-08-28';
const CONTACT_EMAIL = 'info@paradisioclub.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `Paradisio <${CONTACT_EMAIL}>`;
const EMAIL_SUBJECT = 'Tu entrada para Paradisio — 28 de agosto';
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

async function checkCapacity(type) {
  const c = await getCounters();
  if (type === 'free') return (c.free || 0) < FREE_CAP;
  if (type === 'paid') return (c.paid || 0) < PAID_CAP;
  return true;
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

async function createTicket({ name, phone, email, dni, dob, type, amount, docType, orderId, ip }) {
  const id = genTicketId();
  const token = genSecureToken();
  const ticket = {
    id, name, phone: phone || '', email, dni: dni || '', dob: dob || '', type,
    amount: amount || 0,
    docType: docType || '',
    orderId: orderId || null,
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
async function createOrder({ id, token, buyerName, buyerEmail, ticketIds, amount, qty }) {
  const order = {
    id, token, buyerName, buyerEmail, ticketIds, amount, qty,
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
async function findConflictingFreeTicket(email, dni) {
  const all = await listAllTickets();
  const normEmail = (email || '').trim().toLowerCase();
  const normDni = (dni || '').trim().toLowerCase();
  return all.find((t) =>
    t.type === 'free' && !t.voided && (
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

async function checkInTicket(id) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  if (ticket.voided) return { ok: false, reason: 'voided', ticket };
  if (ticket.checkedIn) return { ok: false, reason: 'already_used', ticket };
  ticket.checkedIn = true;
  ticket.checkedInAt = new Date().toISOString();
  await redis.set('ticket:' + ticket.id, ticket);
  const c = await getCounters();
  c.checkedin = (c.checkedin || 0) + 1;
  await redis.set('counters', c);
  return { ok: true, ticket };
}

async function voidTicket(id) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  ticket.voided = true;
  ticket.voidedAt = new Date().toISOString();
  await redis.set('ticket:' + ticket.id, ticket);
  return { ok: true, ticket };
}

async function unvoidTicket(id) {
  const ticket = await getTicket(id);
  if (!ticket) return { ok: false, reason: 'not_found' };
  ticket.voided = false;
  delete ticket.voidedAt;
  await redis.set('ticket:' + ticket.id, ticket);
  return { ok: true, ticket };
}

async function listAllTickets() {
  const keys = await redis.keys('ticket:*');
  if (!keys || keys.length === 0) return [];
  const tickets = await Promise.all(keys.map((k) => redis.get(k)));
  return tickets
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function qrDataUrl(text) {
  return await QRCode.toDataURL(text, { width: 360, margin: 1 });
}

function tierValidityLabel(isFree) {
  return isFree ? 'hasta la medianoche' : 'hasta las 3:00 a. m.';
}

function tierTypeLabel(isFree) {
  return isFree ? 'Cortesía Opening' : 'Entrada Club';
}

function buildTicketEmailHtml(ticket, { logoBase64 }) {
  const isFree = ticket.type === 'free';
  return `
  <div style="background:#090909;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#F2EDE4;">
    <div style="max-width:460px;margin:0 auto;">
      <div style="height:4px;background:#FF2800;"></div>
      <div style="background:#141414;padding:36px 28px;text-align:center;">
        ${logoBase64 ? '<img src="cid:logo" alt="Paradisio" style="max-width:200px;width:55%;margin:0 auto 28px;display:block;" />' : '<div style="font-size:24px;font-weight:900;letter-spacing:1px;margin-bottom:28px;">PARADISIO</div>'}

        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#FF2800;font-weight:700;">${tierTypeLabel(isFree)}</p>
        <p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#F2EDE4;">${ticket.name}</p>

        <div style="background:#F2EDE4;display:inline-block;padding:16px;margin-bottom:18px;">
          <img src="cid:qrcode" alt="Código QR de tu entrada" width="200" height="200" style="display:block;" />
        </div>

        <p style="margin:0 0 6px;font-family:monospace;font-size:14px;letter-spacing:1px;color:#F2EDE4;">${ticket.id}</p>
        <p style="margin:0 0 22px;font-size:12px;color:#888880;">Este código QR es válido para un solo ingreso.</p>

        <a href="${entradaUrl(ticket.token)}" style="display:inline-block;background:#FF2800;color:#0A0A0A;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:13px 26px;margin-bottom:26px;">Ver mi entrada</a>

        <div style="border-top:1px solid rgba(255,40,0,0.25);padding-top:20px;text-align:left;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#F2EDE4;">${EVENT_NAME}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#888880;">${EVENT_DATE_LABEL}</p>
          <p style="margin:0 0 18px;font-size:13px;color:#888880;">Válida ${tierValidityLabel(isFree)}</p>
          <p style="margin:0;font-size:12.5px;line-height:1.7;color:#888880;">
            Presenta este QR junto con tu <strong style="color:#F2EDE4;">documento de identidad físico y original</strong> en la puerta. Evento exclusivo para <strong style="color:#F2EDE4;">mayores de 18 años</strong>.
          </p>
        </div>
      </div>
      <div style="padding:18px 8px 0;text-align:center;font-size:11px;line-height:1.6;color:#55554f;">
        Paradisio · ${CONTACT_EMAIL} · Jr. 28 de Julio 277, Barranco, Lima
      </div>
    </div>
  </div>`;
}

function buildTicketEmailText(ticket) {
  const isFree = ticket.type === 'free';
  return [
    'PARADISIO',
    tierTypeLabel(isFree).toUpperCase(),
    '',
    ticket.name,
    `Código: ${ticket.id}`,
    'El código QR adjunto es válido para un solo ingreso.',
    '',
    `Ver mi entrada: ${entradaUrl(ticket.token)}`,
    '',
    EVENT_NAME,
    EVENT_DATE_LABEL,
    `Válida ${tierValidityLabel(isFree)}`,
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
    logoBase64 = fs.readFileSync(path.join(__dirname, '..', 'logo-white.png')).toString('base64');
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
  const rows = tickets.map((t, i) =>
    `<tr>
      <td style="padding:8px 0;border-bottom:1px solid rgba(255,40,0,0.2);font-size:13px;color:#F2EDE4;">${i + 1}. ${t.name}</td>
      <td style="padding:8px 0;border-bottom:1px solid rgba(255,40,0,0.2);font-size:13px;color:#888880;font-family:monospace;text-align:right;">${t.id}</td>
    </tr>`
  ).join('');

  return `
  <div style="background:#090909;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#F2EDE4;">
    <div style="max-width:460px;margin:0 auto;">
      <div style="height:4px;background:#FF2800;"></div>
      <div style="background:#141414;padding:36px 28px;text-align:center;">
        ${logoBase64 ? '<img src="cid:logo" alt="Paradisio" style="max-width:200px;width:55%;margin:0 auto 28px;display:block;" />' : '<div style="font-size:24px;font-weight:900;letter-spacing:1px;margin-bottom:28px;">PARADISIO</div>'}

        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#FF2800;font-weight:700;">Compra confirmada</p>
        <p style="margin:0 0 24px;font-size:20px;font-weight:800;color:#F2EDE4;">${order.qty} entrada${order.qty > 1 ? 's' : ''} Club</p>

        <table style="width:100%;border-collapse:collapse;text-align:left;margin-bottom:24px;">
          ${rows}
        </table>

        <a href="${ordenUrl(order.token)}" style="display:inline-block;background:#FF2800;color:#0A0A0A;font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:13px 26px;margin-bottom:26px;">Ver mi orden</a>

        <div style="border-top:1px solid rgba(255,40,0,0.25);padding-top:20px;text-align:left;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#F2EDE4;">${EVENT_NAME}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#888880;">${EVENT_DATE_LABEL}</p>
          <p style="margin:0 0 18px;font-size:13px;color:#888880;">Válida ${tierValidityLabel(false)}</p>
          <p style="margin:0;font-size:12.5px;line-height:1.7;color:#888880;">
            Cada asistente que registró su correo recibió su propio código QR. Los demás pueden ver su entrada desde tu página de orden — cada QR es de un solo ingreso y requiere <strong style="color:#F2EDE4;">documento de identidad físico y original</strong> en la puerta. Evento exclusivo para <strong style="color:#F2EDE4;">mayores de 18 años</strong>.
          </p>
        </div>
      </div>
      <div style="padding:18px 8px 0;text-align:center;font-size:11px;line-height:1.6;color:#55554f;">
        Paradisio · ${CONTACT_EMAIL} · Jr. 28 de Julio 277, Barranco, Lima
      </div>
    </div>
  </div>`;
}

function buildOrderEmailText(order, tickets) {
  const lines = tickets.map((t, i) => `${i + 1}. ${t.name} — ${t.id}`);
  return [
    'PARADISIO',
    'COMPRA CONFIRMADA',
    '',
    `${order.qty} entrada${order.qty > 1 ? 's' : ''} Club`,
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
  redis, FREE_CAP, PAID_CAP, EVENT_NAME, EVENT_DATE_LABEL, EVENT_DATE_ISO, CONTACT_EMAIL, EMAIL_SUBJECT, SITE_URL,
  genTicketId, getCounters, incrCounter, checkCapacity, calcAge,
  createTicket, getTicket, getTicketByToken, checkInTicket, qrDataUrl, sendTicketEmail, markEmailStatus,
  voidTicket, unvoidTicket, listAllTickets, findConflictingFreeTicket,
  reserveOrderIdentity, createOrder, getOrder, getOrderByToken, sendOrderEmail,
  buildTicketEmailHtml, buildTicketEmailText, tierValidityLabel, tierTypeLabel, entradaUrl, ordenUrl, getClientIp,
};
