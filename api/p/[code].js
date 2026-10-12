// Link corto de promotor: paradisioclub.com/p/SERGIO -> paradisioclub.com/?ref=SERGIO
// La portada guarda el ref y atribuye al promotor el free entry, las
// entradas y las mesas que saque esa persona. Un código desconocido igual
// redirige: la portada simplemente lo ignora.
module.exports = async (req, res) => {
  const code = String((req.query && req.query.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  res.statusCode = 302;
  res.setHeader('Location', code ? '/?ref=' + code : '/');
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
};
