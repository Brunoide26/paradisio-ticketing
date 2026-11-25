import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { CheckIcon, DownloadCloudIcon, PlusIcon, RadioIcon, RefreshCwIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, Unavailable, fmtDay, fmtStamp, useScope, BrandDot, sel, relDays } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel, Bars, BrandTile, TooltipBox, KindTag } from '../ui.jsx';
import { cn, money, pct, brandColor, limaISO } from '../lib.js';

const ago = (iso) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'hace segundos' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`;
};

// ======================= Integraciones =======================
const TONE = { ok: 'bg-good', manual: 'bg-sky-500', warn: 'bg-[#C98500]', empty: 'bg-muted-foreground/50', off: 'bg-muted-foreground/50', error: 'bg-bad' };
const LABEL = { ok: 'Conectado', manual: 'Carga manual', warn: 'Revisar', empty: 'Sin datos', off: 'Sin configurar', error: 'Con error' };

export function Integrations() {
  const { data, osApi, load, flash, setDrawer } = useOS();
  const list = data.os.integrations || [];
  const processors = (data.ledger.accounts || []).filter((a) => !a.archived && a.type === 'processor');
  const [pickAcc, setAcc] = useState('');
  // Si la cuenta elegida no existe (por ejemplo, recién creada), se usa la primera de tipo procesador.
  const acc = processors.some((a) => a.id === pickAcc) ? pickAcc : processors[0]?.id || '';
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const culqiTx = (data.ledger.transactions || []).filter((t) => t.source === 'culqi');
  const importCulqi = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await osApi({ action: 'int.culqi.import', accountId: acc, baseVersion: data.ledger.updatedAt || null });
      const n = r.ledger ? r.ledger.transactions.filter((t) => t.source === 'culqi').length - culqiTx.length : 0;
      setResult({ ok: true, text: `Culqi devolvió ${r.fetched} cobros; ${r.charges} exitosos dentro de la venta de una fecha. Se importaron ${n} movimientos nuevos (cobros y comisiones). Los que ya estaban no se repiten.` });
      await load();
    } catch (e) { setResult({ ok: false, text: e.message === 'culqi_off' || e.code === 'culqi_off' ? 'Culqi no está configurado.' : `No se pudo importar: ${e.message}` }); flash('No se pudo importar'); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Integraciones" description="De dónde salen los datos, si se actualizan solos o se cargan a mano, y cuándo fue la última vez. Nunca se muestran llaves." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {list.map((i) => (
          <Panel key={i.id} className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-2">
              <span className={cn('size-2 shrink-0 rounded-full', TONE[i.status])} />
              <p className="flex-1 text-[14px] font-medium">{i.name}</p>
              <span className="rounded border px-1.5 text-[10px] text-muted-foreground">{i.kind === 'manual' ? 'Manual' : 'Automática'}</span>
            </div>
            <p className="text-[12px] font-medium">{LABEL[i.status]}</p>
            <p className="text-[12px] text-muted-foreground">{i.detail}</p>
            {(i.lastSync || i.lastEvent || i.lastScan) && (
              <div className="mt-auto space-y-0.5 border-t pt-2 text-[11px] text-muted-foreground">
                {i.lastSync && i.id !== 'tickets' && <p>Última sincronización: {fmtStamp(i.lastSync)} ({ago(i.lastSync)})</p>}
                {i.lastEvent && <p>Último registro: {fmtStamp(i.lastEvent)} ({ago(i.lastEvent)})</p>}
                {i.lastScan && <p>Último escaneo en puerta: {fmtStamp(i.lastScan)}</p>}
              </div>
            )}
          </Panel>
        ))}
      </div>
      <Panel>
        <PanelBar title="Conciliar Culqi con el libro" description="Trae cada cobro exitoso de Culqi (venta online) como transacción de cobro ligada a su fecha, más su comisión. Cada cobro entra una sola vez: si lo vuelves a correr, sólo agrega los nuevos." />
        <div className="flex flex-wrap items-end gap-3 px-4 py-4">
          {processors.length ? (
            <>
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">Cuenta de Culqi en el libro
                <select className={cn(sel, 'w-64')} value={acc} onChange={(e) => setAcc(e.target.value)}>{processors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
              </label>
              <Button onClick={importCulqi} disabled={busy || !acc}><DownloadCloudIcon />{busy ? 'Importando…' : 'Importar cobros de Culqi'}</Button>
            </>
          ) : (
            <div className="text-[13px] text-muted-foreground">Primero crea la cuenta de Culqi en el libro (tipo "Procesador de pagos"). <Button size="sm" variant="outline" className="ml-2" onClick={() => setDrawer({ type: 'account' })}><PlusIcon />Crear cuenta</Button></div>
          )}
          <p className="text-[12px] text-muted-foreground">{culqiTx.length} movimiento(s) de Culqi ya en el libro.</p>
        </div>
        {result && <p className={cn('border-t px-4 py-2.5 text-[13px]', result.ok ? 'text-foreground' : 'text-bad')}>{result.text}</p>}
        <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">Son cobros de montos que ya están en la liquidación de cada fecha (entradas, boxes y mesas): entran a caja, no se suman otra vez al resultado. El POS de barra y Wally no tienen API: se siguen cargando con los reportes.</p>
      </Panel>
    </div>
  );
}

// ======================= Analítica =======================
export function Analytics() {
  const { data, setDrawer } = useOS();
  const scope = useScope();
  const A = data.os.analytics || { rows: [], byBrand: [], byVenue: [], byPeriod: [] };
  const rows = A.rows.filter((r) => scope.inScope(r.brand));
  const avg = (k) => { const xs = rows.map((r) => r[k]).filter((v) => v != null); return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null; };
  const enough = rows.length >= 2;
  const brands = data.finance.brands;
  const cols = [
    { key: 'name', label: 'Fecha', get: (r) => r.date, render: (r) => <span className="flex items-center gap-2"><BrandDot id={r.brand} /><span className="min-w-0"><span className="block max-w-[220px] truncate font-medium">{r.name}</span><span className="block text-[11px] text-muted-foreground">{fmtDay(r.date)} · {r.venue}</span></span></span> },
    { key: 'attendees', label: 'Asistentes', num: true, get: (r) => r.attendees, render: (r) => r.attendees ?? <Unavailable reason="Sin asistencia verificada (no vende por la web)" /> },
    { key: 'revenuePerAttendee', label: 'Ingreso / asistente', num: true, get: (r) => r.revenuePerAttendee, render: (r) => (r.revenuePerAttendee == null ? '—' : money(r.revenuePerAttendee, 2)) },
    { key: 'barPerAttendee', label: 'Barra / asistente', num: true, get: (r) => r.barPerAttendee, render: (r) => (r.barPerAttendee == null ? '—' : money(r.barPerAttendee, 2)) },
    { key: 'costPerAttendee', label: 'Costo / asistente', num: true, get: (r) => r.costPerAttendee, render: (r) => (r.costPerAttendee == null ? '—' : money(r.costPerAttendee, 2)) },
    { key: 'result', label: 'Resultado', num: true, get: (r) => r.result, render: (r) => <span className={r.result >= 0 ? 'text-good' : 'text-bad'}>{money(r.result)}</span> },
    { key: 'margin', label: 'Margen', num: true, get: (r) => r.margin, render: (r) => pct(r.margin) },
    { key: 'cac', label: 'Costo por cliente nuevo', num: true, get: (r) => r.cac, render: (r) => (r.cac == null ? <Unavailable reason={r.marketing == null ? 'Sin gasto de marketing registrado' : 'Sin clientes nuevos medidos'} /> : money(r.cac, 2)) },
    { key: 'repeatShare', label: '% que volvía', num: true, get: (r) => r.repeatShare, render: (r) => pct(r.repeatShare) },
    { key: 'promoterConversion', label: 'Conversión promotores', num: true, get: (r) => r.promoterConversion, render: (r) => pct(r.promoterConversion) },
    { key: 'showRate', label: 'Asistencia con QR', num: true, get: (r) => r.showRate, render: (r) => pct(r.showRate), hidden: true },
    { key: 'velocity', label: 'Venta en la última semana', num: true, get: (r) => (r.velocity ? r.velocity.lastWeekShare : null), render: (r) => (r.velocity ? pct(r.velocity.lastWeekShare) : '—') },
    { key: 'budgetVariance', label: 'Vs. presupuesto', num: true, get: (r) => r.budgetVariance, render: (r) => (r.budgetVariance == null ? <Unavailable reason="No había presupuesto guardado" /> : <span className={r.budgetVariance >= 0 ? 'text-good' : 'text-bad'}>{money(r.budgetVariance)}</span>) },
    { key: 'growth', label: 'Crecimiento vs. anterior', num: true, get: (r) => (r.growth ? r.growth.revenue : null), render: (r) => (r.growth && r.growth.revenue != null ? <span className={r.growth.revenue >= 0 ? 'text-good' : 'text-bad'}>{r.growth.revenue >= 0 ? '+' : ''}{pct(r.growth.revenue)}</span> : '—') },
  ];
  const cmpCols = (label) => [
    { key: 'key', label, get: (x) => x.key, render: (x) => <span className="flex items-center gap-2 font-medium">{brands.some((b) => b.id === x.key) ? <><BrandTile id={x.key} size="xs" />{brands.find((b) => b.id === x.key).name}</> : x.key}</span> },
    { key: 'events', label: 'Fechas', num: true, get: (x) => x.events },
    { key: 'revenue', label: 'Ingresos', num: true, get: (x) => x.revenue, render: (x) => money(x.revenue) },
    { key: 'result', label: 'Resultado', num: true, get: (x) => x.result, render: (x) => <span className={x.result >= 0 ? 'text-good' : 'text-bad'}>{money(x.result)}</span> },
    { key: 'margin', label: 'Margen', num: true, get: (x) => x.margin, render: (x) => pct(x.margin) },
    { key: 'avgResult', label: 'Resultado promedio', num: true, get: (x) => x.avgResult, render: (x) => money(x.avgResult) },
    { key: 'rpa', label: 'Ingreso / asistente', num: true, get: (x) => x.revenuePerAttendee, render: (x) => (x.revenuePerAttendee == null ? '—' : money(x.revenuePerAttendee, 2)) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Analítica" description="Indicadores de las fechas cerradas. Un indicador sin dato dice “no disponible”; los comparativos aparecen cuando hay al menos dos fechas." />
      {rows.length === 0 ? <Panel className="px-5 py-8 text-[13px] text-muted-foreground">{scope.brand ? `${scope.name} todavía no tiene fechas cerradas.` : 'Todavía no hay fechas cerradas.'} La analítica empieza con la primera liquidación.</Panel> : (
        <>
          <div className="kpi-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Ingreso por asistente" value={avg('revenuePerAttendee') == null ? null : money(avg('revenuePerAttendee'), 2)} unavailable={avg('revenuePerAttendee') == null ? 'Sin asistencia verificada' : null} sub={`promedio de ${rows.length} fecha(s)`} />
            <Kpi label="Barra por asistente" value={avg('barPerAttendee') == null ? null : money(avg('barPerAttendee'), 2)} unavailable={avg('barPerAttendee') == null ? 'Sin datos' : null} />
            <Kpi label="Costo por asistente" value={avg('costPerAttendee') == null ? null : money(avg('costPerAttendee'), 2)} unavailable={avg('costPerAttendee') == null ? 'Sin datos' : null} />
            <Kpi label="Resultado por fecha" value={money(avg('result'))} tone={avg('result') >= 0 ? 'good' : 'bad'} sub="promedio" />
            <Kpi label="Costo por cliente nuevo" value={avg('cac') == null ? null : money(avg('cac'), 2)} unavailable={avg('cac') == null ? 'Falta gasto de marketing o clientes nuevos' : null} />
            <Kpi label="Conversión de promotores" value={avg('promoterConversion') == null ? null : pct(avg('promoterConversion'))} unavailable={avg('promoterConversion') == null ? 'Sin datos de promotores' : null} sub="QR → entró" />
          </div>
          <Panel>
            <PanelBar title="Por fecha" description="Clic para abrir la fecha. Usa el botón de columnas para mostrar u ocultar indicadores." action={<KindTag real />} />
            <DataTable id="analytics" rows={rows} columns={cols} initialSort={{ key: 'name', dir: -1 }} onRowClick={(r) => setDrawer({ type: 'event', id: r.id })} csvName="analitica" />
          </Panel>
          {enough ? (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              {!scope.brand && <Panel><PanelBar title="Por marca" /><DataTable id="an-brand" searchable={false} rows={A.byBrand.map((x) => ({ ...x, id: x.key }))} columns={cmpCols('Marca')} /></Panel>}
              <Panel><PanelBar title="Por local" description="Rentabilidad de cada local." /><DataTable id="an-venue" searchable={false} rows={A.byVenue.filter((x) => !scope.brand || rows.some((r) => r.venue === x.key)).map((x) => ({ ...x, id: x.key }))} columns={cmpCols('Local')} /></Panel>
              <Panel className="xl:col-span-2">
                <PanelBar title="Ingreso por asistente y resultado, fecha a fecha" />
                <div className="px-2 pb-2 pt-3">
                  <ChartContainer config={{}} className="aspect-auto h-56 w-full">
                    <BarChart data={rows.map((r) => ({ ...r, label: fmtDay(r.date) }))} margin={{ left: 4, right: 12 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} width={56} />
                      <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Ingreso / asistente', value: money(payload[0].payload.revenuePerAttendee, 2), color: brandColor(payload[0].payload.brand) }, { label: 'Resultado', value: money(payload[0].payload.result) }]} /> : null} />
                      <Bar dataKey="revenuePerAttendee" fill={brandColor(scope.brandId || 'club')} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ChartContainer>
                </div>
              </Panel>
            </div>
          ) : <Panel className="px-5 py-4 text-[13px] text-muted-foreground">Hay {rows.length} fecha cerrada: los comparativos por marca, local, período y el crecimiento aparecen desde la segunda.</Panel>}
        </>
      )}
    </div>
  );
}

// ======================= En vivo =======================
const minutesOfNight = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
const limaNow = () => { const d = new Date(Date.now() - 5 * 3600 * 1000); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

export function Live() {
  const { data, load, updateEvent, com } = useOS();
  const scope = useScope();
  const today = limaISO();
  const candidates = data.finance.events.filter((e) => scope.inScope(e.brand) && e.stage !== 'cancelled').sort((a, b) => a.date.localeCompare(b.date));
  // Por defecto: la fecha de hoy (o de anoche, hasta el mediodía), si no la próxima, si no la última.
  const yesterday = new Date(Date.now() - 29 * 3600 * 1000).toISOString().slice(0, 10);
  const def = candidates.find((e) => e.date === today) || candidates.find((e) => e.date === yesterday) || candidates.find((e) => e.date > today) || candidates[candidates.length - 1];
  const [pick, setPick] = useState('');
  const e = candidates.find((x) => x.id === pick) || def;
  const [auto, setAuto] = useState(true);
  const [stamp, setStamp] = useState(new Date());
  useEffect(() => {
    if (!auto) return undefined;
    const id = setInterval(() => { if (document.visibilityState === 'visible') load().then(() => setStamp(new Date())).catch(() => {}); }, 30000);
    return () => clearInterval(id);
  }, [auto, load]);
  if (!e) return <Panel className="px-5 py-8 text-[13px] text-muted-foreground">No hay fechas para {scope.name}.</Panel>;
  const L = e.liveEventId ? data.live[e.liveEventId] : null;
  const S = data.os.sales[e.id];
  const isToday = e.date === today || e.date === yesterday;
  const cap = e.capacity || null;
  const inside = L ? L.ingresaron : null;
  const staff = ((data.ops.staff || {})[e.id] || []).map((s) => ({ ...s, c: (data.ops.contacts || []).find((x) => x.id === s.contactId) }));
  const ros = (data.ops.runOfShow || {})[e.id] || [];
  const now = minutesOfNight(limaNow());
  const nowIdx = ros.reduce((idx, r, i) => (minutesOfNight(r.time) <= now ? i : idx), -1);
  const inv = ((data.os.byEvent || {})[e.id] || {}).inventory;
  const incidents = (data.incidents.items || []).filter((i) => i.eventId === e.id).sort((a, b) => b.at.localeCompare(a.at));
  const color = brandColor(e.brand);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 xl:max-w-none">
      <div className="flex flex-wrap items-center gap-3">
        <BrandTile id={e.brand} size="md" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{isToday ? <><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-bad opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-bad" /></span>EN VIVO</> : relDays(Math.round((new Date(e.date + 'T00:00:00-05:00') - new Date(today + 'T00:00:00-05:00')) / 86400000))} · {fmtDay(e.date)}</p>
          <h1 className="truncate text-[19px] font-semibold tracking-tight">{e.name}</h1>
        </div>
        <select aria-label="Fecha" className={cn(sel, 'h-9 w-full sm:w-64')} value={e.id} onChange={(x) => setPick(x.target.value)}>{candidates.map((x) => <option key={x.id} value={x.id}>{fmtDay(x.date)} · {x.name}</option>)}</select>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background px-3 py-2 text-[12px] text-muted-foreground">
        <span>Sincronizado {stamp.toLocaleTimeString('es-PE', { timeZone: 'America/Lima' })}</span>
        <label className="flex items-center gap-1.5"><Switch checked={auto} onCheckedChange={setAuto} />Actualizar cada 30 s</label>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => load().then(() => setStamp(new Date())).catch(() => {})}><RefreshCwIcon />Ahora</Button>
        <span className="ml-auto">Puerta y web: en tiempo real · Culqi: cada 10 min · POS y Wally: manual</span>
      </div>

      {!L ? <Panel className="px-5 py-5 text-[13px] text-muted-foreground">Esta fecha no tiene datos de la web de tickets{e.liveEventId ? ' todavía' : ' (no tiene “Fecha en la web de tickets”)'}: la puerta no se ve en vivo aquí.</Panel> : (
        <>
          <div className="kpi-strip grid grid-cols-2 md:grid-cols-4">
            <Kpi label="Adentro" value={inside.toLocaleString('es-PE')} sub={cap ? `${pct((inside / cap) * 100)} del aforo (${cap})` : 'define el aforo abajo'} tone={cap && inside > cap ? 'bad' : undefined} />
            <Kpi label="QRs emitidos" value={L.issued.toLocaleString('es-PE')} sub={`${L.issued - (inside || 0)} por entrar`} />
            <Kpi label="Después de hora" value={String(L.tarde)} sub={`${L.tardeCobrado} pagaron puerta`} />
            <Kpi label="Último escaneo" value={S && S.lastScan ? new Date(S.lastScan).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }) : '—'} sub={S && S.lastScan ? ago(S.lastScan) : 'sin escaneos'} />
          </div>
          {cap && <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (inside / cap) * 100)}%`, background: inside > cap ? 'var(--bad)' : color }} /></div>}
          <Panel>
            <PanelBar title="Ingreso por la puerta" description="Personas que entraron cada 15 minutos." action={<KindTag real />} />
            {L.checkins.length ? (
              <div className="px-2 pb-2 pt-3">
                <ChartContainer config={{}} className="aspect-auto h-44 w-full">
                  <BarChart data={L.checkins} margin={{ left: 4, right: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="t" tickLine={false} axisLine={false} minTickGap={20} tickMargin={6} />
                    <YAxis tickLine={false} axisLine={false} width={32} />
                    <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.t} rows={[{ label: 'Entraron', value: payload[0].payload.n, color }, { label: 'Adentro (acumulado)', value: payload[0].payload.acc }]} /> : null} />
                    <Bar dataKey="n" fill={color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ChartContainer>
              </div>
            ) : <p className="px-4 py-5 text-[13px] text-muted-foreground">Todavía no entra nadie.</p>}
          </Panel>
        </>
      )}

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Panel>
          <PanelBar title="Aforo" description="Capacidad del local para esta fecha." />
          <CapacityForm e={e} onSave={(v) => updateEvent(e.id, { capacity: v }, 'Aforo guardado').catch(() => {})} />
        </Panel>
        <Panel>
          <PanelBar title="Venta" description="Web en tiempo real; Culqi cada 10 min." />
          <div className="grid grid-cols-2 gap-2 p-3">
            <Kpi label="Venta web" value={S ? money(S.webRevenue) : null} unavailable={S ? null : 'Sin venta web'} />
            <Kpi label="Mesas y boxes" value={S ? `${S.tablesSold} de ${S.tablesTotal}` : null} unavailable={S ? null : 'Sin datos'} sub={S ? `${S.tables.filter((t) => t.attended).length} ya llegaron` : ''} />
            <Kpi label="Cobrado en Culqi" value={data.culqi && data.culqi.connected && data.culqi.byEvent[e.id] ? money(data.culqi.byEvent[e.id].amount) : null} unavailable={data.culqi && data.culqi.connected ? null : 'Culqi no conectado'} sub={data.culqi && data.culqi.at ? `al ${new Date(data.culqi.at).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}` : ''} />
            <Kpi label="Barra (POS)" unavailable="Manual: se carga con el reporte del POS" />
          </div>
        </Panel>
        <Panel>
          <PanelBar title="Run of show" description="La línea resaltada es lo que toca ahora (hora de Lima)." />
          <ul className="divide-y">
            {ros.length === 0 && <li className="px-4 py-4 text-[13px] text-muted-foreground">Sin run of show (se arma en la pestaña Producción del evento).</li>}
            {ros.map((r, i) => <li key={i} className={cn('flex gap-3 px-4 py-2 text-[13px]', isToday && i === nowIdx && 'bg-muted font-medium')}><span className="mono w-12 shrink-0">{r.time}</span><span className="flex-1">{r.title}</span><span className="text-muted-foreground">{r.owner}</span></li>)}
          </ul>
        </Panel>
        <Panel>
          <PanelBar title="Staff" description="Asignado en Producción." />
          <ul className="divide-y">
            {staff.length === 0 && <li className="px-4 py-4 text-[13px] text-muted-foreground">Sin staff asignado.</li>}
            {staff.map((s, i) => <li key={i} className="flex items-center gap-3 px-4 py-2 text-[13px]"><span className={cn('size-2 rounded-full', s.confirmed ? 'bg-good' : 'bg-[#C98500]')} /><span className="flex-1">{s.c ? s.c.name : '—'} <span className="text-muted-foreground">· {s.role}</span></span><span className="mono text-muted-foreground">{s.call || ''}</span></li>)}
          </ul>
        </Panel>
        <Panel>
          <PanelBar title="Barra" description="Según el conteo de apertura." />
          {inv && inv.rows.some((r) => r.open != null) ? (
            <Bars items={inv.rows.filter((r) => r.open != null).map((r) => ({ label: r.name, value: r.open, extra: r.unit }))} format={(v) => String(v)} color="#737370" />
          ) : <p className="px-4 py-4 text-[13px] text-muted-foreground">Sin conteo de apertura para esta fecha (Inventario → Conteo del evento).</p>}
        </Panel>
        <IncidentsPanel e={e} incidents={incidents} com={com} />
      </div>
    </div>
  );
}

