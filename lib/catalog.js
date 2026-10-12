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
const TABLE_TYPES = fromEnvJson('TABLE_TYPES_JSON', [
  { type: 'dj', name: 'Box DJ Booth', price: 2000, people: 10, includes: 'Al lado de la cabina. Consumo en botellas incluido.' },
  { type: 'vip-alto', name: 'Box VIP Elevado', price: 1500, people: 10, includes: 'Plataforma elevada con vista a la pista. Consumo incluido.' },
  { type: 'vip', name: 'Box VIP', price: 1000, people: 10, includes: 'Box privado junto a la pista. Consumo incluido.' },
  { type: 'mesa', name: 'Mesa', price: 600, people: 6, includes: 'Mesa en el nivel de la pista. Consumo incluido.' },
]);

const TABLE_UNITS = fromEnvJson('TABLE_UNITS_JSON', [
  { id: 'DJ1', type: 'dj', x: 30, y: 6, w: 16, h: 12 },
  { id: 'DJ2', type: 'dj', x: 54, y: 6, w: 16, h: 12 },
  { id: 'VE1', type: 'vip-alto', x: 3, y: 26, w: 15, h: 16 },
  { id: 'VE2', type: 'vip-alto', x: 82, y: 26, w: 15, h: 16 },
  { id: 'V1', type: 'vip', x: 3, y: 50, w: 15, h: 14 },
  { id: 'V2', type: 'vip', x: 82, y: 50, w: 15, h: 14 },
  { id: 'M1', type: 'mesa', x: 6, y: 74, w: 11, h: 9 },
  { id: 'M2', type: 'mesa', x: 21, y: 80, w: 11, h: 9 },
  { id: 'M3', type: 'mesa', x: 36, y: 84, w: 11, h: 9 },
  { id: 'M4', type: 'mesa', x: 53, y: 84, w: 11, h: 9 },
  { id: 'M5', type: 'mesa', x: 68, y: 80, w: 11, h: 9 },
  { id: 'M6', type: 'mesa', x: 83, y: 74, w: 11, h: 9 },
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
  TICKET_TYPES, TABLE_TYPES, TABLE_UNITS, FREE_ENTRY, DOOR_PRICE_SOLES, MAX_TICKETS_PER_ORDER,
  TEST_SKU_ENABLED, TEST_SKU,
  isSalesOpen, getTicketTypes, findTicketType, findTableType, findTableUnit,
};
