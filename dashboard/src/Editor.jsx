import React, { useState } from 'react';
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, BrandTile, KindTag } from './ui.jsx';
import { CATEGORIES, STATUSES, money, totals, fmtDate, today, isActual, cn } from './lib.js';

const sel = 'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function Editor({ draft, setDraft, dirty, setDirty, editId, setEditId, onSave, onDiscard, onReset, saving, withTaxes, seeded }) {
  const [sureDel, setSureDel] = useState(false);
  const [sureReset, setSureReset] = useState(false);
  const [newBrand, setNewBrand] = useState(draft.brands[0]?.id);
  const events = draft.events.slice().sort((a, b) => a.date.localeCompare(b.date));
  const e = draft.events.find((x) => x.id === editId) || events[0];

  const update = (fn) => { setDraft((d) => { const n = JSON.parse(JSON.stringify(d)); const ev = n.events.find((x) => x.id === e.id); fn(ev, n); return n; }); setDirty(true); };
  const setField = (k, v) => update((ev) => { ev[k] = v; });
  const setLine = (key, i, f, v) => update((ev) => { ev[key][i][f] = f === 'amount' ? (Number(v) || 0) : v; });
  const addLine = (key) => update((ev) => { ev[key] = ev[key] || []; ev[key].push(key === 'brandInvestment' ? { label: '', amount: 0 } : { label: '', category: '', amount: 0 }); });
  const delLine = (key, i) => update((ev) => { ev[key].splice(i, 1); });
  const newEvent = () => {
    const d = today(); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = newBrand + '-' + Date.now().toString(36);
    const b = draft.brands.find((x) => x.id === newBrand);
    setDraft((dd) => ({ ...dd, events: [...dd.events, { id, brand: newBrand, date: iso, name: `${b?.name || ''} · nueva fecha`, venue: '', status: 'planificación', liveEventId: '', notes: '', income: [], costs: [], brandInvestment: [] }] }));
    setEditId(id); setDirty(true);
  };
  const deleteEvent = () => {
    if (!sureDel) { setSureDel(true); return; }
    setDraft((d) => ({ ...d, events: d.events.filter((x) => x.id !== e.id) })); setEditId(null); setDirty(true); setSureDel(false);
  };
  const t = e ? totals(e, withTaxes) : null;

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div>
        <p className="text-xs text-muted-foreground">{seeded ? 'Estás viendo los datos de arranque' : 'Datos guardados'}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Editar datos</h1>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
        <Panel className="p-2">
          {draft.brands.map((b) => (
            <div key={b.id} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-2"><BrandTile id={b.id} size="sm" /><span className="text-xs font-medium">{b.name}</span></div>
              {events.filter((x) => x.brand === b.id).map((x) => (
                <button key={x.id} onClick={() => { setEditId(x.id); setSureDel(false); }}
                  className={cn('block w-full rounded-md border-l-2 px-3 py-2 text-left', x.id === e?.id ? 'bg-accent' : 'hover:bg-muted', isActual(x) ? 'border-l-transparent' : 'border-l-proj-line border-dashed')}>
                  <span className="block truncate text-sm">{x.name}</span>
                  <span className="block text-[11px] capitalize text-muted-foreground">{fmtDate(x.date)} · {x.status}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="mt-2 flex gap-2 border-t p-2">
            <select value={newBrand} onChange={(ev) => setNewBrand(ev.target.value)} className={cn(sel, 'h-8 flex-1 text-xs')} aria-label="Marca de la nueva fecha">
              {draft.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Button size="sm" onClick={newEvent}><PlusIcon />Fecha</Button>
          </div>
        </Panel>

        {e ? (
          <Panel proj={!isActual(e)}>
            <PanelHeader title={<span className="flex items-center gap-2">{e.name || 'Sin nombre'} <KindTag real={isActual(e)} /></span>}
              description={t && <>{isActual(e) ? '' : 'Proyectado · '}Ingresos <span className="mono">{money(t.income)}</span> · Costos <span className="mono">{money(t.cost)}</span> · Resultado <span className={cn('mono', t.result >= 0 ? 'text-good' : 'text-bad')}>{money(t.result)}</span></>}
              action={<Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={deleteEvent}><Trash2Icon />{sureDel ? 'Toca de nuevo' : 'Eliminar'}</Button>} />
            <div className="grid gap-3 p-6 sm:grid-cols-3">
              <Field label="Nombre" className="sm:col-span-3"><Input value={e.name} onChange={(v) => setField('name', v.target.value)} /></Field>
              <Field label="Marca"><select className={sel} value={e.brand} onChange={(v) => setField('brand', v.target.value)}>{draft.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="Fecha"><Input type="date" value={e.date} onChange={(v) => v.target.value && setField('date', v.target.value)} /></Field>
              <Field label="Estado"><select className={sel} value={e.status} onChange={(v) => setField('status', v.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Local"><Input value={e.venue || ''} onChange={(v) => setField('venue', v.target.value)} /></Field>
              <Field label="Fecha en la web de tickets"><Input placeholder="AAAA-MM-DD" value={e.liveEventId || ''} onChange={(v) => setField('liveEventId', v.target.value)} /></Field>
              <Field label="Stock que quedó (S/)"><Input type="number" step="0.01" className="mono" value={e.stockLeft || ''} onChange={(v) => setField('stockLeft', Number(v.target.value) || 0)} /></Field>
              <Field label="Notas" className="sm:col-span-3"><Textarea className="min-h-20" value={e.notes || ''} onChange={(v) => setField('notes', v.target.value)} /></Field>
            </div>
            {[['income', 'Ingresos', true], ['costs', 'Costos', true], ['brandInvestment', 'Inversión en marca', false]].map(([key, title, withCat]) => (
              <div key={key} className="border-t px-6 py-4">
                <div className="flex items-center justify-between"><p className="text-sm font-medium">{title}</p><Button size="sm" variant="outline" onClick={() => addLine(key)}><PlusIcon />Agregar</Button></div>
                {!(e[key] || []).length && <p className="mt-2 text-xs text-muted-foreground">Sin líneas todavía.</p>}
                <div className="mt-2 space-y-2">
                  {(e[key] || []).map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_110px_36px] gap-2 sm:grid-cols-[1fr_170px_130px_36px]">
                      <Input placeholder="Concepto" value={l.label} onChange={(v) => setLine(key, i, 'label', v.target.value)} />
                      {withCat ? <Input className="order-last col-span-3 sm:order-none sm:col-span-1" list="cats" placeholder="Categoría" value={l.category || ''} onChange={(v) => setLine(key, i, 'category', v.target.value)} /> : <span className="hidden sm:block" />}
                      <Input type="number" step="0.01" className="mono text-right" value={l.amount} onChange={(v) => setLine(key, i, 'amount', v.target.value)} />
                      <Button variant="outline" size="icon" aria-label="Quitar línea" onClick={() => delLine(key, i)} className="text-muted-foreground hover:text-destructive"><XIcon /></Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Panel>
        ) : <Panel className="p-6 text-sm text-muted-foreground">No hay fechas.</Panel>}
      </div>

      {/* Barra de guardado (clara) */}
      <div className="fixed inset-x-4 bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background px-4 py-2.5 text-sm shadow-2xl md:left-auto md:right-6 md:w-[640px]">
        <span className="flex items-center gap-2 text-muted-foreground"><i className={cn('size-2 rounded-full', dirty ? 'bg-[#C98500]' : 'bg-good')} />{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => { if (!sureReset) { setSureReset(true); return; } setSureReset(false); onReset(); }}>{sureReset ? 'Toca de nuevo: borra tus cambios' : 'Restaurar arranque'}</Button>
          <Button variant="outline" size="sm" onClick={onDiscard}>Descartar</Button>
          <Button size="sm" disabled={saving || !dirty} onClick={onSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }) {
  return <Label className={cn('flex flex-col items-stretch gap-1.5 text-xs font-normal text-muted-foreground', className)}>{label}{children}</Label>;
}
