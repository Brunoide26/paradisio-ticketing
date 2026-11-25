import React, { useEffect, useState } from 'react';
import { CheckIcon, ListChecksIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOS } from '../os/store.jsx';
import DataTable from '../os/DataTable.jsx';
import { PageHeader, Kpi, fmtDay, sel, BrandDot, Unavailable, useScope } from '../os/kit.jsx';
import { PanelBar } from './Overview.jsx';
import { Panel } from '../ui.jsx';
import { cn, money, limaISO } from '../lib.js';

const STATUS_TONE = { todo: 'text-muted-foreground', doing: 'text-sky-600', done: 'text-good', blocked: 'text-[#C98500]' };

// Lista de tareas reutilizable (Mis tareas, Operaciones, evento).
export function TaskList({ tasks, showEvent = true, id = 'tasks' }) {
  const { data, setDrawer, opsAct } = useOS();
  const events = new Map(data.finance.events.map((e) => [e.id, e]));
  const toggle = (t) => {
    const raw = (data.ops.tasks || []).find((x) => x.id === t.id);
    opsAct('ops.task.upsert', { task: { ...raw, status: raw.status === 'done' ? 'todo' : 'done' } }, raw.status === 'done' ? 'Tarea reabierta' : 'Tarea hecha').catch(() => {});
  };
  return (
    <DataTable id={id} rows={tasks} initialSort={{ key: 'due', dir: 1 }} onRowClick={(t) => setDrawer({ type: 'task', id: t.id })} rowClassName={(t) => (t.effective === 'done' ? 'opacity-60' : t.overdue ? 'bg-red-500/5' : '')}
      empty="Sin tareas."
      columns={[
        { key: 'check', label: '', sortable: false, get: () => '', className: 'w-8', render: (t) => (
          <button type="button" aria-label={t.status === 'done' ? 'Reabrir tarea' : 'Marcar como hecha'} disabled={t.effective === 'blocked' && t.status !== 'done'} onClick={(e) => { e.stopPropagation(); toggle(t); }}
            className={cn('flex size-4 items-center justify-center rounded border', t.status === 'done' ? 'border-good bg-good text-white' : 'hover:border-foreground disabled:opacity-40')}>{t.status === 'done' && <CheckIcon className="size-3" />}</button>) },
        { key: 'title', label: 'Tarea', get: (t) => t.title, render: (t) => <span className="min-w-0"><span className={cn('block max-w-[380px] truncate font-medium', t.status === 'done' && 'line-through')}>{t.title}</span>{t.blockedBy.length > 0 && <span className="block text-[11px] text-[#C98500]">espera: {t.blockedBy.map((b) => b.title).join(' · ')}</span>}</span> },
        ...(showEvent ? [{ key: 'event', label: 'Evento', get: (t) => (events.get(t.eventId) || {}).name || 'General', render: (t) => (t.eventId ? <span className="flex items-center gap-1.5"><BrandDot id={(events.get(t.eventId) || {}).brand} /><span className="max-w-[200px] truncate">{(events.get(t.eventId) || {}).name}</span></span> : <span className="text-muted-foreground">General</span>) }] : []),
        { key: 'group', label: 'Área', get: (t) => t.group },
        { key: 'owner', label: 'Responsable', get: (t) => t.owner, render: (t) => t.owner || <span className="text-muted-foreground">sin asignar</span> },
        { key: 'due', label: 'Vence', get: (t) => t.due || '9999', render: (t) => (t.due ? <span className={cn('mono', t.overdue && 'font-medium text-bad')}>{fmtDay(t.due)}</span> : '—') },
        { key: 'status', label: 'Estado', get: (t) => data.os.enums.taskStatus[t.effective], render: (t) => <span className={STATUS_TONE[t.effective]}>{data.os.enums.taskStatus[t.effective]}</span> },
      ]} />
  );
}

