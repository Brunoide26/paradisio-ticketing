import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ExternalLinkIcon, PlusIcon, ShieldCheckIcon, CheckIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, Unavailable, fmtDay, useScope, BrandDot } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel, Bars, BrandTile, TooltipBox, KindTag } from '../ui.jsx';
import { cn, money, pct, brandColor, limaISO } from '../lib.js';

const today = () => limaISO();
const Empty = ({ children, action }) => <div className="flex flex-col items-start gap-2 px-4 py-6 text-[13px] text-muted-foreground">{children}{action}</div>;

// ======================= Marketing y contenido =======================
const CONTENT_ORDER = ['idea', 'brief', 'design', 'review', 'approved', 'published'];

export function Marketing() {
  const { data, setDrawer } = useOS();
  const scope = useScope();
  const [tab, setTab] = useState('content');
  const E = data.os.enums;
  const content = (data.marketing.content || []).filter((c) => !scope.brand || c.brand === scope.brandId);
  const campaigns = (data.os.campaigns || []).filter((c) => !scope.brand || c.brand === scope.brandId);
  const assets = (data.marketing.assets || []).filter((a) => !scope.brand || !a.brand || a.brand === scope.brandId);
  const late = content.filter((c) => c.due && c.due < today() && !['approved', 'published'].includes(c.status));
  const budget = campaigns.reduce((s, c) => s + (c.budget || 0), 0);
  const spent = campaigns.reduce((s, c) => s + c.spent, 0);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Marketing y contenido" description="Pipeline de contenido, campañas con presupuesto y gasto real, y recursos de marca."
        actions={<>
          <Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'asset', preset: { brand: scope.brandId || '' } })}><PlusIcon />Recurso</Button>
          <Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'campaign', preset: { brand: scope.brandId || '' } })}><PlusIcon />Campaña</Button>
          <Button size="sm" onClick={() => setDrawer({ type: 'content', preset: { brand: scope.brandId || '' } })}><PlusIcon />Contenido</Button>
        </>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi label="Piezas en curso" value={String(content.filter((c) => c.status !== 'published').length)} sub={`${content.filter((c) => c.status === 'published').length} publicadas`} />
        <Kpi label="Atrasadas" value={String(late.length)} tone={late.length ? 'bad' : undefined} sub="pasaron su entrega sin aprobarse" />
        <Kpi label="Campañas activas" value={String(campaigns.filter((c) => c.status === 'active').length)} sub={`${campaigns.length} en total`} />
        <Kpi label="Presupuesto de medios" value={campaigns.some((c) => c.budget != null) ? money(budget) : null} unavailable={campaigns.some((c) => c.budget != null) ? null : 'Sin campañas con presupuesto'} />
        <Kpi label="Gastado (real)" value={campaigns.length ? money(spent) : null} unavailable={campaigns.length ? null : 'Sin campañas'} tone={budget && spent > budget ? 'bad' : undefined} sub="transacciones pagadas" />
      </div>
      <Tabs value={tab} onValueChange={setTab}><TabsList className="h-8"><TabsTrigger value="content" className="text-[12px]">Contenido</TabsTrigger><TabsTrigger value="calendar" className="text-[12px]">Calendario</TabsTrigger><TabsTrigger value="campaigns" className="text-[12px]">Campañas</TabsTrigger><TabsTrigger value="assets" className="text-[12px]">Recursos de marca</TabsTrigger></TabsList></Tabs>

      {tab === 'content' && (
        <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {CONTENT_ORDER.map((st) => {
            const items = content.filter((c) => c.status === st).sort((a, b) => (a.publishOn || a.due || '9').localeCompare(b.publishOn || b.due || '9'));
            return (
              <div key={st} className="flex w-[232px] shrink-0 flex-col rounded-lg border bg-background/60">
                <div className="flex items-center justify-between border-b px-2.5 py-2 text-[12px] font-medium">{E.contentStatus[st]}<span className="font-normal text-muted-foreground">{items.length}</span></div>
                <div className="flex min-h-24 flex-col gap-1.5 p-1.5">
                  {items.map((c) => (
                    <button key={c.id} type="button" onClick={() => setDrawer({ type: 'content', id: c.id })} className="rounded-md border bg-card p-2.5 text-left shadow-xs hover:border-ring" style={c.brand ? { boxShadow: `inset 2px 0 0 ${brandColor(c.brand)}` } : undefined}>
                      <p className="line-clamp-2 text-[13px] font-medium leading-snug">{c.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{E.channels[c.channel]}{c.owner ? ` · ${c.owner}` : ''}</p>
                      {(c.publishOn || c.due) && <p className={cn('mt-0.5 text-[11px]', c.due && c.due < today() && !['approved', 'published'].includes(c.status) ? 'font-medium text-bad' : 'text-muted-foreground')}>{c.publishOn ? `publica ${fmtDay(c.publishOn)}` : `entrega ${fmtDay(c.due)}`}</p>}
                    </button>
                  ))}
                  {st === 'idea' && <Button size="sm" variant="ghost" className="justify-start text-muted-foreground" onClick={() => setDrawer({ type: 'content', preset: { brand: scope.brandId || '' } })}><PlusIcon />Idea</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'calendar' && <ContentCalendar content={content} />}

      {tab === 'campaigns' && (
        <Panel>
          <DataTable id="campaigns" rows={campaigns} initialSort={{ key: 'start', dir: -1 }} onRowClick={(c) => setDrawer({ type: 'campaign', id: c.id })}
            empty={<>Sin campañas. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'campaign', preset: { brand: scope.brandId || '' } })}>Crea la primera</button>. El gasto se liga desde Finanzas → Transacciones (campo Campaña).</>}
            columns={[
              { key: 'name', label: 'Campaña', get: (c) => c.name, render: (c) => <span className="flex items-center gap-2">{c.brand && <BrandDot id={c.brand} />}<span className="font-medium">{c.name}</span></span> },
              { key: 'status', label: 'Estado', get: (c) => E.campaignStatus[c.status] },
              { key: 'start', label: 'Fechas', get: (c) => c.start || '', render: (c) => (c.start ? `${fmtDay(c.start)} – ${c.end ? fmtDay(c.end) : '…'}` : '—') },
              { key: 'budget', label: 'Presupuesto', num: true, get: (c) => c.budget, render: (c) => (c.budget == null ? '—' : money(c.budget)) },
              { key: 'spent', label: 'Gastado', num: true, get: (c) => c.spent, render: (c) => <span className={c.over ? 'text-bad' : ''}>{money(c.spent)}{c.committed ? <span className="block text-[11px] text-muted-foreground">+{money(c.committed)} pendiente</span> : null}</span> },
              { key: 'remaining', label: 'Disponible', num: true, get: (c) => c.remaining, render: (c) => (c.remaining == null ? '—' : <span className={c.remaining < 0 ? 'text-bad' : 'text-good'}>{money(c.remaining)}</span>) },
              { key: 'content', label: 'Piezas', num: true, get: (c) => c.contentCount, render: (c) => `${c.published}/${c.contentCount}` },
              { key: 'reg', label: 'Registros en la ventana', num: true, get: (c) => c.registrations, render: (c) => (c.registrations == null ? <Unavailable reason="La fecha no vende por la web de tickets o la campaña no tiene inicio" /> : <span>{c.registrations}{c.costPerRegistration ? <span className="block text-[11px] text-muted-foreground">{money(c.costPerRegistration, 2)} c/u</span> : null}</span>) },
            ]} />
        </Panel>
      )}

      {tab === 'assets' && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {assets.length === 0 && <Panel className="md:col-span-2 xl:col-span-4"><Empty action={<Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'asset', preset: { brand: scope.brandId || '' } })}><PlusIcon />Agregar recurso</Button>}>Sin recursos todavía. Agrega enlaces a logos, flyers, fotos y guías de marca (Drive, Canva, Dropbox).</Empty></Panel>}
          {assets.map((a) => (
            <Panel key={a.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start gap-2">{a.brand ? <BrandTile id={a.brand} size="sm" /> : <span className="flex size-7 items-center justify-center rounded-md bg-muted text-[10px]">PEG</span>}
                <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{a.name}</p><p className="text-[11px] text-muted-foreground">{E.assetTypes[a.type]}{a.tags ? ` · ${a.tags}` : ''}</p></div></div>
              <div className="mt-auto flex gap-1"><Button asChild size="sm" variant="outline"><a href={a.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon />Abrir</a></Button><Button size="sm" variant="ghost" onClick={() => setDrawer({ type: 'asset', id: a.id })}>Editar</Button></div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentCalendar({ content }) {
  const { setDrawer, data } = useOS();
  const t = new Date(limaISO() + 'T12:00:00');
  const [cur, setCur] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const first = new Date(cur.y, cur.m, 1);
  const startDow = (first.getDay() + 6) % 7;
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startDow + days) / 7) * 7 }, (_, i) => i - startDow + 1);
  const iso = (d) => `${cur.y}-${String(cur.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const shift = (n) => setCur(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const events = data.finance.events;
  const month = first.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  return (
    <Panel>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <h3 className="text-[14px] font-medium capitalize">{month}</h3>
        <div className="ml-auto flex gap-1"><Button size="sm" variant="outline" onClick={() => shift(-1)}>Anterior</Button><Button size="sm" variant="outline" onClick={() => shift(1)}>Siguiente</Button></div>
      </div>
      <div className="grid grid-cols-7 border-b text-[11px] text-muted-foreground">{['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const ok = d >= 1 && d <= days;
          const items = ok ? content.filter((c) => (c.publishOn || c.due) === iso(d)) : [];
          const evs = ok ? events.filter((e) => e.date === iso(d)) : [];
          return (
            <div key={i} className={cn('min-h-[88px] border-b border-r p-1 [&:nth-child(7n)]:border-r-0', !ok && 'bg-muted/40')}>
              {ok && <span className="text-[11px] text-muted-foreground">{d}</span>}
              {evs.map((e) => <p key={e.id} className="truncate rounded px-1 text-[10px] font-semibold text-white" style={{ background: brandColor(e.brand) }}>{e.name}</p>)}
              {items.map((c) => <button key={c.id} type="button" onClick={() => setDrawer({ type: 'content', id: c.id })} className={cn('mt-0.5 block w-full truncate rounded border px-1 text-left text-[10px]', c.status === 'published' ? 'bg-muted' : 'border-dashed')}>{data.os.enums.channels[c.channel].split(' · ').pop()}: {c.title}</button>)}
            </div>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">Fechas de evento en color · contenido con borde punteado = pendiente de publicar.</p>
    </Panel>
  );
}

// ======================= Sponsors =======================
const DEAL_ORDER = ['prospect', 'contacted', 'proposal', 'negotiation', 'signed', 'active', 'renewal', 'lost'];

export function Sponsors() {
  const { data, setDrawer, com } = useOS();
  const scope = useScope();
  const E = data.os.enums;
  const deals = (data.os.deals || []).filter((d) => !scope.brand || d.brands.includes(scope.brandId) || !d.brands.length);
  const open = deals.filter((d) => ['prospect', 'contacted', 'proposal', 'negotiation'].includes(d.stage));
  const won = deals.filter((d) => ['signed', 'active', 'renewal'].includes(d.stage));
  const sum = (l, f) => l.reduce((s, x) => s + (f(x) || 0), 0);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Sponsors y alianzas" description="El monto de un acuerdo es proyectado. Lo real es lo cobrado: transacciones con ese sponsor. Lo que aportan en especie va aparte y nunca suma a ingresos."
        actions={<Button size="sm" onClick={() => setDrawer({ type: 'deal', preset: { brands: scope.brandId ? [scope.brandId] : [] } })}><PlusIcon />Sponsor</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Kpi proj label="En negociación" value={money(sum(open, (d) => d.cash))} sub={`${open.length} acuerdo(s)`} />
        <Kpi proj label="Firmado (efectivo)" value={money(sum(won, (d) => d.cash))} sub={`${won.length} acuerdo(s)`} />
        <Kpi label="Cobrado (real)" value={money(sum(deals, (d) => d.collected))} sub="del libro de transacciones" />
        <Kpi label="Por cobrar" value={money(sum(won, (d) => d.pending))} tone={sum(won, (d) => d.pending) ? 'bad' : undefined} />
        <Kpi label="En especie" value={money(sum(won, (d) => d.inKindValue))} sub="valorizado, fuera de ingresos" />
      </div>
      <div className="scroll-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
        {DEAL_ORDER.map((st) => {
          const items = deals.filter((d) => d.stage === st);
          return (
            <div key={st} className={cn('flex w-[232px] shrink-0 flex-col rounded-lg border bg-background/60', st === 'lost' && 'opacity-70')}>
              <div className="flex items-center justify-between border-b px-2.5 py-2 text-[12px] font-medium">{E.dealStages[st]}<span className="font-normal text-muted-foreground">{items.length}</span></div>
              <div className="flex min-h-24 flex-col gap-1.5 p-1.5">
                {items.map((d) => (
                  <button key={d.id} type="button" onClick={() => setDrawer({ type: 'deal', id: d.id })} className="rounded-md border bg-card p-2.5 text-left shadow-xs hover:border-ring">
                    <p className="text-[13px] font-medium">{d.sponsor}</p>
                    <p className="mt-0.5 flex gap-1">{d.brands.map((b) => <BrandDot key={b} id={b} />)}</p>
                    <p className="mono mt-1 text-[12px]">{d.cash != null ? money(d.cash) : 'sin monto'}{d.inKindValue ? <span className="text-muted-foreground"> + {money(d.inKindValue)} especie</span> : ''}</p>
                    {['signed', 'active', 'renewal'].includes(d.stage) && d.cash != null && <p className="text-[11px] text-muted-foreground">cobrado {money(d.collected)}</p>}
                    {d.openDeliverables > 0 && <p className={cn('text-[11px]', d.overdueDeliverables ? 'font-medium text-bad' : 'text-muted-foreground')}>{d.openDeliverables} entregable(s){d.overdueDeliverables ? `, ${d.overdueDeliverables} vencido(s)` : ''}</p>}
                    {d.renewalSoon && <p className="text-[11px] text-[#C98500]">renueva {fmtDay(d.renewalDate)}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Panel>
        <PanelBar title="Entregables pendientes" description="Lo que Paradisio le debe a cada sponsor." />
        <DataTable id="deliverables" searchable={false} empty="Nada pendiente."
          rows={deals.flatMap((d) => d.deliverables.filter((x) => !x.done).map((x) => ({ ...x, id: d.id + x.id, dealId: d.id, dlId: x.id, sponsor: d.sponsor })))}
          initialSort={{ key: 'due', dir: 1 }}
          columns={[
            { key: 'done', label: '', sortable: false, get: () => '', className: 'w-8', render: (x) => <button type="button" aria-label="Marcar hecho" className="flex size-4 items-center justify-center rounded border hover:border-foreground" onClick={() => com('sponsors', 'sp.deliverable.toggle', { dealId: x.dealId, id: x.dlId }, 'Entregable hecho').catch(() => {})}><CheckIcon className="size-3 opacity-0 hover:opacity-50" /></button> },
            { key: 'title', label: 'Entregable', get: (x) => x.title, render: (x) => <span className="font-medium">{x.title}</span> },
            { key: 'sponsor', label: 'Sponsor', get: (x) => x.sponsor },
            { key: 'due', label: 'Vence', get: (x) => x.due || '9999', render: (x) => (x.due ? <span className={cn('mono', x.due < today() && 'font-medium text-bad')}>{fmtDay(x.due)}</span> : '—') },
          ]} />
      </Panel>
    </div>
  );
}

// ======================= Equipo =======================
export function Team() {
  const { data, setDrawer } = useOS();
  const team = (data.ops.contacts || []).filter((c) => c.type === 'team' && !c.archived);
  const tasks = data.os.tasks || [];
  const load = (name) => tasks.filter((t) => t.owner && t.owner.trim().toLowerCase() === name.trim().toLowerCase());
  const unassigned = tasks.filter((t) => !t.owner && t.status !== 'done');
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Equipo" description="Personas del equipo interno, su rol y su carga de tareas. Las tareas se asignan por nombre (Responsable)."
        actions={<Button size="sm" onClick={() => setDrawer({ type: 'contact', preset: { type: 'team' } })}><PlusIcon />Persona del equipo</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Personas" value={String(team.length)} />
        <Kpi label="Tareas abiertas" value={String(tasks.filter((t) => t.status !== 'done').length)} />
        <Kpi label="Sin responsable" value={String(unassigned.length)} tone={unassigned.length ? 'bad' : undefined} sub="asígnalas en Mis tareas" />
        <Kpi label="Vencidas" value={String(tasks.filter((t) => t.overdue).length)} tone={tasks.some((t) => t.overdue) ? 'bad' : undefined} />
      </div>
      <Panel>
        <DataTable id="team" rows={team.map((c) => { const l = load(c.name); return { ...c, open: l.filter((t) => t.status !== 'done').length, overdue: l.filter((t) => t.overdue).length, done: l.filter((t) => t.status === 'done').length }; })}
          onRowClick={(c) => setDrawer({ type: 'contact', id: c.id })} initialSort={{ key: 'name', dir: 1 }}
          empty={<>Sin personas del equipo. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'contact', preset: { type: 'team' } })}>Agrega la primera</button> (tú, producción, diseño, administración…).</>}
          columns={[
            { key: 'name', label: 'Nombre', get: (c) => c.name, render: (c) => <span className="font-medium">{c.name}</span> },
            { key: 'role', label: 'Rol', get: (c) => c.role },
            { key: 'phone', label: 'Celular', get: (c) => c.phone },
            { key: 'email', label: 'Correo', get: (c) => c.email, hidden: true },
            { key: 'open', label: 'Tareas abiertas', num: true, get: (c) => c.open },
            { key: 'overdue', label: 'Vencidas', num: true, get: (c) => c.overdue, render: (c) => <span className={c.overdue ? 'font-medium text-bad' : ''}>{c.overdue}</span> },
            { key: 'done', label: 'Hechas', num: true, get: (c) => c.done },
          ]} />
      </Panel>
    </div>
  );
}

// ======================= Audiencia (CRM) =======================
export function Audience() {
  const { data } = useOS();
  const scope = useScope();
  const A = (data.os.audience || {})[scope.brandId || 'group'];
  if (!A || !A.people) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Audiencia" description="Clientes de la web de tickets, de forma agregada." />
        <Panel className="px-5 py-8 text-[13px] text-muted-foreground">{scope.brand ? `${scope.name} todavía no tiene registros en la web de tickets.` : 'Sin registros todavía.'} Cuando venda por la web, aquí vas a ver su audiencia separada de las otras marcas.</Panel>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Audiencia" description={`Clientes de la web de tickets${scope.brand ? ` en fechas de ${scope.name}` : ''}. Agregado y anónimo: nada de nombres, DNI, correos ni teléfonos sale del servidor.`} />
      <div className="flex gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
        <p><b>Consentimiento de marketing: {A.consent} persona(s).</b> La política de privacidad exige consentimiento expreso para enviar comunicaciones de futuros eventos, pero la web todavía no tiene esa casilla (solo la de términos). Por eso aquí no se exportan contactos. Para poder hacer campañas a esta base, primero hay que agregar la casilla opcional al registro.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Personas" value={A.people.toLocaleString('es-PE')} sub="con correo o DNI" />
        <Kpi label="Vinieron al menos una vez" value={A.attended.toLocaleString('es-PE')} />
        <Kpi label="Volvieron (2+ fechas)" value={A.repeat.toLocaleString('es-PE')} sub={`${pct(A.repeatRate)} de los que vinieron`} />
        <Kpi label="Compradores" value={A.payers.toLocaleString('es-PE')} sub="entrada o mesa pagada" />
        <Kpi label="Gasto web total" value={money(A.spend)} />
        <Kpi label="Gasto por comprador" value={A.avgSpend == null ? null : money(A.avgSpend)} unavailable={A.avgSpend == null ? 'Sin compradores' : null} />
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-7">
          <PanelBar title="Nuevos y recurrentes por fecha" description="Personas que entraron: primera vez vs. ya habían venido antes." action={<KindTag real />} />
          <div className="px-2 pb-2 pt-3">
            <ChartContainer config={{}} className="aspect-auto h-56 w-full">
              <BarChart data={A.byEvent.map((e) => ({ ...e, label: e.name.length > 22 ? e.name.slice(0, 21) + '…' : e.name }))} margin={{ left: 4, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.name} rows={[{ label: 'Primera vez', value: payload[0].payload.new, color: brandColor('club') }, { label: 'Volvieron', value: payload[0].payload.returning, color: '#525252' }, { label: 'Registrados', value: payload[0].payload.registered }]} /> : null} />
                <Bar dataKey="new" stackId="a" fill={brandColor(scope.brandId || 'club')} isAnimationActive={false} />
                <Bar dataKey="returning" stackId="a" fill="#525252" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          </div>
        </Panel>
        <Panel className="xl:col-span-5">
          <PanelBar title="Retención entre fechas" description="De los que vinieron a una fecha, cuántos volvieron a la siguiente." />
          <DataTable id="retention" searchable={false} rows={A.retention.map((r) => ({ ...r, id: r.from + r.to }))} empty="Hace falta más de una fecha."
            columns={[
              { key: 'from', label: 'De', get: (r) => r.fromName },
              { key: 'to', label: 'A', get: (r) => r.toName },
              { key: 'base', label: 'Vinieron', num: true, get: (r) => r.base },
              { key: 'returned', label: 'Volvieron', num: true, get: (r) => r.returned },
              { key: 'rate', label: 'Retención', num: true, get: (r) => r.rate, render: (r) => pct(r.rate) },
            ]} />
        </Panel>
        <Panel className="xl:col-span-4"><PanelBar title="Segmentos" description="Tamaño de cada grupo (sin exportar contactos)." /><Bars items={A.segments.map((s) => ({ label: s.label, value: s.size }))} format={(v) => v.toLocaleString('es-PE')} color="#525252" /></Panel>
        <Panel className="xl:col-span-4"><PanelBar title="Cómo llegaron" description="Canal de su primer registro." /><Bars items={A.acquisition.map((s) => ({ label: s.key, value: s.value }))} format={(v) => v.toLocaleString('es-PE')} color={brandColor(scope.brandId || 'club')} /></Panel>
        <Panel className="xl:col-span-4"><PanelBar title="Edades" description="Personas que entraron." /><Bars items={A.ages.map((s) => ({ label: s.key, value: s.value }))} format={(v) => v.toLocaleString('es-PE')} color="#737370" /></Panel>
        <Panel className="xl:col-span-5"><PanelBar title="Promotores que más clientes trajeron" description="Por primer registro." /><Bars items={A.acquiredByPromoter.map((s) => ({ label: s.key, value: s.value }))} format={(v) => v.toLocaleString('es-PE')} color="#A3A3A0" empty="Sin datos." /></Panel>
        <Panel className="xl:col-span-7">
          <PanelBar title="Clientes más frecuentes" description="Sólo iniciales y rango de edad." />
          <DataTable id="top-customers" searchable={false} pageSize={10} rows={A.top}
            columns={[
              { key: 'initials', label: 'Cliente', get: (p) => p.initials, render: (p) => <span className="mono">{p.initials}</span> },
              { key: 'age', label: 'Edad', get: (p) => p.age },
              { key: 'attended', label: 'Asistencias', num: true, get: (p) => p.attended },
              { key: 'spend', label: 'Gasto web', num: true, get: (p) => p.spend, render: (p) => (p.spend ? money(p.spend) : '—') },
              { key: 'source', label: 'Llegó por', get: (p) => p.source },
            ]} />
        </Panel>
      </div>
    </div>
  );
}

// ======================= Documentos =======================
export function Documents() {
  const { data, setDrawer } = useOS();
  const scope = useScope();
  const E = data.os.enums;
  const t = today();
  const in30 = new Date(Date.now() + 30 * 86400000 - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const events = new Map(data.finance.events.map((e) => [e.id, e]));
  const contacts = new Map((data.ops.contacts || []).map((c) => [c.id, c]));
  const deals = new Map((data.sponsors.deals || []).map((d) => [d.id, d]));
  const rows = (data.documents.documents || []).filter((d) => !scope.brand || !d.brand || d.brand === scope.brandId);
  const linked = (d) => [d.eventId && (events.get(d.eventId) || {}).name, d.contactId && (contacts.get(d.contactId) || {}).name, d.sponsorId && (deals.get(d.sponsorId) || {}).sponsor].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Documentos" description="Contratos, cotizaciones, riders, permisos y facturas como enlaces (Drive, Dropbox…), ligados a su fecha, proveedor o sponsor. Avisa 30 días antes de que venzan."
        actions={<Button size="sm" onClick={() => setDrawer({ type: 'document', preset: { brand: scope.brandId || '' } })}><PlusIcon />Documento</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Documentos" value={String(rows.length)} />
        <Kpi label="Vencidos" value={String(rows.filter((d) => d.expires && d.expires < t).length)} tone={rows.some((d) => d.expires && d.expires < t) ? 'bad' : undefined} />
        <Kpi label="Vencen en 30 días" value={String(rows.filter((d) => d.expires && d.expires >= t && d.expires <= in30).length)} />
        <Kpi label="Contratos" value={String(rows.filter((d) => d.type === 'contract').length)} />
      </div>
      <Panel>
        <DataTable id="documents" rows={rows} initialSort={{ key: 'expires', dir: 1 }} onRowClick={(d) => setDrawer({ type: 'document', id: d.id })}
          empty={<>Sin documentos. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'document', preset: { brand: scope.brandId || '' } })}>Agrega el primero</button> (contrato del local, rider del DJ, licencia…).</>}
          columns={[
            { key: 'title', label: 'Documento', get: (d) => d.title, render: (d) => <span className="flex items-center gap-2">{d.brand && <BrandDot id={d.brand} />}<span className="font-medium">{d.title}</span></span> },
            { key: 'type', label: 'Tipo', get: (d) => E.docTypes4[d.type] },
            { key: 'linked', label: 'Ligado a', get: linked, render: (d) => <span className="block max-w-[260px] truncate text-muted-foreground">{linked(d) || '—'}</span> },
            { key: 'signedOn', label: 'Firmado', get: (d) => d.signedOn || '', render: (d) => (d.signedOn ? fmtDay(d.signedOn) : '—') },
            { key: 'expires', label: 'Vence', get: (d) => d.expires || '9999', render: (d) => (d.expires ? <span className={cn('mono', d.expires < t ? 'font-medium text-bad' : d.expires <= in30 ? 'text-[#C98500]' : '')}>{fmtDay(d.expires)}</span> : '—') },
            { key: 'open', label: '', sortable: false, get: () => '', render: (d) => <Button asChild size="sm" variant="ghost" className="h-7" onClick={(e) => e.stopPropagation()}><a href={d.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon />Abrir</a></Button> },
          ]} />
      </Panel>
    </div>
  );
}
