// Audiencia (CRM) de Paradisio OS, respetando la política de privacidad.
//
// - Cada persona se identifica con un hash de su correo o DNI, calculado en el
//   servidor. El navegador nunca recibe nombres completos, DNI, correos ni
//   teléfonos: sólo agregados, segmentos con su tamaño y una lista de
//   clientes frecuentes con iniciales.
// - Las comunicaciones de marketing requieren consentimiento expreso (política
//   de privacidad, finalidad 8). Se cuenta quién lo dio (`marketingConsent`);
//   hoy la web no tiene esa casilla, así que no se ofrece exportar contactos.

const crypto = require('crypto');

const TYPE_LABEL = { free: 'Lista gratis', promo: 'Invitación de promotor', paid: 'Entrada pagada', table: 'Mesa / box' };
const AGE_BANDS = [['18–20', 0, 20], ['21–23', 21, 23], ['24–26', 24, 26], ['27–30', 27, 30], ['31–35', 31, 35], ['36+', 36, 200]];
const r1 = (n) => Math.round(n * 10) / 10;

function keyOf(t) {
  const raw = (t.email && String(t.email).trim().toLowerCase()) || (t.dni && String(t.dni).replace(/\D/g, '')) || null;
  return raw ? crypto.createHash('sha256').update('paradisio-os|' + raw).digest('hex').slice(0, 16) : null;
}
function ageAt(dob, iso) {
  if (!dob) return null;
  const d = new Date(dob + 'T00:00:00'), at = new Date(iso + 'T23:00:00');
  if (isNaN(d)) return null;
  let a = at.getFullYear() - d.getFullYear();
  if (at.getMonth() < d.getMonth() || (at.getMonth() === d.getMonth() && at.getDate() < d.getDate())) a--;
  return a >= 14 && a <= 90 ? a : null;
}
const band = (a) => (a == null ? 'Sin dato' : (AGE_BANDS.find(([, lo, hi]) => a >= lo && a <= hi) || ['Sin dato'])[0]);
const initials = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase() + '.').join(' ') || '—';

// ticketsByEvent: Map(eventIdTicketera -> tickets). eventMeta(id) -> { name, date, brand }.
function audience(ticketsByEvent, eventMeta, { brand = null } = {}) {
  const people = new Map();
  const evIds = [...ticketsByEvent.keys()].filter((id) => !brand || eventMeta(id).brand === brand).sort();
  evIds.forEach((evId) => {
    const meta = eventMeta(evId);
    ticketsByEvent.get(evId).filter((t) => !t.voided).forEach((t) => {
      const k = keyOf(t); if (!k) return;
      const p = people.get(k) || { k, name: t.name, events: new Set(), attended: new Set(), brands: new Set(), spend: 0, first: null, age: null, consent: false, tables: 0 };
      p.events.add(evId);
      if (t.checkedIn) { p.attended.add(evId); p.brands.add(meta.brand); }
      if (t.type === 'paid' || t.type === 'table') p.spend += Number(t.amount) || 0;
      if (t.type === 'table') p.tables++;
      if (t.marketingConsent) p.consent = true;
      const when = t.createdAt || meta.date;
      if (!p.first || when < p.first.when) p.first = { when, type: t.type, promoter: t.promoterCode || null, evId };
      if (p.age == null) p.age = ageAt(t.dob, meta.date);
      people.set(k, p);
    });
  });
  const all = [...people.values()];
  const attended = all.filter((p) => p.attended.size > 0);
  const repeat = attended.filter((p) => p.attended.size >= 2);

  const byEvent = evIds.map((evId, i) => {
    const prev = new Set(evIds.slice(0, i));
    const att = attended.filter((p) => p.attended.has(evId));
    const returning = att.filter((p) => [...p.attended].some((e) => prev.has(e)));
    return { id: evId, ...eventMeta(evId), registered: all.filter((p) => p.events.has(evId)).length, attended: att.length, returning: returning.length, new: att.length - returning.length };
  });
  const retention = evIds.slice(1).map((evId, i) => {
    const from = evIds[i];
    const base = attended.filter((p) => p.attended.has(from));
    const back = base.filter((p) => p.attended.has(evId));
    return { from, to: evId, fromName: eventMeta(from).name, toName: eventMeta(evId).name, base: base.length, returned: back.length, rate: base.length ? r1((back.length / base.length) * 100) : null };
  });

  const count = (list, f) => { const m = new Map(); list.forEach((p) => { const k = f(p); m.set(k, (m.get(k) || 0) + 1); }); return [...m.entries()].map(([key, value]) => ({ key, value })).sort((a, b) => b.value - a.value); };
  const payers = all.filter((p) => p.spend > 0);
  const segments = [
    { id: 'loyal', label: 'Fieles (vinieron 2+ veces)', size: repeat.length },
    { id: 'once', label: 'Vinieron una vez', size: attended.length - repeat.length },
    { id: 'noshow', label: 'Se registraron y nunca vinieron', size: all.length - attended.length },
    { id: 'payers', label: 'Pagaron entrada o mesa', size: payers.length },
    { id: 'tables', label: 'Compraron mesa o box', size: all.filter((p) => p.tables > 0).length },
    { id: 'promo', label: 'Llegaron por un promotor', size: all.filter((p) => p.first && p.first.promoter).length },
    { id: 'multibrand', label: 'Fueron a más de una marca', size: attended.filter((p) => p.brands.size > 1).length },
  ];
  return {
    people: all.length, attended: attended.length, repeat: repeat.length,
    repeatRate: attended.length ? r1((repeat.length / attended.length) * 100) : null,
    payers: payers.length, spend: Math.round(payers.reduce((s, p) => s + p.spend, 0) * 100) / 100,
    avgSpend: payers.length ? Math.round((payers.reduce((s, p) => s + p.spend, 0) / payers.length) * 100) / 100 : null,
    consent: all.filter((p) => p.consent).length,
    byEvent, retention, segments,
    acquisition: count(all, (p) => (p.first ? TYPE_LABEL[p.first.type] || p.first.type : 'Sin dato')),
    acquiredByPromoter: count(all.filter((p) => p.first && p.first.promoter), (p) => p.first.promoter).slice(0, 10),
    ages: AGE_BANDS.map(([l]) => ({ key: l, value: attended.filter((p) => band(p.age) === l).length })).concat([{ key: 'Sin dato', value: attended.filter((p) => p.age == null).length }]).filter((x) => x.value),
    top: attended.slice().sort((a, b) => b.attended.size - a.attended.size || b.spend - a.spend).slice(0, 25)
      .map((p) => ({ id: p.k, initials: initials(p.name), age: band(p.age), attended: p.attended.size, registered: p.events.size, spend: Math.round(p.spend * 100) / 100, source: p.first ? (p.first.promoter ? `Promotor ${p.first.promoter}` : TYPE_LABEL[p.first.type]) : '—', consent: p.consent })),
  };
}

module.exports = { audience, keyOf };
