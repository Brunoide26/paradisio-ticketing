// Documentos de Paradisio OS en Redis (libro de transacciones, inventario).
// Cada documento tiene versión (updatedAt), historial de versiones anteriores
// y cada escritura deja auditoría. Mismo patrón que las finanzas de eventos.

const AUDIT_KEY = 'os:audit';
const MAX_BYTES = 900000; // margen bajo el límite de 1 MB por valor de Upstash

const DOCS = {
  ledger: { key: 'os:ledger', history: 'os:ledger:history', empty: () => ({ version: 1, accounts: [], transactions: [] }) },
  inventory: { key: 'os:inventory', history: 'os:inventory:history', empty: () => ({ version: 1, products: [], movements: [] }) },
  promo: { key: 'os:promo', history: 'os:promo:history', empty: () => ({ version: 1, teams: [], members: {}, rules: {}, targets: {} }) },
  marketing: { key: 'os:marketing', history: 'os:marketing:history', empty: () => ({ version: 1, content: [], campaigns: [], assets: [] }) },
  sponsors: { key: 'os:sponsors', history: 'os:sponsors:history', empty: () => ({ version: 1, deals: [] }) },
  documents: { key: 'os:documents', history: 'os:documents:history', empty: () => ({ version: 1, documents: [] }) },
  ops: { key: 'os:ops', history: 'os:ops:history', empty: () => ({ version: 1, contacts: [], tasks: [], runOfShow: {}, staff: {} }) },
};

async function audit(redis, action, detail, actor = 'admin') {
  await redis.lpush(AUDIT_KEY, { at: new Date().toISOString(), actor, action, ...detail });
  await redis.ltrim(AUDIT_KEY, 0, 499);
}

async function readDoc(redis, name) {
  const d = DOCS[name];
  const saved = await redis.get(d.key);
  return saved && typeof saved === 'object' ? saved : d.empty();
}

// mutate(doc) cambia el documento y devuelve el detalle para la auditoría;
// si lanza un Error, se responde 400 con su mensaje.
async function updateDoc(redis, name, { baseVersion, action, actor, mutate }) {
  const d = DOCS[name];
  const current = await readDoc(redis, name);
  if (baseVersion !== undefined && (baseVersion || null) !== (current.updatedAt || null)) {
    return { status: 409, body: { error: 'conflict', message: 'Hubo cambios desde que cargaste. Recarga y vuelve a intentar.' } };
  }
  const next = JSON.parse(JSON.stringify(current));
  let detail;
  try { detail = mutate(next) || {}; } catch (err) { return { status: 400, body: { error: err.message } }; }
  if (JSON.stringify(next).length > MAX_BYTES) return { status: 413, body: { error: 'too_large' } };
  if (current.updatedAt) {
    await redis.lpush(d.history, { savedAt: new Date().toISOString(), doc: current });
    await redis.ltrim(d.history, 0, 49);
  }
  next.updatedAt = new Date().toISOString();
  await redis.set(d.key, next);
  await audit(redis, action, detail, actor);
  return { status: 200, body: { ok: true, [name]: next } };
}

module.exports = { DOCS, AUDIT_KEY, audit, readDoc, updateDoc };