function CapacityForm({ e, onSave }) {
  const [v, setV] = useState(e.capacity || '');
  useEffect(() => { setV(e.capacity || ''); }, [e.id, e.capacity]);
  return (
    <form className="flex items-end gap-2 p-4" onSubmit={(x) => { x.preventDefault(); onSave(v === '' ? null : Number(v)); }}>
      <label className="flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground">Personas<Input type="number" min="1" className="mono" value={v} onChange={(x) => setV(x.target.value)} placeholder="Ej. 350" /></label>
      <Button type="submit" variant="outline">Guardar</Button>
    </form>
  );
}

function IncidentsPanel({ e, incidents, com }) {
  const { data } = useOS();
  const [text, setText] = useState('');
  const [sev, setSev] = useState('low');
  const [area, setArea] = useState('');
  const S = data.os.enums.severity;
  const add = async (x) => { x.preventDefault(); if (!text.trim()) return; try { await com('incidents', 'inc.upsert', { item: { eventId: e.id, text, severity: sev, area } }, 'Incidente registrado'); setText(''); setArea(''); setSev('low'); } catch { /* */ } };
  return (
    <Panel className="lg:col-span-2">
      <PanelBar title={`Incidentes · ${incidents.filter((i) => !i.resolved).length} abiertos`} description="Regístralos al momento: quedan con hora y se cierran cuando se resuelven." />
      <form onSubmit={add} className="flex flex-wrap gap-2 border-b px-4 py-3">
        <select aria-label="Gravedad" className={cn(sel, 'h-9 w-28')} value={sev} onChange={(x) => setSev(x.target.value)}>{Object.entries(S).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Input className="h-9 w-32" value={area} onChange={(x) => setArea(x.target.value)} placeholder="Área" aria-label="Área" />
        <Input className="h-9 min-w-[200px] flex-1" value={text} onChange={(x) => setText(x.target.value)} placeholder="Qué pasó (ej. se acabó el hielo, pelea en la puerta…)" aria-label="Qué pasó" />
        <Button type="submit" disabled={!text.trim()}><PlusIcon />Registrar</Button>
      </form>
      <ul className="divide-y">
        {incidents.length === 0 && <li className="px-4 py-4 text-[13px] text-muted-foreground">Sin incidentes.</li>}
        {incidents.map((i) => (
          <li key={i.id} className={cn('flex items-start gap-3 px-4 py-2.5 text-[13px]', i.resolved && 'opacity-60')}>
            <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', i.severity === 'high' ? 'bg-bad' : i.severity === 'med' ? 'bg-[#C98500]' : 'bg-muted-foreground/50')} />
            <span className="min-w-0 flex-1"><span className={cn('block', i.resolved && 'line-through')}>{i.text}</span><span className="text-[11px] text-muted-foreground">{new Date(i.at).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}{i.area ? ` · ${i.area}` : ''} · {S[i.severity]}</span></span>
            <Button size="sm" variant="outline" className="h-7" onClick={() => com('incidents', 'inc.upsert', { item: { ...i, resolved: !i.resolved } }, i.resolved ? 'Reabierto' : 'Resuelto').catch(() => {})}>{i.resolved ? 'Reabrir' : <><CheckIcon />Resuelto</>}</Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
