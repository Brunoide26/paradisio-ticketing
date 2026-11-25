import React, { useEffect, useMemo, useState } from 'react';
import { SaveIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useOS } from '../os/store.jsx';
import { PageHeader, fmtDay, sel, Field } from '../os/kit.jsx';
import { FinanceTabs } from './Finance.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel } from '../ui.jsx';
import { cn, money, pct, isActual, sum } from '../lib.js';

const SCEN = [['pes', 'Pesimista'], ['con', 'Conservador'], ['opt', 'Optimista']];
const VAR_CATS = new Set(['Barra', 'Comisiones', 'Impuestos']);

// Valores de partida desde un evento real: asistencia (puerta), gasto en barra por persona, costo de barra, costos fijos.
function baseFrom(e, live) {
  if (!e) return null;
  const L = e.liveEventId && live ? live[e.liveEventId] : null;
  const att = L && L.ingresaron ? L.ingresaron : null;
  const inc = (cat) => sum((e.income || []).filter((l) => l.category === cat), (l) => l.amount);
  const cost = (cat) => sum((e.costs || []).filter((l) => l.category === cat), (l) => l.amount);
  const bar = inc('Barra');
  const barCost = Math.max(0, cost('Barra') - (Number(e.stockLeft) || 0) + (Number(e.openingStock) || 0));
  const fixed = (e.costs || []).filter((l) => !VAR_CATS.has(l.category));
  return {
    attendance: att, ticketPrice: 0, payShare: 0,
    // Sin asistencia de puerta no se puede saber el gasto por persona: queda vacío, no en cero.
    barPerHead: att && bar ? Math.round((bar / att) * 100) / 100 : '',
    tables: inc('Boxes y mesas'), cogsPct: bar ? Math.round((barCost / bar) * 1000) / 10 : 30, feePct: 4,
    fixedLines: fixed.map((l) => ({ label: l.label, category: l.category, amount: Number(l.amount) || 0 })),
  };
}

// Asistentes y gasto en barra son obligatorios: sin ellos el resultado sería inventado.
const missing = (s) => s.attendance === '' || s.barPerHead === '';

function compute(s, fixed) {
  if (missing(s)) return null;
  const att = Number(s.attendance) || 0;
  const tickets = att * (Number(s.payShare) || 0) / 100 * (Number(s.ticketPrice) || 0);
  const bar = att * (Number(s.barPerHead) || 0);
  const tables = Number(s.tables) || 0;
  const revenue = tickets + bar + tables;
  const cogs = bar * (Number(s.cogsPct) || 0) / 100;
  const fees = (tickets + tables) * (Number(s.feePct) || 0) / 100;
  const variable = cogs + fees;
  const contribution = revenue - variable;
  const profit = contribution - fixed;
  const perHead = (Number(s.payShare) || 0) / 100 * (Number(s.ticketPrice) || 0) * (1 - (Number(s.feePct) || 0) / 100) + (Number(s.barPerHead) || 0) * (1 - (Number(s.cogsPct) || 0) / 100);
  const tablesNet = tables * (1 - (Number(s.feePct) || 0) / 100);
  const breakEven = perHead > 0 ? Math.max(0, Math.ceil((fixed - tablesNet) / perHead)) : null;
  return { tickets, bar, tables, revenue, cogs, fees, variable, contribution, cm: revenue ? (contribution / revenue) * 100 : null, fixed, profit, margin: revenue ? (profit / revenue) * 100 : null, perHead, breakEven };
}

