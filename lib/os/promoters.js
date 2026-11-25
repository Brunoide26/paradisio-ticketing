// Promotores en Paradisio OS: equipos, metas y reglas de comisión por evento
// (documento os:promo), sobre el rendimiento real de la ticketera.
//
// Comisión de un promotor en un evento =
//   fijo + por asistente verificado × entraron + % entradas pagadas + % mesas
// Se calcula sólo con asistencia VERIFICADA en puerta (no con registros).
// Lo pagado sale del libro: transacciones "Costo de evento" ligadas al evento
// con ese código de promotor.

const r2 = (n) => Math.round(n * 100) / 100;
const str = (v, n = 80) => String(v == null ? '' : v).trim().slice(0, n);
const genId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const num = (v, { min = 0, max = Infinity } = {}) => { if (v === '' || v == null) return 0; const n = Number(v); if (!Number.isFinite(n) || n < min || n > max) throw new Error('bad_number'); return n; };

function cleanTeam(t, existing) {
  if (!t || !str(t.name)) throw new Error('bad_team_name');
  return { id: (existing && existing.id) || genId('team'), name: str(t.name, 60), leader: str(t.leader, 40).toUpperCase() || null };
}

function cleanRule(r) {
  return {
    fixed: num(r.fixed), perAttendee: num(r.perAttendee),
    pctPaid: num(r.pctPaid, { max: 100 }), pctTables: num(r.pctTables, { max: 100 }),
    note: str(r.note, 200),
  };
}

// Rendimiento por promotor para un evento de la ticketera (tickets de esa fecha).
function performance(tickets, { promoters, promo, finEventId, ledger }) {
  const valid = (tickets || []).filter((t) => !t.voided && t.promoterCode);
  const rule = (promo.rules || {})[finEventId] || null;
  const targets = (promo.targets || {})[finEventId] || {};
  const teamOf = (code) => (promo.members || {})[code] || null;
  const teams = new Map((promo.teams || []).map((t) => [t.id, t]));
  const codes = new Set([...valid.map((t) => t.promoterCode), ...Object.keys(targets)]);
  const paidTx = ((ledger && ledger.transactions) || []).filter((t) => t.eventId === finEventId && t.promoterCode);
  const rows = [...codes].map((code) => {
    const mine = valid.filter((t) => t.promoterCode === code);
    const issued = mine.filter((t) => !t.pending);
    const attended = mine.filter((t) => t.checkedIn);
    const paidRev = r2(mine.filter((t) => t.type === 'paid').reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const tableRev = r2(mine.filter((t) => t.type === 'table').reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const p = promoters.get(code) || {};
    const commission = rule ? r2(rule.fixed + rule.perAttendee * attended.length + (rule.pctPaid / 100) * paidRev + (rule.pctTables / 100) * tableRev) : null;
    const paid = r2(paidTx.filter((t) => t.promoterCode === code).reduce((s, t) => s + (t.paidOn ? t.amount * (t.currency === 'USD' ? t.fxRate : 1) : 0), 0));
    const target = targets[code] != null ? Number(targets[code]) : null;
    const team = teams.get(teamOf(code));
    return {
      code, name: p.name || code, retired: !!p.retired, active: p.active !== false,
      team: team ? team.name : null, teamId: team ? team.id : null, leader: team ? team.leader === code : false,
      registrations: mine.length, qrs: issued.length, attended: attended.length,
      conversion: issued.length ? r2((attended.length / issued.length) * 100) : null,
      paidTickets: mine.filter((t) => t.type === 'paid').length, paidRevenue: paidRev, tableRevenue: tableRev,
      target, attainment: target ? r2((attended.length / target) * 100) : null,
      commission, paid, pending: commission == null ? null : r2(Math.max(0, commission - paid)),
    };
  }).sort((a, b) => b.attended - a.attended || b.qrs - a.qrs);
  const byTeam = (promo.teams || []).map((t) => {
    const xs = rows.filter((r) => r.teamId === t.id);
    return { id: t.id, name: t.name, leader: t.leader, members: xs.length, qrs: xs.reduce((s, r) => s + r.qrs, 0), attended: xs.reduce((s, r) => s + r.attended, 0), commission: rule ? r2(xs.reduce((s, r) => s + (r.commission || 0), 0)) : null };
  });
  return {
    rule, rows, byTeam,
    totals: {
      qrs: rows.reduce((s, r) => s + r.qrs, 0), attended: rows.reduce((s, r) => s + r.attended, 0),
      commission: rule ? r2(rows.reduce((s, r) => s + (r.commission || 0), 0)) : null,
      paid: r2(rows.reduce((s, r) => s + r.paid, 0)),
      pending: rule ? r2(rows.reduce((s, r) => s + (r.pending || 0), 0)) : null,
    },
    noPromoter: (tickets || []).filter((t) => !t.voided && !t.promoterCode && !t.pending).length,
  };
}

module.exports = { cleanTeam, cleanRule, performance };
