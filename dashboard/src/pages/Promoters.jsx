import React, { useEffect, useState } from 'react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, Unavailable, fmtDay, sel, Field, moneyOrNA, useScope } from '../os/kit.jsx';
import { useSalesEvents } from './Sales.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel } from '../ui.jsx';
import { cn, money, pct } from '../lib.js';

export default function Promoters() {
  const { data } = useOS();
  const scope = useScope();
  const events = useSalesEvents();
  const [pick, setId] = useState('');
  const id = events.some((x) => x.id === pick) ? pick : events[0]?.id || '';
  const [tab, setTab] = useState('event');
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Promotores" description="Rendimiento verificado en puerta, metas, comisiones y pagos. Cada promotor sigue viendo sólo lo suyo en su portal."
        actions={tab === 'event' && events.length > 0 && <select aria-label="Evento" className={cn(sel, 'h-8 w-72 text-[13px]')} value={id} onChange={(x) => setId(x.target.value)}>{events.map((x) => <option key={x.id} value={x.id}>{fmtDay(x.date)} · {x.name}</option>)}</select>} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8"><TabsTrigger value="event" className="text-[12px]">Por evento</TabsTrigger><TabsTrigger value="history" className="text-[12px]">Historial</TabsTrigger><TabsTrigger value="teams" className="text-[12px]">Equipos</TabsTrigger></TabsList>
      </Tabs>
      {tab === 'event' && (data.os.promoters[id] ? <EventPromoters eventId={id} /> : <Panel className="px-5 py-8 text-[13px] text-muted-foreground">{scope.brand ? `${scope.name} todavía no tiene fechas con promotores en la web de tickets. Cuando empiece, aquí vas a ver a sus promotores separados de las otras marcas.` : 'Sin datos de promotores.'}</Panel>)}
      {tab === 'history' && <History />}
      {tab === 'teams' && <Teams />}
    </div>
  );
}

export function EventPromoters({ eventId }) {
  const { data, setDrawer, promo } = useOS();
  const P = data.os.promoters[eventId];
  const e = data.finance.events.find((x) => x.id === eventId);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [target, setTarget] = useState(null);
  const pay = (r) => setDrawer({ type: 'tx', preset: { kind: 'cost', eventId, date: e.date, category: 'Promotores', description: `Comisión ${r.name}`, counterparty: r.name, promoterCode: r.code, amount: r.pending || '' } });
  const R = P.rule;
  return (
    <div className="flex flex-col gap-3">
      <div className="kpi-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="QRs de promotores" value={P.totals.qrs.toLocaleString('es-PE')} sub={`${P.noPromoter} QRs sin promotor`} />
        <Kpi label="Entraron (verificado)" value={P.totals.attended.toLocaleString('es-PE')} sub={`asistencia ${pct(P.totals.qrs ? (P.totals.attended / P.totals.qrs) * 100 : null)}`} />
        <Kpi label="Comisiones" value={moneyOrNA(P.totals.commission)} unavailable={R ? null : 'Define la regla de comisión del evento'} onClick={() => setRuleOpen(true)} sub={R ? 'según la regla' : 'sin regla'} />
        <Kpi label="Pagado" value={money(P.totals.paid)} sub="transacciones del evento" />
        <Kpi label="Por pagar" value={moneyOrNA(P.totals.pending)} unavailable={R ? null : 'Sin regla'} tone={P.totals.pending ? 'bad' : undefined} />
        <Kpi label="Regla" value={R ? 'Definida' : 'Sin regla'} sub={R ? `S/ ${R.perAttendee} por asistente${R.pctTables ? ` · ${R.pctTables}% mesas` : ''}${R.pctPaid ? ` · ${R.pctPaid}% entradas` : ''}${R.fixed ? ` · S/ ${R.fixed} fijo` : ''}` : 'clic para definir'} onClick={() => setRuleOpen(true)} />
      </div>
      <Panel>
        <DataTable id="promo-event" rows={P.rows.map((r) => ({ ...r, id: r.code }))} initialSort={{ key: 'attended', dir: -1 }} csvName={`promotores-${eventId}`} empty="Nadie trajo invitados con código en esta fecha."
          columns={[
            { key: 'name', label: 'Promotor', get: (r) => r.name, render: (r) => <span className="font-medium">{r.name}{r.leader && <span className="ml-1.5 rounded border px-1 text-[10px] text-muted-foreground">líder</span>}{r.retired && <span className="ml-1.5 text-[11px] text-muted-foreground">retirado</span>}</span> },
            { key: 'team', label: 'Equipo', get: (r) => r.team || '' },
            { key: 'registrations', label: 'Registros', num: true, get: (r) => r.registrations, hidden: true },
            { key: 'qrs', label: 'QRs', num: true, get: (r) => r.qrs },
            { key: 'attended', label: 'Entraron', num: true, get: (r) => r.attended },
            { key: 'conversion', label: 'Asistencia', num: true, get: (r) => r.conversion, render: (r) => <span className={r.conversion != null && r.conversion >= 50 ? 'text-good' : 'text-muted-foreground'}>{pct(r.conversion)}</span> },
            { key: 'target', label: 'Meta', num: true, get: (r) => r.target, render: (r) => <button type="button" className="underline decoration-dotted underline-offset-2" onClick={(ev) => { ev.stopPropagation(); setTarget(r); }}>{r.target == null ? 'definir' : `${r.target} · ${pct(r.attainment)}`}</button> },
            { key: 'sales', label: 'Ventas', num: true, get: (r) => r.paidRevenue + r.tableRevenue, render: (r) => (r.paidRevenue + r.tableRevenue ? money(r.paidRevenue + r.tableRevenue) : '—') },
            { key: 'commission', label: 'Comisión', num: true, get: (r) => r.commission, render: (r) => (r.commission == null ? <Unavailable reason="Sin regla de comisión" /> : money(r.commission, 2)) },
            { key: 'paid', label: 'Pagado', num: true, get: (r) => r.paid, render: (r) => money(r.paid, 2) },
            { key: 'pending', label: 'Por pagar', num: true, get: (r) => r.pending, render: (r) => (r.pending == null ? '—' : r.pending > 0 ? <Button size="sm" variant="outline" className="h-7" onClick={(ev) => { ev.stopPropagation(); pay(r); }}>Pagar {money(r.pending, 2)}</Button> : <span className="text-good">al día</span>) },
          ]} />
      </Panel>
      <RuleDialog open={ruleOpen} onOpenChange={setRuleOpen} eventId={eventId} rule={R} />
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Meta de {target?.name}</DialogTitle><DialogDescription>Asistentes verificados que debería traer en esta fecha.</DialogDescription></DialogHeader>
          <TargetForm r={target} onSave={async (v) => { try { await promo('promo.target.set', { eventId, code: target.code, target: v }, 'Meta guardada'); setTarget(null); } catch { /* */ } }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TargetForm({ r, onSave }) {
  const [v, setV] = useState(r && r.target != null ? r.target : '');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(v); }} className="flex items-end gap-2">
      <Field label="Asistentes" className="flex-1"><Input type="number" min="0" className="mono" value={v} onChange={(e) => setV(e.target.value)} autoFocus /></Field>
      <Button type="submit">Guardar</Button>
    </form>
  );
}

