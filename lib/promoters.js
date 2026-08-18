// The 14 launch promoters — codes are first names because they're voice-friendly
// (dictated over a call, typed from memory, easy to correct if misspelled).
// Name/code pairs are static; only the active/inactive flag is mutable at
// runtime (Redis-backed) so a code can be shut off without a redeploy.
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
];
const PROMOTERS_BY_CODE = new Map(PROMOTERS.map((p) => [p.code, p]));

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
  const base = PROMOTERS_BY_CODE.get(norm);
  if (!base) return null;
  return { code: norm, name: base.name, active: await isActive(norm) };
}

async function listPromoters() {
  const flags = await Promise.all(PROMOTERS.map((p) => isActive(p.code)));
  return PROMOTERS.map((p, i) => ({ code: p.code, name: p.name, active: flags[i] }));
}

async function setPromoterActive(code, active) {
  const norm = normalizeCode(code);
  if (!PROMOTERS_BY_CODE.has(norm)) return { ok: false, reason: 'not_found' };
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
  normalizeCode, getPromoter, listPromoters, setPromoterActive, resolveActivePromoter, applyDiscount,
};
