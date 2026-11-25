import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardHeader, Money, DeltaPill, KindTag, StatusBadge, ShareBarList, DataTable, MetricStrip, BrandTile, TooltipBox } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, daysTo, brandColor, byCategory, cn } from './lib.js';

export default function Group({ finance, withTaxes, go, culqi, live }) {
  const brands = finance.brands || [];
  const events = useMemo(() => (finance.events || []).slice().sort((a, b) => a.date.localeCompare(b.date)), [finance]);
  const real = events.filter(isActual);
  const proj = events.filter((e) => !isActual(e));
  const T = (list) => {
    const ts = list.map((e) => totals(e, withTaxes));
    const o = { income: sum(ts, (t) => t.income), cost: sum(ts, (t) => t.cost), stock: sum(ts, (t) => t.stock), inv: sum(ts, (t) => t.inv), result: sum(ts, (t) => t.result), costs: ts.flatMap((t) => t.costs) };
    o.margin = o.income ? (o.result / o.income) * 100 : null;
    o.coverage = o.cost ? ((o.income + o.stock) / o.cost) * 100 : null;
    return o;
  };
  const R = T(real), P = T(proj);
  const brandName = (id) => (brands.find((b) => b.id === id) || {}).name || id;

  const realByBrand = brands.map((b) => ({ b, n: real.filter((e) => e.brand === b.id).length, ...T(real.filter((e) => e.brand === b.id)) }));
  const incomeBySource = (() => {
    const m = new Map();
    real.forEach((e) => (e.income || []).forEach((l) => { const k = l.category || l.label; m.set(k, (m.get(k) || 0) + (Number(l.amount) || 0)); }));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();

  return (
    <div className="space-y-4">
      {/* Fila 1: lo real */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card delay={0}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4">
            <div>
              <div className="flex items-center gap-2"><KindTag real /><span className="text-[13px] text-muted">{real.length} fecha{real.length === 1 ? '' : 's'} cerrada{real.length === 1 ? '' : 's'}</span></div>
              <p className="mt-2 text-[32px] font-medium leading-none tracking-tight"><Money value={R.income} /></p>
              <p className="mt-1.5 text-[13px] text-muted">Ingresos reales del grupo. Solo fechas que ya pasaron.</p>
            </div>
            <DeltaPill value={R.result} format="money" good={R.result >= 0} label={R.result >= 0 ? ' de utilidad' : ' de pérdida'} />
          </div>
          <div className="h-[250px] px-2 pb-2 pt-4"><IncomeChart events={events} withTaxes={withTaxes} brandName={brandName} /></div>
          <div className="flex flex-wrap gap-4 border-t border-line px-4 py-2.5 text-[12px] text-ink-2">
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-ink" />Real (color de la marca)</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-ink-2" />Presupuesto (no se suma)</span>
          </div>
        </Card>
        <Card delay={0.05}>
          <div className="flex items-start justify-between gap-2 px-4 pt-4">
            <div>
              <p className={cn('text-[32px] font-medium leading-none tracking-tight', R.result >= 0 ? 'text-good' : 'text-bad')}><Money value={R.result} /></p>
              <p className="mt-1.5 text-[13px] text-muted">Resultado real {R.stock ? `· incluye ${money(R.stock)} de stock` : ''}</p>
            </div>
            {R.margin != null && <DeltaPill value={R.margin} good={R.margin >= 0} label=" margen" />}
          </div>
          <div className="mt-3 border-t border-line">
            <ShareBarList items={realByBrand.map(({ b, n, result }) => ({ label: b.name, value: result, color: brandColor(b.id), extra: n ? null : 'sin fechas cerradas' }))} format={(v) => money(v)} />
          </div>
        </Card>
      </div>

      {/* Fila 2: tablas real vs lo que viene */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card delay={0.08}>
          <CardHeader title="Real por marca" description={withTaxes ? 'Fechas cerradas, con IGV y renta.' : 'Fechas cerradas, sin IGV ni renta.'} action={<KindTag real />} />
          <DataTable
            columns={[
              { key: 'm', label: 'Marca', render: (r) => (r.total ? <span className="font-medium">Total grupo</span> : <button onClick={() => go(r.b.id)} className="flex items-center gap-2 font-medium hover:underline"><BrandTile id={r.b.id} size="xs" />{r.b.name}</button>) },
              { key: 'n', label: 'Fechas', align: 'right', mono: true, render: (r) => r.n },
              { key: 'i', label: 'Ingresos', align: 'right', mono: true, render: (r) => (r.n ? money(r.income) : '—') },
              { key: 'r', label: 'Resultado', align: 'right', mono: true, render: (r) => (r.n ? <span className={r.result >= 0 ? 'text-good' : 'text-bad'}>{money(r.result)}</span> : '—') },
            ]}
            rows={[...realByBrand, { total: true, n: real.length, income: R.income, result: R.result, _strong: true }]}
          />
        </Card>
        <Card delay={0.1} dashed>
          <CardHeader title="Lo que viene" description="Presupuestos de las próximas fechas. No se suman a lo real." action={<KindTag />} />
          <DataTable
            columns={[
              { key: 'd', label: 'Fecha', render: (e) => <button onClick={() => go(e.brand, e.id)} className="flex items-center gap-2 hover:underline"><BrandTile id={e.brand} size="xs" /><span className="mono">{fmtShort(e.date)}</span></button> },
              { key: 'm', label: 'Marca', render: (e) => <span className="text-ink-2">{brandName(e.brand)}</span> },
              { key: 's', label: 'Estado', render: (e) => <StatusBadge status={e.status} /> },
              { key: 'r', label: 'Utilidad proy.', align: 'right', mono: true, render: (e) => { const t = totals(e, withTaxes); return !(e.costs || []).length ? <span className="text-muted">{t.income ? `${money(t.income)} ingreso` : 'por definir'}</span> : <span className={t.result >= 0 ? 'text-good' : 'text-bad'}>{money(t.result)}</span>; } },
            ]}
            rows={proj}
            empty="No hay fechas por venir."
          />
          <div className="flex items-center justify-between border-t border-dashed border-[#D6D6D2] px-4 py-2.5 text-[13px]">
            <span className="text-muted">Utilidad proyectada si se cumplen</span>
            <span className={cn('mono font-medium', P.result >= 0 ? 'text-good' : 'text-bad')}>{money(P.result)}</span>
          </div>
        </Card>
      </div>

      {/* Fila 3: composición */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card delay={0.12}>
          <CardHeader title="Ingresos reales" description="Por fuente." />
          <ShareBarList items={incomeBySource} color="#525252" />
        </Card>
        <Card delay={0.14}>
          <CardHeader title="Costos reales" description="Por categoría." />
          <ShareBarList items={byCategory(R.costs).slice(0, 6).map((c) => ({ label: c.name, value: c.value, title: c.items.map((x) => `${x.label}: ${money(x.amount)}`).join('\n') }))} color="#A3A3A0" />
        </Card>
        <Card delay={0.16}>
          <CardHeader title="Peso por marca" description="Ingresos reales." />
          <ShareBarList items={realByBrand.map(({ b, income }) => ({ label: b.name, value: income, color: brandColor(b.id), extra: R.income ? pct((income / R.income) * 100) : '' }))} />
        </Card>
        <Card delay={0.18} dashed>
          <CardHeader title="Próximas fechas" description="Utilidad proyectada." action={<KindTag />} />
          <ShareBarList items={proj.map((e) => ({ label: `${fmtShort(e.date)} · ${brandName(e.brand).replace('Paradisio ', '')}`, value: (e.costs || []).length ? totals(e, withTaxes).result : totals(e, withTaxes).income, color: brandColor(e.brand), extra: daysTo(e.date) >= 0 ? `en ${daysTo(e.date)} d` : '' }))} />
        </Card>
      </div>

      <Card delay={0.19}>
        <CardHeader title="Fuentes de datos" description="De dónde sale cada número." />
        <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Source ok={!!(culqi && culqi.connected)} name="Culqi" text={culqi && culqi.connected ? `Conectado${culqi.mode === 'test' ? ' (prueba)' : ''} · ${money(sum(real, (e) => (culqi.byEvent[e.id] || {}).amount || 0))} cobrados en fechas cerradas` : `No conectado${culqi && culqi.reason ? ` (${culqi.reason})` : ''}`} />
          <Source ok={!!live && Object.keys(live).length > 0} name="Web de tickets" text="En vivo: registros, QRs, puerta y promotores" />
          <Source ok={false} warn name="Wally y costos" text="Carga manual: Wally no tiene API. Se cargan los cierres después de cada fecha." />
        </div>
      </Card>

      {/* Fila 4: indicadores reales */}
      <Card delay={0.2}>
        <CardHeader title="Indicadores reales" description="Calculados solo con fechas cerradas." action={<KindTag real />} />
        <MetricStrip items={[
          { label: 'Margen neto', sub: 'Resultado / ingresos', value: R.margin == null ? '—' : pct(R.margin), tone: R.margin >= 0 ? 'good' : 'bad' },
          { label: 'Cobertura de costos', sub: '(Ingresos + stock) / costos', value: R.coverage == null ? '—' : pct(R.coverage), tone: R.coverage >= 100 ? 'good' : 'bad', foot: R.coverage != null && R.coverage < 100 ? `Faltaron ${money(R.cost - R.income - R.stock)}` : null },
          { label: 'Stock valorizado', sub: 'Lo que quedó, a costo', value: money(R.stock) },
          { label: 'Inversión en marca', sub: 'Activos que se reusan, aparte', value: money(R.inv) },
        ]} />
      </Card>
    </div>
  );
}

function IncomeChart({ events, withTaxes, brandName }) {
  const data = events.map((e) => {
    const t = totals(e, withTaxes);
    const real = isActual(e);
    return { name: fmtShort(e.date), ev: e, real: real ? t.income : 0, proj: real ? 0 : t.income, cost: t.cost, result: t.result };
  });
  return (
    <ResponsiveContainer>
      <BarChart data={data} barCategoryGap="32%">
        <defs>
          {data.map((d, i) => (
            <pattern key={i} id={`hatch-${i}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={brandColor(d.ev.brand)} fillOpacity="0.08" />
              <line x1="0" y1="0" x2="0" y2="6" stroke={brandColor(d.ev.brand)} strokeWidth="1.4" strokeOpacity="0.55" />
            </pattern>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke="#F1F1EF" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={56} />
        <Tooltip cursor={{ fill: 'rgba(10,10,10,.03)' }} content={({ active, payload }) => {
          if (!active || !payload || !payload.length) return null;
          const r = payload[0].payload; const realE = isActual(r.ev);
          return <TooltipBox title={r.ev.name} rows={[
            { label: realE ? 'Ingresos (real)' : 'Ingresos (presupuesto)', value: money(realE ? r.real : r.proj), color: brandColor(r.ev.brand), dashed: !realE },
            { label: realE ? 'Costos (real)' : 'Costos (presupuesto)', value: money(r.cost) },
          ]} foot={`${brandName(r.ev.brand)} · resultado ${money(r.result)}`} />;
        }} />
        <Bar dataKey="real" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={64} animationDuration={1000}>
          {data.map((d, i) => <Cell key={i} fill={brandColor(d.ev.brand)} />)}
        </Bar>
        <Bar dataKey="proj" stackId="a" radius={[4, 4, 0, 0]} maxBarSize={64} animationDuration={1000}>
          {data.map((d, i) => <Cell key={i} fill={`url(#hatch-${i})`} stroke={brandColor(d.ev.brand)} strokeDasharray="4 3" strokeWidth={1.2} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Source({ ok, warn, name, text }) {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', ok ? 'bg-good' : warn ? 'bg-[#C98500]' : 'bg-bad')} />
      <div><p className="text-[13px] font-medium">{name}</p><p className="text-[12px] text-muted">{text}</p></div>
    </div>
  );
}