export function MyTasks() {
  const { data, workspace, setDrawer } = useOS();
  const [show, setShow] = useState('open');
  const evBrand = new Map(data.finance.events.map((e) => [e.id, e.brand]));
  const all = (data.os.tasks || []).filter((t) => workspace === 'group' || !t.eventId || evBrand.get(t.eventId) === workspace);
  const rows = all.filter((t) => (show === 'open' ? t.status !== 'done' : show === 'overdue' ? t.overdue : show === 'blocked' ? t.effective === 'blocked' : true));
  const week = new Date(Date.now() + 7 * 86400000 - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Mis tareas" description="Todo lo pendiente de todos los eventos y del grupo." actions={<Button size="sm" onClick={() => setDrawer({ type: 'task' })}><PlusIcon />Tarea</Button>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Abiertas" value={String(all.filter((t) => t.status !== 'done').length)} onClick={() => setShow('open')} />
        <Kpi label="Vencidas" value={String(all.filter((t) => t.overdue).length)} tone={all.some((t) => t.overdue) ? 'bad' : undefined} onClick={() => setShow('overdue')} />
        <Kpi label="Esta semana" value={String(all.filter((t) => t.status !== 'done' && t.due && t.due <= week && !t.overdue).length)} />
        <Kpi label="Bloqueadas" value={String(all.filter((t) => t.effective === 'blocked').length)} onClick={() => setShow('blocked')} />
      </div>
      <Panel>
        <TaskList id="my-tasks" tasks={rows} />
        <div className="flex gap-1 border-t px-3 py-2">{[['open', 'Abiertas'], ['overdue', 'Vencidas'], ['blocked', 'Bloqueadas'], ['all', 'Todas']].map(([k, l]) => <Button key={k} size="sm" variant={show === k ? 'secondary' : 'ghost'} onClick={() => setShow(k)}>{l}</Button>)}</div>
      </Panel>
    </div>
  );
}

export default function Operations() {
  const { data, setDrawer } = useOS();
  const scope = useScope();
  const [tab, setTab] = useState('directory');
  const [type, setType] = useState('all');
  const [everyone, setEveryone] = useState(false);
  const brandOf = new Map(data.finance.events.map((e) => [e.id, e.brand]));
  // Con una marca elegida: quienes trabajaron en sus fechas (el directorio es compartido).
  const usedBy = new Set(Object.entries(data.ops.staff || {}).filter(([evId]) => scope.inScope(brandOf.get(evId))).flatMap(([, list]) => list.map((x) => x.contactId)));
  const contacts = (data.ops.contacts || []).filter((c) => (type === 'all' || c.type === type) && (!scope.brand || everyone || usedBy.has(c.id)));
  const tasks = (data.os.tasks || []).filter((t) => !scope.brand || (t.eventId && brandOf.get(t.eventId) === scope.brandId));
  const T = data.os.enums.contactTypes;
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Operaciones y proveedores" description="Directorio de locales, artistas y DJs, proveedores y staff, y las tareas de producción."
        actions={<><Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'task' })}><PlusIcon />Tarea</Button><Button size="sm" onClick={() => setDrawer({ type: 'contact' })}><PlusIcon />Contacto</Button></>} />
      <Tabs value={tab} onValueChange={setTab}><TabsList className="h-8"><TabsTrigger value="directory" className="text-[12px]">Directorio</TabsTrigger><TabsTrigger value="tasks" className="text-[12px]">Tareas</TabsTrigger></TabsList></Tabs>
      {tab === 'directory' && (
        <Panel>
          <DataTable id="contacts" rows={contacts} initialSort={{ key: 'name', dir: 1 }} onRowClick={(c) => setDrawer({ type: 'contact', id: c.id })} rowClassName={(c) => (c.archived ? 'opacity-50' : '')}
            empty={<>Directorio vacío. <button type="button" className="font-medium text-foreground underline" onClick={() => setDrawer({ type: 'contact' })}>Agrega el primero</button> (local, DJ, proveedor de barra, seguridad…).</>}
            toolbar={<>
              <select aria-label="Tipo" className={cn(sel, 'h-8 w-auto text-[13px]')} value={type} onChange={(e) => setType(e.target.value)}><option value="all">Todos</option>{Object.entries(T).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              {scope.brand && <Button size="sm" variant="ghost" onClick={() => setEveryone(!everyone)}>{everyone ? `Sólo los de ${scope.name}` : 'Ver todo el directorio'}</Button>}
            </>}
            columns={[
              { key: 'name', label: 'Nombre', get: (c) => c.name, render: (c) => <span className="font-medium">{c.name}</span> },
              { key: 'type', label: 'Tipo', get: (c) => T[c.type] },
              { key: 'role', label: 'Rol / servicio', get: (c) => c.role },
              { key: 'phone', label: 'Celular', get: (c) => c.phone },
              { key: 'email', label: 'Correo', get: (c) => c.email, hidden: true },
              { key: 'ruc', label: 'RUC / DNI', get: (c) => c.ruc, hidden: true },
              { key: 'rate', label: 'Tarifa', num: true, get: (c) => c.rate, render: (c) => (c.rate == null ? '—' : `${money(c.rate)}${c.rateUnit ? ` / ${c.rateUnit}` : ''}`) },
              { key: 'rating', label: 'Calificación', num: true, get: (c) => c.rating, render: (c) => (c.rating ? '★'.repeat(c.rating) : '—') },
            ]} />
        </Panel>
      )}
      {tab === 'tasks' && <Panel><TaskList id="ops-tasks" tasks={tasks} /></Panel>}
      {scope.brand && tab === 'directory' && !everyone && <p className="text-[12px] text-muted-foreground">Mostrando quienes trabajaron en fechas de {scope.name}. El directorio es compartido entre las marcas.</p>}
    </div>
  );
}

