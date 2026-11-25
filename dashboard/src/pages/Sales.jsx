import React, { useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, Unavailable, fmtDay, sel, BrandDot } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel, TooltipBox, KindTag } from '../ui.jsx';
import { cn, money, pct, brandColor, short } from '../lib.js';

// Eventos que tienen datos en la ticketera.
export function useSalesEvents() {
  const { data, workspace } = useOS();
  return data.finance.events
    .filter((e) => data.os.sales && data.os.sales[e.id] && (workspace === 'group' || e.brand === workspace))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export default function Sales() {
  const { data } = useOS();
  const events = useSalesEvents();
  const [id, setId] = useState(events[0]?.id || '');
  const e = data.finance.events.find((x) => x.id === id);
  const S = data.os.sales[id];
  const noTicketing = data.finance.events.filter((x) => !data.os.sales[x.id]);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Ventas y reservas" description="Leído de la web de tickets: entradas, listas, invitaciones, mesas y puerta. Sin datos personales."
        actions={events.length > 0 && <select aria-label="Evento" className={cn(sel, 'h-8 w-72 text-[13px]')} value={id} onChange={(x) => setId(x.target.value)}>{events.map((x) => <option key={x.id} value={x.id}>{fmtDay(x.date)} · {x.name}</option>)}</select>} />
      {!S ? (
        <Panel className="px-5 py-8 text-[13px] text-muted-foreground">
          Ningún evento de este espacio tiene ventas en la web de tickets. Para enlazar uno, en el evento completa "Fecha en la web de tickets" (Datos de eventos).
        </Panel>
      ) : <SalesView e={e} S={S} />}
      {noTicketing.length > 0 && <p className="text-[12px] text-muted-foreground">Sin datos de la web de tickets: {noTicketing.map((x) => x.name).join(' · ')}. Beats e Icon todavía no venden por la web.</p>}
    </div>
  );
}

