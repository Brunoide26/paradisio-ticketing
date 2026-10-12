// Catálogo de la fecha vigente: entradas pagadas, free entry y mesas/boxes.
//
// Todo lo que se vende se define AQUÍ y sólo aquí: el precio que cobra el
// servidor sale de este archivo, nunca del navegador. Para una fecha nueva se
// editan las listas de abajo (o se pisan con variables de entorno, ver
// TICKET_TYPES_JSON / TABLE_TYPES_JSON / TABLE_UNITS_JSON).
//
// Precios por persona y cupos son PROVISIONALES hasta que Bruno los confirme.

const { TEST_SKU_ENABLED } = require('./config');

function fromEnvJson(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch (e) {
    console.error('Invalid JSON in ' + name + ', using defaults');
    return fallback;
  }
}

// ---------- Entradas pagadas ----------
// cap: cuántas se pueden vender de ese tipo en la fecha (null = sin tope
// propio; igual aplica PAID_CAP global). saleEnds: ISO con offset; después
// de esa hora el tipo deja de venderse (null = hasta que cierre la venta).
const TICKET_TYPES = fromEnvJson('TICKET_TYPES_JSON', [
  {
    sku: 'early', name: 'Early Entry', price: 30, cap: 100, saleEnds: null,
    description: 'Ingreso a cualquier hora de la noche. Cupo limitado.',
  },
  {
    sku: 'general', name: 'General', price: 40, cap: null, saleEnds: null,
    description: 'Ingreso a cualquier hora de la noche.',
  },
]);

// Máximo de entradas pagadas por compra (todas nominales).
const MAX_TICKETS_PER_ORDER = 10;

// Venta online abierta hasta esta hora (ISO con offset). null = sin corte.
const SALES_END = process.env.SALES_END || null;

// ---------- Free entry ----------
const FREE_ENTRY = {
  name: 'Free Entry',
  description: 'Ingreso libre hasta las 11:00 p.m. Registro sujeto a aprobación: tu QR llega por correo días antes del evento.',
};

// Precio en puerta después del corte del free entry (sólo informativo).
const DOOR_PRICE_SOLES = parseInt(process.env.DOOR_PRICE || '40', 10);

// ---------- Mesas y boxes ----------
// Cada tipo: precio total de la reserva, cuántas personas entran con ella y
// qué incluye. Cada unidad del mapa apunta a un tipo y tiene su posición en
// el plano (x, y, w, h en una grilla de 100 x 100).
const BOTELLAS_A_ELECCION = 'Jägermeister, Tanqueray London, Kick The Rules, Smirnoff, Johnnie Walker Black o Tequila Jimador';

// Precios: Box Paradisio y Mesa según lo conversado (S/ 2,000 y S/ 600);
// Box After Hours PROVISIONAL hasta que Bruno lo confirme.
const TABLE_TYPES = fromEnvJson('TABLE_TYPES_JSON', [
  { type: 'paradisio', name: 'Box Paradisio', price: 2000, people: 10,
    includes: '1 botella Jägermeister, 2 botellas a elección, 8 insumos, 8 Red Bull y 6 Corona.',
    where: 'A los lados del DJ booth' },
  { type: 'afterhours', name: 'Box After Hours', price: 1200, people: 8,
    includes: '1 botella Jägermeister, 1 botella a elección, 6 insumos, 6 Red Bull y 6 Corona.',
    where: 'Boxes laterales' },
  { type: 'mesa', name: 'Mesa', price: 600, people: 6,
    includes: '1 botella a elección, 4 insumos y 4 Red Bull.',
    where: 'Repartidas en el local' },
]);

// Plano real del local (plano.jpg). x, y, w, h en % del ancho y alto del
// plano. Una unidad sin coordenadas (las mesas, que no están dibujadas)
// igual se vende: se elige por botón en vez de en el mapa.
// Box 5 y 6 = Box Paradisio (junto al DJ booth); Box 1 a 4 = Box After Hours.
const TABLE_MAP = {
  image: '/plano.jpg',
  ratio: 910 / 844,
  // Rótulos que el plano no trae dibujados.
  labels: [
    { text: 'DJ BOOTH', x: 71.4, y: 25.2, accent: true },
    { text: 'BARRA', x: 21, y: 13.5 },
    { text: 'PISTA', x: 60, y: 45 },
    { text: 'ENTRADA', x: 46.5, y: 99 },
  ],
};

