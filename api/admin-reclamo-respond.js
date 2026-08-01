const { respondReclamo, sendRespuestaEmail } = require('../lib/reclamos');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const { id, passcode, respuesta } = req.body || {};
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (!id || !respuesta || !respuesta.trim()) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const result = await respondReclamo(id, respuesta.trim());
    if (!result.ok) return res.status(404).json(result);

    try {
      await sendRespuestaEmail(result.reclamo);
    } catch (emailErr) {
      console.error('Respuesta email send failed:', emailErr);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
