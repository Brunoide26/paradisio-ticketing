// Fase 4 de Paradisio OS: marketing y contenido, sponsorships y documentos
// (documentos os:marketing, os:sponsors, os:documents).
//
// Reglas de dinero (igual que en el libro, Fase 2):
// - El valor de un acuerdo de sponsor es PROYECTADO. Sólo es real lo cobrado:
//   transacciones del libro con `sponsorId`.
// - Los aportes en especie se registran aparte y nunca se suman a ingresos.
// - El gasto de una campaña sale del libro: transacciones con `campaignId`.

const str = (v, n = 160) => String(v == null ? '' : v).trim().slice(0, n);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const optDate = (v, err) => { if (!v) return null; if (!isDate(v)) throw new Error(err || 'bad_date'); return v; };
const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const money = (v, err = 'bad_amount') => { if (v === '' || v == null) return null; const n = Number(v); if (!(n >= 0)) throw new Error(err); return Math.round(n * 100) / 100; };
const url = (v) => { const u = str(v, 500); if (u && !/^https?:\/\//i.test(u)) throw new Error('bad_url'); return u; };
const r2 = (n) => Math.round(n * 100) / 100;

const CONTENT_STATUS = { idea: 'Idea', brief: 'Brief', design: 'En diseño', review: 'En revisión', approved: 'Aprobado', published: 'Publicado' };
const CHANNELS = { ig_post: 'Instagram · post', ig_story: 'Instagram · story', ig_reel: 'Instagram · reel', tiktok: 'TikTok', email: 'Correo', whatsapp: 'WhatsApp', flyer: 'Flyer impreso', web: 'Web', other: 'Otro' };
const CAMPAIGN_STATUS = { planned: 'Planificada', active: 'Activa', done: 'Terminada', cancelled: 'Cancelada' };
const ASSET_TYPES = { logo: 'Logo', flyer: 'Flyer / arte', photo: 'Fotos', video: 'Video', guide: 'Guía de marca', template: 'Plantilla', other: 'Otro' };
const DEAL_STAGES = { prospect: 'Prospecto', contacted: 'Contactado', proposal: 'Propuesta enviada', negotiation: 'Negociación', signed: 'Firmado', active: 'Activo', renewal: 'Renovación', lost: 'Perdido' };
const DOC_TYPES = { contract: 'Contrato', quote: 'Cotización', invoice: 'Factura / boleta', rider: 'Rider técnico', permit: 'Permiso / licencia', proposal: 'Propuesta', brief: 'Brief', other: 'Otro' };

function ctxCheck({ events, brands }, o) {
  if (o.eventId && !events.some((e) => e.id === o.eventId)) throw new Error('bad_event');
  if (o.brand && !brands.some((b) => b.id === o.brand)) throw new Error('bad_brand');
}

// ---------- Marketing ----------
function cleanContent(c, ctx, existing) {
  if (!c || !str(c.title)) throw new Error('bad_title');
  if (!CONTENT_STATUS[c.status || 'idea']) throw new Error('bad_status');
  if (!CHANNELS[c.channel || 'ig_post']) throw new Error('bad_channel');
  ctxCheck(ctx, c);
  const brand = c.brand || (c.eventId ? (ctx.events.find((e) => e.id === c.eventId) || {}).brand : null) || null;
  return {
    id: (existing && existing.id) || genId('ct'), title: str(c.title), brand, eventId: c.eventId || null, campaignId: c.campaignId || null,
    channel: c.channel || 'ig_post', status: c.status || 'idea', owner: str(c.owner, 60), designer: str(c.designer, 60),
    due: optDate(c.due), publishOn: optDate(c.publishOn), link: url(c.link), notes: str(c.notes, 1000),
    results: { reach: money(c.results && c.results.reach, 'bad_number'), interactions: money(c.results && c.results.interactions, 'bad_number') },
  };
}
function cleanCampaign(c, ctx, existing) {
  if (!c || !str(c.name)) throw new Error('bad_name');
  if (!CAMPAIGN_STATUS[c.status || 'planned']) throw new Error('bad_status');
  ctxCheck(ctx, c);
  const start = optDate(c.start), end = optDate(c.end);
  if (start && end && end < start) throw new Error('bad_range');
  return {
    id: (existing && existing.id) || genId('cmp'), name: str(c.name, 100), brand: c.brand || (c.eventId ? (ctx.events.find((e) => e.id === c.eventId) || {}).brand : null) || null,
    eventId: c.eventId || null, objective: str(c.objective, 200), channels: (Array.isArray(c.channels) ? c.channels : []).filter((x) => CHANNELS[x]),
    budget: money(c.budget), start, end, status: c.status || 'planned', notes: str(c.notes, 1000),
  };
}
function cleanAsset(a, ctx, existing) {
  if (!a || !str(a.name)) throw new Error('bad_name');
  if (!ASSET_TYPES[a.type || 'other']) throw new Error('bad_type');
  ctxCheck(ctx, a);
  if (!str(a.url)) throw new Error('bad_url');
  return { id: (existing && existing.id) || genId('ast'), name: str(a.name, 100), type: a.type || 'other', brand: a.brand || null, url: url(a.url), tags: str(a.tags, 120), notes: str(a.notes, 400) };
}

const pen = (t) => t.amount * (t.currency === 'USD' ? t.fxRate : 1);

// Campañas con gasto real (libro) y registros durante la ventana (ticketera, si la fecha vende por la web).
function campaignsView(mkt, { ledger, sales, today }) {
  return (mkt.campaigns || []).map((c) => {
    const tx = (ledger.transactions || []).filter((t) => t.campaignId === c.id);
    const spent = r2(tx.filter((t) => t.paidOn).reduce((s, t) => s + pen(t), 0));
    const committed = r2(tx.filter((t) => !t.paidOn).reduce((s, t) => s + pen(t), 0));
    const content = (mkt.content || []).filter((x) => x.campaignId === c.id);
    const S = c.eventId && sales ? sales[c.eventId] : null;
    let registrations = null;
    if (S && c.start) {
      const end = c.end || today;
      registrations = S.velocity.filter((v) => v.d >= c.start && v.d <= end).reduce((s, v) => s + v.registrations, 0);
    }
    return {
      ...c, spent, committed, remaining: c.budget == null ? null : r2(c.budget - spent - committed),
      over: c.budget != null && spent + committed > c.budget,
      contentCount: content.length, published: content.filter((x) => x.status === 'published').length,
      registrations, costPerRegistration: registrations && spent ? r2(spent / registrations) : null,
    };
  });
}

// ---------- Sponsorships ----------
function cleanDeal(d, ctx, existing) {
  if (!d || !str(d.sponsor)) throw new Error('bad_sponsor');
  if (!DEAL_STAGES[d.stage || 'prospect']) throw new Error('bad_stage');
  const brands = (Array.isArray(d.brands) ? d.brands : []).filter((b) => ctx.brands.some((x) => x.id === b));
  const eventIds = (Array.isArray(d.eventIds) ? d.eventIds : []).filter((e) => ctx.events.some((x) => x.id === e));
  const email = str(d.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('bad_email');
  const deliverables = (Array.isArray(d.deliverables) ? d.deliverables : []).map((x) => {
    if (!x || !str(x.title)) throw new Error('bad_deliverable');
    return { id: x.id || genId('dl'), title: str(x.title, 160), due: optDate(x.due), done: !!x.done, eventId: x.eventId && ctx.events.some((e) => e.id === x.eventId) ? x.eventId : null };
  });
  const start = optDate(d.contractStart), end = optDate(d.contractEnd);
  if (start && end && end < start) throw new Error('bad_range');
  return {
    id: (existing && existing.id) || genId('sp'), sponsor: str(d.sponsor, 100), contactName: str(d.contactName, 80), email, phone: str(d.phone, 30),
    stage: d.stage || 'prospect', brands, eventIds,
    cash: money(d.cash), inKind: str(d.inKind, 300), inKindValue: money(d.inKindValue),
    contractStart: start, contractEnd: end, renewalDate: optDate(d.renewalDate),
    deliverables, proposalUrl: url(d.proposalUrl), notes: str(d.notes, 1500),
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
  };
}

function dealsView(sp, { ledger, today }) {
  const in30 = new Date(new Date(today + 'T12:00:00Z').getTime() + 30 * 86400000).toISOString().slice(0, 10);
  return (sp.deals || []).map((d) => {
    const tx = (ledger.transactions || []).filter((t) => t.sponsorId === d.id);
    const collected = r2(tx.filter((t) => t.paidOn).reduce((s, t) => s + pen(t), 0));
    const pending = d.cash == null ? null : r2(Math.max(0, d.cash - collected));
    const openDl = d.deliverables.filter((x) => !x.done);
    return {
      ...d, collected, pending,
      overdueDeliverables: openDl.filter((x) => x.due && x.due < today).length,
      openDeliverables: openDl.length,
      renewalSoon: !!(d.renewalDate && d.renewalDate >= today && d.renewalDate <= in30),
      expired: !!(d.contractEnd && d.contractEnd < today && ['signed', 'active'].includes(d.stage)),
    };
  });
}

// ---------- Documentos ----------
function cleanDocument(d, ctx, existing) {
  if (!d || !str(d.title)) throw new Error('bad_title');
  if (!DOC_TYPES[d.type || 'other']) throw new Error('bad_type');
  ctxCheck(ctx, d);
  if (!str(d.url)) throw new Error('bad_url');
  return {
    id: (existing && existing.id) || genId('doc'), title: str(d.title, 140), type: d.type || 'other', url: url(d.url),
    brand: d.brand || (d.eventId ? (ctx.events.find((e) => e.id === d.eventId) || {}).brand : null) || null,
    eventId: d.eventId || null, contactId: str(d.contactId, 40) || null, sponsorId: str(d.sponsorId, 40) || null,
    signedOn: optDate(d.signedOn), expires: optDate(d.expires), notes: str(d.notes, 600),
    createdAt: (existing && existing.createdAt) || new Date().toISOString(),
  };
}

// Alertas de la fase 4 para la lista de atención.
function commercialAttention({ mkt, sponsors, documents, today }) {
  const out = [];
  const in30 = new Date(new Date(today + 'T12:00:00Z').getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const lateContent = (mkt.content || []).filter((c) => c.due && c.due < today && !['approved', 'published'].includes(c.status));
  if (lateContent.length) out.push({ level: 'med', title: 'Contenido atrasado', text: `${lateContent.length} pieza(s) pasaron su fecha sin aprobarse: ${lateContent.slice(0, 3).map((c) => c.title).join(' · ')}.`, route: '/marketing' });
  sponsors.forEach((d) => {
    if (d.overdueDeliverables) out.push({ level: 'high', title: `Entregables vencidos · ${d.sponsor}`, text: `${d.overdueDeliverables} entregable(s) para el sponsor ya pasaron su fecha.`, route: '/sponsors' });
    if (d.renewalSoon) out.push({ level: 'med', title: `Renovación próxima · ${d.sponsor}`, text: `La renovación es el ${d.renewalDate}.`, route: '/sponsors' });
    if (d.expired) out.push({ level: 'med', title: `Contrato vencido · ${d.sponsor}`, text: `El acuerdo terminó el ${d.contractEnd} y sigue marcado como ${DEAL_STAGES[d.stage].toLowerCase()}.`, route: '/sponsors' });
  });
  const exp = (documents.documents || []).filter((d) => d.expires && d.expires <= in30);
  if (exp.length) out.push({ level: exp.some((d) => d.expires < today) ? 'high' : 'med', title: 'Documentos por vencer', text: exp.slice(0, 3).map((d) => `${d.title} (${d.expires < today ? 'vencido' : 'vence'} ${d.expires})`).join(' · '), route: '/documentos' });
  return out;
}

module.exports = {
  CONTENT_STATUS, CHANNELS, CAMPAIGN_STATUS, ASSET_TYPES, DEAL_STAGES, DOC_TYPES,
  cleanContent, cleanCampaign, cleanAsset, campaignsView, cleanDeal, dealsView, cleanDocument, commercialAttention,
};
