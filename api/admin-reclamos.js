const { listAllReclamos, calcDiasHabilesRestantes, semaforo } = require('../lib/reclamos');

module.exports = async (req, res) => {
  try {
    const passcode = req.method === 'POST' ? (req.body || {}).passcode : req.query.passcode;
    if (passcode !== process.env.STAFF_PASSCODE) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const reclamos = await listAllReclamos();
    const withStatus = reclamos.map((r) => {
      const diasHabilesRestantes = calcDiasHabilesRestantes(r.createdAt, r.status);
      return { ...r, diasHabilesRestantes, semaforo: semaforo(diasHabilesRestantes) };
    });
    return res.status(200).json({ reclamos: withStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
