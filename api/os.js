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
// POST { passcode, action: 'event.numbers', id, numbers, baseVersion } -> reemplaza los números de un evento
//
// Además de la clave, acepta `Authorization: Bearer <OS_API_TOKEN>` (variable
// de entorno en Vercel, mínimo 32 caracteres), autorizado por el dueño el
// 25/11/2026. Es la llave con la que Claude carga los reportes después de cada
// evento: sus cambios quedan en la auditoría como actor "claude" y se revoca
// borrando la variable en Vercel.
//
// Datos: el mismo documento de finanzas de siempre (Redis `ceo:finance`), así
// que api/ceo.js y este endpoint leen y escriben lo mismo. Cada escritura:
//   - rechaza si alguien guardó después de que cargaste (baseVersion),
//   - guarda la versión anterior en `ceo:finance:history` (últimas 50),
//   - deja una entrada en `os:audit` (últimas 500).

const crypto = require('crypto');
const { redis, FINANCE_KEY, ceoPasscode, loadFinance, validFinance, loadPayload } = require('../lib/ceo-data');
const { culqiForEvents } = require('../lib/culqi-sync');
const { STAGES, STAGE_IDS, stageOf, statusForStage, isActualStage } = require('../lib/os/stages');
const { METRICS, summarize, attention } = require('../lib/os/finance');
const { readDoc, updateDoc } = require('../lib/os/docs');
const L = require('../lib/os/ledger');
const I = require('../lib/os/inventory');

// Libro + inventario + sus resúmenes para un alcance (grupo o marca).
async function opsPayload(finance, brand = null) {
  const [ledger, inventory] = await Promise.all([readDoc(redis, 'ledger'), readDoc(redis, 'inventory')]);
  return {
    ledger, inventory,
    ledgerSummary: L.ledgerSummary(ledger, { finance, brand }),
    inventorySummary: I.inventorySummary(inventory),
    // Por evento: pagos/cobros del libro y consumo según los conteos.
    byEvent: Object.fromEntries((finance.events || []).map((e) => [e.id, { payments: L.eventPayments(ledger, e.id), inventory: I.eventConsumption(inventory, e.id) }])),
  };
}

// Alertas de caja e inventario que se suman a la lista de atención.
function opsAttention(ops) {
  const out = [];
  const ls = ops.ledgerSummary, is = ops.inventorySummary;
  if (ls.payables.overdue) out.push({ level: 'high', title: 'Pagos vencidos', text: `${ls.payables.overdue} pago(s) por hacer ya pasaron su fecha de vencimiento.`, route: '/finanzas/por-pagar' });
  if (is.low.length) out.push({ level: 'med', title: 'Stock bajo', text: `${is.low.length} producto(s) por debajo del mínimo: ${is.products.filter((p) => p.low).map((p) => p.name).slice(0, 4).join(', ')}.`, route: '/inventario' });
  const noOpening = ls.accounts.filter((a) => !a.archived && a.openingBalance == null);
  if (noOpening.length) out.push({ level: 'low', title: 'Cuentas sin saldo inicial', text: `Sin saldo inicial no se puede calcular la caja: ${noOpening.map((a) => a.name).join(', ')}.`, route: '/finanzas/cuentas' });
  return out;
}
const rank = { high: 0, med: 1, low: 2 };
const merged = (a, b) => [...a, ...b].sort((x, y) => rank[x.level] - rank[y.level]);

const HISTORY_KEY = 'ceo:finance:history';
const AUDIT_KEY = 'os:audit';
const MAX_FAILS = 8;

