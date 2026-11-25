// Paradisio OS (/administracion). Un solo usuario: entra con la misma clave
// que el dashboard de CEO (CEO_PASSCODE, o STAFF_PASSCODE mientras no exista).
// La clave se valida aquí, en el servidor, en cada request; el frontend no es
// la barrera.
//
// POST { passcode, action: 'load' }                       -> datos + cálculos + atención + actividad
// POST { passcode, action: 'summary', brand, from, to, withTaxes } -> cálculos de un alcance
// POST { passcode, action: 'save', finance, baseVersion }   -> guarda el documento completo
// POST { passcode, action: 'event.update', id, patch, baseVersion }
// POST { passcode, action: 'event.create', event, baseVersion }
// POST { passcode, action: 'activity' }                    -> registro de actividad
//
// Datos: el mismo documento de finanzas de siempre (Redis `ceo:finance`), así
// que api/ceo.js y este endpoint leen y escriben lo mismo. Cada escritura:
//   - rechaza si alguien guardó después de que cargaste (baseVersion),
//   - guarda la versión anterior en `ceo:finance:history` (últimas 50),
//   - deja una entrada en `os:audit` (últimas 500).

const { redis, FINANCE_KEY, ceoPasscode, loadFinance, validFinance, loadPayload } = require('../lib/ceo-data');
const { culqiForEvents } = require('../lib/culqi-sync');
const { STAGES, STAGE_IDS, stageOf, statusForStage, isActualStage } = require('../lib/os/stages');
const { METRICS, summarize, attention } = require('../lib/os/finance');

const HISTORY_KEY = 'ceo:finance:history';
const AUDIT_KEY = 'os:audit';
const MAX_FAILS = 8;

function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

