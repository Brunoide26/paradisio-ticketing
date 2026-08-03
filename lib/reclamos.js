const { redis } = require('./tickets');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'Paradisio <tickets@tu-dominio.com>';
const INTERNAL_EMAIL = 'info@paradisioclub.com';

const PROVIDER = {
  razonSocial: 'Bruno Yofreed Espinoza Pérez',
  ruc: '10720126589',
  nombreComercial: 'Paradisio Club',
  domicilio: 'Jr. 28 de Julio 277, Barranco, Lima',
};

const PLAZO_DIAS_HABILES = 15;

// Feriados nacionales Perú 2026 (fuente: RPP / Plataforma del Estado Peruano, gob.pe/feriados)
const FERIADOS_2026 = new Set([
  '2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01',
  '2026-06-07', '2026-06-29', '2026-07-23', '2026-07-28', '2026-07-29',
  '2026-08-06', '2026-08-30', '2026-10-08', '2026-11-01',
  '2026-12-08', '2026-12-09', '2026-12-25',
]);

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

function isBusinessDay(d) {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  if (FERIADOS_2026.has(toISODate(d))) return false;
  return true;
}

function calcPlazoLimite(createdAtISO) {
  const d = new Date(createdAtISO);
  let count = 0;
  while (count < PLAZO_DIAS_HABILES) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) count++;
  }
  return d;
}

// Business days strictly between `from` (exclusive) and `to` (inclusive). Negative if `to` is in the past.
function businessDaysBetween(from, to) {
  const sign = to >= from ? 1 : -1;
  let a = sign === 1 ? from : to;
  const b = sign === 1 ? to : from;
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) count++;
  }
  return count * sign;
}

function calcDiasHabilesRestantes(createdAtISO, status) {
  if (status === 'respondido') return null;
  const deadline = calcPlazoLimite(createdAtISO);
  const today = new Date();
  return businessDaysBetween(today, deadline);
}

function semaforo(diasRestantes) {
  if (diasRestantes === null) return 'none';
  if (diasRestantes < 3) return 'red';
  if (diasRestantes <= 7) return 'amber';
  return 'green';
}

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

// Returns true if this IP is still under the submission limit for the current window.
async function checkRateLimit(ip) {
  const key = 'reclamo_rl:' + (ip || 'unknown');
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  return count <= RATE_LIMIT_MAX;
}

async function nextReclamoId() {
  const n = await redis.incr('reclamos:counter');
  return 'PDS-LR-' + String(n).padStart(6, '0');
}

async function createReclamo(fields) {
  const id = await nextReclamoId();
  const reclamo = {
    id,
    createdAt: new Date().toISOString(),
    status: 'pendiente',
    respuesta: '',
    respondedAt: null,
    ...fields,
  };
  await redis.set('reclamo:' + id, reclamo);
  await redis.sadd('all_reclamo_ids', id);
  return reclamo;
}

async function getReclamo(id) {
  return await redis.get('reclamo:' + id.toUpperCase());
}

