const { checkPortalInvite } = require('../lib/promoter-portal');

// La portada llama aquí cuando alguien llega con el link de un código
// (paradisioclub.com/i/CODIGO). Dice si el código sirve y de parte de qué
// promotor viene (sólo su primer nombre, para "Invitación de Gonzalo").
// Siempre 200: un código malo no es un error del request, es una respuesta.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const r = await checkPortalInvite(req.query && req.query.code);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: r.ok,
      reason: r.reason || null,
      code: r.ok ? r.code : null,
      promoter: r.promoter ? { code: r.promoter.code, firstName: r.promoter.firstName } : null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