function ipOf(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function bearerOk(req) {
  const token = process.env.OS_API_TOKEN || '';
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (token.length < 32 || !m) return false;
  const a = Buffer.from(m[1].trim()), b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Devuelve { status: 'ok' | 'unauthorized' | 'locked', actor }.
async function authorize(req, body) {
  const failKey = 'os:auth_fail:' + ipOf(req);
  const fails = Number(await redis.get(failKey)) || 0;
  if (fails >= MAX_FAILS) return { status: 'locked' };
  let actor = null;
  if (bearerOk(req)) actor = 'claude';
  else if (ceoPasscode() && body.passcode === ceoPasscode()) actor = 'admin';
  if (!actor) {
    await redis.incr(failKey);
    await redis.expire(failKey, 15 * 60);
    return { status: 'unauthorized' };
  }
  if (fails) await redis.del(failKey);
  return { status: 'ok', actor };
}

const versionOf = (f) => (f && f.updatedAt) || null;

async function audit(action, detail, actor = 'admin') {
  await redis.lpush(AUDIT_KEY, { at: new Date().toISOString(), actor, action, ...detail });
  await redis.ltrim(AUDIT_KEY, 0, 499);
}

// Escribe el documento con control de versión, historial y auditoría.
async function write(current, next, baseVersion, action, detail, actor) {
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
  await audit(action, detail, actor);
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

// Números de un evento (ingresos, costos, stock, barra). Reemplaza sólo las
// claves que vienen y valida cada línea. Devuelve totales antes → después.
const sumAmt = (l) => Math.round((l || []).reduce((t, x) => t + (Number(x.amount) || 0), 0) * 100) / 100;
function cleanLines(list, withCategory) {
  if (!Array.isArray(list) || list.length > 300) throw new Error('bad_lines');
  return list.map((l) => {
    const amount = Number(l && l.amount);
    if (!l || typeof l.label !== 'string' || !l.label.trim() || !Number.isFinite(amount)) throw new Error('bad_line');
    const out = { label: l.label.trim().slice(0, 200), amount: Math.round(amount * 100) / 100 };
    if (withCategory) out.category = String(l.category || 'Otros').slice(0, 60);
    return out;
  });
}
function applyNumbers(e, n) {
  const changes = {};
  const track = (k, before, after) => { if (JSON.stringify(before) !== JSON.stringify(after)) changes[k] = { from: before, to: after }; };
  if ('income' in n) { const v = cleanLines(n.income, true); track('income', sumAmt(e.income), sumAmt(v)); e.income = v; }
  if ('costs' in n) { const v = cleanLines(n.costs, true); track('costs', sumAmt(e.costs), sumAmt(v)); e.costs = v; }
  if ('brandInvestment' in n) { const v = cleanLines(n.brandInvestment, false); track('brandInvestment', sumAmt(e.brandInvestment), sumAmt(v)); e.brandInvestment = v; }
  ['stockLeft', 'openingStock'].forEach((k) => {
    if (!(k in n)) return;
    const v = n[k] === null || n[k] === '' ? null : Number(n[k]);
    if (v !== null && !Number.isFinite(v)) throw new Error('bad_amount');
    track(k, e[k] ?? null, v); e[k] = v;
  });
  if ('stock' in n) {
    if (!Array.isArray(n.stock) || n.stock.length > 300) throw new Error('bad_stock');
    const v = n.stock.map((x) => { const cost = Number(x && x.cost); if (!x || typeof x.label !== 'string' || !Number.isFinite(cost)) throw new Error('bad_stock'); return { label: x.label.slice(0, 200), detail: String(x.detail || '').slice(0, 300), cost }; });
    track('stock', (e.stock || []).length, v.length); e.stock = v;
  }
  if ('bar' in n) {
    if (n.bar !== null && (typeof n.bar !== 'object' || Array.isArray(n.bar))) throw new Error('bad_bar');
    track('bar', e.bar ? 'sí' : 'no', n.bar ? 'sí' : 'no');
    if (n.bar) e.bar = n.bar; else delete e.bar;
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
    if (auth.status === 'locked') return res.status(429).json({ error: 'locked', message: 'Demasiados intentos. Espera 15 minutos.' });
    if (auth.status !== 'ok') return res.status(401).json({ error: 'unauthorized' });
    const actor = auth.actor;
    const action = body.action || 'load';
    const usingStaffPasscode = !process.env.CEO_PASSCODE;

    if (action === 'load') {
      const p = await loadPayload();
      withStages(p.finance);
      const s = summarize(p.finance, { culqi: p.culqi });
      const activity = await redis.lrange(AUDIT_KEY, 0, 29);
      const ops = await opsPayload(p.finance);
      return res.status(200).json({
        ...p,
        version: p.seeded ? null : versionOf(p.finance),
        ledger: ops.ledger, inventory: ops.inventory,
        os: {
          stages: STAGES, metrics: METRICS, summary: s, activity,
          attention: merged(attention(s, { culqi: p.culqi, usingStaffPasscode }), opsAttention(ops)),
          ledgerSummary: ops.ledgerSummary, inventorySummary: ops.inventorySummary, byEvent: ops.byEvent,
          enums: { txKinds: L.KINDS, accountTypes: L.ACCOUNT_TYPES, docTypes: L.DOC_TYPES, moveTypes: I.MOVES, productKinds: I.KINDS },
        },
      });
    }

    if (action === 'summary') {
      const { finance } = await loadFinance();
      withStages(finance);
      let culqi = null;
      try { culqi = await culqiForEvents(redis, finance.events || []); } catch (e) { culqi = null; }
      const s = summarize(finance, { brand: body.brand || null, from: body.from || null, to: body.to || null, withTaxes: body.withTaxes !== false, culqi });
      const ops = await opsPayload(finance, body.brand || null);
      return res.status(200).json({ summary: s, ledgerSummary: ops.ledgerSummary, attention: merged(attention(s, { culqi, usingStaffPasscode }), opsAttention(ops)) });
    }

    // ---------- Libro: cuentas y transacciones ----------
    if (action.startsWith('account.') || action.startsWith('tx.') || action.startsWith('inv.')) {
      const { finance } = await loadFinance();
      const ctx = { events: finance.events || [], brands: finance.brands || [] };
      let r;
      if (action === 'account.upsert') {
        r = await updateDoc(redis, 'ledger', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const i = d.accounts.findIndex((a) => a.id === (body.account || {}).id);
          const acc = L.cleanAccount(body.account, i >= 0 ? d.accounts[i] : null);
          if (i >= 0) d.accounts[i] = acc; else d.accounts.push(acc);
          return { account: acc.id, name: acc.name };
        } });
      } else if (action === 'tx.upsert') {
        r = await updateDoc(redis, 'ledger', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const i = d.transactions.findIndex((t) => t.id === (body.tx || {}).id);
          const tx = L.cleanTx(body.tx, { accounts: d.accounts, ...ctx }, i >= 0 ? d.transactions[i] : null);
          L.assertUniqueRef(d.transactions, tx);
          const before = i >= 0 ? d.transactions[i] : null;
          if (i >= 0) d.transactions[i] = tx; else d.transactions.push(tx);
          return { tx: tx.id, name: tx.description, event: tx.eventId || undefined, changes: { amount: { from: before ? before.amount : null, to: tx.amount }, ...(before && before.paidOn !== tx.paidOn ? { paidOn: { from: before.paidOn, to: tx.paidOn } } : {}) } };
        } });
      } else if (action === 'tx.delete') {
        r = await updateDoc(redis, 'ledger', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const t = d.transactions.find((x) => x.id === body.id);
          if (!t) throw new Error('not_found');
          d.transactions = d.transactions.filter((x) => x.id !== body.id);
          return { tx: t.id, name: t.description, changes: { amount: { from: t.amount, to: null } } };
        } });
      } else if (action === 'inv.product.upsert') {
        r = await updateDoc(redis, 'inventory', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const i = d.products.findIndex((x) => x.id === (body.product || {}).id);
          const pr = I.cleanProduct(body.product, i >= 0 ? d.products[i] : null);
          if (i >= 0) d.products[i] = pr; else d.products.push(pr);
          return { product: pr.id, name: pr.name };
        } });
      } else if (action === 'inv.move.add') {
        r = await updateDoc(redis, 'inventory', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const list = Array.isArray(body.moves) ? body.moves : [body.move];
          if (!list.length || list.length > 200) throw new Error('bad_moves');
          const ms = list.map((m) => I.cleanMove(m, { products: d.products, events: ctx.events }));
          d.movements.push(...ms);
          return { moves: ms.length, name: ms.length === 1 ? (d.products.find((x) => x.id === ms[0].productId) || {}).name : `${ms.length} movimientos`, event: ms[0].eventId || undefined };
        } });
      } else if (action === 'inv.move.delete') {
        r = await updateDoc(redis, 'inventory', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
          const m = d.movements.find((x) => x.id === body.id);
          if (!m) throw new Error('not_found');
          d.movements = d.movements.filter((x) => x.id !== body.id);
          return { move: m.id, name: (d.products.find((x) => x.id === m.productId) || {}).name };
        } });
      } else {
        return res.status(400).json({ error: 'unknown_action' });
      }
      return res.status(r.status).json(r.body);
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
      const r = await write(current, f, body.baseVersion, 'finance.save', { events: (f && f.events || []).length }, actor);
      return res.status(r.status).json(r.body);
    }

    if (action === 'event.update') {
      const e = (next.events || []).find((x) => x.id === body.id);
      if (!e) return res.status(404).json({ error: 'not_found' });
      let changes;
      try { changes = applyPatch(e, body.patch || {}); } catch (err) { return res.status(400).json({ error: err.message }); }
      if (!Object.keys(changes).length) return res.status(200).json({ ok: true, version: versionOf(current.finance), finance: withStages(next) });
      const r = await write(current, next, body.baseVersion, 'event.update', { event: e.id, name: e.name, changes }, actor);
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
      const r = await write(current, next, body.baseVersion, 'event.create', { event: e.id, name: e.name }, actor);
      if (r.body.finance) withStages(r.body.finance);
      return res.status(r.status).json({ ...r.body, id: e.id });
    }

    if (action === 'event.duplicate') {
      const src = (next.events || []).find((x) => x.id === body.id);
      if (!src) return res.status(404).json({ error: 'not_found' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date || '')) return res.status(400).json({ error: 'bad_date' });
      // Copia como plantilla: mismos ingresos y costos como presupuesto; sin stock, barra ni cierre.
      const e = {
        id: `${src.brand}-${Date.now().toString(36)}`, brand: src.brand, date: body.date,
        name: String(body.name || `${src.name} (copia)`).slice(0, 300), venue: src.venue || '', stage: 'concept', status: 'planificación',
        liveEventId: '', notes: `Duplicado de ${src.name}.`, income: JSON.parse(JSON.stringify(src.income || [])), costs: JSON.parse(JSON.stringify(src.costs || [])), brandInvestment: [],
      };
      next.events = [...next.events, e];
      const r = await write(current, next, body.baseVersion, 'event.create', { event: e.id, name: e.name, from: src.id }, actor);
      if (r.body.finance) withStages(r.body.finance);
      return res.status(r.status).json({ ...r.body, id: e.id });
    }

    if (action === 'event.numbers') {
      const e = (next.events || []).find((x) => x.id === body.id);
      if (!e) return res.status(404).json({ error: 'not_found' });
      let changes;
      try { changes = applyNumbers(e, body.numbers || {}); } catch (err) { return res.status(400).json({ error: err.message }); }
      if (!Object.keys(changes).length) return res.status(200).json({ ok: true, unchanged: true, version: versionOf(current.finance) });
      const r = await write(current, next, body.baseVersion, 'event.numbers', { event: e.id, name: e.name, changes, source: String(body.source || '').slice(0, 200) }, actor);
      if (r.body.finance) withStages(r.body.finance);
      return res.status(r.status).json(r.body);
    }

    return res.status(400).json({ error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server_error' });
  }
};
