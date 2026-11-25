import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, ReferenceLine, PieChart, Pie } from 'recharts';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { Card, CardHead, Count, Badge, Segmented, BrandTile, TooltipBox } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, fmtDate, daysTo, dayName, monthName, brandColor, byCategory, cn } from './lib.js';

const COST_ORDER = ['Local', 'Talento', 'Personal', 'Barra', 'Promotores', 'Producción', 'Marketing', 'Comisiones', 'Impuestos', 'Otros'];

export default function Group({ finance, withTaxes, go }) {
  const [scope, setScope] = useState('all');
  const brands = finance.brands || [];
  const events = useMemo(() => (finance.events || []).slice().sort((a, b) => a.date.localeCompare(b.date)), [finance]);
  const inScope = events.filter((e) => scope === 'all' || (scope === 'real' ? isActual(e) : !isActual(e)));

  const per = brands.map((b) => {
    const evs = inScope.filter((e) => e.brand === b.id);
    const ts = evs.map((e) => totals(e, withTaxes));
    const allCosts = ts.flatMap((t) => t.costs);
    return {
      ...b, color: brandColor(b.id), events: evs.length,
      income: sum(ts, (t) => t.income), cost: sum(ts, (t) => t.cost), stock: sum(ts, (t) => t.stock),
      result: sum(ts, (t) => t.result), inv: sum(ts, (t) => t.inv), cats: byCategory(allCosts),
    };
  });
  const T = { income: sum(per, (p) => p.income), cost: sum(per, (p) => p.cost), stock: sum(per, (p) => p.stock), result: sum(per, (p) => p.result), inv: sum(per, (p) => p.inv) };
  const margin = T.income ? (T.result / T.income) * 100 : 0;
  const upcoming = events.filter((e) => daysTo(e.date) >= 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Consolidado de Paradisio Club, Paradisio Beats e Icon</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Resumen del grupo</h1>
        </div>
        <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Real + proyectado' }, { value: 'real', label: 'Realizado' }, { value: 'proj', label: 'Proyectado' }]} />
      </div>

      {/* KPIs con la contribución de cada marca */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiSplit label="Ingresos" value={T.income} per={per} k="income" delay={0} />
        <KpiSplit label="Costos" value={T.cost} per={per} k="cost" hint={withTaxes ? 'Con IGV y renta' : 'Sin IGV ni renta'} delay={0.04} />
        <KpiSplit label="Resultado neto" value={T.result} per={per} k="result" tone={T.result >= 0 ? 'good' : 'bad'} hint={T.stock ? `Incluye ${money(T.stock)} de stock` : null} delay={0.08} />
        <Card className="p-5" delay={0.12}>
          <p className="text-xs text-ink-2">Margen neto</p>
          <p className={cn('mt-2 text-[28px] font-medium leading-none', margin >= 0 ? 'text-good' : 'text-bad')}><Count value={margin} format="pct" /></p>
          <p className="mt-3 text-xs text-muted">Inversión en marca aparte: <span className="num text-ink-2">{money(T.inv)}</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-ink transition-[width] duration-1000" style={{ width: Math.max(0, Math.min(100, margin)) + '%' }} /></div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Card delay={0.1}>
          <CardHead title="Ingresos por fecha" hint="Color de cada marca · tono claro = presupuesto" right={<Legend items={per.map((p) => ({ label: p.name, color: p.color }))} />} />
          <div className="h-[290px] px-2 pb-3 pt-4"><IncomeByDate events={inScope} brands={brands} withTaxes={withTaxes} /></div>
        </Card>
        <Card delay={0.14}>
          <CardHead title="Resultado neto por marca" hint="Ingresos − costos + stock" />
          <div className="divide-y divide-line-soft">
            {per.map((p) => {
              const max = Math.max(...per.map((x) => Math.abs(x.result)), 1);
              return (
                <button key={p.id} onClick={() => go(p.id)} className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#FAF9F7]">
                  <BrandTile id={p.id} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className={cn('num text-sm', p.result >= 0 ? 'text-good' : 'text-bad')}>{money(p.result)}</span>
                    </div>
                    <div className="relative mt-2 h-1.5 rounded-full bg-line-soft">
                      <div className="absolute inset-y-0 left-1/2 w-px bg-cost" />
                      <div className="absolute inset-y-0 rounded-full transition-all duration-1000" style={{ background: p.color, width: (Math.abs(p.result) / max) * 50 + '%', left: p.result >= 0 ? '50%' : 50 - (Math.abs(p.result) / max) * 50 + '%' }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">{p.events} fecha{p.events === 1 ? '' : 's'} · ingresos <span className="num">{short(p.income)}</span> · costos <span className="num">{short(p.cost)}</span></p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.35fr_1fr]">
        <Card delay={0.16}>
          <CardHead title="Estado de resultados consolidado" hint="Por marca y total del grupo" />
          <ConsolidatedPL per={per} T={T} />
        </Card>
        <div className="grid gap-3">
          <Card delay={0.18}>
            <CardHead title="Resultado acumulado" hint="Fecha a fecha · real hasta hoy, luego proyectado" />
            <div className="h-[200px] px-2 pb-3 pt-3"><Cumulative events={inScope} withTaxes={withTaxes} /></div>
          </Card>
          <Card delay={0.2}>
            <CardHead title="Peso de cada marca" hint="Participación en los ingresos" />
            <Mix per={per} total={T.income} />
          </Card>
        </div>
      </div>

      <Card delay={0.22}>
        <CardHead title="Agenda del grupo" hint={`${upcoming.length} fecha${upcoming.length === 1 ? '' : 's'} por venir`} right={<CalendarDays className="h-4 w-4 text-muted" />} />
        <div className="grid divide-y divide-line-soft md:grid-cols-3 md:divide-x md:divide-y-0">
          {upcoming.length === 0 && <p className="px-5 py-6 text-sm text-muted">No hay fechas próximas cargadas.</p>}
          {upcoming.map((e) => {
            const t = totals(e, withTaxes); const n = daysTo(e.date); const noCosts = !(e.costs || []).length;
            const bName = (brands.find((b) => b.id === e.brand) || {}).name;
            return (
              <button key={e.id} onClick={() => go(e.brand, e.id)} className="flex items-start gap-4 px-5 py-4 text-left hover:bg-[#FAF9F7]">
                <div className="w-12 shrink-0 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted">{dayName(e.date)}</p>
                  <p className="num text-2xl font-medium leading-tight">{e.date.slice(8)}</p>
                  <p className="text-[10px] uppercase tracking-widest" style={{ color: brandColor(e.brand) }}>{monthName(e.date)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><BrandTile id={e.brand} size="sm" /><Badge tone={e.status}>{e.status}</Badge></div>
                  <p className="mt-2 truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted">{bName} · {e.venue || 'Por confirmar'} · {n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`}</p>
                  <p className="mt-2 text-xs text-ink-2">{noCosts ? (t.income ? <>Ingreso <span className="num">{money(t.income)}</span> · sin costos aún</> : 'Números por definir') : <>Resultado proyectado <span className={cn('num', t.result >= 0 ? 'text-good' : 'text-bad')}>{money(t.result)}</span></>}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function KpiSplit({ label, value, per, k, hint, tone, delay }) {
  const tot = sum(per, (p) => Math.abs(p[k]));
  return (
    <Card className="p-5" delay={delay}>
      <p className="text-xs text-ink-2">{label}</p>
      <p className={cn('mt-2 text-[28px] font-medium leading-none', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}><Count value={value} /></p>
      <p className="mt-3 min-h-4 text-xs text-muted">{hint || ' '}</p>
      <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line-soft">
        {per.map((p) => (tot ? <div key={p.id} title={`${p.name}: ${money(p[k])}`} className="h-full transition-all duration-1000" style={{ width: (Math.abs(p[k]) / tot) * 100 + '%', background: p.color }} /> : null))}
      </div>
    </Card>
  );
}

function Legend({ items }) {
  return <div className="flex flex-wrap gap-3 text-[11px] text-ink-2">{items.map((i) => <span key={i.label} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px]" style={{ background: i.color }} />{i.label}</span>)}</div>;
}

function IncomeByDate({ events, brands, withTaxes }) {
  const data = events.map((e) => {
    const t = totals(e, withTaxes);
    return { name: fmtShort(e.date), ev: e, cost: t.cost, result: t.result, income: t.income };
  });
  return (
    <ResponsiveContainer>
      <BarChart data={data} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke="#EFEDE9" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={56} />
        <Tooltip cursor={{ fill: 'rgba(20,20,19,.04)' }} content={({ active, payload }) => {
          if (!active || !payload || !payload.length) return null;
          const r = payload[0].payload;
          return <TooltipBox title={`${r.ev.name} · ${r.ev.status}`} rows={[{ label: 'Ingresos', value: money(r.income), color: brandColor(r.ev.brand) }, { label: 'Costos', value: money(r.cost), color: '#C9C5BD' }]} foot={`Resultado ${money(r.result)}`} />;
        }} />
        <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={56} animationDuration={1100}>
          {data.map((d, j) => <Cell key={j} fill={brandColor(d.ev.brand)} fillOpacity={d.ev.status === 'realizado' ? 1 : 0.5} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Cumulative({ events, withTaxes }) {
  let acc = 0;
  const data = events.map((e) => { acc += totals(e, withTaxes).result; return { name: fmtShort(e.date), v: acc, ev: e }; });
  return (
    <ResponsiveContainer>
      <AreaChart data={data} margin={{ left: 0, right: 10 }}>
        <defs>
          <linearGradient id="cum" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#141413" stopOpacity={0.14} /><stop offset="100%" stopColor="#141413" stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#EFEDE9" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={56} />
        <ReferenceLine y={0} stroke="#C9C5BD" />
        <Tooltip content={({ active, payload }) => active && payload && payload.length ? <TooltipBox title={payload[0].payload.ev.name} rows={[{ label: 'Acumulado', value: money(payload[0].value) }, { label: 'Esta fecha', value: money(totals(payload[0].payload.ev, withTaxes).result) }]} /> : null} />
        <Area type="monotone" dataKey="v" stroke="#141413" strokeWidth={2} fill="url(#cum)" animationDuration={1300}
          dot={(p) => <circle key={p.index} cx={p.cx} cy={p.cy} r={4.5} fill={brandColor(p.payload.ev.brand)} stroke="#fff" strokeWidth={2} />} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Mix({ per, total }) {
  const data = per.filter((p) => p.income > 0).map((p) => ({ name: p.name, value: p.income, color: p.color }));
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="relative h-[130px] w-[130px] shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data.length ? data : [{ name: '—', value: 1, color: '#EFEDE9' }]} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} stroke="none" animationDuration={1200}>
              {(data.length ? data : [{ color: '#EFEDE9' }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] uppercase tracking-widest text-muted">Total</span><span className="num text-sm font-medium">{short(total)}</span></div>
      </div>
      <div className="flex-1 space-y-2.5">
        {per.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-[3px]" style={{ background: p.color }} />{p.name}</span>
            <span className="num text-ink-2">{total ? pct((p.income / total) * 100) : '0%'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConsolidatedPL({ per, T }) {
  const catNames = COST_ORDER.filter((c) => per.some((p) => p.cats.some((x) => x.name === c)))
    .concat([...new Set(per.flatMap((p) => p.cats.map((x) => x.name)))].filter((c) => !COST_ORDER.includes(c)));
  const val = (p, c) => (p.cats.find((x) => x.name === c) || { value: 0 }).value;
  const Row = ({ label, vals, total, strong, tone, sub }) => (
    <tr className={cn('border-b border-line-soft', strong && 'bg-[#FAF9F7] font-medium')}>
      <td className={cn('py-2 pl-5 pr-3 text-left', sub && 'pl-8 text-ink-2')}>{label}</td>
      {vals.map((v, i) => <td key={i} className={cn('num px-3 py-2 text-right', v === 0 && 'text-cost', tone && v !== 0 && (v >= 0 ? 'text-good' : 'text-bad'))}>{v === 0 ? '—' : money(v)}</td>)}
      <td className={cn('num py-2 pl-3 pr-5 text-right font-medium', tone && (total >= 0 ? 'text-good' : 'text-bad'))}>{money(total)}</td>
    </tr>
  );
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wider text-muted">
            <th className="py-2.5 pl-5 pr-3 text-left font-medium">Concepto</th>
            {per.map((p) => <th key={p.id} className="px-3 py-2.5 text-right font-medium"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} />{p.name.replace('Paradisio ', '')}</span></th>)}
            <th className="py-2.5 pl-3 pr-5 text-right font-medium">Grupo</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Ingresos" vals={per.map((p) => p.income)} total={T.income} strong />
          {catNames.map((c) => <Row key={c} sub label={c} vals={per.map((p) => -val(p, c))} total={-sum(per, (p) => val(p, c))} />)}
          <Row label="Costos" vals={per.map((p) => -p.cost)} total={-T.cost} strong />
          {T.stock !== 0 && <Row sub label="+ Stock que quedó" vals={per.map((p) => p.stock)} total={T.stock} />}
          <Row label="Resultado neto" vals={per.map((p) => p.result)} total={T.result} strong tone />
          <Row sub label="Inversión en marca (aparte)" vals={per.map((p) => -p.inv)} total={-T.inv} />
        </tbody>
      </table>
    </div>
  );
}
