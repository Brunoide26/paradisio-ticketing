const { createReclamo, sendReclamoEmails, checkRateLimit, calcPlazoLimite } = require('../lib/reclamos');

const TIPO_DOCUMENTO = ['DNI', 'CE', 'Pasaporte', 'RUC'];
const TIPO_BIEN = ['Producto', 'Servicio'];
const TIPO_RECLAMO = ['Reclamo', 'Queja'];

const MAX_LEN = {
  nombres: 200,
  numeroDocumento: 20,
  domicilio: 300,
  email: 200,
  telefono: 30,
  apoderado: 200,
  descripcionBien: 500,
  detalle: 2000,
  pedidoConcreto: 1000,
};

function getClientIp(req) {
  const fwd = req.headers && req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  try {
    const b = req.body || {};

    // Honeypot: a hidden field a real person would never fill. If it's set, this is
    // almost certainly a bot — discard without touching the correlative or sending mail,
    // but still answer 200 so the bot gets no signal that it was caught.
    if ((b.website || '').trim()) {
      return res.status(200).json({ reclamo: null });
    }

    const ip = getClientIp(req);
    const withinLimit = await checkRateLimit(ip);
    if (!withinLimit) {
      return res.status(429).json({ error: 'rate_limited' });
    }

    const nombres = (b.nombres || '').trim();
    const tipoDocumento = b.tipoDocumento;
    const numeroDocumento = (b.numeroDocumento || '').trim();
    const domicilio = (b.domicilio || '').trim();
    const email = (b.email || '').trim();
    const telefono = (b.telefono || '').trim();
    const esMenorEdad = !!b.esMenorEdad;
    const apoderado = (b.apoderado || '').trim();
    const tipoBien = b.tipoBien;
    const descripcionBien = (b.descripcionBien || '').trim();
    const montoReclamado = b.montoReclamado === '' || b.montoReclamado === undefined || b.montoReclamado === null
      ? null : Number(b.montoReclamado);
    const tipoReclamo = b.tipoReclamo;
    const detalle = (b.detalle || '').trim();
    const pedidoConcreto = (b.pedidoConcreto || '').trim();
    const declaracionVeraz = !!b.declaracionVeraz;

    if (!nombres || !TIPO_DOCUMENTO.includes(tipoDocumento) || !numeroDocumento || !domicilio || !email) {
      return res.status(400).json({ error: 'missing_fields' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }
    if (esMenorEdad && !apoderado) {
      return res.status(400).json({ error: 'missing_apoderado' });
    }
    if (!TIPO_BIEN.includes(tipoBien) || !descripcionBien) {
      return res.status(400).json({ error: 'missing_bien' });
    }
    if (montoReclamado !== null && (isNaN(montoReclamado) || montoReclamado < 0)) {
      return res.status(400).json({ error: 'invalid_monto' });
    }
    if (!TIPO_RECLAMO.includes(tipoReclamo)) {
      return res.status(400).json({ error: 'missing_tipo_reclamo' });
    }
    if (!detalle) {
      return res.status(400).json({ error: 'invalid_detalle' });
    }
    if (!pedidoConcreto) {
      return res.status(400).json({ error: 'invalid_pedido' });
    }
    if (!declaracionVeraz) {
      return res.status(400).json({ error: 'missing_declaracion' });
    }

    const fieldLengths = { nombres, numeroDocumento, domicilio, email, telefono, apoderado, descripcionBien, detalle, pedidoConcreto };
    for (const [field, value] of Object.entries(fieldLengths)) {
      if (value.length > MAX_LEN[field]) {
        return res.status(400).json({ error: 'field_too_long', field });
      }
    }

    const reclamo = await createReclamo({
      nombres, tipoDocumento, numeroDocumento, domicilio, email, telefono,
      esMenorEdad, apoderado: esMenorEdad ? apoderado : '',
      tipoBien, descripcionBien, montoReclamado,
      tipoReclamo, detalle, pedidoConcreto,
    });

    try {
      await sendReclamoEmails(reclamo);
    } catch (emailErr) {
      console.error('Reclamo email send failed:', emailErr);
    }

    return res.status(200).json({ reclamo, plazoLimite: calcPlazoLimite(reclamo.createdAt) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
