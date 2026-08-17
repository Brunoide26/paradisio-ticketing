// Time-windowed pricing catalog for Paradisio ticket sales. All cutoffs are
// Lima wall-clock times (UTC-5, no DST) written as explicit ISO offsets, so
// the window logic doesn't depend on the server process's local timezone.

const { TEST_SKU_ENABLED } = require('./config');

// Preventa ends and Club starts at the same instant (Thu 27/08 00:00 Lima) —
// a single shared boundary, checked with < on one side and <= on the other,
// so every instant belongs to exactly one window. Two separate constants for
// "23:59:59" and "00:00:00" previously left a ~1s gap where neither matched
// and sales looked closed right at midnight.
const PREVENTA_CLUB_BOUNDARY = new Date('2026-08-27T00:00:00-05:00');
const CLUB_END = new Date('2026-08-28T19:00:00-05:00');
const CORTESIA_END = new Date('2026-08-23T23:59:59-05:00');

const CORTESIA_CAP = 450;
const DOOR_PRICE_SOLES = 50;

const PAID_NIGHT_NOTE = 'Todas las entradas pagadas son válidas a cualquier hora de la noche.';
const CORTESIA_NOTE = 'Ingreso libre hasta las 12:00 a.m. presentando tu QR. Sujeto a aforo.';
const CLOSED_MESSAGE = 'Venta cerrada. Entrada en puerta S/' + DOOR_PRICE_SOLES;
const SOLD_OUT_MESSAGE = 'Cortesías agotadas';

const PREVENTA_SKUS = [
  { sku: 'preventa-individual', tier: 'Preventa', name: 'Individual', qty: 1, price: 35 },
  { sku: 'preventa-duo', tier: 'Preventa', name: 'Duo', qty: 2, price: 60 },
  { sku: 'preventa-trio', tier: 'Preventa', name: 'Trío', qty: 3, price: 85 },
  { sku: 'preventa-crew', tier: 'Preventa', name: 'Crew', qty: 4, price: 110 },
];

const CLUB_SKUS = [
  { sku: 'club-individual', tier: 'Club', name: 'Individual', qty: 1, price: 45 },
  { sku: 'club-duo', tier: 'Club', name: 'Duo', qty: 2, price: 80 },
  { sku: 'club-trio', tier: 'Club', name: 'Trío', qty: 3, price: 115 },
];

// Never listed in getPaidSkus()/the public catalog — only resolvable by exact
// id, and only while TEST_SKU_ENABLED is on, regardless of sales window. Lets
// the real Culqi charge + ticket + email + /entrada flow be rehearsed for
// S/1 instead of full price. See lib/config.js for how to turn it off.
const TEST_SKU = { sku: 'qa-check', tier: 'QA', name: 'Prueba interna', qty: 1, price: 1 };

function getSalesWindow(now = new Date()) {
  if (now.getTime() < PREVENTA_CLUB_BOUNDARY.getTime()) return 'preventa';
  if (now.getTime() <= CLUB_END.getTime()) return 'club';
  return 'closed';
}

function getPaidSkus(now = new Date()) {
  const window = getSalesWindow(now);
  if (window === 'preventa') return PREVENTA_SKUS;
  if (window === 'club') return CLUB_SKUS;
  return [];
}

// Looks up a SKU only among the SKUs valid for the current window — a Preventa
// sku id sent after the window rolled over to Club (or closed) won't resolve,
// so price/qty is always read from the server's current window, never the client.
// The test SKU is the one exception: resolvable by id any time TEST_SKU_ENABLED
// is on, independent of the sales window, since it exists to rehearse the flow.
function findPaidSku(skuId, now = new Date()) {
  if (TEST_SKU_ENABLED && skuId === TEST_SKU.sku) return TEST_SKU;
  return getPaidSkus(now).find((s) => s.sku === skuId) || null;
}

function isCortesiaDateOpen(now = new Date()) {
  return now.getTime() <= CORTESIA_END.getTime();
}

module.exports = {
  getSalesWindow, getPaidSkus, findPaidSku, isCortesiaDateOpen,
  CORTESIA_CAP, DOOR_PRICE_SOLES, PAID_NIGHT_NOTE, CORTESIA_NOTE, CLOSED_MESSAGE, SOLD_OUT_MESSAGE,
  TEST_SKU_ENABLED, TEST_SKU,
};