async function listAllReclamos() {
  const keys = await redis.keys('reclamo:*');
  if (!keys || keys.length === 0) return [];
  const reclamos = await Promise.all(keys.map((k) => redis.get(k)));
  return reclamos
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function respondReclamo(id, respuesta) {
  const reclamo = await getReclamo(id);
  if (!reclamo) return { ok: false, reason: 'not_found' };
  reclamo.respuesta = respuesta;
  reclamo.status = 'respondido';
  reclamo.respondedAt = new Date().toISOString();
  await redis.set('reclamo:' + reclamo.id, reclamo);
  return { ok: true, reclamo };
}

function formatDate(d) {
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function tipoBienLabel(r) { return r.tipoBien; }

function hojaResumenHtml(r) {
  const deadline = calcPlazoLimite(r.createdAt);
  return `
    <table style="width:100%;border-collapse:collapse;font-size:13px;color:#ddd;">
      <tr><td style="padding:6px 0;color:#888;">N.º de hoja</td><td style="padding:6px 0;font-weight:700;color:#fff;">${r.id}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Fecha del reclamo</td><td style="padding:6px 0;">${formatDate(new Date(r.createdAt))}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Tipo</td><td style="padding:6px 0;">${r.tipoReclamo}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Consumidor</td><td style="padding:6px 0;">${r.nombres}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Documento</td><td style="padding:6px 0;">${r.tipoDocumento} ${r.numeroDocumento}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;">${r.email}</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Bien contratado</td><td style="padding:6px 0;">${tipoBienLabel(r)} — ${r.descripcionBien}</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Detalle</td><td style="padding:6px 0;white-space:pre-wrap;">${r.detalle}</td></tr>
      <tr><td style="padding:6px 0;color:#888;vertical-align:top;">Pedido concreto</td><td style="padding:6px 0;white-space:pre-wrap;">${r.pedidoConcreto}</td></tr>
      <tr><td style="padding:6px 0;color:#888;">Plazo límite de respuesta</td><td style="padding:6px 0;font-weight:700;color:#FF9A00;">${formatDate(deadline)}</td></tr>
    </table>`;
}

async function sendReclamoEmails(reclamo) {
  const subject = `Hoja de Reclamación ${reclamo.id} — Paradisio Club`;
  const consumerHtml = `
    <div style="background:#090909;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#F2EDE4;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="font-size:22px;font-weight:900;letter-spacing:1px;margin-bottom:6px;">PARADISIO</div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FF2800;margin-bottom:24px;">Libro de Reclamaciones</div>
        <p style="font-size:14px;line-height:1.6;">Hemos registrado tu ${reclamo.tipoReclamo.toLowerCase()} con el siguiente número de hoja:</p>
        <div style="font-size:20px;font-weight:900;color:#FF2800;margin:14px 0 22px;">${reclamo.id}</div>
        ${hojaResumenHtml(reclamo)}
        <p style="font-size:13px;line-height:1.7;color:#bbb;margin-top:24px;">Conforme al Código de Protección y Defensa del Consumidor, Paradisio Club deberá dar respuesta a tu reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables, contados desde el día siguiente de su presentación.</p>
        <p style="font-size:13px;line-height:1.7;color:#bbb;">La formulación de este reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.</p>
        <div style="border-top:1px solid #2a2a2a;margin-top:24px;padding-top:16px;font-size:11px;color:#666;">
          ${PROVIDER.nombreComercial} · RUC ${PROVIDER.ruc} · ${PROVIDER.domicilio}
        </div>
      </div>
    </div>`;

  const internalHtml = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111;">
      <h2>Nuevo reclamo/queja registrado — ${reclamo.id}</h2>
      ${hojaResumenHtml(reclamo)}
      <p style="margin-top:16px;"><strong>Responder antes de:</strong> ${formatDate(calcPlazoLimite(reclamo.createdAt))} (15 días hábiles improrrogables).</p>
    </div>`;

  await Promise.all([
    resend.emails.send({ from: FROM_EMAIL, to: reclamo.email, subject, html: consumerHtml }),
    resend.emails.send({ from: FROM_EMAIL, to: INTERNAL_EMAIL, subject: `[Reclamo] ${reclamo.id} — vence ${formatDate(calcPlazoLimite(reclamo.createdAt))}`, html: internalHtml }),
  ]);
}

async function sendRespuestaEmail(reclamo) {
  const html = `
    <div style="background:#090909;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#F2EDE4;">
      <div style="max-width:480px;margin:0 auto;">
        <div style="font-size:22px;font-weight:900;letter-spacing:1px;margin-bottom:6px;">PARADISIO</div>
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#FF2800;margin-bottom:24px;">Respuesta a tu reclamo ${reclamo.id}</div>
        <p style="font-size:14px;line-height:1.6;">Hemos atendido tu ${reclamo.tipoReclamo.toLowerCase()} presentado el ${formatDate(new Date(reclamo.createdAt))}. Nuestra respuesta:</p>
        <div style="background:#141414;border:1px solid #232323;padding:16px;margin:16px 0;font-size:13px;line-height:1.7;white-space:pre-wrap;">${reclamo.respuesta}</div>
        <div style="border-top:1px solid #2a2a2a;margin-top:24px;padding-top:16px;font-size:11px;color:#666;">
          ${PROVIDER.nombreComercial} · RUC ${PROVIDER.ruc} · ${PROVIDER.domicilio}
        </div>
      </div>
    </div>`;
  await resend.emails.send({
    from: FROM_EMAIL,
    to: reclamo.email,
    subject: `Respuesta a tu reclamación ${reclamo.id} — Paradisio Club`,
    html,
  });
}

module.exports = {
  PROVIDER,
  createReclamo, getReclamo, listAllReclamos, respondReclamo,
  calcPlazoLimite, calcDiasHabilesRestantes, semaforo,
  sendReclamoEmails, sendRespuestaEmail,
  checkRateLimit,
};
