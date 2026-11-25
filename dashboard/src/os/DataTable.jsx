import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, Columns3Icon, DownloadIcon, SearchIcon, ListFilterIcon, MoreHorizontalIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { t as tr } from './motion.jsx';
import { cn, limaISO } from '../lib.js';

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

// Tabla reutilizable de Paradisio OS.
// columns: [{ key, label, get(row) -> valor para ordenar/buscar/CSV, render(row), num, align, hidden, facet, className }]
// Opcional: expand(row) -> detalle en la fila; rowActions(row) -> [{ label, onSelect, destructive }];
// bulkActions -> [{ label, run(rows), destructive }] (activa la selección múltiple).
// Encabezado fijo al hacer scroll, filtros por columna (facet), columnas visibles recordadas, CSV y teclado (↑ ↓ Enter Espacio).
export default function DataTable({ id, columns, rows, onRowClick, rowClassName, toolbar, empty = 'Sin datos.', footer, pageSize = 25, initialSort, csvName, searchable = true, dense, expand, rowActions, bulkActions, maxHeight = 'min(72vh, 760px)' }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  const [facets, setFacets] = useState({});
  const [open, setOpen] = useState(() => new Set());
  const [picked, setPicked] = useState(() => new Set());
  const [hidden, setHiddenState] = useState(() => (id && lsGet('os_cols_' + id)) || columns.filter((c) => c.hidden).map((c) => c.key));
  const bodyRef = useRef(null);
  const setHidden = (h) => { setHiddenState(h); if (id) lsSet('os_cols_' + id, h); };
  const visible = columns.filter((c) => !hidden.includes(c.key));
  const val = (c, r) => (c.get ? c.get(r) : r[c.key]);
  const rowId = (r, i) => r.id ?? i;
  const facetCols = columns.filter((c) => c.facet);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let out = !t ? rows : rows.filter((r) => columns.some((c) => { const v = val(c, r); return v != null && String(v).toLowerCase().includes(t); }));
    Object.entries(facets).forEach(([k, set]) => { if (!set || !set.length) return; const c = columns.find((x) => x.key === k); if (c) out = out.filter((r) => set.includes(String(val(c, r) ?? '—'))); });
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) out = out.slice().sort((a, b) => { const va = val(c, a), vb = val(c, b); if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir; });
    }
    return out;
  }, [rows, q, sort, columns, facets]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * pageSize, cur * pageSize + pageSize);
  const selRows = filtered.filter((r, i) => picked.has(rowId(r, i)));
  const allPicked = shown.length > 0 && shown.every((r, i) => picked.has(rowId(r, cur * pageSize + i)));
  const cols = visible.length + (bulkActions ? 1 : 0) + (rowActions || expand ? 1 : 0);
  const activeFacets = Object.values(facets).filter((v) => v && v.length).length;

  const exportCsv = () => {
    const src = selRows.length ? selRows : filtered;
    const out = [visible.map((c) => c.label)].concat(src.map((r) => visible.map((c) => { const v = val(c, r); return v == null ? '' : v; })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${csvName || id || 'tabla'}-${limaISO()}.csv`; a.click();
  };
  const toggle = (set, setter, k) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); setter(n); };
  const activate = (r, k) => { if (expand) toggle(open, setOpen, k); else if (onRowClick) onRowClick(r); };
  const onKey = (e, r, k) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rowsEls = [...bodyRef.current.querySelectorAll('tr[data-row]')];
      const i = rowsEls.indexOf(e.currentTarget);
      rowsEls[Math.max(0, Math.min(rowsEls.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    } else if (e.key === 'Enter') { e.preventDefault(); if (onRowClick && expand && !e.shiftKey) onRowClick(r); else activate(r, k); }
    else if (e.key === ' ' && bulkActions) { e.preventDefault(); toggle(picked, setPicked, k); }
  };
  const right = (c) => c.num || c.align === 'right';

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
        <AnimatePresence mode="wait" initial={false}>
          {selRows.length > 0 ? (
            <motion.div key="bulk" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 3 }} transition={tr.micro} className="flex flex-wrap items-center gap-2">
              <span className="num text-[12.5px] font-medium">{selRows.length} seleccionada{selRows.length === 1 ? '' : 's'}</span>
              {bulkActions.map((b) => (
                <Button key={b.label} size="sm" variant="outline" className={cn('h-7', b.destructive && 'text-bad hover:text-bad')} onClick={async () => { await b.run(selRows); setPicked(new Set()); }}>{b.label}</Button>
              ))}
              <Button size="sm" variant="ghost" className="h-7" onClick={exportCsv}><DownloadIcon />CSV</Button>
              <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={() => setPicked(new Set())}><XIcon />Quitar selección</Button>
            </motion.div>
          ) : (
            <motion.div key="tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tr.micro} className="flex flex-1 flex-wrap items-center gap-2">
              {searchable && (
                <div className="relative w-full max-w-[240px]">
                  <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar…" className="h-8 pl-8 text-[13px]" aria-label="Buscar en la tabla" />
                </div>
              )}
              {facetCols.map((c) => {
                const opts = [...new Set(rows.map((r) => String(val(c, r) ?? '—')))].sort();
                const on = facets[c.key] || [];
                return (
                  <DropdownMenu key={c.key}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 gap-1.5 border-dashed font-normal', on.length && 'border-solid')}>
                        <ListFilterIcon className="text-muted-foreground" />{c.label}{on.length > 0 && <span className="num rounded bg-muted px-1 text-[11px]">{on.length}</span>}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-72 w-56">
                      {opts.map((o) => (
                        <DropdownMenuCheckboxItem key={o} checked={on.includes(o)} onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(v) => { setFacets({ ...facets, [c.key]: v ? [...on, o] : on.filter((x) => x !== o) }); setPage(0); }}>{o}</DropdownMenuCheckboxItem>
                      ))}
                      {on.length > 0 && <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setFacets({ ...facets, [c.key]: [] })}>Quitar filtro</DropdownMenuItem></>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
              {activeFacets > 0 && <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setFacets({})}><XIcon />Limpiar</Button>}
              {toolbar}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="ml-auto flex items-center gap-0.5">
          <span className="num mr-1.5 text-[12px] text-muted-foreground">{filtered.length} fila{filtered.length === 1 ? '' : 's'}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Columnas visibles" title="Columnas"><Columns3Icon /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">Columnas visibles</DropdownMenuLabel>
              {columns.map((c) => (
                <DropdownMenuCheckboxItem key={c.key} checked={!hidden.includes(c.key)} onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) => setHidden(on ? hidden.filter((k) => k !== c.key) : [...hidden, c.key])}>{c.label}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon-sm" onClick={exportCsv} aria-label="Exportar CSV" title="Exportar CSV"><DownloadIcon /></Button>
        </div>
      </div>
      <div className="scroll-thin relative w-full overflow-auto" style={{ maxHeight }}>
        <table className="w-full caption-bottom text-[13px]">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--divider)]">
            <tr className="[&>th]:h-9 [&>th]:whitespace-nowrap [&>th]:px-2 [&>th]:text-left [&>th]:align-middle [&>th]:text-[11.5px] [&>th]:font-normal [&>th]:text-muted-foreground">
              {bulkActions && (
                <th className="w-9 pl-4!"><Check checked={allPicked} label="Seleccionar página" onChange={() => { const n = new Set(picked); shown.forEach((r, i) => { const k = rowId(r, cur * pageSize + i); allPicked ? n.delete(k) : n.add(k); }); setPicked(n); }} /></th>
              )}
              {visible.map((c, i) => (
                <th key={c.key} className={cn(i === 0 && !bulkActions && 'pl-4!', i === visible.length - 1 && !(rowActions || expand) && 'pr-4!', right(c) && 'text-end!')}
                  aria-sort={sort && sort.key === c.key ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
                  {c.sortable === false ? c.label : (
                    <button type="button" className={cn('inline-flex items-center gap-1 transition-colors hover:text-foreground', right(c) && 'flex-row-reverse', sort && sort.key === c.key && 'text-foreground')}
                      onClick={() => setSort((s) => ({ key: c.key, dir: s && s.key === c.key ? -s.dir : c.num ? -1 : 1 }))}>
                      {c.label}{sort && sort.key === c.key && (sort.dir > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                    </button>
                  )}
                </th>
              ))}
              {(rowActions || expand) && <th className="w-10 pr-3!" />}
            </tr>
          </thead>
          <tbody ref={bodyRef}>
            {shown.length === 0 && <tr><td colSpan={cols} className="px-4 py-10 text-[13px] text-muted-foreground">{rows.length ? 'Nada coincide con la búsqueda o los filtros.' : empty}</td></tr>}
            {shown.map((r, ri) => {
              const k = rowId(r, cur * pageSize + ri);
              const isOpen = open.has(k), isPicked = picked.has(k);
              const actions = rowActions ? rowActions(r) || [] : [];
              return (
                <React.Fragment key={k}>
                  <tr data-row tabIndex={onRowClick || expand ? 0 : -1} onKeyDown={(e) => onKey(e, r, k)} onClick={(e) => { if (e.target.closest('button,a,input,[role=menuitem]')) return; activate(r, k); }}
                    aria-expanded={expand ? isOpen : undefined} aria-selected={bulkActions ? isPicked : undefined}
                    className={cn('border-b border-divider outline-none transition-colors hover:bg-muted/45 focus-visible:bg-muted/60 focus-visible:shadow-[inset_2px_0_0_var(--foreground)]', (onRowClick || expand) && 'cursor-pointer', isPicked && 'bg-muted/60', isOpen && 'bg-muted/35', rowClassName && rowClassName(r))}>
                    {bulkActions && <td className="w-9 py-2 pl-4"><Check checked={isPicked} label="Seleccionar fila" onChange={() => toggle(picked, setPicked, k)} /></td>}
                    {visible.map((c, i) => (
                      <td key={c.key} className={cn('px-2 align-middle', dense ? 'py-1.5' : 'py-2.5', i === 0 && !bulkActions && 'pl-4', i === visible.length - 1 && !(rowActions || expand) && 'pr-4', right(c) && 'text-end', c.num && 'num', c.className)}>
                        {c.render ? c.render(r) : val(c, r) ?? '—'}
                      </td>
                    ))}
                    {(rowActions || expand) && (
                      <td className="w-10 pr-3 text-right">
                        {actions.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><button type="button" aria-label="Acciones" className="press inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontalIcon className="size-4" /></button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {expand && <DropdownMenuItem onSelect={() => toggle(open, setOpen, k)}>{isOpen ? 'Ocultar detalle' : 'Ver detalle'}</DropdownMenuItem>}
                              {actions.map((a, ai) => a === '-' ? <DropdownMenuSeparator key={ai} /> : <DropdownMenuItem key={a.label} variant={a.destructive ? 'destructive' : undefined} onSelect={a.onSelect}>{a.label}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : expand ? <ChevronRightIcon className={cn('ml-auto size-4 text-muted-foreground transition-transform duration-[var(--dur-standard)]', isOpen && 'rotate-90')} /> : null}
                      </td>
                    )}
                  </tr>
                  {expand && (
                    <tr className="border-0">
                      <td colSpan={cols} className="p-0">
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={tr.layout} className="overflow-hidden border-b border-divider bg-surface">
                              <div className="px-4 py-3">{expand(r)}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {footer && <tfoot className="sticky bottom-0 bg-surface font-medium shadow-[0_-1px_0_var(--border)] [&_td]:py-2.5 [&_td]:text-[13px]">{footer(visible)}</tfoot>}
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-divider px-4 py-2 text-[12px] text-muted-foreground">
          <span className="num">Página {cur + 1} de {pages}</span>
          <Button variant="outline" size="icon-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Siguiente"><ChevronRightIcon /></Button>
        </div>
      )}
    </div>
  );
}

function Check({ checked, onChange, label }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={cn('press flex size-4 items-center justify-center rounded-[4px] border transition-colors', checked ? 'border-foreground bg-foreground text-background' : 'border-input bg-background hover:border-ring')}>
      {checked && <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="M2.5 6.2 5 8.5 9.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}
