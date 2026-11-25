import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ReferenceLine } from 'recharts';
import { PlusIcon, SlidersHorizontalIcon } from 'lucide-react';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { useOS, useSummary } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, StageBadge, BrandDot, Unavailable, fmtDay, moneyOrNA, signTone, sel, MONTHS_LONG } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel, KindTag, TooltipBox } from '../ui.jsx';
import { cn, money, pct, short, limaISO, isActual, totals } from '../lib.js';

const TABS = [
  ['/finanzas', 'Resumen', true], ['/finanzas/transacciones', 'Transacciones'], ['/finanzas/cuentas', 'Cuentas'], ['/finanzas/por-pagar', 'Por pagar y cobrar'],
  ['/finanzas/flujo', 'Flujo de caja'], ['/finanzas/presupuestos', 'Presupuestos'], ['/finanzas/simulador', 'Simulador'], ['/finanzas/datos', 'Datos de eventos'],
];

export function FinanceTabs() {
  return (
    <nav className="scroll-thin -mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Secciones de finanzas">
      {TABS.map(([to, label, end]) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('shrink-0 rounded-md px-2.5 py-1.5 text-[13px] transition-colors', isActive ? 'bg-background font-medium text-foreground shadow-xs ring-1 ring-border' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground')}>{label}</NavLink>
      ))}
    </nav>
  );
}

const scopeBrand = (ws) => (ws === 'group' ? null : ws);
const kindLabel = (data, k) => (data.os.enums.txKinds[k] || {}).label || k;
const txPen = (t) => t.amount * (t.currency === 'USD' ? t.fxRate : 1);

