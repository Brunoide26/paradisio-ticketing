import React, { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Panel, PanelHeader, CardContent, SectionTitle, Money, DeltaPill, KindTag, StatusBadge, Bars, DataTable, MetricStrip, BrandTile, TooltipBox, Legend, HatchDefs, Empty } from './ui.jsx';
import { money, short, pct, sum, totals, isActual, fmtShort, daysTo, brandColor, byCategory, cn } from './lib.js';

const chartConfig = { income: { label: 'Ingresos' } };

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
  const shortBrand = (id) => brandName(id).replace('Paradisio ', '');

  const realByBrand = brands.map((b) => ({ b, n: real.filter((e) => e.brand === b.id).length, ...T(real.filter((e) => e.brand === b.id)) }));
  const projByBrand = brands.map((b) => ({ b, n: proj.filter((e) => e.brand === b.id).length, ...T(proj.filter((e) => e.brand === b.id)) }));
  const incomeBySource = (() => {
    const m = new Map();
    real.forEach((e) => (e.income || []).forEach((l) => { const k = l.category || l.label; m.set(k, (m.get(k) || 0) + (Number(l.amount) || 0)); }));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  })();
  const culqiOn = !!(culqi && culqi.connected);
  const culqiAmt = (list) => (culqiOn ? sum(list, (e) => (culqi.byEvent[e.id] || {}).amount || 0) : 0);
  const projValue = (e) => { const t = totals(e, withTaxes); return (e.costs || []).length ? t.result : t.income; };

  return (
    <div className="flex flex-col gap-4">
      {/* ================= LO REAL (arriba, sólido) ================= */}
      <SectionTitle kind="real" title="Lo real" description={`${real.length} fecha${real.length === 1 ? '' : 's'} cerrada${real.length === 1 ? '' : 's'} · ${withTaxes ? 'con' : 'sin'} IGV y renta`} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* VisitorsChart → ingresos reales por fecha */}
        <Panel className="md:col-span-2 lg:col-span-3">
          <PanelHeader big title={<Money value={R.income} />} description="Ingresos reales del grupo, por fecha cerrada."
            action={<DeltaPill value={R.result} format="money" good={R.result >= 0} label={R.result >= 0 ? 'de utilidad' : 'de pérdida'} />} className="border-b-0" />
          <CardContent className="px-2 pb-2">
            {real.length ? <RealChart events={real} withTaxes={withTaxes} brandName={brandName} /> : <Empty title="Todavía no hay fechas cerradas" />}
          </CardContent>
          <Legend items={brands.filter((b) => real.some((e) => e.brand === b.id)).map((b) => ({ label: b.name, color: brandColor(b.id) }))} />
        </Panel>

        {/* OnlineNow → resultado real por marca */}
        <Panel className="md:col-span-2 lg:col-span-1">
          <PanelHeader big title={<span className={R.result >= 0 ? 'text-good' : 'text-bad'}><Money value={R.result} /></span>}
            description={`Resultado real${R.stock ? ` · incluye ${money(R.stock)} de stock` : ''}`}
            action={R.margin != null ? <DeltaPill value={R.margin} good={R.margin >= 0} label="margen" /> : null} />
          <CardContent className="px-0 py-2">
            <Bars items={realByBrand.map(({ b, n, result }) => ({ label: b.name, value: result, color: brandColor(b.id), extra: n ? null : 'sin cierres' }))} />
          </CardContent>
        </Panel>

        {/* TopPages → real por marca */}
        <Panel className="md:col-span-2">
          <PanelHeader title="Real por marca" description="Fechas cerradas, suma de ingresos y resultado." action={<KindTag real />} />
          <DataTable
            columns={[
              { key: 'm', label: 'Marca', render: (r) => (r.total ? <span className="font-medium">Total grupo</span> : <button onClick={() => go(r.b.id)} className="flex items-center gap-2 font-medium hover:underline"><BrandTile id={r.b.id} size="xs" />{r.b.name}</button>) },
              { key: 'n', label: 'Fechas', align: 'right', mono: true, render: (r) => r.n },
              { key: 'i', label: 'Ingresos', align: 'right', mono: true, render: (r) => (r.n ? money(r.income) : '—') },
              { key: 'r', label: 'Resultado', align: 'right', mono: true, render: (r) => (r.n ? <span className={r.result >= 0 ? 'text-good' : 'text-bad'}>{money(r.result)}</span> : '—') },
            ]}
            rows={[...realByBrand, { total: true, n: real.length, income: R.income, result: R.result, _strong: true }]}
          />
        </Panel>

        {/* TopReferrers → fuentes de datos */}
        <Panel className="md:col-span-2">
          <PanelHeader title="Fuentes de datos" description="De dónde sale cada número." />
          <ul className="divide-y">
            <Source ok={culqiOn} name="Culqi" text={culqiOn ? `Conectado${culqi.mode === 'test' ? ' (prueba)' : ''} · ${money(culqiAmt(real))} cobrados en fechas cerradas${culqi.diag ? ` · ${culqi.diag.fetched} cobros leídos${culqi.diag.newest ? `, el último del ${new Date(culqi.diag.newest * 1000).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' })}` : ''}` : ''}` : `No conectado${culqi && culqi.reason ? ` (${culqi.reason})` : ''}`} />
            <Source ok={!!live && Object.keys(live).length > 0} name="Web de tickets" text="En vivo: registros, QRs, puerta y promotores" />
            <Source warn name="Wally y costos" text="Carga manual: Wally no tiene API. Los cierres se cargan después de cada fecha." />
          </ul>
        </Panel>

        {/* TrafficSources / AudienceMix / BrowserShare → composición real */}
        <Panel>
          <PanelHeader title="Ingresos reales" description="Por fuente." />
          <CardContent className="px-0 py-1"><Bars items={incomeBySource} color="#525252" /></CardContent>
        </Panel>
        <Panel>
          <PanelHeader title="Costos reales" description="Por categoría." />
          <CardContent className="px-0 py-1"><Bars items={byCategory(R.costs).slice(0, 6).map((c) => ({ label: c.name, value: c.value, title: c.items.map((x) => `${x.label}: ${money(x.amount)}`).join('\n') }))} color="#A3A3A0" /></CardContent>
        </Panel>
        <Panel>
          <PanelHeader title="Peso por marca" description="Participación en ingresos reales." />
          <CardContent className="px-0 py-1"><Bars items={realByBrand.map(({ b, income }) => ({ label: b.name, value: income, color: brandColor(b.id), extra: R.income ? pct((income / R.income) * 100) : '' }))} /></CardContent>
        </Panel>
        <Panel>
          <PanelHeader title="Cobrado en Culqi" description={culqiOn ? 'Fechas cerradas, por marca.' : 'Culqi no está conectado.'} />
          <CardContent className="px-0 py-1">
            {culqiOn ? <Bars items={brands.map((b) => ({ label: b.name, value: culqiAmt(real.filter((e) => e.brand === b.id)), color: brandColor(b.id) }))} /> : <p className="px-6 py-5 text-[13px] text-muted-foreground">Los montos siguen siendo los cargados a mano.</p>}
          </CardContent>
        </Panel>

        {/* WebVitals → indicadores reales */}
        <Panel className="md:col-span-2 lg:col-span-4">
          <PanelHeader title="Indicadores reales" description="Calculados solo con fechas cerradas." action={<KindTag real />} />
          <MetricStrip items={[
            { label: 'Margen neto', sub: 'Resultado / ingresos', value: R.margin == null ? '—' : pct(R.margin), tone: R.margin >= 0 ? 'good' : 'bad' },
            { label: 'Cobertura de costos', sub: '(Ingresos + stock) / costos', value: R.coverage == null ? '—' : pct(R.coverage), tone: R.coverage >= 100 ? 'good' : 'bad', foot: R.coverage != null && R.coverage < 100 ? `Faltaron ${money(R.cost - R.income - R.stock)}` : null },
            { label: 'Stock valorizado', sub: 'Lo que quedó, a costo', value: money(R.stock) },
            { label: 'Inversión en marca', sub: 'Activos que se reusan, aparte', value: money(R.inv) },
          ]} />
        </Panel>
      </div>

      {/* ================= PROYECTADO (aparte, punteado) ================= */}
      <SectionTitle kind="proj" title="Proyectado" description="Presupuestos de las fechas por venir. Nunca se suman a lo real." className="pt-6" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Panel proj className="md:col-span-2 lg:col-span-3">
          <PanelHeader big title={<span className="text-foreground/80"><Money value={P.income} /></span>} description="Ingresos proyectados de las próximas fechas." action={<KindTag />} className="border-b-0" />
          <CardContent className="px-2 pb-2">
            {proj.length ? <ProjChart events={proj} withTaxes={withTaxes} brandName={brandName} /> : <Empty title="No hay fechas por venir" />}
          </CardContent>
          <Legend items={[{ label: 'Presupuesto (rayado, color de la marca)', dashed: true }]} />
        </Panel>

        <Panel proj className="md:col-span-2 lg:col-span-1">
          <PanelHeader big title={<span className={P.result >= 0 ? 'text-good/80' : 'text-bad/80'}><Money value={P.result} /></span>} description="Utilidad proyectada si se cumplen." action={<KindTag />} />
          <CardContent className="px-0 py-2">
            <Bars dashed empty="Sin presupuestos." items={proj.map((e) => ({ label: `${fmtShort(e.date)} · ${shortBrand(e.brand)}`, value: projValue(e), color: brandColor(e.brand), extra: daysTo(e.date) >= 0 ? `en ${daysTo(e.date)} d` : '' }))} />
          </CardContent>
        </Panel>

        <Panel proj className="md:col-span-2 lg:col-span-3">
          <PanelHeader title="Lo que viene" description="Cada fecha con su estado y su utilidad proyectada." action={<KindTag />} />
          <DataTable proj limit={8}
            columns={[
              { key: 'd', label: 'Fecha', render: (e) => <button onClick={() => go(e.brand, e.id)} className="flex items-center gap-2 hover:underline"><BrandTile id={e.brand} size="xs" /><span className="mono">{fmtShort(e.date)}</span></button> },
              { key: 'n', label: 'Evento', render: (e) => <span className="block max-w-[220px] truncate text-muted-foreground">{e.name}</span> },
              { key: 's', label: 'Estado', render: (e) => <StatusBadge status={e.status} /> },
              { key: 'r', label: 'Utilidad proy.', align: 'right', mono: true, render: (e) => { const t = totals(e, withTaxes); return !(e.costs || []).length ? <span className="text-muted-foreground">{t.income ? `${money(t.income)} ingreso` : 'por definir'}</span> : <span className={t.result >= 0 ? 'text-good' : 'text-bad'}>{money(t.result)}</span>; } },
            ]}
            rows={proj}
            empty="No hay fechas por venir."
          />
        </Panel>

        <Panel proj>
          <PanelHeader title="Proyectado por marca" description="Utilidad si se cumplen los presupuestos." />
          <CardContent className="px-0 py-1">
            <Bars dashed items={projByBrand.filter((x) => x.n).map(({ b, n, result }) => ({ label: b.name, value: result, color: brandColor(b.id), extra: `${n} fecha${n === 1 ? '' : 's'}` }))} empty="Sin presupuestos." />
          </CardContent>
        </Panel>
      </div>
    </div>
  );
}

