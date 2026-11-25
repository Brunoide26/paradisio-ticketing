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
const SALES = require('../lib/os/sales');
const PR = require('../lib/os/promoters');
const OPS = require('../lib/os/ops');
const { listPromoters } = require('../lib/promoters');
const limaToday = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

// Libro + inventario + sus resúmenes para un alcance (grupo o marca).
async function opsPayload(finance, brand = null) {
  const [ledger, inventory, promo, ops] = await Promise.all([readDoc(redis, 'ledger'), readDoc(redis, 'inventory'), readDoc(redis, 'promo'), readDoc(redis, 'ops')]);
  return {
    ledger, inventory, promo, ops,
    tasks: OPS.tasksView(ops, limaToday()),
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
  const overdue = (ops.tasks || []).filter((t) => t.overdue);
  if (overdue.length) out.push({ level: 'high', title: 'Tareas vencidas', text: `${overdue.length} tarea(s) pasaron su fecha: ${overdue.slice(0, 3).map((t) => t.title).join(' · ')}${overdue.length > 3 ? '…' : ''}.`, route: '/tareas' });
  const blocked = (ops.tasks || []).filter((t) => t.effective === 'blocked' && t.due && t.due <= new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  if (blocked.length) out.push({ level: 'med', title: 'Tareas bloqueadas por vencer', text: `${blocked.length} tarea(s) dependen de otras sin terminar y vencen pronto.`, route: '/tareas' });
  (ops.promoPending || []).forEach((p) => out.push({ level: 'med', title: 'Comisiones de promotores por pagar', text: `${p.name}: ${p.amount.toFixed(2)} soles pendientes según la regla de comisión.`, event: p.event }));
  return out;
}
// Resumen por marca: qué aporta cada una al grupo y en qué se le va.
// Todo sale de la misma capa de cálculo (summarize, ledgerSummary, promotores).
function brandsPayload(finance, { culqi, ledger, promoters, ops }) {
  const group = summarize(finance, { culqi });
  const pen = (t) => t.amount * (t.currency === 'USD' ? t.fxRate : 1);
  const r2 = (n) => Math.round(n * 100) / 100;
  return Object.fromEntries((finance.brands || []).map((b) => {
    const S = summarize(finance, { brand: b.id, culqi });
    const LS = L.ledgerSummary(ledger, { finance, brand: b.id });
    const evIds = new Set((finance.events || []).filter((e) => e.brand === b.id).map((e) => e.id));
    const perf = Object.entries(promoters).filter(([id]) => evIds.has(id)).map(([, p]) => p);
    const withRule = perf.filter((p) => p.rule);
    // Proveedores: pagos y deudas del libro, y costos de la liquidación (por concepto) de las fechas reales.
    const sup = new Map();
    (ledger.transactions || []).filter((t) => t.brand === b.id && (t.kind === 'cost' || t.kind === 'expense' || t.kind === 'inventory') && t.counterparty).forEach((t) => {
      const o = sup.get(t.counterparty) || { name: t.counterparty, paid: 0, pending: 0, count: 0 };
      if (t.paidOn) o.paid = r2(o.paid + pen(t)); else o.pending = r2(o.pending + pen(t));
      o.count++; sup.set(t.counterparty, o);
    });
    const staffCost = Object.entries((ops && ops.staff) || {}).filter(([id]) => evIds.has(id));
    return [b.id, {
      actual: { ...S.actual, events: undefined, byBrand: undefined },
      projected: { revenue: S.projected.revenue, profit: S.projected.profit, count: S.projected.count, completeCount: S.projected.completeCount },
      share: {
        revenue: group.actual.revenue ? r2((S.actual.revenue / group.actual.revenue) * 100) : null,
        result: group.actual.result && S.actual.count ? r2((S.actual.result / Math.abs(group.actual.result)) * 100) : null,
      },
      events: { done: S.actual.count, upcoming: S.projected.count, total: evIds.size },
      promoters: perf.length ? {
        attended: perf.reduce((s, p) => s + p.totals.attended, 0), qrs: perf.reduce((s, p) => s + p.totals.qrs, 0),
        commission: withRule.length ? r2(withRule.reduce((s, p) => s + p.totals.commission, 0)) : null,
        paid: r2(perf.reduce((s, p) => s + p.totals.paid, 0)),
        pending: withRule.length ? r2(withRule.reduce((s, p) => s + p.totals.pending, 0)) : null,
        top: perf.flatMap((p) => p.rows).reduce((m, r) => m.set(r.code, { name: r.name, attended: (m.get(r.code) || { attended: 0 }).attended + r.attended }), new Map()),
      } : null,
      payments: { hasData: LS.hasData, paidOut: r2((ledger.transactions || []).filter((t) => t.brand === b.id && t.paidOn && L.KINDS[t.kind].dir < 0).reduce((s, t) => s + pen(t), 0)), collected: r2((ledger.transactions || []).filter((t) => t.brand === b.id && t.paidOn && L.KINDS[t.kind].dir > 0).reduce((s, t) => s + pen(t), 0)), payables: LS.payables.total, receivables: LS.receivables.total, deposits: LS.deposits.total, corporate: LS.corporate },
      suppliers: [...sup.values()].sort((a, b2) => b2.paid + b2.pending - (a.paid + a.pending)),
      staffAssigned: staffCost.reduce((s, [, list]) => s + list.length, 0),
    }];
  }));
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
      const p = await loadPayload({ withTickets: true });
      const ticketsBy = p._ticketsByEvent; delete p._ticketsByEvent; delete p._promoterNames;
      withStages(p.finance);
      const s = summarize(p.finance, { culqi: p.culqi });
      const activity = await redis.lrange(AUDIT_KEY, 0, 29);
      const ops = await opsPayload(p.finance);
      // Ventas y promotores por evento del OS, leídos de la ticketera (sólo agregados, sin datos personales).
      const roster = new Map((await listPromoters({ includeRemoved: true })).map((x) => [x.code, x]));
      const sales = {}, promoters = {};
      (p.finance.events || []).forEach((e) => {
        if (!e.liveEventId || !ticketsBy.has(e.liveEventId)) return;
        const ts = ticketsBy.get(e.liveEventId);
        sales[e.id] = SALES.salesForEvent(ts, e.date);
        promoters[e.id] = PR.performance(ts, { promoters: roster, promo: ops.promo, finEventId: e.id, ledger: ops.ledger });
      });
      const brands = brandsPayload(p.finance, { culqi: p.culqi, ledger: ops.ledger, promoters, ops: ops.ops });
      Object.values(brands).forEach((x) => { if (x.promoters) x.promoters.top = [...x.promoters.top.values()].sort((a, b) => b.attended - a.attended).slice(0, 5); });
      ops.promoPending = Object.entries(promoters).flatMap(([evId, perf]) => {
        const e = p.finance.events.find((x) => x.id === evId);
        if (!e || !isActualStage(stageOf(e)) || !perf.rule) return [];
        return perf.rows.filter((r) => r.pending > 0).map((r) => ({ name: r.name, amount: r.pending, event: evId }));
      });
      return res.status(200).json({
        ...p,
        version: p.seeded ? null : versionOf(p.finance),
        ledger: ops.ledger, inventory: ops.inventory, promo: ops.promo, ops: ops.ops,
        os: {
          sales, promoters, tasks: ops.tasks, brands, groupActual: { revenue: s.actual.revenue, result: s.actual.result },
          roster: [...roster.values()].map((x) => ({ code: x.code, name: x.name, retired: !!x.retired, active: x.active !== false })),
          stages: STAGES, metrics: METRICS, summary: s, activity,
          attention: merged(attention(s, { culqi: p.culqi, usingStaffPasscode }), opsAttention(ops)),
          ledgerSummary: ops.ledgerSummary, inventorySummary: ops.inventorySummary, byEvent: ops.byEvent,
          enums: { txKinds: L.KINDS, accountTypes: L.ACCOUNT_TYPES, docTypes: L.DOC_TYPES, moveTypes: I.MOVES, productKinds: I.KINDS, contactTypes: OPS.CONTACT_TYPES, taskStatus: OPS.TASK_STATUS },
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
    // ---------- Promotores: equipos, metas y reglas de comisión ----------
    if (action.startsWith('promo.')) {
      const { finance } = await loadFinance();
      const evOk = (id) => (finance.events || []).some((e) => e.id === id);
      const code = String(body.code || '').toUpperCase();
      const r = await updateDoc(redis, 'promo', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
        if (action === 'promo.team.upsert') {
          const i = d.teams.findIndex((t) => t.id === (body.team || {}).id);
          const t = PR.cleanTeam(body.team, i >= 0 ? d.teams[i] : null);
          if (i >= 0) d.teams[i] = t; else d.teams.push(t);
          return { name: t.name };
        }
        if (action === 'promo.team.delete') {
          const t = d.teams.find((x) => x.id === body.id); if (!t) throw new Error('not_found');
          d.teams = d.teams.filter((x) => x.id !== body.id);
          Object.keys(d.members).forEach((k) => { if (d.members[k] === body.id) delete d.members[k]; });
          return { name: t.name };
        }
        if (action === 'promo.member.set') {
          if (!code) throw new Error('bad_code');
          if (body.teamId && !d.teams.some((t) => t.id === body.teamId)) throw new Error('bad_team');
          if (body.teamId) d.members[code] = body.teamId; else delete d.members[code];
          return { name: code };
        }
        if (action === 'promo.rule.set') {
          if (!evOk(body.eventId)) throw new Error('bad_event');
          if (body.rule) d.rules[body.eventId] = PR.cleanRule(body.rule); else delete d.rules[body.eventId];
          return { event: body.eventId, name: 'Regla de comisión' };
        }
        if (action === 'promo.target.set') {
          if (!evOk(body.eventId) || !code) throw new Error('bad_event');
          d.targets[body.eventId] = d.targets[body.eventId] || {};
          const v = body.target === '' || body.target == null ? null : Number(body.target);
          if (v !== null && !(v >= 0)) throw new Error('bad_number');
          if (v === null) delete d.targets[body.eventId][code]; else d.targets[body.eventId][code] = v;
          return { event: body.eventId, name: `Meta de ${code}` };
        }
        throw new Error('unknown_action');
      } });
      return res.status(r.status).json(r.body);
    }

    // ---------- Operaciones: directorio, tareas, run of show, staff ----------
    if (action.startsWith('ops.')) {
      const { finance } = await loadFinance();
      const events = finance.events || [];
      const r = await updateDoc(redis, 'ops', { baseVersion: body.baseVersion, action, actor, mutate: (d) => {
        if (action === 'ops.contact.upsert') {
          const i = d.contacts.findIndex((c) => c.id === (body.contact || {}).id);
          const c = OPS.cleanContact(body.contact, i >= 0 ? d.contacts[i] : null);
          if (i >= 0) d.contacts[i] = c; else d.contacts.push(c);
          return { name: c.name };
        }
        if (action === 'ops.task.upsert') {
          const i = d.tasks.findIndex((t) => t.id === (body.task || {}).id);
          const t = OPS.cleanTask(body.task, { events, tasks: d.tasks }, i >= 0 ? d.tasks[i] : null);
          const before = i >= 0 ? d.tasks[i] : null;
          if (i >= 0) d.tasks[i] = t; else d.tasks.push(t);
          return { name: t.title, event: t.eventId || undefined, ...(before && before.status !== t.status ? { changes: { status: { from: before.status, to: t.status } } } : {}) };
        }
        if (action === 'ops.task.delete') {
          const t = d.tasks.find((x) => x.id === body.id); if (!t) throw new Error('not_found');
          d.tasks = d.tasks.filter((x) => x.id !== body.id).map((x) => ({ ...x, dependsOn: (x.dependsOn || []).filter((y) => y !== body.id) }));
          return { name: t.title };
        }
        if (action === 'ops.task.template') {
          const e = events.find((x) => x.id === body.eventId); if (!e) throw new Error('bad_event');
          const add = OPS.templateTasks(e, d.tasks);
          d.tasks.push(...add);
          return { event: e.id, name: `Checklist estándar (${add.length} tareas)` };
        }
        if (action === 'ops.ros.set') {
          if (!events.some((x) => x.id === body.eventId)) throw new Error('bad_event');
          d.runOfShow[body.eventId] = OPS.cleanRunOfShow(body.items || []);
          return { event: body.eventId, name: 'Run of show' };
        }
        if (action === 'ops.staff.set') {
          if (!events.some((x) => x.id === body.eventId)) throw new Error('bad_event');
          d.staff[body.eventId] = OPS.cleanStaff(body.items || [], d.contacts);
          return { event: body.eventId, name: 'Staff del evento' };
        }
        throw new Error('unknown_action');
      } });
      return res.status(r.status).json(r.body);
    }

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
