import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useBlocker } from 'react-router-dom';
import { ArrowLeftIcon, CheckIcon, PencilIcon, SlidersHorizontalIcon, TriangleAlertIcon, CopyIcon, ClipboardListIcon, PlusIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import DataTable from '../os/DataTable.jsx';
import { CountDialog } from '../os/forms.jsx';
import { EventConsumption } from './Inventory.jsx';
import Simulator from './Simulator.jsx';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOS, useSummary } from '../os/store.jsx';
import { PageHeader, StageBadge, BrandDot, Kpi, Unavailable, fmtDay, fmtDayYear, relDays, moneyOrNA, signTone, Field } from '../os/kit.jsx';
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
  const [tab, setTab] = useState('resumen');
  const [counting, setCounting] = useState(false);
  const [dup, setDup] = useState(false);
  const e = data.finance.events.find((x) => x.id === id);
  const pay = ((data.os.byEvent || {})[id] || {}).payments;
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
          <Button size="sm" variant="outline" onClick={() => setDup(true)}><CopyIcon />Duplicar</Button>
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8">
          <TabsTrigger value="resumen" className="text-[12px]">Finanzas y operación</TabsTrigger>
          <TabsTrigger value="pagos" className="text-[12px]">Pagos y cobros{pay ? ` (${pay.count})` : ''}</TabsTrigger>
          <TabsTrigger value="inventario" className="text-[12px]">Inventario</TabsTrigger>
          {!real && e.stage !== 'cancelled' && <TabsTrigger value="simulador" className="text-[12px]">Simulador</TabsTrigger>}
        </TabsList>
      </Tabs>
      {tab === 'resumen' && <EventView key={e.id + withTaxes} e={e} events={events} live={data.live} culqi={data.culqi} withTaxes={withTaxes} color={brandColor(e.brand)} brandId={e.brand} go={navigate} />}
      {tab === 'pagos' && <EventPayments e={e} />}
      {tab === 'inventario' && (
        <Panel>
          <PanelBar title="Consumo de inventario" description="Conteo de apertura + compras para el evento − conteo de cierre." action={<Button size="sm" variant="outline" onClick={() => setCounting(true)}><ClipboardListIcon />Conteo</Button>} />
          <EventConsumption eventId={e.id} compact />
        </Panel>
      )}
      {tab === 'simulador' && <Simulator eventId={e.id} />}
      <CountDialog open={counting} onOpenChange={setCounting} eventId={e.id} phase={real ? 'close' : 'open'} />
      <DuplicateDialog open={dup} onOpenChange={setDup} e={e} />
    </div>
  );
}

function EventPayments({ e }) {
  const { data, setDrawer } = useOS();
  const p = ((data.os.byEvent || {})[e.id] || {}).payments;
  const tx = (data.ledger.transactions || []).filter((t) => t.eventId === e.id);
  const acc = new Map((data.ledger.accounts || []).map((a) => [a.id, a.name]));
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Pagado" value={p ? money(p.paid) : null} unavailable={p ? null : 'Sin pagos registrados'} />
        <Kpi label="Por pagar" value={p ? money(p.pendingCost) : null} unavailable={p ? null : 'Sin pagos registrados'} tone={p && p.pendingCost ? 'bad' : undefined} />
        <Kpi label="Comprometido" value={p ? money(p.committed) : null} unavailable={p ? null : 'Sin compromisos'} />
        <Kpi label="Cobrado" value={p ? money(p.collected) : null} unavailable={p ? null : 'Sin cobros registrados'} />
        <Kpi label="Por cobrar" value={p ? money(p.toCollect) : null} unavailable={p ? null : 'Sin cobros registrados'} />
      </div>
      <Panel>
        <PanelBar title="Movimientos de dinero del evento" description="Pagos y cobros de montos que ya están en la liquidación: no cambian el resultado del evento."
          action={<div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'tx', preset: { kind: 'cost', eventId: e.id, date: e.date } })}><PlusIcon />Pago</Button><Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'tx', preset: { kind: 'sale', eventId: e.id, date: e.date } })}><PlusIcon />Cobro</Button></div>} />
        <DataTable id="ev-tx" rows={tx} searchable={false} initialSort={{ key: 'date', dir: -1 }} onRowClick={(t) => setDrawer({ type: 'tx', id: t.id })} empty="Sin pagos ni cobros registrados para este evento."
          columns={[
            { key: 'date', label: 'Fecha', get: (t) => t.date, render: (t) => <span className="mono">{fmtDay(t.date)}</span> },
            { key: 'description', label: 'Concepto', get: (t) => t.description, render: (t) => <span className="font-medium">{t.description}</span> },
            { key: 'kind', label: 'Tipo', get: (t) => data.os.enums.txKinds[t.kind].label },
            { key: 'counterparty', label: 'Proveedor / cliente', get: (t) => t.counterparty },
            { key: 'status', label: 'Estado', get: (t) => (t.paidOn ? `Pagado ${fmtDay(t.paidOn)} · ${acc.get(t.accountId) || ''}` : t.committed ? 'Comprometido' : 'Pendiente') },
            { key: 'amount', label: 'Monto', num: true, get: (t) => t.amount, render: (t) => money(t.amount, 2, t.currency) },
          ]} />
      </Panel>
    </div>
  );
}

function DuplicateDialog({ open, onOpenChange, e }) {
  const { duplicateEvent, setDrawer } = useOS();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDate(''); setName(e.name.replace(/\s*·\s*\d+ de \w+$/, '')); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Duplicar evento</DialogTitle><DialogDescription>Crea una fecha nueva en Concepto con los mismos ingresos y costos como presupuesto inicial. No copia stock, barra ni cierre.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre" className="sm:col-span-2"><Input value={name} onChange={(x) => setName(x.target.value)} /></Field>
          <Field label="Fecha"><Input type="date" value={date} onChange={(x) => setDate(x.target.value)} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button disabled={!date || !name || busy} onClick={async () => { setBusy(true); try { const r = await duplicateEvent(e.id, date, name); onOpenChange(false); if (r && r.id) setDrawer({ type: 'event', id: r.id }); } catch { /* */ } finally { setBusy(false); } }}>{busy ? 'Duplicando…' : 'Duplicar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