async function authorize(req, body) {
  const failKey = 'os:auth_fail:' + ipOf(req);
  const fails = Number(await redis.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return 'locked';
  const expected = ceoPasscode();
  if (!expected || body.passcode !== expected) {
    await redis.incr(failKey);
    await redis.expire(failKey, 15 * 60);
    return 'unauthorized';
  }
  if (fails) await redis.del(failKey);
  return 'ok';
}

const versionOf = (f) => (f && f.updatedAt) || null;

async function audit(action, detail) {
  await redis.lpush(AUDIT_KEY, { at: new Date().toISOString(), actor: 'admin', action, ...detail });
  await redis.ltrim(AUDIT_KEY, 0, 499);
}

// Escribe el documento con control de versión, historial y auditoría.
async function write(current, next, baseVersion, action, detail) {
  if (baseVersion !== undefined && baseVersion !== versionOf(current.seeded ? null : current.finance)) {
    return { status: 409, body: { error: 'conflict', message: 'Alguien guardó cambios después de que cargaste. Recarga y vuelve a intentar.' } };
  }
  if (!validFinance(next)) return { status: 400, body: { error: 'invalid_finance' } };
  if (!current.seeded) {
    await redis.lpush(HISTORY_KEY, { savedAt: new Date().toISOString(), finance: current.finance });
    await redis.ltrim(HISTORY_KEY, 0, 49);
  }
  next.updatedAt = new Date().toISOString();
  await redis.set(FINANCE_KEY, next);
  await audit(action, detail);
  return { status: 200, body: { ok: true, version: next.updatedAt, finance: next } };
}

const EDITABLE = ['name', 'date', 'venue', 'brand', 'notes', 'stage', 'liveEventId', 'openingStock'];

function applyPatch(e, patch) {
  const changes = {};
  EDITABLE.forEach((k) => {
    if (!(k in patch)) return;
    let v = patch[k];
    if (k === 'stage') { if (!STAGE_IDS.includes(v)) throw new Error('bad_stage'); }
    else if (k === 'date') { if (!/^\d{4}-\d{2}-\d{2}$/.test(v || '')) throw new Error('bad_date'); }
    else if (k === 'openingStock') { v = v === null || v === '' ? null : Number(v); if (v !== null && !Number.isFinite(v)) throw new Error('bad_amount'); }
    else v = String(v == null ? '' : v).slice(0, 300);
    if (JSON.stringify(e[k]) !== JSON.stringify(v)) changes[k] = { from: e[k] === undefined ? null : e[k], to: v };
    e[k] = v;
  });
  if (changes.stage) {
    const from = changes.stage.from || stageOf({ status: e.status });
    e.status = statusForStage(e.stage);
    // Al pasar a números reales, se guarda el presupuesto aprobado para poder compararlo.
    if (!isActualStage(from) && isActualStage(e.stage) && !e.budget && ((e.income || []).length || (e.costs || []).length)) {
      e.budget = { approvedAt: new Date().toISOString(), income: JSON.parse(JSON.stringify(e.income || [])), costs: JSON.parse(JSON.stringify(e.costs || [])) };
    }
  }
  return changes;
}

function withStages(finance) {
  (finance.events || []).forEach((e) => { e.stage = stageOf(e); });
  return finance;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const body = req.body || {};
    const auth = await authorize(req, body);
    if (auth === 'locked') return res.status(429).json({ error: 'locked', message: 'Demasiados intentos. Espera 15 minutos.' });
    if (auth !== 'ok') return res.status(401).json({ error: 'unauthorized' });
    const action = body.action || 'load';
    const usingStaffPasscode = !process.env.CEO_PASSCODE;

    if (action === 'load') {
      const p = await loadPayload();
      withStages(p.finance);
      const s = summarize(p.finance, { culqi: p.culqi });
      const activity = await redis.lrange(AUDIT_KEY, 0, 29);
      return res.status(200).json({
        ...p,
        version: p.seeded ? null : versionOf(p.finance),
        os: { stages: STAGES, metrics: METRICS, summary: s, attention: attention(s, { culqi: p.culqi, usingStaffPasscode }), activity },
      });
    }

    if (action === 'summary') {
      const { finance } = await loadFinance();
      withStages(finance);
      let culqi = null;
      try { culqi = await culqiForEvents(redis, finance.events || []); } catch (e) { culqi = null; }
      const s = summarize(finance, { brand: body.brand || null, from: body.from || null, to: body.to || null, withTaxes: body.withTaxes !== false, culqi });
      return res.status(200).json({ summary: s, attention: attention(s, { culqi, usingStaffPasscode }) });
    }

    if (action === 'activity') {
      return res.status(200).json({ activity: await redis.lrange(AUDIT_KEY, 0, 199) });
    }

    const current = await loadFinance();
    const next = JSON.parse(JSON.stringify(current.finance));

    if (action === 'save') {
      const f = body.finance;
      if (f && Array.isArray(f.events)) {
        const before = new Map((current.finance.events || []).map((e) => [e.id, e]));
        f.events.forEach((e) => {
          const stage = stageOf(e);
          const prev = before.get(e.id);
          const prevStage = prev ? stageOf(prev) : null;
          // Pasa a números reales desde el editor: guarda el presupuesto que había.
          if (prev && !isActualStage(prevStage) && isActualStage(stage) && !e.budget && ((prev.income || []).length || (prev.costs || []).length)) {
            e.budget = { approvedAt: new Date().toISOString(), income: prev.income || [], costs: prev.costs || [] };
          }
          e.stage = stage;
          e.status = statusForStage(stage);
        });
      }
      const r = await write(current, f, body.baseVersion, 'finance.save', { events: (f && f.events || []).length });
      return res.status(r.status).json(r.body);
    }

    if (action === 'event.update') {
      const e = (next.events || []).find((x) => x.id === body.id);
      if (!e) return res.status(404).json({ error: 'not_found' });
      let changes;
      try { changes = applyPatch(e, body.patch || {}); } catch (err) { return res.status(400).json({ error: err.message }); }
      if (!Object.keys(changes).length) return res.status(200).json({ ok: true, version: versionOf(current.finance), finance: withStages(next) });
      const r = await write(current, next, body.baseVersion, 'event.update', { event: e.id, name: e.name, changes });
      if (r.body.finance) withStages(r.body.finance);
      return res.status(r.status).json(r.body);
    }

    if (action === 'event.create') {
      const ev = body.event || {};
      const brandIds = (next.brands || []).map((b) => b.id);
      if (!brandIds.includes(ev.brand)) return res.status(400).json({ error: 'bad_brand' });
      const e = { id: `${ev.brand}-${Date.now().toString(36)}`, brand: ev.brand, date: '', name: '', venue: '', stage: 'concept', status: 'planificación', liveEventId: '', notes: '', income: [], costs: [], brandInvestment: [] };
      try { applyPatch(e, { name: ev.name || 'Nueva fecha', date: ev.date, venue: ev.venue || '', stage: ev.stage || 'concept', notes: ev.notes || '' }); } catch (err) { return res.status(400).json({ error: err.message }); }
      e.status = statusForStage(e.stage);
      delete e.budget;
      next.events = [...(next.events || []), e];
      const r = await write(current, next, body.baseVersion, 'event.create', { event: e.id, name: e.name });
      if (r.body.finance) withStages(r.body.finance);
      return res.status(r.status).json({ ...r.body, id: e.id });
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