function RealChart({ events, withTaxes, brandName }) {
  const data = events.map((e) => { const t = totals(e, withTaxes); return { name: fmtShort(e.date), ev: e, income: t.income, cost: t.cost, result: t.result }; });
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
      <BarChart accessibilityLayer data={data} barCategoryGap="32%" margin={{ left: 4, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={56} />
        <ChartTooltip cursor={{ fill: 'var(--muted)' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => {
          if (!active || !payload || !payload.length) return null;
          const r = payload[0].payload;
          return <TooltipBox title={r.ev.name} rows={[{ label: 'Ingresos (real)', value: money(r.income), color: brandColor(r.ev.brand) }, { label: 'Costos (real)', value: money(r.cost) }]} foot={`${brandName(r.ev.brand)} · resultado ${money(r.result)}`} />;
        }} />
        <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={brandColor(d.ev.brand)} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function ProjChart({ events, withTaxes, brandName }) {
  const data = events.map((e) => { const t = totals(e, withTaxes); return { name: fmtShort(e.date), ev: e, income: t.income, cost: t.cost, result: t.result, hasCosts: !!(e.costs || []).length }; });
  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-52 w-full">
      <BarChart accessibilityLayer data={data} barCategoryGap="32%" margin={{ left: 4, right: 12 }}>
        <defs>{data.map((d, i) => <HatchDefs key={i} id={`proj-hatch-${i}`} color={brandColor(d.ev.brand)} />)}</defs>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={56} />
        <ChartTooltip cursor={{ fill: 'var(--color-proj-soft)' }} wrapperStyle={{ outline: 'none' }} content={({ active, payload }) => {
          if (!active || !payload || !payload.length) return null;
          const r = payload[0].payload;
          return <TooltipBox title={`${r.ev.name} · Proyectado`} rows={[{ label: 'Ingresos (presupuesto)', value: money(r.income), color: brandColor(r.ev.brand), dashed: true }, { label: 'Costos (presupuesto)', value: r.hasCosts ? money(r.cost) : 'por definir' }]} foot={`${brandName(r.ev.brand)}${r.hasCosts ? ` · utilidad ${money(r.result)}` : ''}`} />;
        }} />
        <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={64} isAnimationActive={false}>
          {data.map((d, i) => <Cell key={i} fill={`url(#proj-hatch-${i})`} stroke={brandColor(d.ev.brand)} strokeDasharray="4 3" strokeWidth={1.2} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function Source({ ok, warn, name, text }) {
  return (
    <li className="flex gap-3 px-6 py-3.5">
      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', ok ? 'bg-good' : warn ? 'bg-[#C98500]' : 'bg-bad')} />
      <div><p className="text-[13px] font-medium">{name}</p><p className="text-[12px] text-muted-foreground">{text}</p></div>
    </li>
  );
}
