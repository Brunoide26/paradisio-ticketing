// The launch promoters — codes are first names because they're voice-friendly
// (dictated over a call, typed from memory, easy to correct if misspelled).
// Name/code pairs are static, so a new code needs a code change + deploy;
// only the active/inactive flag is mutable at runtime (Redis-backed) so an
// existing code can be shut off without a redeploy.
const { redis } = require('./tickets');

const PROMOTERS = [
  { code: 'SERGIO', name: 'Sergio Requena' },
  { code: 'GUILLERMO', name: 'Guillermo Chiroque' },
  { code: 'LUCIENNE', name: 'Lucienne Navach' },
  { code: 'DIEGO', name: 'Diego Murdoch' },
  { code: 'DANIEL', name: 'Daniel Gurtra' },
  { code: 'MARIANO', name: 'Mariano Gambirazio' },
  { code: 'JOSUE', name: 'Josué Masalias' },
  { code: 'ALEJANDRO', name: 'Alejandro Garay' },
  { code: 'JOAQUIN', name: 'Joaquín Velasco' },
  { code: 'GONZALO', name: 'Gonzalo Abad' },
  { code: 'GABRIEL', name: 'Gabriel Zarzar' },
  { code: 'CAROLINA', name: 'Carolina Huamán' },
  { code: 'MICAELA', name: 'Micaela Byrne' },
  { code: 'ANTONELLA', name: 'Antonella Meléndez' },
  { code: 'MANUELA', name: 'Manuela Trujillo' },
  { code: 'PADRON', name: 'Alejandro Padrón' },
  { code: 'PARADISIO', name: 'Paradisio Club' },
  // MICAELAO and ANTONIA are distinct codes/people from MICAELA and
  // ANTONELLA above, not renames or reuses of them.
  { code: 'MICAELAO', name: 'Micaela Ortiz' },
  { code: 'ANTONIA', name: 'Antonia' },
  { code: 'JUANI', name: 'Juan Nicolás Montoya' },
  { code: 'ISABELLA', name: 'Isabella Carranza' },
  { code: 'MARLO', name: 'Marlo' },
];
const PROMOTERS_BY_CODE = new Map(PROMOTERS.map((p) => [p.code, p]));

// Promotores agregados desde el admin (sin redeploy). Viven en Redis como
// una lista de { code, name, createdAt } y se suman a los fijos de arriba.
const CUSTOM_KEY = 'promoters_custom';

async function getCustomPromoters() {
  const list = await redis.get(CUSTOM_KEY);
  return Array.isArray(list) ? list : [];
}

async function allPromoterBases() {
  const custom = await getCustomPromoters();
  const seen = new Set(PROMOTERS.map((p) => p.code));
  return PROMOTERS.concat(custom.filter((p) => !seen.has(p.code)));
}

// Promotores eliminados desde el admin. No se borra nada de verdad: el
// código queda reservado (no se reasigna a otra persona) y sus entradas ya
// emitidas siguen válidas y atribuidas; sólo dejan de aparecer en la lista
// y no pueden recibir códigos nuevos.
const REMOVED_KEY = 'promoters_removed';

async function getRemovedCodes() {
  const v = await redis.get(REMOVED_KEY);
  return new Set(Array.isArray(v) ? v : []);
}

async function removePromoter(code) {
  const norm = normalizeCode(code);
  if (!(await findBase(norm))) return { ok: false, reason: 'not_found' };
  const removed = await getRemovedCodes();
  removed.add(norm);
  await redis.set(REMOVED_KEY, [...removed]);
  return { ok: true, code: norm };
}

async function findBase(code) {
  if (PROMOTERS_BY_CODE.has(code)) return PROMOTERS_BY_CODE.get(code);
  return (await getCustomPromoters()).find((p) => p.code === code) || null;
}

// Código = primer nombre en mayúsculas sin tildes (como los fijos). Si ya
// existe, se le agrega la inicial del apellido, y si no alcanza, un número.
function baseCodeFromName(name) {
  const parts = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^A-Z ]/g, '').trim().split(/\s+/).filter(Boolean);
  return parts;
}