export default function Simulator({ eventId: fixedEvent }) {
  const { data, saveEventNumbers, workspace } = useOS();
  const inScope = (e) => workspace === 'group' || e.brand === workspace || (fixedEvent && e.id === fixedEvent);
  // Partir de cualquier fecha real (de otra marca también sirve como referencia); guardar sólo en fechas de la marca elegida.
  const actual = data.finance.events.filter(isActual).sort((a, b) => b.date.localeCompare(a.date));
  const targets = data.finance.events.filter((e) => !isActual(e) && e.stage !== 'cancelled' && inScope(e)).sort((a, b) => a.date.localeCompare(b.date));
  const [baseId, setBaseId] = useState(actual[0]?.id || '');
  const base = useMemo(() => baseFrom(data.finance.events.find((e) => e.id === baseId), data.live), [baseId, data.finance, data.live]); // eslint-disable-line react-hooks/exhaustive-deps
  const init = (b) => {
    const a = b && b.attendance ? b.attendance : null;
    const mk = (f) => ({ attendance: a ? Math.round(a * f) : '', payShare: b ? b.payShare : 0, ticketPrice: b ? b.ticketPrice : 0, barPerHead: b ? b.barPerHead : '', tables: Math.round((b ? b.tables : 0) * f), cogsPct: b ? b.cogsPct : 30, feePct: b ? b.feePct : 4 });
    return { pes: mk(0.7), con: mk(1), opt: mk(1.3) };
  };
  const [sc, setSc] = useState(() => init(base));
  const [fixed, setFixed] = useState(() => (base ? base.fixedLines : []));
  useEffect(() => { setSc(init(base)); setFixed(base ? base.fixedLines : []); }, [baseId]); // eslint-disable-line react-hooks/exhaustive-deps
  const fixedTotal = sum(fixed, (l) => Number(l.amount) || 0);
  const R = Object.fromEntries(SCEN.map(([k]) => [k, compute(sc[k], fixedTotal)]));
  const set = (k, f) => (e) => setSc((x) => ({ ...x, [k]: { ...x[k], [f]: e.target.value } }));

  const [saving, setSaving] = useState(null); // { scen }
  const [target, setTarget] = useState(fixedEvent || targets[0]?.id || '');
  const saveAsBudget = async () => {
    const r = R[saving.scen];
    const income = [
      r.tickets > 0 && { label: `Entradas (simulación ${saving.label.toLowerCase()})`, category: 'Entradas', amount: Math.round(r.tickets * 100) / 100 },
      r.bar > 0 && { label: `Barra (simulación ${saving.label.toLowerCase()})`, category: 'Barra', amount: Math.round(r.bar * 100) / 100 },
      r.tables > 0 && { label: 'Boxes y mesas', category: 'Boxes y mesas', amount: r.tables },
    ].filter(Boolean);
    const costs = [
      ...fixed.filter((l) => l.label && Number(l.amount)).map((l) => ({ label: l.label, category: l.category || 'Otros', amount: Number(l.amount) })),
      r.cogs > 0 && { label: `Costo de barra (${sc[saving.scen].cogsPct}%)`, category: 'Barra', amount: Math.round(r.cogs * 100) / 100 },
      r.fees > 0 && { label: `Comisiones (${sc[saving.scen].feePct}%)`, category: 'Comisiones', amount: Math.round(r.fees * 100) / 100 },
    ].filter(Boolean);
    try { await saveEventNumbers(target, { income, costs }, `Simulador · escenario ${saving.label}`); setSaving(null); } catch { /* toast */ }
  };

  const rows = [
    ['Asistentes', 'attendance', 'personas'], ['% que paga entrada', 'payShare', '%'], ['Precio de entrada', 'ticketPrice', 'S/'],
    ['Gasto en barra por persona', 'barPerHead', 'S/'], ['Boxes y mesas (total)', 'tables', 'S/'], ['Costo de barra', 'cogsPct', '% de la barra'], ['Comisiones (Culqi, etc.)', 'feePct', '% de entradas y boxes'],
  ];
  const out = [
    ['Ingresos por entradas', 'tickets'], ['Ingresos de barra', 'bar'], ['Boxes y mesas', 'tables'], ['Ingresos totales', 'revenue', true],
    ['Costos variables', 'variable'], ['Margen de contribución', 'contribution', true], ['Margen de contribución %', 'cm', false, true],
    ['Costos fijos', 'fixed'], ['Utilidad', 'profit', true], ['Margen', 'margin', false, true],
  ];
  return (
    <div className="flex flex-col gap-3">
      {!fixedEvent && <PageHeader title="Simulador de rentabilidad" description="Tres escenarios con los mismos costos fijos. Todo es proyectado: nada de aquí se suma a lo real hasta que lo guardes como presupuesto de un evento." />}
      {!fixedEvent && <FinanceTabs />}
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Partir de un evento real" className="w-72"><select className={sel} value={baseId} onChange={(e) => setBaseId(e.target.value)}><option value="">Desde cero</option>{actual.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select></Field>
        {base && !base.attendance && <p className="pb-2 text-[12px] text-proj">Este evento no tiene asistencia registrada en la puerta: ingresa asistentes y gasto en barra por persona.</p>}
        {base && base.attendance && <p className="pb-2 text-[12px] text-muted-foreground">{base.attendance ? `${base.attendance} asistentes (puerta)` : 'sin datos de puerta'} · barra {money(base.barPerHead, 2)} por persona · costo de barra {pct(base.cogsPct)} (descontando stock final) · {base.fixedLines.length} costos fijos</p>}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel proj className="xl:col-span-7">
          <PanelBar title="Supuestos y resultado" description="Edita las celdas. El punto de equilibrio usa la mezcla de cada escenario." />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]"><TableHead className="pl-4">Supuesto</TableHead>{SCEN.map(([k, l]) => <TableHead key={k} className="text-end">{l}</TableHead>)}<TableHead className="pr-4" /></TableRow></TableHeader>
              <TableBody>
                {rows.map(([l, f, unit]) => (
                  <TableRow key={f} className="hover:bg-transparent">
                    <TableCell className="pl-4 text-[13px]">{l}</TableCell>
                    {SCEN.map(([k]) => <TableCell key={k} className="py-1 text-end"><Input type="number" step="any" min="0" className="mono ml-auto h-8 w-28 text-right" value={sc[k][f]} onChange={set(k, f)} aria-label={`${l} ${k}`} /></TableCell>)}
                    <TableCell className="pr-4 text-[11px] text-muted-foreground">{unit}</TableCell>
                  </TableRow>
                ))}
                {out.map(([l, f, strong, isPct]) => (
                  <TableRow key={f} className={cn('hover:bg-transparent', strong && 'bg-muted/50 font-medium')}>
                    <TableCell className="pl-4 text-[13px]">{l}</TableCell>
                    {SCEN.map(([k]) => { if (!R[k]) return <TableCell key={k} className="text-end text-[12px] text-proj">Falta dato</TableCell>; const v = R[k][f]; return <TableCell key={k} className={cn('mono text-end text-[13px]', f === 'profit' && (v >= 0 ? 'text-good' : 'text-bad'))}>{isPct ? pct(v) : (f === 'variable' || f === 'fixed' ? '−' : '') + money(v)}</TableCell>; })}
                    <TableCell className="pr-4" />
                  </TableRow>
                ))}
                <TableRow className="bg-proj-soft/60 font-medium hover:bg-proj-soft/60">
                  <TableCell className="pl-4 text-[13px]">Asistentes para no perder</TableCell>
                  {SCEN.map(([k]) => <TableCell key={k} className="mono text-end text-[13px]">{!R[k] || R[k].breakEven == null ? '—' : R[k].breakEven.toLocaleString('es-PE')}</TableCell>)}
                  <TableCell className="pr-4 text-[11px] text-muted-foreground">punto de equilibrio</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="pl-4 text-[13px]">Guardar como presupuesto</TableCell>
                  {SCEN.map(([k, l]) => <TableCell key={k} className="py-1 text-end"><Button size="sm" variant="outline" disabled={!targets.length || !R[k]} onClick={() => setSaving({ scen: k, label: l })}><SaveIcon />Usar</Button></TableCell>)}
                  <TableCell className="pr-4" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel proj className="xl:col-span-5">
          <PanelBar title={`Costos fijos · ${money(fixedTotal)}`} description="Iguales en los tres escenarios. Edita, agrega o quita." action={<Button size="sm" variant="ghost" onClick={() => setFixed((x) => [...x, { label: '', category: 'Otros', amount: 0 }])}>Agregar</Button>} />
          <ul className="divide-y">
            {fixed.length === 0 && <li className="px-4 py-4 text-[13px] text-muted-foreground">Sin costos fijos.</li>}
            {fixed.map((l, i) => (
              <li key={i} className="flex items-center gap-2 px-4 py-1.5">
                <Input className="h-8 flex-1 text-[13px]" value={l.label} onChange={(e) => setFixed((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} aria-label="Concepto" />
                <Input type="number" step="any" className="mono h-8 w-28 text-right text-[13px]" value={l.amount} onChange={(e) => setFixed((x) => x.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} aria-label="Monto" />
                <Button size="icon-sm" variant="ghost" aria-label="Quitar" onClick={() => setFixed((x) => x.filter((_, j) => j !== i))}>×</Button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Dialog open={!!saving} onOpenChange={(o) => !o && setSaving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar escenario {saving?.label.toLowerCase()} como presupuesto</DialogTitle>
            <DialogDescription>Reemplaza los ingresos y costos presupuestados del evento elegido. La versión anterior queda en el historial.</DialogDescription>
          </DialogHeader>
          <Field label="Evento"><select className={sel} value={target} onChange={(e) => setTarget(e.target.value)} disabled={!!fixedEvent}>{targets.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select></Field>
          {saving && <p className="text-[13px]">Ingresos {money(R[saving.scen].revenue)} · costos {money(R[saving.scen].variable + R[saving.scen].fixed)} · utilidad <span className={R[saving.scen].profit >= 0 ? 'text-good' : 'text-bad'}>{money(R[saving.scen].profit)}</span></p>}
          <DialogFooter><Button variant="outline" onClick={() => setSaving(null)}>Cancelar</Button><Button onClick={saveAsBudget} disabled={!target}>Reemplazar presupuesto</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
