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
// entryCutoff: hasta qué hora vale el QR en puerta (null = toda la noche);
// pasada esa hora el scanner lo marca DESPUÉS DE HORA y el staff decide.
// validityLabel: cómo se muestra ese horario en el correo y en /entrada.
const TICKET_TYPES = fromEnvJson('TICKET_TYPES_JSON', [
  {
    sku: 'early', name: 'Early Entry', price: 40, cap: null, saleEnds: null,
    description: 'Ingreso hasta las 12:00 a.m. Incluye welcome cocktail.',
    entryCutoff: process.env.EARLY_ENTRY_CUTOFF || '2026-11-15T00:00:00-05:00',
    validityLabel: 'hasta las 12:00 a.m.',
  },
  {
    sku: 'allnight', name: 'All Night Entry', price: 55, cap: null, saleEnds: null,
    description: 'Ingreso a cualquier hora de la noche. Incluye welcome cocktail.',
    entryCutoff: null,
    validityLabel: 'a cualquier hora de la noche',
  },
]);

function ticketTypeBySku(sku) {
  return TICKET_TYPES.find((t) => t.sku === sku) || null;
}

// Máximo de entradas pagadas por compra (todas nominales).
const MAX_TICKETS_PER_ORDER = 10;

// Venta online abierta hasta esta hora (ISO con offset). null = sin corte.
const SALES_END = process.env.SALES_END || null;

// ---------- Free entry ----------
const FREE_ENTRY = {
  name: 'Free Entry',
  description: 'Entrada libre hasta las 11:00 p.m. Tu QR llegará por correo días antes del evento, tras ser aprobado. Después de esa hora, S/ 50 en puerta.',
};

// Precio en puerta después del corte del free entry (sólo informativo).
const DOOR_PRICE_SOLES = parseInt(process.env.DOOR_PRICE || '50', 10);

// ---------- Mesas y boxes ----------
// Cada tipo: precio total de la reserva, cuántas personas entran con ella y
// qué incluye. Cada unidad del mapa apunta a un tipo y tiene su posición en
// el plano (x, y, w, h en una grilla de 100 x 100).
const BOTELLAS_A_ELECCION = 'Jägermeister, Tanqueray London, Kick The Rules, Smirnoff, Johnnie Walker Black o Tequila Jimador';

// Precios confirmados por Bruno (12/10): Box Paradisio S/1,500, Box After Hours S/1,000, Mesa S/600.
const TABLE_TYPES = fromEnvJson('TABLE_TYPES_JSON', [
  { type: 'paradisio', name: 'Box Paradisio', price: 1500, people: 10,
    includes: '1 botella Jägermeister, 2 botellas a elección, 8 insumos, 8 Red Bull y 6 Corona.',
    where: 'A los lados del DJ booth', color: '#E2361F' },
  { type: 'afterhours', name: 'Box After Hours', price: 1000, people: 8,
    includes: '1 botella Jägermeister, 1 botella a elección, 6 insumos, 6 Red Bull y 6 Corona.',
    where: 'Boxes en zona reservada', color: '#E8B04B' },
  { type: 'mesa', name: 'Mesa', price: 600, people: 6,
    includes: '1 botella a elección, 4 insumos y 4 Red Bull.',
    where: 'Repartidas en el local', color: '#8FC1D4' },
]);

// Plano del local, redibujado en vector a partir del plano real (lo dibuja
// index.html). x, y, w, h de cada unidad en una grilla de 100 x 100.
// Box 5 y 6 = Box Paradisio (junto al DJ booth); Box 1 a 4 = Box After Hours.
const TABLE_MAP = { kind: 'vector' };

const TABLE_UNITS = fromEnvJson('TABLE_UNITS_JSON', [
  { id: 'BOX5', label: 'Box 5', type: 'paradisio', x: 48.3, y: 11.8, w: 13, h: 8.6 },
  { id: 'BOX6', label: 'Box 6', type: 'paradisio', x: 80.6, y: 12, w: 14, h: 8.6 },
  { id: 'BOX4', label: 'Box 4', type: 'afterhours', x: 4.3, y: 45.4, w: 9, h: 12 },
  { id: 'BOX3', label: 'Box 3', type: 'afterhours', x: 4.3, y: 62.3, w: 9, h: 12 },
  { id: 'BOX2', label: 'Box 2', type: 'afterhours', x: 4.9, y: 78.7, w: 13, h: 10.5 },
  { id: 'BOX1', label: 'Box 1', type: 'afterhours', x: 21.6, y: 78.7, w: 13, h: 10.5 },
  // Mesas según el plano que marcó Bruno (29/10). M1 y M2 en la zona reservada.
  { id: 'M1', label: 'Mesa 1', type: 'mesa', x: 28.4, y: 50.3, w: 5, h: 5 },
  { id: 'M2', label: 'Mesa 2', type: 'mesa', x: 28.4, y: 64.1, w: 5, h: 5 },
  { id: 'M3', label: 'Mesa 3', type: 'mesa', x: 60.9, y: 53.3, w: 5, h: 5 },
  { id: 'M4', label: 'Mesa 4', type: 'mesa', x: 75.1, y: 53.3, w: 5, h: 5 },
  { id: 'M5', label: 'Mesa 5', type: 'mesa', x: 89.3, y: 53.3, w: 5, h: 5 },
  { id: 'M6', label: 'Mesa 6', type: 'mesa', x: 89.3, y: 42.4, w: 5, h: 5 },
  { id: 'M7', label: 'Mesa 7', type: 'mesa', x: 89.3, y: 30.7, w: 5, h: 5 },
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
  isSalesOpen, getTicketTypes, findTicketType, ticketTypeBySku, findTableType, findTableUnit,
};
