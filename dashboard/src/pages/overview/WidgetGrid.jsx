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
import { ProjTag } from './widgets.jsx';

export const SIZES = [
  { id: 's', label: 'S', name: 'Un tercio', cls: 'col-span-12 md:col-span-6 xl:col-span-4' },
  { id: 'm', label: 'M', name: 'Mitad', cls: 'col-span-12 md:col-span-6 xl:col-span-6' },
  { id: 'l', label: 'L', name: 'Dos tercios', cls: 'col-span-12 xl:col-span-8' },
  { id: 'f', label: 'XL', name: 'Ancho completo', cls: 'col-span-12' },
];
const sizeCls = (s) => (SIZES.find((x) => x.id === s) || SIZES[1]).cls;
const noStrategy = () => null;
// Anuncios en español para lectores de pantalla al ordenar con teclado.
const ANNOUNCE = (registry) => {
  const t = (id) => (registry[id] ? registry[id].title : id);
  return {
    onDragStart: ({ active }) => `Tomaste ${t(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${t(active.id)} está sobre ${t(over.id)}.` : `${t(active.id)} no está sobre ningún lugar.`),
    onDragEnd: ({ active, over }) => (over ? `${t(active.id)} quedó en el lugar de ${t(over.id)}.` : `Soltaste ${t(active.id)}.`),
    onDragCancel: ({ active }) => `Cancelado. ${t(active.id)} volvió a su lugar.`,
  };
};

export function WidgetFrame({ def, editing, children, handle, onSize, onRemove, size, dragging, className }) {
  return (
    <section aria-label={def.title}
      className={cn('surface flex h-full min-h-[160px] flex-col overflow-hidden transition-[opacity,outline-color] duration-[var(--dur-standard)]',
        editing && 'outline-1 outline-offset-2 outline-dashed outline-hairline',
        dragging && 'opacity-30', className)}>
      <header className="flex min-h-12 items-center gap-2 px-4 pb-2 pt-3">
        <AnimatePresence initial={false}>
          {editing && (
            <motion.button type="button" {...handle} aria-label={`Mover ${def.title}. Espacio para tomar, flechas para mover`}
              initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 24 }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="press -ml-1.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing">
              <GripVerticalIcon className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
        <h2 className="truncate text-[14px] font-medium tracking-[-0.01em]">{def.title}</h2>
        {def.kind === 'proj' && !editing && <ProjTag className="hidden sm:inline-flex" />}
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <div className="flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label={`Tamaño de ${def.title}`}>
                {SIZES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={size === s.id} aria-label={s.name} title={s.name} onClick={() => onSize(s.id)}
                    className={cn('num h-6 min-w-7 rounded px-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring', size === s.id ? 'bg-panel font-medium shadow-[0_0_0_1px_var(--panel-border)]' : 'text-muted-foreground hover:text-foreground')}>{s.label}</button>
                ))}
              </div>
              <button type="button" onClick={onRemove} aria-label={`Quitar ${def.title}`} className="press flex size-7 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><XIcon className="size-3.5" /></button>
            </>
          ) : def.action}
        </div>
      </header>
      <div className={cn('min-h-0 flex-1', editing && 'pointer-events-none select-none opacity-70')} inert={editing || undefined}>{children}</div>
    </section>
  );
}

function Sortable({ item, def, editing, render, onSize, onRemove, className }) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({ id: item.id, disabled: !editing });
  return (
    <motion.div ref={setNodeRef} layout="position" transition={spring.layout} className={cn(sizeCls(item.size), 'min-w-0', className)}
      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.15 } }}>
      <WidgetFrame def={def} editing={editing} size={item.size} dragging={isDragging} handle={{ ...attributes, ...listeners }} onSize={onSize} onRemove={onRemove}>
        {render()}
      </WidgetFrame>
    </motion.div>
  );
}

export default function WidgetGrid({ items, setItems, registry, editing, ctx, onRemove, hideOnMobile }) {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const shown = items.filter((i) => registry[i.id]);
  const active = activeId && registry[activeId];
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} accessibility={{ announcements: ANNOUNCE(registry), screenReaderInstructions: { draggable: 'Para mover un widget, presiona Espacio o Enter. Usa las flechas para moverlo y Espacio otra vez para soltarlo, o Escape para cancelar.' } }}
      onDragStart={(e) => setActiveId(e.active.id)} onDragCancel={() => setActiveId(null)}
      onDragEnd={({ active: a, over }) => {
        setActiveId(null);
        if (!over || a.id === over.id) return;
        const from = items.findIndex((x) => x.id === a.id); const to = items.findIndex((x) => x.id === over.id);
        if (from >= 0 && to >= 0) setItems(arrayMove(items, from, to));
      }}>
      <SortableContext items={shown.map((i) => i.id)} strategy={noStrategy}>
        <div className="grid grid-flow-row-dense grid-cols-12 items-start gap-4">
          <AnimatePresence initial={false}>
            {shown.map((item) => (
              <Sortable key={item.id} item={item} def={registry[item.id]} editing={editing} render={() => registry[item.id].render(ctx)}
                className={hideOnMobile && hideOnMobile.includes(item.id) && !editing ? 'hidden md:block' : undefined}
                onSize={(size) => setItems(items.map((x) => (x.id === item.id ? { ...x, size } : x)))}
                onRemove={() => onRemove(item, items.indexOf(item))} />
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {active ? (
          <div className="float-shadow flex h-11 cursor-grabbing items-center gap-2 rounded-lg border border-panel-border bg-popover px-3 text-[13px] font-medium">
            <GripVerticalIcon className="size-3.5 text-muted-foreground" />{active.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
