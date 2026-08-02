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
const CONTACT_EMAIL = 'ritmo@paradisioclub.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `Paradisio <${CONTACT_EMAIL}>`;
const EMAIL_SUBJECT = 'Tu entrada para Paradisio — 28 de agosto';
const SITE_URL = (process.env.SITE_URL || 'https://paradisioclub.com').replace(/\/$/, '');

function genTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'PDS-' + s;
}

// Cryptographically random, 64 hex chars — well past the 32-char minimum,
// and never derived from (or convertible back to) the sequential PDS code.
function genEntradaToken() {
  return crypto.randomBytes(32).toString('hex');
}

function entradaUrl(token) {
  return `${SITE_URL}/entrada?t=${token}`;
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

function calcAge(dobStr) {
  const dob = new Date(dobStr + 'T00:00:00');
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

async function createTicket({ name, phone, email, dni, dob, type, amount }) {
  const id = genTicketId();
  const token = genEntradaToken();
  const ticket = {
    id, name, phone, email, dni: dni || '', dob: dob || '', type,
    amount: amount || 0,
    token,
    createdAt: new Date().toISOString(),
    checkedIn: false,
    voided: false,
  };
  await redis.set('ticket:' + id, ticket);
  await redis.set('entrada_token:' + token, id);
  await redis.sadd('all_ticket_ids', id);
  await incrCounter(type);
  return ticket;
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

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ticket.email,
    reply_to: CONTACT_EMAIL,
    subject: EMAIL_SUBJECT,
    html,
    text,
    attachments,
  });
}

module.exports = {
  redis, FREE_CAP, PAID_CAP, EVENT_NAME, EVENT_DATE_LABEL, CONTACT_EMAIL, EMAIL_SUBJECT, SITE_URL,
  genTicketId, getCounters, incrCounter, checkCapacity, calcAge,
  createTicket, getTicket, getTicketByToken, checkInTicket, qrDataUrl, sendTicketEmail,
  voidTicket, unvoidTicket, listAllTickets,
  buildTicketEmailHtml, buildTicketEmailText, tierValidityLabel, tierTypeLabel, entradaUrl,
};
