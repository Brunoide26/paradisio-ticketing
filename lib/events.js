// Cada fecha de Paradisio es un "evento". Los tickets y los códigos se sellan
// con el id del evento vigente al crearse (eventId = fecha ISO), y el admin
// filtra todo por evento: cada fecha arranca en cero y las anteriores quedan
// guardadas para consultarlas.
//
// Evento vigente = EVENT_DATE_ISO (env) o el default de abajo. Para la próxima
// fecha basta con cambiar EVENT_DATE_ISO / EVENT_NAME en Vercel (o los
// defaults aquí) y, si se quiere un nombre bonito en el selector del admin
// para fechas pasadas, sumarla a PAST_EVENTS.
const CURRENT_EVENT_ID = process.env.EVENT_DATE_ISO || '2026-10-17';
const CURRENT_EVENT_NAME = process.env.EVENT_NAME || 'After Hours by Jägermeister';

const PAST_EVENTS = [
  { id: '2026-08-28', name: 'Apertura', legacy: true },
  { id: '2026-10-17', name: 'After Hours by Jägermeister' },
];

// Tickets y códigos creados antes de que existiera eventId: las invitaciones
// de promotor sólo existen desde el 17/10; todo lo demás es de la apertura.
const LEGACY_EVENT_ID = '2026-08-28';
const FIRST_PROMO_EVENT_ID = '2026-10-17';

function eventIdOfTicket(t) {
  if (!t) return null;
  if (t.eventId) return t.eventId;
  return t.type === 'promo' ? FIRST_PROMO_EVENT_ID : LEGACY_EVENT_ID;
}

function eventIdOfInvite(i) {
  if (!i) return null;
  return i.eventId || FIRST_PROMO_EVENT_ID;
}

// Lista para el selector del admin, la más reciente primero. Incluye el
// evento vigente aunque no esté en PAST_EVENTS, y cualquier id que aparezca
// en los datos aunque no tenga nombre registrado.
function listEvents(extraIds = []) {
  const byId = new Map(PAST_EVENTS.map((e) => [e.id, { ...e }]));
  if (!byId.has(CURRENT_EVENT_ID)) byId.set(CURRENT_EVENT_ID, { id: CURRENT_EVENT_ID, name: CURRENT_EVENT_NAME });
  else byId.get(CURRENT_EVENT_ID).name = CURRENT_EVENT_NAME;
  extraIds.forEach((id) => { if (id && !byId.has(id)) byId.set(id, { id, name: id }); });
  return [...byId.values()]
    .map((e) => ({ ...e, current: e.id === CURRENT_EVENT_ID }))
    .sort((a, b) => b.id.localeCompare(a.id));
}

module.exports = { CURRENT_EVENT_ID, LEGACY_EVENT_ID, eventIdOfTicket, eventIdOfInvite, listEvents };
