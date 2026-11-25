// Dashboard de CEO (/administracion): finanzas por marca y evento + números
// en vivo de la web de tickets.
//
// Clave: CEO_PASSCODE (variable de entorno en Vercel). Mientras no exista,
// acepta la STAFF_PASSCODE para no dejar la página inaccesible; en cuanto se
// configure CEO_PASSCODE, la del staff deja de servir aquí.
//
// POST { passcode }                          -> { finance, live, generatedAt }
// POST { passcode, action: 'save', finance } -> guarda las finanzas editadas
// POST { passcode, action: 'reset' }         -> vuelve a los datos de arranque
//
// Lo "en vivo" sale agregado por fecha: conteos, curvas y rankings. Nunca
// manda nombres, DNI, correos ni teléfonos de asistentes.

const { redis, SEED, FINANCE_KEY, ceoPasscode, validFinance, loadPayload } = require('../lib/ceo-data');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const body = req.body || {};
    const expected = ceoPasscode();
    if (!expected || body.passcode !== expected) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (body.action === 'save') {
      const f = body.finance;
      if (!validFinance(f)) return res.status(400).json({ error: 'invalid_finance' });
      f.updatedAt = new Date().toISOString();
      await redis.set(FINANCE_KEY, f);
      return res.status(200).json({ ok: true, updatedAt: f.updatedAt });
    }
    if (body.action === 'reset') {
      await redis.del(FINANCE_KEY);
      return res.status(200).json({ ok: true, finance: SEED });
    }

    return res.status(200).json(await loadPayload());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