// ---------- Resumen: estado de resultados del grupo ----------
export function FinanceOverview() {
  const { data, workspace, setDrawer, withTaxes } = useOS();
  const navigate = useNavigate();
  const { summary: S, ledger: LS, loading } = useSummary({ brand: scopeBrand(workspace) });
  if (!S || !LS) return <><FinanceTabs /><p className="text-[13px] text-muted-foreground">Calculando…</p></>;
  const metric = (id) => () => setDrawer({ type: 'metric', id, summary: S });
  const groupResult = S.actual.result + LS.corporate.income - LS.corporate.expenses;
  const actual = S.events.filter((f) => f.kind === 'actual');
  const budget = S.events.filter((f) => f.kind === 'budget');
  return (
    <div className={cn('flex flex-col gap-4', loading && 'opacity-60')}>
      <PageHeader title="Finanzas" description={`${withTaxes ? 'Con' : 'Sin'} IGV y renta · clic en una cifra para ver de dónde sale.`}
        actions={<Button size="sm" onClick={() => setDrawer({ type: 'tx' })}><PlusIcon />Transacción</Button>} />
      <FinanceTabs />
      <div className="kpi-strip grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Caja disponible" value={moneyOrNA(LS.cash)} unavailable={LS.cash == null ? (LS.accounts.length ? 'Falta el saldo inicial de alguna cuenta' : 'Registra tus cuentas (BCP, caja, Culqi)') : null} sub={LS.accounts.length ? `${LS.accounts.filter((a) => !a.archived).length} cuenta(s)` : 'sin cuentas'} onClick={() => navigate('/finanzas/cuentas')} />
        <Kpi label="Por pagar" value={LS.hasData ? money(LS.payables.total) : null} unavailable={LS.hasData ? null : 'Sin transacciones registradas'} tone={LS.payables.overdue ? 'bad' : undefined} sub={LS.payables.overdue ? `${LS.payables.overdue} vencido(s)` : `${LS.payables.count} pendiente(s)`} onClick={() => navigate('/finanzas/por-pagar')} />
        <Kpi label="Por cobrar" value={LS.hasData ? money(LS.receivables.total) : null} unavailable={LS.hasData ? null : 'Sin transacciones registradas'} sub={`${LS.receivables.count} pendiente(s)`} onClick={() => navigate('/finanzas/por-pagar')} />
        <Kpi label="Anticipos de clientes" value={LS.hasData ? money(LS.deposits.total) : null} unavailable={LS.hasData ? null : 'Sin transacciones registradas'} sub="deuda hasta que ocurra el evento" onClick={() => navigate('/finanzas/por-pagar')} />
        <Kpi label="Resultado de eventos" value={money(S.actual.result)} tone={signTone(S.actual.result)} sub={`${S.actual.count} cerrado(s)`} onClick={metric('result')} />
        <Kpi label="Resultado del grupo" value={money(groupResult)} tone={signTone(groupResult)} sub="eventos + corporativo" onClick={() => document.getElementById('pnl')?.scrollIntoView({ behavior: 'smooth' })} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel id="pnl" className="xl:col-span-5">
          <PanelBar title="Estado de resultados del grupo" description="Real, base devengado." action={<KindTag real />} />
          <Table>
            <TableBody className="[&_td]:py-2 [&_td]:text-[13px]">
              <TableRow><TableCell className="pl-4">Ingresos de eventos</TableCell><TableCell className="mono pr-4 text-end">{money(S.actual.revenue)}</TableCell></TableRow>
              <TableRow><TableCell className="pl-4">Costos de eventos</TableCell><TableCell className="mono pr-4 text-end">−{money(S.actual.costs)}</TableCell></TableRow>
              <TableRow><TableCell className="pl-4 text-muted-foreground">Ajuste de inventario (stock final − inicial)</TableCell><TableCell className="mono pr-4 text-end text-muted-foreground">{money(S.actual.result - (S.actual.revenue - S.actual.costs))}</TableCell></TableRow>
              <TableRow className="font-medium"><TableCell className="pl-4">Resultado de eventos</TableCell><TableCell className={cn('mono pr-4 text-end', S.actual.result >= 0 ? 'text-good' : 'text-bad')}>{money(S.actual.result)}</TableCell></TableRow>
              <TableRow><TableCell className="pl-4">Ingresos corporativos</TableCell><TableCell className="mono pr-4 text-end">{money(LS.corporate.income)}</TableCell></TableRow>
              {LS.corporate.byCategory.map((c) => <TableRow key={c.key}><TableCell className="pl-8 text-muted-foreground">{c.key}</TableCell><TableCell className="mono pr-4 text-end text-muted-foreground">−{money(c.value)}</TableCell></TableRow>)}
              <TableRow><TableCell className="pl-4">Gastos corporativos</TableCell><TableCell className="mono pr-4 text-end">−{money(LS.corporate.expenses)}</TableCell></TableRow>
              <TableRow className="bg-muted/60 font-semibold"><TableCell className="pl-4">Resultado del grupo</TableCell><TableCell className={cn('mono pr-4 text-end', groupResult >= 0 ? 'text-good' : 'text-bad')}>{money(groupResult)}</TableCell></TableRow>
            </TableBody>
          </Table>
          <p className="border-t px-4 py-2.5 text-[12px] text-muted-foreground">Fuera del resultado: inversión en marca {money(S.actual.brandInvestment)} (activo) · aportes de capital {money(LS.capital)} · anticipos {money(LS.deposits.total)}. Los pagos de costos de eventos son movimientos de caja y no se suman otra vez.</p>
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-7">
          <EventPnl title="Eventos · real" rows={actual} kind="real" S={S} />
          <EventPnl title="Eventos · proyectado" rows={budget} kind="proj" S={S} />
        </div>
      </div>
    </div>
  );
}

