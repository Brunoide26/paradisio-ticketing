import React, { useState } from 'react';
import { ClipboardListIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { CountDialog } from '../os/forms.jsx';
import { PageHeader, Kpi, Unavailable, fmtDay, moneyOrNA, sel, BrandDot, useScope } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel } from '../ui.jsx';
import { cn, money } from '../lib.js';

export default function Inventory() {
  const { data, setDrawer } = useOS();
  const [tab, setTab] = useState('products');
  const [countFor, setCountFor] = useState(null);
  const IS = data.os.inventorySummary;
  const inv = data.inventory;
  const scope = useScope();
  const events = data.finance.events.filter((e) => scope.inScope(e.brand)).sort((a, b) => b.date.localeCompare(a.date));
  const [pick, setEvSel] = useState('');
  const evSel = events.some((e) => e.id === pick) ? pick : events[0]?.id || '';
  // Consumo y stock final contado en las fechas de la marca (el stock en sí es compartido).
  const byEv = data.os.byEvent || {};
  const evInv = events.map((e) => (byEv[e.id] || {}).inventory).filter((c) => c && c.rows.length);
  const consumed = evInv.filter((c) => c.consumedCost != null);
  const closed = evInv.filter((c) => c.closeValue != null);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Inventario" description={scope.brand ? `El stock es compartido entre las marcas; abajo, el consumo en las fechas de ${scope.name}.` : 'Compartido entre las marcas. Comprar suma stock; el consumo de un evento sale de sus conteos de apertura y cierre.'}
        actions={<>
          <Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'product' })}><PlusIcon />Producto</Button>
          <Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'move' })}><PlusIcon />Movimiento</Button>
          <Button size="sm" onClick={() => setCountFor(evSel || events[0]?.id)} disabled={!events.length}><ClipboardListIcon />Conteo del evento</Button>
        </>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Valor del inventario" value={moneyOrNA(IS.value)} unavailable={IS.value == null ? 'Sin productos contados o comprados' : null} sub="a costo" />
        <Kpi label="Productos" value={String(IS.products.length)} sub={IS.uncounted ? `${IS.uncounted} sin contar` : 'todos con stock conocido'} />
        <Kpi label="Stock bajo" value={String(IS.low.length)} tone={IS.low.length ? 'bad' : undefined} sub="debajo del mínimo" onClick={IS.low.length ? () => setTab('products') : undefined} />
        <Kpi label={scope.brand ? `Consumido por ${scope.name}` : 'Consumido en fechas'} value={consumed.length ? money(consumed.reduce((t, c) => t + c.consumedCost, 0)) : null}
          unavailable={consumed.length ? null : (evInv.length ? 'Falta conteo de apertura o cierre' : `${scope.brand ? scope.name + ' no tiene' : 'No hay'} conteos de fechas todavía`)}
          sub={closed.length ? `stock final contado ${money(closed.reduce((t, c) => t + c.closeValue, 0))}` : 'apertura + compras − cierre'} onClick={() => setTab('events')} />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8"><TabsTrigger value="products" className="text-[12px]">Productos</TabsTrigger><TabsTrigger value="moves" className="text-[12px]">Movimientos</TabsTrigger><TabsTrigger value="events" className="text-[12px]">Consumo por evento</TabsTrigger></TabsList>
      </Tabs>

      {tab === 'products' && (
        <Panel>
          <DataTable id="inv-products" rows={IS.products} initialSort={{ key: 'name', dir: 1 }} onRowClick={(p) => setDrawer({ type: 'product', id: p.id })}
            empty={<>Sin productos. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'product' })}>Crea el primero</button>.</>}
            rowClassName={(p) => (p.low ? 'bg-red-500/5' : '')}
            columns={[
              { key: 'name', label: 'Producto', get: (p) => p.name, render: (p) => <span className="font-medium">{p.name}</span> },
              { key: 'kind', label: 'Tipo', get: (p) => data.os.enums.productKinds[p.kind] },
              { key: 'category', label: 'Categoría', get: (p) => p.category },
              { key: 'unitCost', label: 'Costo unit.', num: true, get: (p) => p.unitCost, render: (p) => money(p.unitCost, 2) },
              { key: 'onHand', label: 'En stock', num: true, get: (p) => p.onHand, render: (p) => (p.onHand == null ? <Unavailable reason="Sin conteo ni compras" /> : <span className={cn(p.low && 'font-medium text-bad')}>{p.onHand.toLocaleString('es-PE')} {p.unit}</span>) },
              { key: 'minStock', label: 'Mínimo', num: true, get: (p) => p.minStock, render: (p) => (p.minStock == null ? '—' : p.minStock.toLocaleString('es-PE')) },
              { key: 'value', label: 'Valor', num: true, get: (p) => p.value, render: (p) => (p.value == null ? '—' : money(p.value, 2)) },
            ]} />
        </Panel>
      )}

      {tab === 'moves' && <Moves inv={inv} />}

      {tab === 'events' && (
        <Panel>
          <PanelBar title="Consumo por evento" description="Apertura + compras para el evento − cierre. Sin conteo de cierre, el consumo no está disponible."
            action={<div className="flex items-center gap-2"><select aria-label="Evento" className={cn(sel, 'h-8 w-64 text-[13px]')} value={evSel} onChange={(e) => setEvSel(e.target.value)} disabled={!events.length}>{!events.length && <option>Sin fechas</option>}{events.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select><Button size="sm" variant="outline" onClick={() => setCountFor(evSel)}>Contar</Button></div>} />
          <EventConsumption eventId={evSel} />
        </Panel>
      )}
      <CountDialog open={!!countFor} onOpenChange={(o) => !o && setCountFor(null)} eventId={countFor} />
    </div>
  );
}

