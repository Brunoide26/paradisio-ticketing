// Inventario compartido entre marcas (barra, insumos y activos de producción).
//
// Modelo:
// - Un conteo físico (`count`) fija el stock total de un producto en esa fecha.
// - Después del último conteo, el stock se mueve con compras (+), devoluciones
//   a proveedor (−), mermas (−), cortesías (−) y ajustes (±).
// - Consumo de un evento = conteo de apertura − conteo de cierre + compras y
//   asignaciones hechas para ese evento. Comprar NO es consumir: una compra
//   suma stock; sólo lo que falta entre conteos es consumo.

const MOVES = {
  purchase: { label: 'Compra', sign: 1 },
  return: { label: 'Devolución a proveedor', sign: -1 },
  waste: { label: 'Merma', sign: -1 },
  comp: { label: 'Cortesía', sign: -1 },
  transfer: { label: 'Asignación a evento', sign: 0 },
  adjustment: { label: 'Ajuste', sign: 1 }, // qty con signo
  count: { label: 'Conteo físico', sign: null },
};
const KINDS = { bar: 'Barra', supply: 'Insumo', asset: 'Activo (equipo, decoración)' };

const str = (v, n = 120) => String(v == null ? '' : v).trim().slice(0, n);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;

function cleanProduct(p, existing) {
  if (!p || !str(p.name)) throw new Error('bad_product_name');
  if (!KINDS[p.kind || 'bar']) throw new Error('bad_product_kind');
  const unitCost = Number(p.unitCost);
  if (!(unitCost >= 0)) throw new Error('bad_unit_cost');
  const minStock = p.minStock === '' || p.minStock == null ? null : Number(p.minStock);
  if (minStock !== null && !(minStock >= 0)) throw new Error('bad_min_stock');
  return {
    id: (existing && existing.id) || genId('prd'),
    name: str(p.name, 80), kind: p.kind || 'bar', category: str(p.category, 40), unit: str(p.unit, 20) || 'unidad',
    unitCost: r2(unitCost), minStock, archived: !!p.archived,
  };
}

function cleanMove(m, { products, events }) {
  if (!m || !MOVES[m.type]) throw new Error('bad_move_type');
  if (!products.some((p) => p.id === m.productId)) throw new Error('bad_product');
  if (!isDate(m.date)) throw new Error('bad_date');
  const qty = Number(m.qty);
  if (!Number.isFinite(qty) || (m.type !== 'adjustment' && qty < 0) || (m.type !== 'count' && m.type !== 'adjustment' && qty === 0)) throw new Error('bad_qty');
  const eventId = m.eventId || null;
  if (eventId && !events.some((e) => e.id === eventId)) throw new Error('bad_event');
  const phase = m.type === 'count' && eventId ? (m.phase === 'close' ? 'close' : 'open') : null;
  const unitCost = m.unitCost === '' || m.unitCost == null ? null : Number(m.unitCost);
  if (unitCost !== null && !(unitCost >= 0)) throw new Error('bad_unit_cost');
  return { id: genId('mov'), type: m.type, productId: m.productId, date: m.date, qty: r3(qty), unitCost, eventId, phase, note: str(m.note, 200), createdAt: new Date().toISOString() };
}

// Orden estable: por fecha y, dentro del día, por creación.
const ord = (a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || '');

function onHand(product, movements) {
  const ms = movements.filter((m) => m.productId === product.id).sort(ord);
  let qty = null; // null = nunca contado ni comprado
  ms.forEach((m) => {
    if (m.type === 'count') { qty = m.qty; return; }
    const sign = MOVES[m.type].sign;
    if (!sign) return;
    qty = (qty || 0) + sign * m.qty;
  });
  return qty == null ? null : r3(qty);
}

// Consumo de un evento por producto. Requiere conteo de apertura y de cierre.
function eventConsumption(inv, eventId) {
  const rows = [];
  (inv.products || []).forEach((p) => {
    const ms = (inv.movements || []).filter((m) => m.productId === p.id && m.eventId === eventId);
    if (!ms.length) return;
    const open = ms.filter((m) => m.type === 'count' && m.phase === 'open').sort(ord).pop();
    const close = ms.filter((m) => m.type === 'count' && m.phase === 'close').sort(ord).pop();
    const added = ms.filter((m) => m.type === 'purchase' || m.type === 'transfer').reduce((s, m) => s + m.qty, 0);
    const comps = ms.filter((m) => m.type === 'comp').reduce((s, m) => s + m.qty, 0);
    const waste = ms.filter((m) => m.type === 'waste').reduce((s, m) => s + m.qty, 0);
    const consumed = open && close ? r3(open.qty + added - close.qty) : null;
    rows.push({
      productId: p.id, name: p.name, unit: p.unit, unitCost: p.unitCost,
      open: open ? open.qty : null, added: r3(added), close: close ? close.qty : null,
      consumed, comps: r3(comps), waste: r3(waste),
      consumedCost: consumed == null ? null : r2(consumed * p.unitCost),
      closeValue: close ? r2(close.qty * p.unitCost) : null,
    });
  });
  const complete = rows.length > 0 && rows.every((r) => r.consumed != null);
  return {
    rows, complete,
    consumedCost: complete ? r2(rows.reduce((s, r) => s + r.consumedCost, 0)) : null,
    closeValue: rows.length && rows.every((r) => r.closeValue != null) ? r2(rows.reduce((s, r) => s + r.closeValue, 0)) : null,
  };
}

function inventorySummary(inv) {
  const products = (inv.products || []).filter((p) => !p.archived).map((p) => {
    const q = onHand(p, inv.movements || []);
    return { ...p, onHand: q, value: q == null ? null : r2(q * p.unitCost), low: q != null && p.minStock != null && q < p.minStock };
  });
  const known = products.filter((p) => p.value != null);
  return {
    hasData: (inv.products || []).length > 0,
    products,
    value: known.length ? r2(known.reduce((s, p) => s + p.value, 0)) : null,
    uncounted: products.filter((p) => p.onHand == null).length,
    low: products.filter((p) => p.low).map((p) => p.id),
  };
}

module.exports = { MOVES, KINDS, cleanProduct, cleanMove, onHand, eventConsumption, inventorySummary };