function EventPnl({ title, rows, kind, S }) {
  const { data, setDrawer } = useOS();
  const proj = kind === 'proj';
  return (
    <Panel proj={proj}>
      <PanelBar title={title} description={proj ? 'Presupuestos. La utilidad sólo suma presupuestos completos.' : 'Eventos en Liquidación o Cerrados.'} action={<KindTag real={!proj} />} />
      <DataTable id={proj ? 'fin-ev-proj' : 'fin-ev-real'} searchable={false} rows={rows} onRowClick={(f) => setDrawer({ type: 'event', id: f.id })} empty={proj ? 'Sin presupuestos.' : 'Sin eventos cerrados.'}
        rowClassName={() => (proj ? 'border-dashed' : '')}
        columns={[
          { key: 'name', label: 'Evento', get: (f) => f.name, render: (f) => <span className="flex items-center gap-2"><BrandDot id={f.brand} /><span className="min-w-0"><span className="block max-w-[260px] truncate font-medium">{f.name}</span><span className="block text-[11px] text-muted-foreground">{fmtDay(f.date)}</span></span></span> },
          { key: 'stage', label: 'Etapa', get: (f) => f.stage, render: (f) => <StageBadge stage={f.stage} stages={data.os.stages} /> },
          { key: 'revenue', label: 'Ingresos', num: true, get: (f) => f.revenue, render: (f) => (f.hasIncome ? money(f.revenue) : <Unavailable />) },
          { key: 'costs', label: 'Costos', num: true, get: (f) => (f.hasCosts ? f.costs : null), render: (f) => (f.hasCosts ? money(f.costs) : <Unavailable />) },
          { key: 'result', label: proj ? 'Utilidad' : 'Resultado', num: true, get: (f) => f.result, render: (f) => (f.result == null ? <span className="text-[12px] text-proj">Incompleto</span> : <span className={f.result >= 0 ? 'text-good' : 'text-bad'}>{money(f.result)}</span>) },
          { key: 'margin', label: 'Margen', num: true, get: (f) => f.margin, render: (f) => <span className="text-muted-foreground">{pct(f.margin)}</span> },
        ]}
        footer={rows.length ? (cols) => (
          <TableRow className="text-[13px]">{cols.map((c, i) => (
            <TableCell key={c.key} className={cn(i === 0 && 'pl-4', i === cols.length - 1 && 'pr-4', c.num && 'mono text-end')}>
              {i === 0 ? 'Total' : c.key === 'revenue' ? money(proj ? S.projected.revenue : S.actual.revenue) : c.key === 'costs' ? money(proj ? S.projected.costs : S.actual.costs) : c.key === 'result' ? (proj ? (moneyOrNA(S.projected.profit) || <Unavailable />) : money(S.actual.result)) : c.key === 'margin' && !proj ? pct(S.actual.margin) : ''}
            </TableCell>))}
          </TableRow>
        ) : null} />
    </Panel>
  );
}

