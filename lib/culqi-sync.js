// Lectura de cobros reales desde la API de Culqi para el dashboard de CEO.
//
// Usa la misma CULQI_SECRET_KEY con la que la web ya cobra (nadie tiene que
// copiar llaves). Sólo LEE cargos: nunca crea, captura ni devuelve nada.
// El resultado se guarda 10 minutos en Redis para no consultar a Culqi en
// cada refresco del dashboard.

const CACHE_TTL = 600; // segundos

function toSec(v) {
  const n = Number(v) || 0;
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

function isSuccess(c) {
  const t = (c.outcome && (c.outcome.type || c.outcome.code)) || '';
  if (c.paid === false || c.status === 'failed') return false;
  if (t && !/exitos|success|venta/i.test(t)) return false;
  return true;
}

function methodOf(c) {
  const s = c.source || {};
  if (/yape/i.test(s.type || s.object || '') || /yape/i.test(JSON.stringify(s.iin || {}))) return 'Yape';
  const brand = (s.iin && (s.iin.card_brand || s.iin.card_type)) || s.card_brand || '';
  return brand ? String(brand).replace(/^\w/, (m) => m.toUpperCase()) : 'Tarjeta';
}

async function listCharges(key, fromSec, toSecV) {
  const out = [];
  let after = null;
  for (let page = 0; page < 30; page++) {
    const qs = new URLSearchParams({ creation_date_from: String(fromSec), creation_date_to: String(toSecV), limit: '100' });
    if (after) qs.set('after', after);
    const r = await fetch('https://api.culqi.com/v2/charges?' + qs.toString(), { headers: { Authorization: 'Bearer ' + key } });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      const err = new Error('culqi_' + r.status); err.detail = t.slice(0, 200); throw err;
    }
    const j = await r.json();
    const data = Array.isArray(j.data) ? j.data : [];
    out.push(...data);
    const next = j.paging && j.paging.cursors && j.paging.cursors.after;
    if (!next || !data.length || next === after) break;
    after = next;
  }
  return out;
}

// Ventana de venta de una fecha: desde el día siguiente a la fecha anterior
// de la misma marca (o 45 días antes) hasta el mediodía del día después.
function windowFor(event, events) {
  const same = events.filter((e) => e.brand === event.brand && e.date < event.date).sort((a, b) => a.date.localeCompare(b.date));
  const prev = same[same.length - 1];
  const start = prev ? new Date(prev.date + 'T12:00:00-05:00').getTime() + 24 * 3600 * 1000 : new Date(event.date + 'T00:00:00-05:00').getTime() - 45 * 24 * 3600 * 1000;
  const end = new Date(event.date + 'T12:00:00-05:00').getTime() + 24 * 3600 * 1000;
  return { from: Math.floor(start / 1000), to: Math.floor(end / 1000) };
}

function summarize(charges, from, to) {
  const ok = charges.filter(isSuccess).filter((c) => { const s = toSec(c.creation_date); return !s || (s >= from && s <= to); });
  const byMethod = new Map();
  const byDay = new Map();
  let amount = 0, fee = 0;
  ok.forEach((c) => {
    const a = (Number(c.amount) || 0) / 100;
    const f = (Number(c.total_fee) || 0) / 100 + (Number(c.total_fee_taxes) || 0) / 100;
    amount += a; fee += f;
    const m = methodOf(c);
    const g = byMethod.get(m) || { label: m, amount: 0, n: 0 }; g.amount += a; g.n++; byMethod.set(m, g);
    const d = new Date(toSec(c.creation_date) * 1000 - 5 * 3600 * 1000).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + a);
  });
  return {
    count: ok.length,
    failed: charges.length - ok.length,
    amount: Math.round(amount * 100) / 100,
    fee: Math.round(fee * 100) / 100,
    net: Math.round((amount - fee) * 100) / 100,
    byMethod: [...byMethod.values()].map((x) => ({ ...x, amount: Math.round(x.amount * 100) / 100 })).sort((a, b) => b.amount - a.amount),
    byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, a]) => ({ d, amount: Math.round(a * 100) / 100 })),
  };
}

async function culqiForEvents(redis, events) {
  const key = process.env.CULQI_SECRET_KEY;
  if (!key) return { connected: false, reason: 'missing_key' };
  const cacheKey = 'ceo:culqi:v1:' + events.map((e) => e.id + '@' + e.date).join(',');
  try {
    const cached = await redis.get(cacheKey);
    if (cached && cached.at && Date.now() - cached.at < CACHE_TTL * 1000) return cached;
  } catch (e) { /* sin caché */ }

  const result = { connected: true, at: Date.now(), byEvent: {}, mode: key.startsWith('sk_live') ? 'live' : 'test' };
  try {
    for (const e of events) {
      const w = windowFor(e, events);
      if (w.from > Date.now() / 1000) { result.byEvent[e.id] = { ...summarize([], w.from, w.to), window: w }; continue; }
      const charges = await listCharges(key, w.from, w.to);
      result.byEvent[e.id] = { ...summarize(charges, w.from, w.to), window: w };
    }
  } catch (err) {
    return { connected: false, reason: err.message, detail: err.detail || '' };
  }
  try { await redis.set(cacheKey, result, { ex: CACHE_TTL }); } catch (e) { /* sin caché */ }
  return result;
}

module.exports = { culqiForEvents };