export function SalesView({ e, S }) {
  const color = brandColor(e.brand);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Registros" value={S.registrations.toLocaleString('es-PE')} sub={`${S.voided} anulados · ${S.pending} sin QR`} />
        <Kpi label="QRs emitidos" value={S.issued.toLocaleString('es-PE')} sub="pueden entrar" />
        <Kpi label="Entraron" value={S.attended.toLocaleString('es-PE')} sub={`${S.attendedPersons.toLocaleString('es-PE')} personas con mesas`} />
        <Kpi label="Asistencia" value={pct(S.showRate)} unavailable={S.showRate == null ? 'Sin QRs emitidos' : null} tone={S.showRate != null && S.showRate < 50 ? 'bad' : undefined} sub={`${S.noShow} con QR no vinieron`} />
        <Kpi label="Venta web" value={money(S.webRevenue)} sub="entradas pagadas + mesas" />
        <Kpi label="Mesas y boxes" value={`${S.tablesSold} de ${S.tablesTotal}`} sub="vendidos por la web" />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-5">
          <PanelBar title="Plano de mesas y boxes" description="Vendido por la web en esta fecha." action={<KindTag real />} />
          <TableMap S={S} />
        </Panel>
        <Panel className="xl:col-span-7">
          <PanelBar title="Velocidad de venta" description="Registros acumulados por día (hora de Lima)." />
          {S.velocity.length ? (
            <div className="px-2 pb-2 pt-3">
              <ChartContainer config={{}} className="aspect-auto h-56 w-full">
                <AreaChart data={S.velocity.map((v) => ({ ...v, name: fmtDay(v.d) }))} margin={{ left: 4, right: 12 }}>
                  <defs><linearGradient id="vel" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={24} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={40} />
                  <ChartTooltip content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Registros del día', value: payload[0].payload.registrations, color }, { label: 'Acumulado', value: payload[0].payload.accRegistrations }, { label: 'Venta web del día', value: money(payload[0].payload.revenue) }]} /> : null} />
                  <Area type="linear" dataKey="accRegistrations" stroke={color} strokeWidth={2} fill="url(#vel)" isAnimationActive={false} />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : <p className="px-4 py-8 text-[13px] text-muted-foreground">Sin registros.</p>}
        </Panel>

        <Panel className="xl:col-span-7">
          <PanelBar title="Por canal" description="Cuántos se registraron, cuántos recibieron QR y cuántos entraron." />
          <DataTable id="sales-channels" searchable={false} rows={S.byType.map((x) => ({ ...x, id: x.type }))}
            columns={[
              { key: 'label', label: 'Canal', get: (x) => x.label, render: (x) => <span className="font-medium">{x.label}</span> },
              { key: 'tickets', label: 'Registros', num: true, get: (x) => x.tickets },
              { key: 'issued', label: 'Con QR', num: true, get: (x) => x.issued },
              { key: 'attended', label: 'Entraron', num: true, get: (x) => x.attended },
              { key: 'conv', label: 'Asistencia', num: true, get: (x) => (x.issued ? (x.attended / x.issued) * 100 : null), render: (x) => pct(x.issued ? (x.attended / x.issued) * 100 : null) },
              { key: 'revenue', label: 'Ingresos', num: true, get: (x) => x.revenue, render: (x) => (x.revenue ? money(x.revenue) : '—') },
            ]} />
          <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">Puerta: {S.late} entraron después de hora, {S.lateCharged} pagaron. Estimado {money(S.doorRevenueEstimate)} a {money(S.doorPrice)} c/u (el monto real de puerta se carga en la liquidación).</p>
        </Panel>
        <Panel className="xl:col-span-5">
          <PanelBar title="Fases y precios" description="Entradas pagadas por tipo y mesas por categoría." />
          <DataTable id="sales-sku" searchable={false} empty="Sin entradas pagadas en esta fecha."
            rows={[...S.bySku.map((x) => ({ id: x.sku, label: x.label, price: x.price, sold: x.tickets, cap: null, revenue: x.revenue })), ...S.tableTypes.filter((t) => t.units).map((t) => ({ id: t.type, label: t.name, price: t.price, sold: t.sold, cap: t.units, revenue: t.revenue }))]}
            columns={[
              { key: 'label', label: 'Tipo', get: (x) => x.label, render: (x) => <span className="font-medium">{x.label}</span> },
              { key: 'price', label: 'Precio', num: true, get: (x) => x.price, render: (x) => (x.price == null ? '—' : money(x.price)) },
              { key: 'sold', label: 'Vendidas', num: true, get: (x) => x.sold, render: (x) => (x.cap ? `${x.sold} / ${x.cap}` : x.sold) },
              { key: 'revenue', label: 'Ingresos', num: true, get: (x) => x.revenue, render: (x) => money(x.revenue) },
            ]} />
          {S.offMapTables > 0 && <p className="border-t px-4 py-2 text-[12px] text-[#C98500]">{S.offMapTables} mesa(s) vendidas no están en el plano actual.</p>}
        </Panel>
      </div>
    </div>
  );
}

// Plano: posiciones del catálogo de la web (porcentajes del local).
function TableMap({ S }) {
  return (
    <div className="p-4">
      <div className="relative w-full overflow-hidden rounded-md border bg-muted/40" style={{ aspectRatio: '1 / 0.82' }}>
        <div className="absolute left-1/2 top-[3%] -translate-x-1/2 rounded bg-foreground/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">DJ</div>
        {S.tables.map((u) => (
          <div key={u.id} title={`${u.label} · ${u.typeName}${u.status === 'sold' ? ` · vendida ${money(u.amount)}${u.promoterCode ? ` · ${u.promoterCode}` : ''}` : ' · libre'}`}
            className={cn('absolute flex flex-col items-center justify-center rounded-[4px] border text-center text-[10px] leading-tight', u.status === 'sold' ? 'font-semibold text-white' : 'border-dashed bg-background/70 text-muted-foreground')}
            style={{ left: `${u.x}%`, top: `${u.y}%`, width: `${u.w}%`, height: `${u.h}%`, ...(u.status === 'sold' ? { background: u.color || '#525252', borderColor: u.color || '#525252' } : { borderColor: u.color || undefined }) }}>
            <span>{u.w < 8 ? u.id.replace(/^BOX/, 'B') : u.label}</span>
            {u.status === 'sold' && u.w > 6 && <span className="font-normal opacity-90">{short(u.amount)}</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {S.tableTypes.filter((t) => t.units).map((t) => { const c = (S.tables.find((u) => u.type === t.type) || {}).color; return <span key={t.type} className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: c }} />{t.name} · {t.sold}/{t.units}</span>; })}
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-[3px] border border-dashed" />libre</span>
      </div>
    </div>
  );
}
