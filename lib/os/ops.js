// Operaciones de Paradisio OS (documento os:ops): directorio de contactos
// (locales, artistas/DJs, proveedores, staff), tareas con responsable, fecha
// límite y dependencias, run of show y staff asignado por evento.

const CONTACT_TYPES = { venue: 'Local', artist: 'Artista / DJ', supplier: 'Proveedor', staff: 'Staff', contractor: 'Contratista', other: 'Otro' };
const TASK_STATUS = { todo: 'Por hacer', doing: 'En curso', done: 'Hecha', blocked: 'Bloqueada' };

const str = (v, n = 120) => String(v == null ? '' : v).trim().slice(0, n);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const addDays = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

function cleanContact(c, existing) {
  if (!c || !str(c.name)) throw new Error('bad_contact_name');
  if (!CONTACT_TYPES[c.type]) throw new Error('bad_contact_type');
  const email = str(c.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('bad_email');
  const ruc = str(c.ruc, 11);
  if (ruc && !/^\d{8}(\d{3})?$/.test(ruc)) throw new Error('bad_ruc');
  const rate = c.rate === '' || c.rate == null ? null : Number(c.rate);
  if (rate !== null && !(rate >= 0)) throw new Error('bad_amount');
  const rating = c.rating === '' || c.rating == null ? null : Number(c.rating);
  if (rating !== null && !(rating >= 1 && rating <= 5)) throw new Error('bad_rating');
  return {
    id: (existing && existing.id) || genId('ct'), type: c.type, name: str(c.name, 80), role: str(c.role, 60),
    company: str(c.company, 80), phone: str(c.phone, 30), email, instagram: str(c.instagram, 60), ruc,
    rate, rateUnit: str(c.rateUnit, 30), rating, notes: str(c.notes, 1000), archived: !!c.archived,
  };
}

function cleanTask(t, { events, tasks }, existing) {
  if (!t || !str(t.title)) throw new Error('bad_task_title');
  if (t.eventId && !events.some((e) => e.id === t.eventId)) throw new Error('bad_event');
  if (t.due && !isDate(t.due)) throw new Error('bad_date');
  if (t.status && !TASK_STATUS[t.status]) throw new Error('bad_status');
  const id = (existing && existing.id) || genId('tk');
  const dependsOn = (Array.isArray(t.dependsOn) ? t.dependsOn : []).filter((d) => d !== id && tasks.some((x) => x.id === d));
  // Evita ciclos simples: A depende de B y B de A.
  if (dependsOn.some((d) => ((tasks.find((x) => x.id === d) || {}).dependsOn || []).includes(id))) throw new Error('dependency_cycle');
  const status = t.status || 'todo';
  return {
    id, title: str(t.title, 160), eventId: t.eventId || null, owner: str(t.owner, 60), due: t.due || null,
    status, dependsOn, notes: str(t.notes, 1000), group: str(t.group, 40),
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    doneAt: status === 'done' ? (existing && existing.doneAt) || new Date().toISOString() : null,
  };
}

// Checklist estándar de producción: fecha límite relativa a la fecha del evento.
const TEMPLATE = [
  [-28, 'Planificación', 'Confirmar local, fecha y condiciones (alquiler, consumo mínimo)'],
  [-21, 'Planificación', 'Presupuesto con costos completos (simulador)'],
  [-21, 'Planificación', 'Contrato o acuerdo con el local firmado'],
  [-18, 'Talento', 'Line-up confirmado y fees acordados'],
  [-14, 'Marketing', 'Arte, flyer y plan de contenido aprobados'],
  [-12, 'Ventas', 'Abrir venta: entradas, mesas y boxes'],
  [-12, 'Promotores', 'Cupos, metas y regla de comisión de promotores'],
  [-7, 'Staff', 'Staff confirmado: barra, seguridad, caja, limpieza'],
  [-7, 'Barra', 'Pedido de barra y concesiones según stock disponible'],
  [-3, 'Producción', 'Producción, sonido y luces confirmados'],
  [-2, 'Ventas', 'Enviar QRs pendientes de la lista'],
  [-1, 'Producción', 'Run of show listo y compartido con el equipo'],
  [0, 'Barra', 'Conteo de apertura de barra'],
  [1, 'Barra', 'Conteo de cierre de barra'],
  [2, 'Pagos', 'Pagos a staff, talento y proveedores'],
  [3, 'Pagos', 'Comisiones de promotores'],
  [4, 'Cierre', 'Cargar números reales y pasar a Liquidación'],
  [7, 'Cierre', 'Reporte post-evento'],
];

function templateTasks(event, existingTasks) {
  const have = new Set(existingTasks.filter((t) => t.eventId === event.id).map((t) => t.title));
  const out = [];
  TEMPLATE.forEach(([offset, group, title]) => {
    if (have.has(title)) return;
    out.push({ id: genId('tk'), title, eventId: event.id, owner: '', due: addDays(event.date, offset), status: 'todo', dependsOn: [], notes: '', group, createdAt: new Date().toISOString(), doneAt: null });
  });
  // Dependencias naturales del flujo de cierre.
  const byTitle = (t) => out.find((x) => x.title === t) || existingTasks.find((x) => x.eventId === event.id && x.title === t);
  const link = (a, b) => { const A = byTitle(a), B = byTitle(b); if (A && B && out.includes(A) && !A.dependsOn.includes(B.id)) A.dependsOn.push(B.id); };
  link('Abrir venta: entradas, mesas y boxes', 'Presupuesto con costos completos (simulador)');
  link('Conteo de cierre de barra', 'Conteo de apertura de barra');
  link('Cargar números reales y pasar a Liquidación', 'Pagos a staff, talento y proveedores');
  link('Reporte post-evento', 'Cargar números reales y pasar a Liquidación');
  return out;
}

function cleanRunOfShow(items) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('bad_ros');
  return items.map((i) => {
    if (!i || !/^\d{2}:\d{2}$/.test(i.time || '') || !str(i.title)) throw new Error('bad_ros_item');
    return { time: i.time, title: str(i.title, 120), owner: str(i.owner, 60), notes: str(i.notes, 200) };
  }).sort((a, b) => { const k = (t) => { const [h, m] = t.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; }; return k(a.time) - k(b.time); });
}

