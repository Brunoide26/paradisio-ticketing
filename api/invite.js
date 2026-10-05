const { checkInvite } = require('../lib/invites');
const { EVENT_NAME, EVENT_DATE_LABEL, EVENT_DATE_ISO } = require('../lib/tickets');

// Primer paso de la página principal: ¿este código existe y sigue libre?
// Siempre 200 -- un código malo no es un error del request, es una respuesta.
// Nunca dice de qué promotor es el código ni quién lo usó.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const result = await checkInvite(req.query && req.query.code);
    return res.status(200).json({
      ...result,
      event: { name: EVENT_NAME, dateLabel: EVENT_DATE_LABEL, dateIso: EVENT_DATE_ISO },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