// ---------- Transacciones ----------
export function Transactions() {
  const { data, workspace, setDrawer, deleteTx, deleteTxs } = useOS();
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const accounts = new Map((data.ledger.accounts || []).map((a) => [a.id, a]));
  const events = new Map(data.finance.events.map((e) => [e.id, e]));
  const rows = (data.ledger.transactions || []).filter((t) => (workspace === 'group' || t.brand === workspace)
    && (kind === 'all' || t.kind === kind)
    && (status === 'all' || (status === 'paid' ? !!t.paidOn : status === 'committed' ? t.committed && !t.paidOn : !t.paidOn && !t.committed)));
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Transacciones" description="Movimientos de dinero: cobros, pagos, gastos, aportes, transferencias." actions={<Button size="sm" onClick={() => setDrawer({ type: 'tx' })}><PlusIcon />Nueva transacción</Button>} />
      <FinanceTabs />
      <Panel>
        <DataTable id="tx" rows={rows} initialSort={{ key: 'date', dir: -1 }} onRowClick={(t) => setDrawer({ type: 'tx', id: t.id })} csvName="transacciones"
          rowActions={(t) => [
            { label: 'Editar', onSelect: () => setDrawer({ type: 'tx', id: t.id }) },
            { label: 'Duplicar como nueva', onSelect: () => setDrawer({ type: 'tx', preset: Object.fromEntries(Object.entries(t).filter(([k, v]) => v != null && !['id', 'createdAt', 'updatedAt', 'createdBy', 'paidOn', 'externalRef', 'source'].includes(k))) }) },
            '-',
            { label: 'Eliminar', destructive: true, onSelect: async () => { if (window.confirm(`¿Eliminar "${t.description}"? Queda en el registro de actividad.`)) await deleteTx(t.id).catch(() => {}); } },
          ]}
          bulkActions={[{ label: 'Eliminar', destructive: true, run: async (sel) => { if (!window.confirm(`¿Eliminar ${sel.length} transacción(es)? Quedan en el registro de actividad.`)) return; await deleteTxs(sel.map((t) => t.id)); } }]}
          empty={<>Todavía no hay transacciones. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'tx' })}>Registra la primera</button>, o crea antes tus cuentas.</>}
          toolbar={<>
            <select aria-label="Tipo" className={cn(sel, 'h-8 w-auto text-[13px]')} value={kind} onChange={(e) => setKind(e.target.value)}><option value="all">Todos los tipos</option>{Object.entries(data.os.enums.txKinds).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <select aria-label="Estado" className={cn(sel, 'h-8 w-auto text-[13px]')} value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="paid">Pagado / cobrado</option><option value="pending">Pendiente</option><option value="committed">Comprometido</option></select>
          </>}
          columns={[
            { key: 'date', label: 'Fecha', get: (t) => t.date, render: (t) => <span className="mono">{fmtDay(t.date)}</span> },
            { key: 'description', label: 'Descripción', get: (t) => t.description, render: (t) => <span className="block max-w-[260px] truncate font-medium">{t.description}</span> },
            { key: 'kind', label: 'Tipo', get: (t) => kindLabel(data, t.kind), render: (t) => <span className="text-muted-foreground">{kindLabel(data, t.kind)}</span> },
            { key: 'event', label: 'Evento / marca', get: (t) => (t.eventId ? (events.get(t.eventId) || {}).name : t.brand || 'Grupo'), render: (t) => (t.eventId ? <span className="flex items-center gap-1.5"><BrandDot id={t.brand} /><span className="max-w-[180px] truncate">{(events.get(t.eventId) || {}).name}</span></span> : <span className="text-muted-foreground">{t.brand ? data.finance.brands.find((b) => b.id === t.brand)?.name : 'Grupo'}</span>) },
            { key: 'counterparty', label: 'Proveedor / cliente', get: (t) => t.counterparty, hidden: true },
            { key: 'doc', label: 'Comprobante', get: (t) => [t.docType, t.docNumber].filter(Boolean).join(' '), hidden: true },
            { key: 'account', label: 'Cuenta', facet: true, get: (t) => (accounts.get(t.accountId) || {}).name || '' },
            { key: 'status', label: 'Estado', get: (t) => (t.paidOn ? 'Pagado' : t.committed ? 'Comprometido' : 'Pendiente'), render: (t) => (t.paidOn ? <span className="text-good">{data.os.enums.txKinds[t.kind].dir > 0 ? 'Cobrado' : 'Pagado'} {fmtDay(t.paidOn)}</span> : t.committed ? <span className="text-muted-foreground">Comprometido</span> : <span className={(t.dueDate || t.date) < limaISO() ? 'text-bad' : 'text-[#C98500]'}>Pendiente{t.dueDate ? ` · vence ${fmtDay(t.dueDate)}` : ''}</span>) },
            { key: 'amount', label: 'Monto', num: true, get: (t) => data.os.enums.txKinds[t.kind].dir * txPen(t), render: (t) => { const d = data.os.enums.txKinds[t.kind].dir; return <span className={d > 0 ? 'text-good' : d < 0 ? '' : 'text-muted-foreground'}>{d < 0 ? '−' : d > 0 ? '+' : ''}{money(t.amount, 2, t.currency)}</span>; } },
          ]} />
      </Panel>
    </div>
  );
}

