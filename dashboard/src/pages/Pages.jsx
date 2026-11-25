import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useBlocker } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon, PencilIcon, SlidersHorizontalIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOS, useSummary } from '../os/store.jsx';
import { PageHeader, StageBadge, BrandDot, Kpi, Unavailable, fmtDay, fmtDayYear, relDays, moneyOrNA, signTone } from '../os/kit.jsx';
import { ActivityRow, PanelBar } from './Overview.jsx';
import Brand, { EventView } from '../Brand.jsx';
import Editor from '../Editor.jsx';
import { Panel, BrandTile, KindTag } from '../ui.jsx';
import { cn, money, pct, brandColor, isActual } from '../lib.js';

// ---------- Espacio de un evento ----------
export function EventPage() {
  const { id } = useParams();
  const { data, withTaxes, updateEvent, setDrawer } = useOS();
  const navigate = useNavigate();
  const e = data.finance.events.find((x) => x.id === id);
  if (!e) return <NotFound what="Este evento no existe o fue eliminado." />;
  const f = data.os.summary.events.find((x) => x.id === id);
  const stages = data.os.stages;
  const brand = data.finance.brands.find((b) => b.id === e.brand);
  const events = data.finance.events.filter((x) => x.brand === e.brand).sort((a, b) => a.date.localeCompare(b.date));
  const real = isActual(e);
  const flow = stages.filter((s) => s.id !== 'cancelled');
  const idx = flow.findIndex((s) => s.id === e.stage);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-3">
        <BrandTile id={e.brand} size="md" />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-muted-foreground"><Link to={`/marcas/${e.brand}`} className="hover:underline">{brand?.name}</Link> · {fmtDayYear(e.date)} · {relDays(f?.daysTo)} · {e.venue || 'local por confirmar'}</p>
          <h1 className="text-[20px] font-semibold tracking-tight">{e.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <KindTag real={real} />
          <Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'event', id })}><PencilIcon />Editar detalles</Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/finanzas/datos?evento=${id}`)}><SlidersHorizontalIcon />Editar números</Button>
        </div>
      </div>

      {/* Etapas: clic para mover el evento. */}
      <Panel className="overflow-x-auto">
        <ol className="flex min-w-max items-stretch">
          {flow.map((s, i) => {
            const done = idx >= 0 && i < idx, cur = s.id === e.stage;
            return (
              <li key={s.id} className="flex-1">
                <button type="button" disabled={cur} onClick={() => updateEvent(id, { stage: s.id }, `Movido a ${s.label}`).catch(() => {})}
                  className={cn('flex h-full w-full items-center gap-2 border-r px-3 py-2.5 text-left text-[12px] transition-colors last:border-r-0 hover:bg-muted/60', cur && 'bg-muted font-medium text-foreground', !cur && !done && 'text-muted-foreground')}>
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px]', done && 'border-transparent bg-good text-white', cur && 'border-foreground')}>{done ? <CheckIcon className="size-3" /> : i + 1}</span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        {e.stage === 'cancelled' && <p className="border-t px-3 py-2 text-[12px] text-muted-foreground">Evento cancelado: no entra en ningún total.</p>}
      </Panel>

      {f && f.warnings.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {f.warnings.map((w, i) => <li key={i} className={cn('flex gap-2 rounded-lg border px-3 py-2 text-[12px]', w.level === 'warn' ? 'border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200' : 'bg-background text-muted-foreground')}><TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />{w.text}</li>)}
        </ul>
      )}

      {f && f.budget && real && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Kpi label="Resultado real" value={money(f.result)} tone={signTone(f.result)} />
          <Kpi proj label="Utilidad presupuestada" value={moneyOrNA(f.budget.result)} unavailable={f.budget.result == null ? 'El presupuesto no tenía costos' : null} sub={f.budget.approvedAt ? `aprobado el ${fmtDayYear(f.budget.approvedAt.slice(0, 10))}` : ''} />
          <Kpi label="Variación" value={f.budget.result == null ? null : money(f.result - f.budget.result)} unavailable={f.budget.result == null ? 'Sin presupuesto completo' : null} tone={f.budget.result == null ? undefined : signTone(f.result - f.budget.result)} />
          <Kpi label="Ingresos vs. presupuesto" value={money(f.revenue - f.budget.revenue)} tone={signTone(f.revenue - f.budget.revenue)} sub={`presupuesto ${money(f.budget.revenue)}`} />
        </div>
      )}

      <EventView key={e.id + withTaxes} e={e} events={events} live={data.live} culqi={data.culqi} withTaxes={withTaxes} color={brandColor(e.brand)} brandId={e.brand} go={navigate} />
    </div>
  );
}

// ---------- Marca ----------
export function BrandPage() {
  const { brandId } = useParams();
  const { data, withTaxes } = useOS();
  const navigate = useNavigate();
  const [sel, setSel] = useState({});
  if (!data.finance.brands.some((b) => b.id === brandId)) return <NotFound what="Esta marca no existe." />;
  return <Brand brandId={brandId} finance={data.finance} live={data.live} culqi={data.culqi} withTaxes={withTaxes} selected={sel[brandId]} onSelect={(id) => setSel((s) => ({ ...s, [brandId]: id }))} go={navigate} />;
}

// ---------- Finanzas: estado de resultados por evento ----------
export function Finance() {
  const { data, workspace, setDrawer, withTaxes } = useOS();
  const navigate = useNavigate();
  const { summary: S, loading } = useSummary({ brand: workspace === 'group' ? null : workspace });
  if (!S) return <p className="text-[13px] text-muted-foreground">Calculando…</p>;
  const actual = S.events.filter((f) => f.kind === 'actual');
  const budget = S.events.filter((f) => f.kind === 'budget');
  const metric = (id) => () => setDrawer({ type: 'metric', id, summary: S });
  const Row = ({ f }) => (
    <TableRow className={cn('cursor-pointer text-[13px]', f.kind === 'budget' && 'border-dashed')} onClick={() => setDrawer({ type: 'event', id: f.id })}>
      <TableCell className="pl-4"><span className="flex items-center gap-2"><BrandDot id={f.brand} /><span className="min-w-0"><span className="block truncate font-medium">{f.name}</span><span className="block text-[11px] text-muted-foreground">{fmtDay(f.date)}</span></span></span></TableCell>
      <TableCell><StageBadge stage={f.stage} stages={data.os.stages} /></TableCell>
      <TableCell className="mono text-end">{f.hasIncome ? money(f.revenue) : <Unavailable />}</TableCell>
      <TableCell className="mono text-end">{f.hasCosts ? money(f.costs) : <Unavailable />}</TableCell>
      <TableCell className="mono text-end text-muted-foreground">{f.closingStock ? money(f.closingStock) : '—'}{f.openingStock ? <span className="block text-[11px]">−{money(f.openingStock)} inicial</span> : null}</TableCell>
      <TableCell className={cn('mono text-end', f.result != null && (f.result >= 0 ? 'text-good' : 'text-bad'))}>{f.result == null ? <span className="text-[12px] text-proj">Incompleto</span> : money(f.result)}</TableCell>
      <TableCell className="mono pr-4 text-end text-muted-foreground">{pct(f.margin)}</TableCell>
    </TableRow>
  );
  const Head = () => (
    <TableHeader><TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]">
      <TableHead className="pl-4">Evento</TableHead><TableHead>Etapa</TableHead><TableHead className="text-end">Ingresos</TableHead><TableHead className="text-end">Costos</TableHead><TableHead className="text-end">Inventario</TableHead><TableHead className="text-end">Resultado</TableHead><TableHead className="pr-4 text-end">Margen</TableHead>
    </TableRow></TableHeader>
  );
  return (
    <div className={cn('flex flex-col gap-4', loading && 'opacity-60')}>
      <PageHeader title="Finanzas" description={`Estado de resultados por evento · ${withTaxes ? 'con' : 'sin'} IGV y renta. Clic en una cifra para ver cómo se calcula.`}
        actions={<Button size="sm" variant="outline" onClick={() => navigate('/finanzas/datos')}><SlidersHorizontalIcon />Datos financieros</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ingresos reales" value={money(S.actual.revenue)} onClick={metric('revenue')} />
        <Kpi label="Costos reales" value={money(S.actual.costs)} onClick={metric('costs')} />
        <Kpi label="Resultado real" value={money(S.actual.result)} tone={signTone(S.actual.result)} onClick={metric('result')} />
        <Kpi label="Inversión en marca" value={money(S.actual.brandInvestment)} sub="activo, fuera del resultado" onClick={metric('brandInvestment')} />
        <Kpi proj label="Ingresos proyectados" value={money(S.projected.revenue)} onClick={metric('projRevenue')} />
        <Kpi proj label="Utilidad proyectada" value={moneyOrNA(S.projected.profit)} unavailable={S.projected.profit == null ? 'Ningún presupuesto completo' : null} tone={signTone(S.projected.profit)} sub={`${S.projected.completeCount} de ${S.projected.count} completos`} onClick={metric('projProfit')} />
      </div>
      <Panel>
        <PanelBar title="Real" description="Eventos en Liquidación o Cerrados." action={<KindTag real />} />
        <Table><Head /><TableBody>
          {actual.length === 0 && <TableRow><TableCell colSpan={7} className="px-4 py-6 text-[13px] text-muted-foreground">Sin eventos cerrados.</TableCell></TableRow>}
          {actual.map((f) => <Row key={f.id} f={f} />)}
        </TableBody>
          {actual.length > 0 && <TableFooter><TableRow className="text-[13px]"><TableCell className="pl-4" colSpan={2}>Total real</TableCell><TableCell className="mono text-end">{money(S.actual.revenue)}</TableCell><TableCell className="mono text-end">{money(S.actual.costs)}</TableCell><TableCell className="mono text-end">{money(S.actual.stock)}</TableCell><TableCell className={cn('mono text-end', S.actual.result >= 0 ? 'text-good' : 'text-bad')}>{money(S.actual.result)}</TableCell><TableCell className="mono pr-4 text-end">{pct(S.actual.margin)}</TableCell></TableRow></TableFooter>}
        </Table>
      </Panel>
      <Panel proj>
        <PanelBar title="Proyectado" description="Presupuestos. La utilidad solo suma presupuestos completos." action={<KindTag />} />
        <Table><Head /><TableBody>
          {budget.length === 0 && <TableRow><TableCell colSpan={7} className="px-4 py-6 text-[13px] text-muted-foreground">Sin presupuestos.</TableCell></TableRow>}
          {budget.map((f) => <Row key={f.id} f={f} />)}
        </TableBody>
          {budget.length > 0 && <TableFooter className="bg-proj-soft/60 dark:bg-transparent"><TableRow className="text-[13px]"><TableCell className="pl-4" colSpan={2}>Total proyectado</TableCell><TableCell className="mono text-end">{money(S.projected.revenue)}</TableCell><TableCell className="mono text-end">{money(S.projected.costs)}<span className="block text-[11px] font-normal text-muted-foreground">solo completos</span></TableCell><TableCell /><TableCell className="mono text-end">{moneyOrNA(S.projected.profit) || <Unavailable />}</TableCell><TableCell className="pr-4" /></TableRow></TableFooter>}
        </Table>
      </Panel>
      <p className="text-[12px] text-muted-foreground">Caja, por pagar, por cobrar, cuentas y transacciones llegan en la Fase 2. Hasta entonces se muestran como no disponibles, nunca como cero.</p>
    </div>
  );
}

// ---------- Datos financieros (editor) ----------
export function FinanceData() {
  const { data, withTaxes, saveFinance } = useOS();
  const [params] = useSearchParams();
  const [draft, setDraft] = useState(() => JSON.parse(JSON.stringify(data.finance)));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(params.get('evento'));
  useEffect(() => { if (!dirty) setDraft(JSON.parse(JSON.stringify(data.finance))); }, [data.version, data.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const p = params.get('evento'); if (p) setEditId(p); }, [params]);
  useEffect(() => {
    const h = (ev) => { if (dirty) { ev.preventDefault(); ev.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  return (
    <>
      <Editor draft={draft} setDraft={setDraft} dirty={dirty} setDirty={setDirty} editId={editId} setEditId={setEditId} withTaxes={withTaxes} seeded={data.seeded} stages={data.os.stages}
        saving={saving} onSave={async () => { setSaving(true); try { await saveFinance(draft); setDirty(false); } catch { /* toast */ } finally { setSaving(false); } }}
        onDiscard={() => { setDraft(JSON.parse(JSON.stringify(data.finance))); setDirty(false); }} />
      <Dialog open={blocker.state === 'blocked'} onOpenChange={(o) => !o && blocker.reset && blocker.reset()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tienes cambios sin guardar</DialogTitle><DialogDescription>Si sales ahora, se pierden.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => blocker.reset && blocker.reset()}>Seguir editando</Button>
            <Button variant="destructive" onClick={() => blocker.proceed && blocker.proceed()}>Salir sin guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------- Atención ----------
export function Attention() {
  const { workspace, setDrawer } = useOS();
  const { attention, summary } = useSummary({ brand: workspace === 'group' ? null : workspace });
  const groups = [['high', 'Urgente'], ['med', 'Revisar'], ['low', 'Aviso']];
  const byId = new Map((summary ? summary.events : []).map((f) => [f.id, f]));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Atención" description="Lo que hay que resolver, calculado con los datos actuales. Se actualiza solo." />
      {attention.length === 0 && <Panel className="px-4 py-8 text-[13px] text-muted-foreground">Nada pendiente.</Panel>}
      {groups.map(([lvl, label]) => {
        const items = attention.filter((a) => a.level === lvl);
        if (!items.length) return null;
        return (
          <Panel key={lvl}>
            <PanelBar title={`${label} (${items.length})`} />
            <ul className="divide-y">
              {items.map((a, i) => { const f = a.event && byId.get(a.event); return (
                <li key={i}>
                  <button type="button" disabled={!a.event} onClick={() => a.event && setDrawer({ type: 'event', id: a.event })} className="flex w-full items-start gap-3 px-4 py-3 text-left enabled:hover:bg-muted/60">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', lvl === 'high' ? 'bg-bad' : lvl === 'med' ? 'bg-[#C98500]' : 'bg-muted-foreground/50')} />
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{a.title}</span><span className="block text-[12px] text-muted-foreground">{a.text}</span></span>
                    {f && <span className="flex shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground"><BrandDot id={f.brand} />{fmtDay(f.date)}</span>}
                  </button>
                </li>); })}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}

// ---------- Registro de actividad ----------
export function Activity() {
  const { osApi, setDrawer, data } = useOS();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { osApi({ action: 'activity' }).then((r) => setRows(r.activity || [])).catch(() => setErr(true)); }, [data.version]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Registro de actividad" description="Cada cambio hecho desde Paradisio OS, con fecha y hora de Lima. Se guardan los últimos 500." />
      <Panel>
        {err ? <p className="px-4 py-6 text-[13px] text-bad">No se pudo cargar el registro.</p>
          : !rows ? <p className="px-4 py-6 text-[13px] text-muted-foreground">Cargando…</p>
          : rows.length === 0 ? <p className="px-4 py-6 text-[13px] text-muted-foreground">Sin cambios registrados todavía.</p>
          : <ul className="divide-y">{rows.map((a, i) => <ActivityRow key={i} a={a} stages={data.os.stages} onOpen={(id) => setDrawer({ type: 'event', id })} />)}</ul>}
      </Panel>
    </div>
  );
}

export function NotFound({ what = 'Esta página no existe.' }) {
  return (
    <Panel className="flex flex-col items-start gap-3 px-5 py-8">
      <p className="text-[14px] font-medium">{what}</p>
      <Button asChild size="sm" variant="outline"><Link to="/"><ArrowLeftIcon />Volver al resumen</Link></Button>
    </Panel>
  );
}
