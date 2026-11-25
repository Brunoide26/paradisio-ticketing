import React, { useMemo, useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon, Columns3Icon, DownloadIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn, limaISO } from '../lib.js';

const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } };

// Tabla reutilizable de Paradisio OS.
// columns: [{ key, label, get(row) -> valor para ordenar/buscar/CSV, render(row), num, align, hidden, className }]
export default function DataTable({ id, columns, rows, onRowClick, rowClassName, toolbar, empty = 'Sin datos.', footer, pageSize = 25, initialSort, csvName, searchable = true, dense }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  const [hidden, setHiddenState] = useState(() => (id && lsGet('os_cols_' + id)) || columns.filter((c) => c.hidden).map((c) => c.key));
  const setHidden = (h) => { setHiddenState(h); if (id) lsSet('os_cols_' + id, h); };
  const visible = columns.filter((c) => !hidden.includes(c.key));
  const val = (c, r) => (c.get ? c.get(r) : r[c.key]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let out = !t ? rows : rows.filter((r) => columns.some((c) => { const v = val(c, r); return v != null && String(v).toLowerCase().includes(t); }));
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) out = out.slice().sort((a, b) => { const va = val(c, a), vb = val(c, b); if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir; });
    }
    return out;
  }, [rows, q, sort, columns]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const shown = filtered.slice(cur * pageSize, cur * pageSize + pageSize);

  const exportCsv = () => {
    const out = [visible.map((c) => c.label)].concat(filtered.map((r) => visible.map((c) => { const v = val(c, r); return v == null ? '' : v; })));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + out.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
    a.download = `${csvName || id || 'tabla'}-${limaISO()}.csv`; a.click();
  };

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        {searchable && (
          <div className="relative w-full max-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Buscar…" className="h-8 pl-8 text-[13px]" aria-label="Buscar en la tabla" />
          </div>
        )}
        {toolbar}
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 text-[12px] text-muted-foreground">{filtered.length} fila{filtered.length === 1 ? '' : 's'}</span>
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
      <Table className={cn(dense && '[&_td]:py-1.5')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent [&_th]:h-9 [&_th]:text-[12px]">
            {visible.map((c, i) => (
              <TableHead key={c.key} className={cn(i === 0 && 'pl-4', i === visible.length - 1 && 'pr-4', (c.num || c.align === 'right') && 'text-end')}>
                {c.sortable === false ? c.label : (
                  <button type="button" className={cn('inline-flex items-center gap-1 hover:text-foreground', (c.num || c.align === 'right') && 'flex-row-reverse')}
                    onClick={() => setSort((s) => ({ key: c.key, dir: s && s.key === c.key ? -s.dir : c.num ? -1 : 1 }))}>
                    {c.label}{sort && sort.key === c.key && (sort.dir > 0 ? <ArrowUpIcon className="size-3" /> : <ArrowDownIcon className="size-3" />)}
                  </button>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.length === 0 && <TableRow className="hover:bg-transparent"><TableCell colSpan={visible.length} className="px-4 py-8 text-[13px] text-muted-foreground">{rows.length ? 'Nada coincide con la búsqueda.' : empty}</TableCell></TableRow>}
          {shown.map((r, ri) => (
            <TableRow key={r.id || ri} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('text-[13px]', onRowClick && 'cursor-pointer', rowClassName && rowClassName(r))}>
              {visible.map((c, i) => (
                <TableCell key={c.key} className={cn(i === 0 && 'pl-4', i === visible.length - 1 && 'pr-4', (c.num || c.align === 'right') && 'text-end', c.num && 'mono', c.className)}>
                  {c.render ? c.render(r) : val(c, r) ?? '—'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {footer && <TableFooter>{footer(visible)}</TableFooter>}
      </Table>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t px-4 py-2 text-[12px] text-muted-foreground">
          Página {cur + 1} de {pages}
          <Button variant="outline" size="icon-sm" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Anterior"><ChevronLeftIcon /></Button>
          <Button variant="outline" size="icon-sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Siguiente"><ChevronRightIcon /></Button>
        </div>
      )}
    </div>
  );
}
