const { EVENT_MAPS_URL } = require('../lib/tickets');

// paradisioclub.com/como-llegar -> Google Maps de la fecha actual. El correo
// del QR enlaza aquí y no directo a google.com: los filtros de spam
// desconfían de links que no son del dominio que envía el correo.
module.exports = (req, res) => {
  res.statusCode = 302;
  res.setHeader('Location', EVENT_MAPS_URL);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
};
