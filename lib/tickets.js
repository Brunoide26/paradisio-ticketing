const { Redis } = require('@upstash/redis');
const { Resend } = require('resend');
const QRCode = require('qrcode');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const FREE_CAP = parseInt(process.env.FREE_CAP || '200', 10);
const PAID_CAP = parseInt(process.env.PAID_CAP || '150', 10);
const EVENT_NAME = 'Paradisio — Apertura';
const EVENT_DATE_LABEL = 'Viernes 28 de agosto · Espacio NHN, Barranco';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Paradisio <tickets@tu-dominio.com>';

function genTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'PDS-' + s;
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

async function createTicket({ name, phone, email, type, amount }) {
  const id = genTicketId();
  const ticket = {
    id, name, phone, email, type,
    amount: amount || 0,
    createdAt: new Date().toISOString(),
    checkedIn: false,
    voided: false,
  };
  await redis.set('ticket:' + id, ticket);
  await redis.sadd('all_ticket_ids', id);
  await incrCounter(type);
  return ticket;
}

async function getTicket(id) {
  return await redis.get('ticket:' + id.toUpperCase());
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
  const ids = await redis.smembers('all_ticket_ids');
  if (!ids || ids.length === 0) return [];
  const tickets = await Promise.all(ids.map((id) => redis.get('ticket:' + id)));
  return tickets
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function qrDataUrl(text) {
  return await QRCode.toDataURL(text, { width: 360, margin: 1 });
}

async function sendTicketEmail(ticket) {
  const qr = await qrDataUrl(ticket.id);
  const qrBase64 = qr.split(',')[1];
  const isFree = ticket.type === 'free';

  const html = `
  <div style="background:#000;padding:40px 20px;font-family:Arial,sans-serif;color:#fff;">
    <div style="max-width:420px;margin:0 auto;background:#0a0a0a;border:1px solid #ff28aa55;border-radius:16px;padding:30px;text-align:center;">
      <div style="font-size:11px;letter-spacing:2px;color:#ff28aa;text-transform:uppercase;margin-bottom:6px;">
        ${isFree ? 'Lista gratis · antes de 11pm' : 'Entrada pagada · S/45'}
      </div>
      <div style="font-size:18px;font-weight:bold;margin-bottom:18px;">${ticket.name}</div>
      <img src="cid:qrcode" alt="QR" style="width:220px;height:220px;background:#fff;padding:12px;border-radius:10px;" />
      <div style="font-family:monospace;font-size:13px;color:#999;letter-spacing:1px;margin:16px 0;">${ticket.id}</div>
      <div style="font-size:12px;color:#aaa;line-height:1.6;border-top:1px solid #232323;padding-top:16px;">
        ${EVENT_NAME}<br/>${EVENT_DATE_LABEL}<br/><br/>
        Muestra este QR en la puerta.
        ${isFree ? ' Válido solo hasta las 11:00 pm — después aplica el cover de S/45.' : ' Válido toda la noche.'}
      </div>
    </div>
  </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ticket.email,
    subject: `Tu entrada — ${EVENT_NAME}`,
    html,
    attachments: [
      {
        filename: 'qr.png',
        content: qrBase64,
        content_id: 'qrcode',
      },
    ],
  });
}

module.exports = {
  redis, FREE_CAP, PAID_CAP,
  genTicketId, getCounters, incrCounter, checkCapacity,
  createTicket, getTicket, checkInTicket, qrDataUrl, sendTicketEmail,
  voidTicket, unvoidTicket, listAllTickets,
};
