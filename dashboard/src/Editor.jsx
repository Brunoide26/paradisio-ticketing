import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Card, CardHead, Button, BrandTile } from './ui.jsx';
import { CATEGORIES, STATUSES, money, totals, fmtDate, today, cn } from './lib.js';

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
    <div className="space-y-4 pb-20">
      <div>
        <p className="text-xs text-muted">{seeded ? 'Estás viendo los datos de arranque' : 'Datos guardados'}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Editar datos</h1>
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[280px_1fr]">
        <Card className="p-2">
          {draft.brands.map((b) => (
            <div key={b.id} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-2"><BrandTile id={b.id} size="sm" /><span className="text-xs font-medium">{b.name}</span></div>
              {events.filter((x) => x.brand === b.id).map((x) => (
                <button key={x.id} onClick={() => { setEditId(x.id); setSureDel(false); }} className={cn('block w-full rounded-lg px-3 py-2 text-left', x.id === e?.id ? 'bg-line-soft' : 'hover:bg-[#FAF9F7]')}>
                  <span className="block truncate text-sm">{x.name}</span>
                  <span className="block text-[11px] capitalize text-muted">{fmtDate(x.date)} · {x.status}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="mt-2 flex gap-2 border-t border-line-soft p-2">
            <select value={newBrand} onChange={(ev) => setNewBrand(ev.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 text-xs">
              {draft.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <Button size="sm" onClick={newEvent}><Plus className="h-3.5 w-3.5" />Fecha</Button>
          </div>
        </Card>

        {e ? (
          <Card>
            <CardHead title={e.name || 'Sin nombre'} hint={t && <>Ingresos <span className="num">{money(t.income)}</span> · Costos <span className="num">{money(t.cost)}</span> · Resultado <span className={cn('num', t.result >= 0 ? 'text-good' : 'text-bad')}>{money(t.result)}</span></>}
              right={<Button size="sm" variant="danger" onClick={deleteEvent}><Trash2 className="h-3.5 w-3.5" />{sureDel ? 'Toca de nuevo' : 'Eliminar'}</Button>} />
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              <Field label="Nombre" className="sm:col-span-3"><input className={inp} value={e.name} onChange={(v) => setField('name', v.target.value)} /></Field>
              <Field label="Marca"><select className={inp} value={e.brand} onChange={(v) => setField('brand', v.target.value)}>{draft.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="Fecha"><input type="date" className={inp} value={e.date} onChange={(v) => v.target.value && setField('date', v.target.value)} /></Field>
              <Field label="Estado"><select className={inp} value={e.status} onChange={(v) => setField('status', v.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Local"><input className={inp} value={e.venue || ''} onChange={(v) => setField('venue', v.target.value)} /></Field>
              <Field label="Fecha en la web de tickets"><input className={inp} placeholder="AAAA-MM-DD" value={e.liveEventId || ''} onChange={(v) => setField('liveEventId', v.target.value)} /></Field>
              <Field label="Stock que quedó (S/)"><input type="number" step="0.01" className={cn(inp, 'num')} value={e.stockLeft || ''} onChange={(v) => setField('stockLeft', Number(v.target.value) || 0)} /></Field>
              <Field label="Notas" className="sm:col-span-3"><textarea className={cn(inp, 'min-h-20 py-2')} value={e.notes || ''} onChange={(v) => setField('notes', v.target.value)} /></Field>
            </div>
            {[['income', 'Ingresos', true], ['costs', 'Costos', true], ['brandInvestment', 'Inversión en marca', false]].map(([key, title, withCat]) => (
              <div key={key} className="border-t border-line-soft px-5 py-4">
                <div className="flex items-center justify-between"><p className="text-sm font-medium">{title}</p><Button size="sm" variant="outline" onClick={() => addLine(key)}><Plus className="h-3.5 w-3.5" />Agregar</Button></div>
                {!(e[key] || []).length && <p className="mt-2 text-xs text-muted">Sin líneas todavía.</p>}
                <div className="mt-2 space-y-2">
                  {(e[key] || []).map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_110px_32px] gap-2 sm:grid-cols-[1fr_170px_130px_32px]">
                      <input className={inp} placeholder="Concepto" value={l.label} onChange={(v) => setLine(key, i, 'label', v.target.value)} />
                      {withCat ? <input className={cn(inp, 'col-span-3 sm:col-span-1 order-last sm:order-none')} list="cats" placeholder="Categoría" value={l.category || ''} onChange={(v) => setLine(key, i, 'category', v.target.value)} /> : <span className="hidden sm:block" />}
                      <input type="number" step="0.01" className={cn(inp, 'num text-right')} value={l.amount} onChange={(v) => setLine(key, i, 'amount', v.target.value)} />
                      <button onClick={() => delLine(key, i)} className="flex h-9 items-center justify-center rounded-lg border border-line text-muted hover:border-bad hover:text-bad"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Card>
        ) : <Card className="p-6 text-sm text-muted">No hay fechas.</Card>}
      </div>

      <div className="fixed bottom-4 left-1/2 z-30 flex w-[min(720px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-2xl lg:left-[calc(50%+120px)]">
        <span className="text-[#C9C5BD]">{dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
        <div className="flex gap-2">
          <button className="rounded-lg px-2.5 py-1.5 text-xs text-[#C9C5BD] hover:text-white" onClick={() => { if (!sureReset) { setSureReset(true); return; } setSureReset(false); onReset(); }}>{sureReset ? 'Toca de nuevo: borra tus cambios' : 'Restaurar arranque'}</button>
          <button className="rounded-lg border border-[#3a3a37] px-2.5 py-1.5 text-xs hover:bg-[#2a2a28]" onClick={onDiscard}>Descartar</button>
          <button className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60" disabled={saving || !dirty} onClick={onSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

const inp = 'h-9 w-full rounded-lg border border-line bg-[#FCFCFB] px-3 text-sm outline-none transition-colors focus:border-ink';
function Field({ label, children, className }) {
  return <label className={cn('flex flex-col gap-1.5 text-xs text-ink-2', className)}>{label}{children}</label>;
}
