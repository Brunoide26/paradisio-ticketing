const dns = require('dns').promises;
const disposableDomains = require('disposable-email-domains');
const { redis } = require('./tickets');

const DISPOSABLE_SET = new Set(disposableDomains.map((d) => d.toLowerCase()));

// MX lookups are slow and rate-limit-prone; a real domain's MX presence rarely
// changes, so a week-long cache keeps registration fast without re-querying DNS
// on every signup.
const MX_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDomain(email) {
  return (email || '').trim().toLowerCase().split('@')[1] || '';
}

async function hasMxRecords(domain) {
  const cacheKey = 'mx_cache:' + domain;
  const cached = await redis.get(cacheKey);
  if (cached !== null && cached !== undefined) return cached === true || cached === 'true';

  let valid = false;
  try {
    const records = await dns.resolveMx(domain);
    valid = Array.isArray(records) && records.length > 0;
  } catch (e) {
    valid = false;
  }

  await redis.set(cacheKey, valid, { ex: MX_CACHE_TTL_SECONDS });
  return valid;
}

// Order: a) format, b) domain has MX records, c) not a disposable-email domain.
// Deliberately no provider whitelist — that would block legitimate corporate
// and university mail. The disposable list comes from the actively maintained
// `disposable-email-domains` package, not a hand-written list.
async function validateEmail(email) {
  if (!EMAIL_FORMAT_RE.test(email || '')) {
    return { ok: false, reason: 'invalid_format' };
  }

  const domain = getDomain(email);

  const mxOk = await hasMxRecords(domain);
  if (!mxOk) {
    return { ok: false, reason: 'no_mx' };
  }

  if (DISPOSABLE_SET.has(domain)) {
    return { ok: false, reason: 'disposable' };
  }

  return { ok: true };
}

module.exports = { validateEmail, hasMxRecords, isDisposableDomain: (d) => DISPOSABLE_SET.has((d || '').toLowerCase()) };
