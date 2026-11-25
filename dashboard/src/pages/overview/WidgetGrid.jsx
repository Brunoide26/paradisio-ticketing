// Rejilla de widgets personalizable: arrastrar para reordenar, cambiar tamaño, quitar, añadir y presets.
// Interacción basada en shadcn-fintech (MIT, © 2026 Abderrahim Ghazali): dnd-kit con la rejilla CSS
// manejando el diseño (sin transformaciones de dnd-kit) y un "overlay" al arrastrar.
// Las preferencias se guardan sólo en este navegador; no tocan datos del negocio.
import React, { useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'motion/react';
import { GripVerticalIcon, XIcon } from 'lucide-react';
import { spring } from '../../os/motion.jsx';
import { cn } from '../../lib.js';
import { RealTag, ProjTag } from './widgets.jsx';

export const SIZES = [
  { id: 's', label: 'S', cls: 'col-span-12 md:col-span-6 xl:col-span-4' },
  { id: 'm', label: 'M', cls: 'col-span-12 md:col-span-6 xl:col-span-6' },
  { id: 'l', label: 'L', cls: 'col-span-12 xl:col-span-8' },
  { id: 'f', label: 'XL', cls: 'col-span-12' },
];
const sizeCls = (s) => (SIZES.find((x) => x.id === s) || SIZES[1]).cls;
const noStrategy = () => null;

export function WidgetFrame({ def, editing, children, handle, onSize, onRemove, size, dragging }) {
  return (
    <section aria-label={def.title}
      className={cn('flex h-full min-h-[180px] flex-col overflow-hidden rounded-lg border bg-card transition-[box-shadow,opacity] duration-[var(--dur-standard)]',
        def.kind === 'proj' && 'border-dashed border-proj-line',
        editing && 'shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_6%,transparent)]',
        dragging && 'opacity-30')}>
      <header className="flex min-h-11 items-center gap-2 px-4 pb-1.5 pt-3">
        {editing && (
          <button type="button" {...handle} aria-label={`Mover ${def.title}`} className="press -ml-1.5 flex size-6 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing">
            <GripVerticalIcon className="size-3.5" />
          </button>
        )}
        <h3 className="truncate text-[13px] font-medium tracking-tight">{def.title}</h3>
        {def.kind === 'real' && <RealTag />}
        {def.kind === 'proj' && <ProjTag />}
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <div className="flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Tamaño">
                {SIZES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={size === s.id} onClick={() => onSize(s.id)}
                    className={cn('num h-5 min-w-6 rounded px-1 text-[10.5px] transition-colors', size === s.id ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground hover:text-foreground')}>{s.label}</button>
                ))}
              </div>
              <button type="button" onClick={onRemove} aria-label={`Quitar ${def.title}`} className="press flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"><XIcon className="size-3.5" /></button>
            </>
          ) : def.action}
        </div>
      </header>
      <div className={cn('min-h-0 flex-1', editing && 'pointer-events-none select-none')}>{children}</div>
    </section>
  );
}

function Sortable({ item, def, editing, render, onSize, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id, disabled: !editing });
  return (
    <motion.div ref={setNodeRef} layout="position" transition={spring.layout} className={cn(sizeCls(item.size), 'min-w-0')}
      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}>
      <WidgetFrame def={def} editing={editing} size={item.size} dragging={isDragging} handle={{ ...attributes, ...listeners }} onSize={onSize} onRemove={onRemove}>
        {render()}
      </WidgetFrame>
    </motion.div>
  );
}

export default function WidgetGrid({ items, setItems, registry, editing, ctx }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const shown = items.filter((i) => registry[i.id]);
  const active = activeId && registry[activeId];
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)} onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active: a, over }) => {
        setActiveId(null);
        if (!over || a.id === over.id) return;
        const from = items.findIndex((x) => x.id === a.id); const to = items.findIndex((x) => x.id === over.id);
        if (from >= 0 && to >= 0) setItems(arrayMove(items, from, to));
      }}>
      <SortableContext items={shown.map((i) => i.id)} strategy={noStrategy}>
        <div className="grid grid-cols-12 gap-3">
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <Sortable key={item.id} item={item} def={registry[item.id]} editing={editing} render={() => registry[item.id].render(ctx)}
                onSize={(size) => setItems(items.map((x) => (x.id === item.id ? { ...x, size } : x)))}
                onRemove={() => setItems(items.filter((x) => x.id !== item.id))} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {active ? (
          <div className="flex h-11 cursor-grabbing items-center gap-2 rounded-lg border bg-card px-3 text-[13px] font-medium shadow-2xl ring-1 ring-black/5">
            <GripVerticalIcon className="size-3.5 text-muted-foreground" />{active.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