// Pestaña "Producción" del evento: checklist, run of show y staff.
export function EventProduction({ e }) {
  const { data, setDrawer, opsAct } = useOS();
  const tasks = (data.os.tasks || []).filter((t) => t.eventId === e.id);
  const done = tasks.filter((t) => t.status === 'done').length;
  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelBar title={`Checklist de producción · ${done} de ${tasks.length}`} description="Tareas del evento con responsable, fecha límite y dependencias."
          action={<div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => opsAct('ops.task.template', { eventId: e.id }, 'Checklist estándar agregada').catch(() => {})}><ListChecksIcon />Checklist estándar</Button><Button size="sm" variant="outline" onClick={() => setDrawer({ type: 'task', preset: { eventId: e.id } })}><PlusIcon />Tarea</Button></div>} />
        {tasks.length > 0 && <div className="h-1 bg-muted"><div className="h-full bg-good transition-all" style={{ width: `${(done / tasks.length) * 100}%` }} /></div>}
        <TaskList id="ev-tasks" tasks={tasks} showEvent={false} />
      </Panel>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <RunOfShow e={e} />
        <Staff e={e} />
      </div>
    </div>
  );
}

function RunOfShow({ e }) {
  const { data, opsAct } = useOS();
  const saved = (data.ops.runOfShow || {})[e.id] || [];
  const [items, setItems] = useState(saved);
  useEffect(() => { setItems(saved); }, [data.ops.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const set = (i, k) => (ev) => setItems((x) => x.map((y, j) => (j === i ? { ...y, [k]: ev.target.value } : y)));
  return (
    <Panel className="xl:col-span-6">
      <PanelBar title="Run of show" description="La noche, hora por hora. Se ordena solo (pasada la medianoche va al final)."
        action={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setItems((x) => [...x, { time: '', title: '', owner: '', notes: '' }])}><PlusIcon />Línea</Button><Button size="sm" disabled={!dirty} onClick={() => opsAct('ops.ros.set', { eventId: e.id, items: items.filter((i) => i.time || i.title) }, 'Run of show guardado').catch(() => {})}>Guardar</Button></div>} />
      <ul className="divide-y">
        {items.length === 0 && <li className="px-4 py-5 text-[13px] text-muted-foreground">Sin run of show. Ej.: 22:30 staff en posición · 23:00 puertas · 00:30 headliner.</li>}
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 px-4 py-1.5">
            <Input type="time" className="mono h-8 w-24" value={it.time} onChange={set(i, 'time')} aria-label="Hora" />
            <Input className="h-8 flex-1" value={it.title} onChange={set(i, 'title')} placeholder="Qué pasa" aria-label="Qué pasa" />
            <Input className="h-8 w-32" value={it.owner} onChange={set(i, 'owner')} placeholder="Quién" aria-label="Responsable" />
            <Button size="icon-sm" variant="ghost" aria-label="Quitar" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><Trash2Icon /></Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Staff({ e }) {
  const { data, opsAct, setDrawer } = useOS();
  const contacts = (data.ops.contacts || []).filter((c) => !c.archived);
  const saved = (data.ops.staff || {})[e.id] || [];
  const [items, setItems] = useState(saved);
  useEffect(() => { setItems(saved); }, [data.ops.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(items) !== JSON.stringify(saved);
  const set = (i, k, v) => setItems((x) => x.map((y, j) => (j === i ? { ...y, [k]: v } : y)));
  const total = items.reduce((s, i) => s + (Number(i.fee) || 0), 0);
  const committed = (it) => {
    const c = contacts.find((x) => x.id === it.contactId);
    setDrawer({ type: 'tx', preset: { kind: 'cost', eventId: e.id, date: e.date, category: c && c.type === 'artist' ? 'Talento' : 'Personal', description: `${it.role || (c && c.role) || 'Staff'} · ${c ? c.name : ''}`, counterparty: c ? c.name : '', ruc: c ? c.ruc : '', amount: it.fee || '', committed: true } });
  };
  return (
    <Panel className="xl:col-span-6">
      <PanelBar title={`Staff y talento · ${money(total)}`} description="Quién trabaja, a qué hora entra y cuánto se le paga."
        action={<div className="flex gap-1"><Button size="sm" variant="ghost" disabled={!contacts.length} onClick={() => setItems((x) => [...x, { contactId: contacts[0].id, role: contacts[0].role, call: '', fee: contacts[0].rate ?? '', confirmed: false }])}><PlusIcon />Persona</Button><Button size="sm" disabled={!dirty} onClick={() => opsAct('ops.staff.set', { eventId: e.id, items: items.map((i) => ({ ...i, fee: i.fee === '' ? null : i.fee })) }, 'Staff guardado').catch(() => {})}>Guardar</Button></div>} />
      <ul className="divide-y">
        {!contacts.length && <li className="px-4 py-5 text-[13px] text-muted-foreground">Primero agrega personas al directorio (Operaciones → Contacto).</li>}
        {contacts.length > 0 && items.length === 0 && <li className="px-4 py-5 text-[13px] text-muted-foreground">Nadie asignado todavía.</li>}
        {items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 px-4 py-1.5">
            <select aria-label="Persona" className={cn(sel, 'h-8 w-40 text-[12px]')} value={it.contactId} onChange={(ev) => { const c = contacts.find((x) => x.id === ev.target.value) || {}; setItems((x) => x.map((y, j) => (j === i ? { ...y, contactId: c.id, role: c.role || '', fee: c.rate ?? '' } : y))); }}>{contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <Input className="h-8 w-28 text-[12px]" value={it.role} onChange={(ev) => set(i, 'role', ev.target.value)} placeholder="Rol" aria-label="Rol" />
            <Input type="time" className="mono h-8 w-24" value={it.call} onChange={(ev) => set(i, 'call', ev.target.value)} aria-label="Hora de llegada" />
            <Input type="number" min="0" step="0.01" className="mono h-8 w-24 text-right" value={it.fee ?? ''} onChange={(ev) => set(i, 'fee', ev.target.value)} placeholder="S/" aria-label="Pago" />
            <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={!!it.confirmed} onChange={(ev) => set(i, 'confirmed', ev.target.checked)} />confirmado</label>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled={dirty || !it.fee} title={dirty ? 'Guarda primero' : 'Registrar el pago como comprometido en Finanzas'} onClick={() => committed(it)}>→ Finanzas</Button>
            <Button size="icon-sm" variant="ghost" aria-label="Quitar" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}><Trash2Icon /></Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