// ---------- Cuentas ----------
export function Accounts() {
  const { data, setDrawer } = useOS();
  const LS = data.os.ledgerSummary;
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Cuentas" description="Bancos, caja, Culqi y billeteras del grupo (son compartidas: no se dividen por marca). El saldo se calcula desde el saldo inicial con las transacciones pagadas." actions={<Button size="sm" onClick={() => setDrawer({ type: 'account' })}><PlusIcon />Nueva cuenta</Button>} />
      <FinanceTabs />
      <div className="kpi-strip grid grid-cols-2 md:grid-cols-4">
        <Kpi label="Caja disponible" value={moneyOrNA(LS.cash)} unavailable={LS.cash == null ? 'Falta saldo inicial o tipo de cambio en alguna cuenta' : null} sub="suma de cuentas activas, en soles" />
      </div>
      <Panel>
        <DataTable id="accounts" rows={LS.accounts} searchable={false} onRowClick={(a) => setDrawer({ type: 'account', id: a.id })} rowClassName={(a) => (a.archived ? 'opacity-50' : '')}
          empty={<>Sin cuentas. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'account' })}>Crea la primera</button> (por ejemplo, BCP Soles con su saldo de hoy).</>}
          columns={[
            { key: 'name', label: 'Cuenta', get: (a) => a.name, render: (a) => <span className="font-medium">{a.name}{a.archived && <span className="ml-1.5 text-[11px] text-muted-foreground">archivada</span>}</span> },
            { key: 'type', label: 'Tipo', get: (a) => data.os.enums.accountTypes[a.type] },
            { key: 'institution', label: 'Institución', get: (a) => a.institution },
            { key: 'opening', label: 'Saldo inicial', num: true, get: (a) => a.openingBalance, render: (a) => (a.openingBalance == null ? <Unavailable reason="Sin saldo inicial" /> : <span className="text-muted-foreground">{money(a.openingBalance, 2, a.currency)} <span className="text-[11px]">al {fmtDay(a.openingDate)}</span></span>) },
            { key: 'balance', label: 'Saldo hoy', num: true, get: (a) => a.balance, render: (a) => (a.balance == null ? <Unavailable reason="Sin saldo inicial" /> : <span className={cn('font-medium', a.balance < 0 && 'text-bad')}>{money(a.balance, 2, a.currency)}</span>) },
          ]} />
      </Panel>
    </div>
  );
}

// ---------- Por pagar / por cobrar ----------
export function Pending() {
  const { data, workspace, setDrawer } = useOS();
  const { ledger: LS } = useSummary({ brand: scopeBrand(workspace) });
  const byId = new Map((data.ledger.transactions || []).map((t) => [t.id, t]));
  const events = new Map(data.finance.events.map((e) => [e.id, e]));
  const today = limaISO();
  if (!LS) return <><FinanceTabs /><p className="text-[13px] text-muted-foreground">Calculando…</p></>;
  const cols = (inflow) => [
    { key: 'due', label: 'Vence', get: (t) => t.dueDate || t.date, render: (t) => <span className={cn('mono', (t.dueDate || t.date) < today && 'text-bad')}>{fmtDay(t.dueDate || t.date)}</span> },
    { key: 'description', label: 'Concepto', get: (t) => t.description, render: (t) => <span className="font-medium">{t.description}</span> },
    { key: 'who', label: inflow ? 'Cliente' : 'Proveedor', get: (t) => t.counterparty },
    { key: 'event', label: 'Evento', get: (t) => (events.get(t.eventId) || {}).name || 'Corporativo' },
    { key: 'amount', label: 'Monto', num: true, get: (t) => txPen(t), render: (t) => money(t.amount, 2, t.currency) },
  ];
  const Block = ({ title, ids, inflow, description, proj }) => (
    <Panel proj={proj}>
      <PanelBar title={`${title} · ${money(ids.reduce((s, id) => s + txPen(byId.get(id)), 0))}`} description={description} />
      <DataTable id={'pend-' + title} rows={ids.map((id) => byId.get(id)).filter(Boolean)} searchable={false} initialSort={{ key: 'due', dir: 1 }} onRowClick={(t) => setDrawer({ type: 'tx', id: t.id })} columns={cols(inflow)} empty="Nada pendiente." />
    </Panel>
  );
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Por pagar y por cobrar" description="Clic en una fila para marcarla como pagada o cobrada." actions={<Button size="sm" onClick={() => setDrawer({ type: 'tx' })}><PlusIcon />Transacción</Button>} />
      <FinanceTabs />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Block title="Por pagar" ids={LS.payables.items} description="Costos y gastos devengados que todavía no se pagan." />
        <Block title="Por cobrar" ids={LS.receivables.items} inflow description="Ventas hechas que todavía no se cobran." />
        <Block title="Comprometido" ids={LS.committed.items} description="Acordado pero todavía no se debe (por ejemplo, contrato firmado del DJ)." proj />
        <Block title="Anticipos de clientes" ids={LS.deposits.items} inflow description="Dinero recibido por eventos que todavía no ocurren: es deuda con el cliente hasta la fecha." />
      </div>
    </div>
  );
}