function cleanStaff(items, contacts) {
  if (!Array.isArray(items) || items.length > 100) throw new Error('bad_staff');
  return items.map((i) => {
    if (!i || !contacts.some((c) => c.id === i.contactId)) throw new Error('bad_staff_contact');
    const fee = i.fee === '' || i.fee == null ? null : Number(i.fee);
    if (fee !== null && !(fee >= 0)) throw new Error('bad_amount');
    if (i.call && !/^\d{2}:\d{2}$/.test(i.call)) throw new Error('bad_time');
    return { contactId: i.contactId, role: str(i.role, 60), call: i.call || '', fee, confirmed: !!i.confirmed };
  });
}

// Estado efectivo de cada tarea (bloqueada si depende de algo sin terminar) y vencidas.
function tasksView(ops, today) {
  const byId = new Map((ops.tasks || []).map((t) => [t.id, t]));
  return (ops.tasks || []).map((t) => {
    const waiting = (t.dependsOn || []).map((d) => byId.get(d)).filter((d) => d && d.status !== 'done');
    const blocked = t.status !== 'done' && (t.status === 'blocked' || waiting.length > 0);
    return { ...t, blockedBy: waiting.map((w) => ({ id: w.id, title: w.title })), effective: t.status === 'done' ? 'done' : blocked ? 'blocked' : t.status, overdue: t.status !== 'done' && t.due && t.due < today };
  });
}

module.exports = { CONTACT_TYPES, TASK_STATUS, TEMPLATE, cleanContact, cleanTask, templateTasks, cleanRunOfShow, cleanStaff, tasksView };
