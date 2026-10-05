// Los links por promotor (/p/{nombre}) quedaron retirados: ahora cada
// invitado recibe su propio código de un solo uso y lo canjea en la página
// principal. Este endpoint sólo redirige para que los links viejos que
// quedaron circulando no den 404.
module.exports = async (req, res) => {
  res.statusCode = 302;
  res.setHeader('Location', '/');
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
};
