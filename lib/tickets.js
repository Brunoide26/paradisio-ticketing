const { Redis } = require('@upstash/redis');
const { Resend } = require('resend');
const QRCode = require('qrcode');
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
  const ticket = {
    id, name, phone, email, dni: dni || '', dob: dob || '', type,
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

async function sendTicketEmail(ticket) {
  const qr = await qrDataUrl(ticket.id);
  const qrBase64 = qr.split(',')[1];
  const isFree = ticket.type === 'free';

  let logoBase64 = null;
  try {
    logoBase64 = fs.readFileSync(path.join(__dirname, '..', 'logo.jpg')).toString('base64');
  } catch (e) {
    console.error('Could not read logo for email:', e);
  }

  const html = `
  <div style="background:#000000;padding:0;font-family:Arial,Helvetica,sans-serif;color:#fff;">
    <div style="max-width:460px;margin:0 auto;">

      <!-- brand stripe -->
      <div style="height:8px;background:linear-gradient(90deg,#FD5400 0%,#FD5400 25%,#FFC700 25%,#FFC700 50%,#E8291C 50%,#E8291C 75%,#0a0a0a 75%,#0a0a0a 100%);"></div>

      <div style="background:#0a0a0a;padding:34px 26px;text-align:center;">
        ${logoBase64 ? '<img src="cid:logo" alt="Paradisio" style="max-width:220px;width:60%;margin:0 auto 26px;display:block;margin-left:auto;margin-right:auto;" />' : '<div style="font-size:26px;font-weight:900;letter-spacing:2px;margin-bottom:26px;">PARADISIO</div>'}

        <div style="display:inline-block; background:${isFree ? '#FFC700' : '#FD5400'}; color:#000; font-weight:800; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:8px 16px; margin-bottom:20px; transform:skewX(-6deg);">
          ${isFree ? 'Lista gratis · antes de 11pm' : 'Entrada pagada · S/45'}
        </div>

        <div style="font-size:19px;font-weight:800;margin-bottom:4px;">${ticket.name}</div>
        <div style="font-size:12px;color:#999;margin-bottom:22px;">DNI: ${ticket.dni || '—'}</div>

        <div style="background:#fff;display:inline-block;padding:14px;border:3px solid #FD5400;margin-bottom:18px;">
          <img src="cid:qrcode" alt="QR" style="width:200px;height:200px;display:block;" />
        </div>

        <div style="font-family:monospace;font-size:13px;color:#999;letter-spacing:1px;margin-bottom:22px;">${ticket.id}</div>

        <div style="border-top:1px solid #2a2a2a;padding-top:18px;font-size:12px;color:#bbb;line-height:1.7;text-align:left;">
          <strong style="color:#fff;">${EVENT_NAME}</strong><br/>
          ${EVENT_DATE_LABEL}<br/><br/>
          Muestra este QR en la puerta.
          ${isFree ? ' Válido solo hasta las 11:00 pm — después aplica el cover de S/45.' : ' Válido toda la noche.'}
        </div>
      </div>

      <div style="height:8px;background:linear-gradient(90deg,#0a0a0a 0%,#0a0a0a 25%,#E8291C 25%,#E8291C 50%,#FFC700 50%,#FFC700 75%,#FD5400 75%,#FD5400 100%);"></div>

      <div style="background:#000;text-align:center;padding:16px;font-size:10px;letter-spacing:1px;color:#555;">
        PARADISIO © 2026 · EVENTO +18
      </div>
    </div>
  </div>`;

  const attachments = [
    {
      filename: 'qr.png',
      content: qrBase64,
      content_id: 'qrcode',
    },
  ];
  if (logoBase64) {
    attachments.push({
      filename: 'logo.jpg',
      content: logoBase64,
      content_id: 'logo',
    });
  }

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ticket.email,
    subject: `Tu entrada — ${EVENT_NAME}`,
    html,
    attachments,
  });
}

module.exports = {
  redis, FREE_CAP, PAID_CAP,
  genTicketId, getCounters, incrCounter, checkCapacity, calcAge,
  createTicket, getTicket, checkInTicket, qrDataUrl, sendTicketEmail,
  voidTicket, unvoidTicket, listAllTickets,
};