const TABLE_UNITS = fromEnvJson('TABLE_UNITS_JSON', [
  { id: 'BOX5', label: 'Box 5', type: 'paradisio', x: 46.5, y: 10.3, w: 16.5, h: 11.8 },
  { id: 'BOX6', label: 'Box 6', type: 'paradisio', x: 77.8, y: 10.3, w: 18.7, h: 11.8 },
  { id: 'BOX4', label: 'Box 4', type: 'afterhours', x: 3.1, y: 43.6, w: 11.2, h: 15.6 },
  { id: 'BOX3', label: 'Box 3', type: 'afterhours', x: 3.1, y: 60.3, w: 11.2, h: 16.5 },
  { id: 'BOX2', label: 'Box 2', type: 'afterhours', x: 2.5, y: 77.0, w: 17.3, h: 14.1 },
  { id: 'BOX1', label: 'Box 1', type: 'afterhours', x: 20.0, y: 77.0, w: 15.9, h: 14.1 },
  // Mesas: posiciones propuestas, ajustables (x, y, w, h en % del plano).
  { id: 'M1', label: 'Mesa 1', short: 'M1', type: 'mesa', x: 17.4, y: 26.6, w: 6, h: 6.4 },
  { id: 'M2', label: 'Mesa 2', short: 'M2', type: 'mesa', x: 13.2, y: 49.2, w: 6, h: 6.4 },
  { id: 'M3', label: 'Mesa 3', short: 'M3', type: 'mesa', x: 13.2, y: 66.3, w: 6, h: 6.4 },
  { id: 'M4', label: 'Mesa 4', short: 'M4', type: 'mesa', x: 87.7, y: 27.8, w: 6, h: 6.4 },
  { id: 'M5', label: 'Mesa 5', short: 'M5', type: 'mesa', x: 87.7, y: 39.8, w: 6, h: 6.4 },
  { id: 'M6', label: 'Mesa 6', short: 'M6', type: 'mesa', x: 87.7, y: 51.8, w: 6, h: 6.4 },
]);

// Hidden S/1 test SKU (see lib/config.js). Never listed publicly.
const TEST_SKU = { sku: 'qa-check', name: 'Prueba interna', price: 1, cap: null, saleEnds: null, description: '' };

function isSalesOpen(now = new Date()) {
  if (!SALES_END) return true;
  const end = new Date(SALES_END);
  return isNaN(end.getTime()) || now.getTime() < end.getTime();
}

function isTypeOnSale(t, now = new Date()) {
  if (!t.saleEnds) return true;
  const end = new Date(t.saleEnds);
  return isNaN(end.getTime()) || now.getTime() < end.getTime();
}

function getTicketTypes(now = new Date()) {
  if (!isSalesOpen(now)) return [];
  return TICKET_TYPES.filter((t) => isTypeOnSale(t, now));
}

function findTicketType(sku, now = new Date()) {
  if (TEST_SKU_ENABLED && sku === TEST_SKU.sku) return TEST_SKU;
  return getTicketTypes(now).find((t) => t.sku === sku) || null;
}

function findTableType(type) {
  return TABLE_TYPES.find((t) => t.type === type) || null;
}

function findTableUnit(id) {
  const unit = TABLE_UNITS.find((u) => u.id === String(id || '').toUpperCase());
  if (!unit) return null;
  const type = findTableType(unit.type);
  return type ? { ...unit, typeInfo: type } : null;
}

module.exports = {
  TICKET_TYPES, TABLE_TYPES, TABLE_UNITS, TABLE_MAP, BOTELLAS_A_ELECCION, FREE_ENTRY, DOOR_PRICE_SOLES, MAX_TICKETS_PER_ORDER,
  TEST_SKU_ENABLED, TEST_SKU,
  isSalesOpen, getTicketTypes, findTicketType, findTableType, findTableUnit,
};