function RuleDialog({ open, onOpenChange, eventId, rule }) {
  const { promo } = useOS();
  const [f, setF] = useState({ fixed: '', perAttendee: '', pctPaid: '', pctTables: '', note: '' });
  useEffect(() => { if (open) setF(rule ? { ...rule } : { fixed: '', perAttendee: '', pctPaid: '', pctTables: '', note: '' }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Regla de comisión del evento</DialogTitle><DialogDescription>Cada evento puede tener su propia regla. Se aplica sobre asistencia verificada en puerta y ventas reales con el código del promotor.</DialogDescription></DialogHeader>
        <form id="rule-form" className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); try { await promo('promo.rule.set', { eventId, rule: f }, 'Regla guardada'); onOpenChange(false); } catch { /* */ } }}>
          <Field label="S/ por asistente verificado"><Input type="number" step="0.01" min="0" className="mono" value={f.perAttendee} onChange={set('perAttendee')} /></Field>
          <Field label="Monto fijo por promotor (S/)"><Input type="number" step="0.01" min="0" className="mono" value={f.fixed} onChange={set('fixed')} /></Field>
          <Field label="% de mesas y boxes vendidos"><Input type="number" step="0.1" min="0" max="100" className="mono" value={f.pctTables} onChange={set('pctTables')} /></Field>
          <Field label="% de entradas pagadas vendidas"><Input type="number" step="0.1" min="0" max="100" className="mono" value={f.pctPaid} onChange={set('pctPaid')} /></Field>
          <Field label="Nota" className="sm:col-span-2"><Input value={f.note} onChange={set('note')} placeholder="Ej. bono si pasa la meta, se paga aparte" /></Field>
        </form>
        <DialogFooter>
          {rule && <Button variant="outline" className="mr-auto text-destructive" onClick={async () => { try { await promo('promo.rule.set', { eventId, rule: null }, 'Regla eliminada'); onOpenChange(false); } catch { /* */ } }}>Quitar regla</Button>}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="rule-form">Guardar regla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function History() {
  const { data } = useOS();
  const scope = useScope();
  const brandOf = new Map(data.finance.events.map((e) => [e.id, e.brand]));
  const agg = new Map();
  Object.entries(data.os.promoters).filter(([evId]) => scope.inScope(brandOf.get(evId))).forEach(([evId, P]) => P.rows.forEach((r) => {
    const o = agg.get(r.code) || { id: r.code, code: r.code, name: r.name, team: r.team, events: 0, qrs: 0, attended: 0, sales: 0, commission: 0, paid: 0, hasRule: false };
    o.events++; o.qrs += r.qrs; o.attended += r.attended; o.sales += r.paidRevenue + r.tableRevenue; o.paid += r.paid;
    if (r.commission != null) { o.commission += r.commission; o.hasRule = true; }
    agg.set(r.code, o);
  }));
  return (
    <Panel>
      <PanelBar title={`Historial por promotor · ${scope.name}`} description="Todas las fechas con datos de la web de tickets." />
      <DataTable id="promo-history" rows={[...agg.values()]} initialSort={{ key: 'attended', dir: -1 }} csvName="promotores-historial"
        columns={[
          { key: 'name', label: 'Promotor', get: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'team', label: 'Equipo', get: (r) => r.team || '' },
          { key: 'events', label: 'Fechas', num: true, get: (r) => r.events },
          { key: 'qrs', label: 'QRs', num: true, get: (r) => r.qrs },
          { key: 'attended', label: 'Entraron', num: true, get: (r) => r.attended },
          { key: 'conv', label: 'Asistencia', num: true, get: (r) => (r.qrs ? (r.attended / r.qrs) * 100 : null), render: (r) => pct(r.qrs ? (r.attended / r.qrs) * 100 : null) },
          { key: 'sales', label: 'Ventas', num: true, get: (r) => r.sales, render: (r) => (r.sales ? money(r.sales) : '—') },
          { key: 'commission', label: 'Comisiones', num: true, get: (r) => (r.hasRule ? r.commission : null), render: (r) => (r.hasRule ? money(r.commission, 2) : <Unavailable reason="Ninguna fecha con regla" />) },
          { key: 'paid', label: 'Pagado', num: true, get: (r) => r.paid, render: (r) => money(r.paid, 2) },
        ]} />
    </Panel>
  );
}

function Teams() {
  const { data, promo } = useOS();
  const teams = data.promo.teams || [];
  const members = data.promo.members || {};
  const roster = (data.os.roster || []).filter((p) => !p.retired);
  const [name, setName] = useState('');
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
      <Panel className="xl:col-span-5">
        <PanelBar title="Equipos" description="Compartidos entre las marcas: un promotor puede trabajar para varias." />
        <form className="flex gap-2 border-b px-4 py-3" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; try { await promo('promo.team.upsert', { team: { name } }, 'Equipo creado'); setName(''); } catch { /* */ } }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del equipo" className="h-8" /><Button size="sm" type="submit"><PlusIcon />Crear</Button>
        </form>
        <ul className="divide-y">
          {teams.length === 0 && <li className="px-4 py-5 text-[13px] text-muted-foreground">Sin equipos todavía.</li>}
          {teams.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{t.name}</span><span className="text-[11px] text-muted-foreground">{Object.values(members).filter((m) => m === t.id).length} miembro(s)</span></span>
              <select aria-label={`Líder de ${t.name}`} className={cn(sel, 'h-8 w-40 text-[12px]')} value={t.leader || ''} onChange={(e) => promo('promo.team.upsert', { team: { ...t, leader: e.target.value } }, 'Líder actualizado').catch(() => {})}>
                <option value="">Sin líder</option>{roster.filter((p) => members[p.code] === t.id).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
              <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${t.name}`} onClick={() => promo('promo.team.delete', { id: t.id }, 'Equipo eliminado').catch(() => {})}><Trash2Icon /></Button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="xl:col-span-7">
        <PanelBar title="Promotores activos" description="Los accesos y códigos se siguen gestionando en el admin de tickets." />
        <DataTable id="promo-roster" rows={roster.map((p) => ({ ...p, id: p.code }))} initialSort={{ key: 'name', dir: 1 }}
          columns={[
            { key: 'name', label: 'Promotor', get: (p) => p.name, render: (p) => <span className="font-medium">{p.name}</span> },
            { key: 'code', label: 'Código', get: (p) => p.code, render: (p) => <span className="mono text-muted-foreground">{p.code}</span> },
            { key: 'status', label: 'Estado', get: (p) => (p.active ? 'Activo' : 'Pausado') },
            { key: 'team', label: 'Equipo', sortable: false, get: (p) => (teams.find((t) => t.id === members[p.code]) || {}).name || '', render: (p) => (
              <select aria-label={`Equipo de ${p.name}`} className={cn(sel, 'h-7 w-44 text-[12px]')} value={members[p.code] || ''} onClick={(e) => e.stopPropagation()} onChange={(e) => promo('promo.member.set', { code: p.code, teamId: e.target.value || null }, 'Equipo asignado').catch(() => {})}>
                <option value="">Sin equipo</option>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>) },
          ]} />
      </Panel>
    </div>
  );
}