async function addPromoter(name) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (clean.length < 2 || clean.length > 60) return { ok: false, reason: 'invalid_name' };
  const parts = baseCodeFromName(clean);
  if (!parts.length) return { ok: false, reason: 'invalid_name' };
  const all = await allPromoterBases();
  const taken = new Set(all.map((p) => p.code));
  let code = parts[0].slice(0, 16);
  if (taken.has(code) && parts[1]) code = (parts[0] + parts[1][0]).slice(0, 16);
  let n = 2;
  const stem = code;
  while (taken.has(code)) code = stem + (n++);
  const custom = await getCustomPromoters();
  const promoter = { code, name: clean, createdAt: new Date().toISOString() };
  custom.push(promoter);
  await redis.set(CUSTOM_KEY, custom);
  return { ok: true, promoter: { ...promoter, active: true } };
}

const DISCOUNT_RATE = 0.10;

function normalizeCode(code) {
  return (code || '').trim().toUpperCase();
}

// Stored as a small object, never a bare boolean or a bare numeric-looking
// string. @upstash/redis's response decoder has no case for a boolean-typed
// REST result (only string/number/object) and always decodes one to
// undefined; separately, its "smart" string deserializer auto-JSON.parses
// any stored string that looks like a JSON literal ('0', '1', 'false', ...)
// back into that literal's native type, which defeats a plain string flag
// too. An object is the one shape this SDK round-trips reliably — same
// pattern already used for every other piece of state in lib/tickets.js.
async function isActive(code) {
  const flag = await redis.get('promoter_active:' + code);
  // Unset means never toggled off — default active.
  return !flag || flag.active !== false;
}

// Only returns known codes; active state is layered on separately so callers
// that need to show an admin toggle can still see an inactive promoter's name.
async function getPromoter(code) {
  const norm = normalizeCode(code);
  if (!norm) return null;
  const base = await findBase(norm);
  if (!base) return null;
  const removed = (await getRemovedCodes()).has(norm);
  return { code: norm, name: base.name, active: !removed && await isActive(norm), removed };
}

// includeRemoved: el admin lo usa para seguir mostrando, en fechas pasadas,
// a un promotor eliminado que sí tuvo entradas en esa fecha.
async function listPromoters({ includeRemoved = false } = {}) {
  const [bases, removed] = await Promise.all([allPromoterBases(), getRemovedCodes()]);
  const visible = includeRemoved ? bases : bases.filter((p) => !removed.has(p.code));
  const flags = await Promise.all(visible.map((p) => isActive(p.code)));
  return visible.map((p, i) => ({
    code: p.code, name: p.name, active: flags[i] && !removed.has(p.code),
    custom: !PROMOTERS_BY_CODE.has(p.code), removed: removed.has(p.code),
  }));
}

async function setPromoterActive(code, active) {
  const norm = normalizeCode(code);
  if (!(await findBase(norm))) return { ok: false, reason: 'not_found' };
  await redis.set('promoter_active:' + norm, { active: !!active });
  return { ok: true };
}

// The one function checkout/landing code should call: an unknown or
// deactivated code both resolve to null, so callers treat them identically
// to "no code given" — never an error, never a block.
async function resolveActivePromoter(code) {
  const p = await getPromoter(code);
  return p && p.active ? p : null;
}

// Integer-cents math so 10% off a soles price with a .50 remainder (e.g.
// S/35 -> S/3.50 off) never drifts from floating point rounding.
function applyDiscount(priceSoles) {
  const subtotalCents = Math.round(priceSoles * 100);
  const discountCents = Math.round(subtotalCents * DISCOUNT_RATE);
  const totalCents = subtotalCents - discountCents;
  return { subtotalCents, discountCents, totalCents };
}

module.exports = {
  PROMOTERS, DISCOUNT_RATE,
  normalizeCode, getPromoter, listPromoters, setPromoterActive, resolveActivePromoter, applyDiscount, addPromoter, removePromoter,
};