// ---------- Flujo de caja ----------
export function CashFlow() {
  const { workspace } = useOS();
  const { ledger: LS } = useSummary({ brand: scopeBrand(workspace) });
  if (!LS) return <><FinanceTabs /><p className="text-[13px] text-muted-foreground">Calculando…</p></>;
  const months = LS.cashflow.months.map((m) => ({ ...m, name: `${MONTHS_LONG[Number(m.month.slice(5)) - 1].slice(0, 3)} ${m.month.slice(2, 4)}`, outNeg: -m.outflow }));
  const weeks = LS.cashflow.weeks.map((w) => ({ ...w, name: fmtDay(w.week), outNeg: -w.outflow, projOutNeg: -w.projOutflow }));
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Flujo de caja" description="Lo real sale de transacciones pagadas o cobradas. La proyección suma lo pendiente (sólido) y los presupuestos de eventos (punteado), siempre por separado." />
      <FinanceTabs />
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-6">
          <PanelBar title="Real por mes" description="Entradas y salidas de dinero." action={<KindTag real />} />
          {months.length ? <FlowChart data={months} series={[['inflow', 'Entradas', 'var(--good)'], ['outNeg', 'Salidas', 'var(--bad)']]} /> : <p className="px-4 py-10 text-[13px] text-muted-foreground">Sin transacciones pagadas o cobradas todavía.</p>}
        </Panel>
        <Panel className="xl:col-span-6">
          <PanelBar title="Próximas 8 semanas" description="Pendiente (sólido) y presupuestos de eventos (punteado, aparte)." />
          {weeks.length ? <FlowChart data={weeks} series={[['inflow', 'Por cobrar', 'var(--good)'], ['outNeg', 'Por pagar', 'var(--bad)'], ['projInflow', 'Ingresos proyectados', 'var(--good)', true], ['projOutNeg', 'Costos proyectados', 'var(--bad)', true]]} /> : <p className="px-4 py-10 text-[13px] text-muted-foreground">Nada pendiente ni presupuestado en las próximas 8 semanas.</p>}
        </Panel>
        <Panel className="xl:col-span-12">
          <PanelBar title="Caja hoy" />
          <div className="px-4 py-3 text-[13px]">{LS.cash == null ? <Unavailable reason="Registra tus cuentas con saldo inicial" /> : <span className="mono text-[20px] font-semibold">{money(LS.cash)}</span>}</div>
        </Panel>
      </div>
    </div>
  );
}