export function EventConsumption({ eventId, compact }) {
  const { data } = useOS();
  const c = ((data.os.byEvent || {})[eventId] || {}).inventory;
  const e = data.finance.events.find((x) => x.id === eventId);
  if (!c || !c.rows.length) return <p className="px-4 py-6 text-[13px] text-muted-foreground">Sin conteos para este evento. Usa "Conteo del evento" antes de abrir y al cerrar.</p>;
  return (
    <>
      <DataTable id={compact ? 'ev-cons' : 'inv-cons'} rows={c.rows.map((r) => ({ ...r, id: r.productId }))} searchable={!compact}
        columns={[
          { key: 'name', label: 'Producto', get: (r) => r.name, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'open', label: 'Apertura', num: true, get: (r) => r.open, render: (r) => (r.open == null ? <Unavailable reason="Falta conteo de apertura" /> : r.open) },
          { key: 'added', label: 'Compras', num: true, get: (r) => r.added },
          { key: 'close', label: 'Cierre', num: true, get: (r) => r.close, render: (r) => (r.close == null ? <Unavailable reason="Falta conteo de cierre" /> : r.close) },
          { key: 'consumed', label: 'Consumido', num: true, get: (r) => r.consumed, render: (r) => (r.consumed == null ? '—' : `${r.consumed} ${r.unit}`) },
          { key: 'consumedCost', label: 'Costo consumido', num: true, get: (r) => r.consumedCost, render: (r) => (r.consumedCost == null ? '—' : money(r.consumedCost, 2)) },
          { key: 'closeValue', label: 'Stock final', num: true, get: (r) => r.closeValue, render: (r) => (r.closeValue == null ? '—' : money(r.closeValue, 2)) },
        ]} />
      <div className="flex flex-wrap gap-x-6 gap-y-1 border-t px-4 py-2.5 text-[12px] text-muted-foreground">
        <span>Costo consumido: <b className="mono text-foreground">{c.consumedCost == null ? 'incompleto' : money(c.consumedCost, 2)}</b></span>
        <span>Stock final según conteo: <b className="mono text-foreground">{c.closeValue == null ? 'incompleto' : money(c.closeValue, 2)}</b></span>
        {e && c.closeValue != null && Number(e.stockLeft) > 0 && Math.abs(c.closeValue - Number(e.stockLeft)) >= 1 && <span className="text-[#C98500]">En finanzas el stock final es {money(e.stockLeft, 2)}: revisa cuál es el correcto.</span>}
      </div>
    </>
  );
}

function Moves({ inv }) {
  const { data, deleteMove } = useOS();
  const [sure, setSure] = useState(null);
  const products = new Map((inv.products || []).map((p) => [p.id, p]));
  const events = new Map(data.finance.events.map((e) => [e.id, e]));
  return (
    <Panel>
      <DataTable id="inv-moves" rows={inv.movements || []} initialSort={{ key: 'date', dir: -1 }} empty="Sin movimientos."
        columns={[
          { key: 'date', label: 'Fecha', get: (m) => m.date, render: (m) => <span className="mono">{fmtDay(m.date)}</span> },
          { key: 'type', label: 'Tipo', get: (m) => (m.type === 'count' ? `Conteo${m.phase ? (m.phase === 'open' ? ' de apertura' : ' de cierre') : ''}` : data.os.enums.moveTypes[m.type].label) },
          { key: 'product', label: 'Producto', get: (m) => (products.get(m.productId) || {}).name, render: (m) => <span className="font-medium">{(products.get(m.productId) || {}).name}</span> },
          { key: 'qty', label: 'Cantidad', num: true, get: (m) => m.qty, render: (m) => { const sg = data.os.enums.moveTypes[m.type].sign; return <span className={sg > 0 ? 'text-good' : sg < 0 ? 'text-bad' : ''}>{sg > 0 && m.type !== 'adjustment' ? '+' : sg < 0 ? '−' : ''}{m.qty}</span>; } },
          { key: 'event', label: 'Evento', get: (m) => (events.get(m.eventId) || {}).name || '', render: (m) => (m.eventId ? <span className="flex items-center gap-1.5"><BrandDot id={(events.get(m.eventId) || {}).brand} /><span className="max-w-[200px] truncate">{(events.get(m.eventId) || {}).name}</span></span> : '—') },
          { key: 'note', label: 'Nota', get: (m) => m.note },
          { key: 'del', label: '', sortable: false, get: () => '', render: (m) => <Button size="sm" variant="ghost" className={cn('h-7 px-2', sure === m.id && 'text-destructive')} onClick={async (e) => { e.stopPropagation(); if (sure !== m.id) { setSure(m.id); return; } try { await deleteMove(m.id); } catch { /* */ } setSure(null); }}><Trash2Icon />{sure === m.id ? 'Confirmar' : ''}</Button> },
        ]} />
    </Panel>
  );
}