function FlowChart({ data, series }) {
  return (
    <div className="px-2 pb-2 pt-3">
      <ChartContainer config={{}} className="aspect-auto h-60 w-full">
        <BarChart data={data} stackOffset="sign" margin={{ left: 4, right: 12 }}>
          <defs>{series.filter((s) => s[3]).map(([k, , c]) => (
            <pattern key={k} id={`h-${k}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill={c} fillOpacity="0.06" /><line x1="0" y1="0" x2="0" y2="6" stroke={c} strokeWidth="1.4" strokeOpacity="0.5" /></pattern>
          ))}</defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={64} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <ChartTooltip cursor={{ fill: 'var(--muted)' }} content={({ active, payload }) => active && payload && payload.length ? (
            <TooltipBox title={payload[0].payload.name} rows={series.map(([k, l, c, d]) => ({ label: l, value: money(Math.abs(payload[0].payload[k] || 0)), color: c, dashed: d }))} />) : null} />
          {series.map(([k, , c, dashed]) => <Bar key={k} dataKey={k} stackId={dashed ? 'p' : 'r'} fill={dashed ? `url(#h-${k})` : c} stroke={dashed ? c : undefined} strokeDasharray={dashed ? '4 3' : undefined} maxBarSize={36} isAnimationActive={false} />)}
        </BarChart>
      </ChartContainer>
      <div className="flex flex-wrap gap-4 px-2 pt-1 text-[12px] text-muted-foreground">{series.map(([k, l, c, d]) => <span key={k} className="flex items-center gap-1.5"><i className={cn('size-2.5 rounded-[3px]', d && 'border border-dashed')} style={d ? { borderColor: c } : { background: c }} />{l}</span>)}</div>
    </div>
  );
}

// ---------- Presupuestos: aprobado, comprometido, real, pagado, pendiente ----------
export function Budgets() {
  const { data, workspace, withTaxes, setDrawer } = useOS();
  const byEvent = data.os.byEvent || {};
  const rows = data.finance.events.filter((e) => (workspace === 'group' || e.brand === workspace) && e.stage !== 'cancelled').map((e) => {
    const real = isActual(e);
    const t = totals(e, withTaxes);
    const approved = real ? (e.budget ? totals({ ...e.budget, stage: 'evaluation' }, withTaxes).cost : null) : ((e.costs || []).length ? t.cost : null);
    const p = (byEvent[e.id] || {}).payments;
    return {
      id: e.id, e, name: e.name, date: e.date, brand: e.brand, stage: e.stage, real,
      approved, committed: p ? p.committed : null, actual: real ? t.cost : null,
      paid: p ? p.paid : null, outstanding: real && p ? Math.round((t.cost - p.paid) * 100) / 100 : null,
      variance: real && approved != null ? Math.round((t.cost - approved) * 100) / 100 : null,
    };
  });
  const na = (v, reason) => (v == null ? <Unavailable reason={reason} /> : money(v));
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Presupuestos" description="Costos de cada evento en sus cinco estados. Ningún estado se suma con otro." />
      <FinanceTabs />
      <Panel>
        <DataTable id="budgets" rows={rows} initialSort={{ key: 'date', dir: -1 }} onRowClick={(r) => setDrawer({ type: 'event', id: r.id })}
          columns={[
            { key: 'name', label: 'Evento', get: (r) => r.name, render: (r) => <span className="flex items-center gap-2"><BrandDot id={r.brand} /><span className="min-w-0"><span className="block max-w-[240px] truncate font-medium">{r.name}</span><span className="block text-[11px] text-muted-foreground">{fmtDay(r.date)}</span></span></span> },
            { key: 'stage', label: 'Etapa', get: (r) => r.stage, render: (r) => <StageBadge stage={r.stage} stages={data.os.stages} /> },
            { key: 'approved', label: 'Aprobado', num: true, get: (r) => r.approved, render: (r) => <span className="text-proj">{na(r.approved, r.real ? 'No se guardó presupuesto antes de cerrar' : 'Sin costos presupuestados')}</span> },
            { key: 'committed', label: 'Comprometido', num: true, get: (r) => r.committed, render: (r) => na(r.committed, 'Sin transacciones del evento') },
            { key: 'actual', label: 'Real', num: true, get: (r) => r.actual, render: (r) => na(r.actual, 'El evento no está liquidado') },
            { key: 'paid', label: 'Pagado', num: true, get: (r) => r.paid, render: (r) => na(r.paid, 'Sin pagos registrados en Transacciones') },
            { key: 'outstanding', label: 'Pendiente', num: true, get: (r) => r.outstanding, render: (r) => (r.outstanding == null ? <Unavailable reason="Requiere costos reales y pagos registrados" /> : <span className={r.outstanding > 0 ? 'text-[#C98500]' : 'text-good'}>{money(r.outstanding)}</span>) },
            { key: 'variance', label: 'Variación', num: true, get: (r) => r.variance, render: (r) => (r.variance == null ? <Unavailable reason="Requiere presupuesto aprobado y costos reales" /> : <span className={r.variance > 0 ? 'text-bad' : 'text-good'}>{r.variance > 0 ? '+' : ''}{money(r.variance)}</span>) },
          ]} />
      </Panel>
      <p className="text-[12px] text-muted-foreground">Aprobado = presupuesto guardado al pasar a Liquidación (o el actual, si el evento no ha ocurrido). Comprometido y pagado salen de Transacciones ligadas al evento. Variación positiva = se gastó más de lo aprobado.</p>
    </div>
  );
}

export function FinanceShell({ children }) {
  return children;
}
