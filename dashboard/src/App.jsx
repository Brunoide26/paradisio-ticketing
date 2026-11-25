import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import * as Dialog from '@radix-ui/react-dialog';
import { LayoutDashboard, SlidersHorizontal, RefreshCw, LogOut, Search, PanelLeft, Download, KeyRound, CalendarDays, Receipt } from 'lucide-react';
import Group from './Group.jsx';
import Brand from './Brand.jsx';
import Editor from './Editor.jsx';
import { BrandTile, Toggle, Button, KindTag } from './ui.jsx';
import { ss, cn, fmtDate, fmtShort, daysTo, isActual, totals } from './lib.js';

async function api(pass, body = {}) {
  const r = await fetch('/api/ceo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pass, ...body }) });
  if (r.status === 401) throw new Error('unauthorized');
  if (!r.ok) throw new Error('server');
  return r.json();
}

// CSV del estado de resultados de cada fecha (real y presupuesto separados por columna "Tipo").
function exportCsv(finance, withTaxes) {
  const rows = [['Marca', 'Fecha', 'Evento', 'Tipo', 'Línea', 'Concepto', 'Categoría', 'Monto (S/)']];
  const bn = (id) => (finance.brands.find((b) => b.id === id) || {}).name || id;
  finance.events.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => {
    const kind = isActual(e) ? 'Real' : 'Presupuesto';
    (e.income || []).forEach((l) => rows.push([bn(e.brand), e.date, e.name, kind, 'Ingreso', l.label, l.category || '', l.amount]));
    totals(e, withTaxes).costs.forEach((l) => rows.push([bn(e.brand), e.date, e.name, kind, 'Costo', l.label, l.category || '', -l.amount]));
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `paradisio-group-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

export default function App() {
  const [pass, setPass] = useState(ss('ceo_pass') || '');
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState('group');
  const [sel, setSel] = useState({});
  const [editId, setEditId] = useState(null);
  const [withTaxes, setWithTaxes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [cmd, setCmd] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async (p = pass, quiet = true) => {
    setLoading(true);
    try {
      const d = await api(p);
      setData(d);
      setDraft((cur) => (dirty && cur ? cur : JSON.parse(JSON.stringify(d.finance))));
      ss('ceo_pass', p);
      if (!quiet) flash('Datos actualizados');
    } catch (e) {
      if (e.message === 'unauthorized') { ss('ceo_pass', null); setData(null); setPass(''); }
      else flash('No se pudo actualizar');
      throw e;
    } finally { setLoading(false); }
  }, [pass, dirty]);

  useEffect(() => { if (pass && !data) load(pass).catch(() => {}); }, []);
  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => { if (page !== 'edit' && document.visibilityState === 'visible') load(pass).catch(() => {}); }, 60000);
    return () => clearInterval(id);
  }, [data, page, pass, load]);
  useEffect(() => {
    const h = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);
  useEffect(() => {
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((v) => !v); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const go = (p, eventId) => {
    setPage(p); setCmd(false);
    if (eventId && p === 'edit') setEditId(eventId);
    else if (eventId) setSel((s) => ({ ...s, [p]: eventId }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!data) return <Login onLogin={async (p) => { setPass(p); await load(p); }} />;

  const finance = data.finance;
  const brands = finance.brands || [];
  const events = (finance.events || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  const next = events.find((e) => daysTo(e.date) >= 0);
  const title = page === 'group' ? 'Resumen del grupo' : page === 'edit' ? 'Editar datos' : (brands.find((b) => b.id === page) || {}).name;
  const updated = new Date(data.generatedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  const save = async () => {
    setSaving(true);
    try { await api(pass, { action: 'save', finance: draft }); setData((d) => ({ ...d, finance: JSON.parse(JSON.stringify(draft)), seeded: false })); setDirty(false); flash('Cambios guardados'); }
    catch (e) { flash(e.message === 'server' ? 'Revisa fechas y montos' : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const NavItem = ({ id, icon, label }) => (
    <button onClick={() => go(id)} title={collapsed ? label : undefined} className={cn('flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] transition-colors', page === id ? 'bg-[#EFEFED] font-medium text-ink' : 'text-ink-2 hover:bg-[#F3F3F1] hover:text-ink', collapsed && 'justify-center px-0')}>
      {icon}{!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
  const Section = ({ label, children }) => (
    <div>{!collapsed && <p className="px-2 pb-1 text-[12px] text-muted">{label}</p>}<div className="space-y-0.5">{children}</div></div>
  );

  return (
    <div className="flex min-h-full">
      {/* Barra lateral (app-shell) */}
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-200 lg:flex', collapsed ? 'w-[60px]' : 'w-[240px]')}>
        <div className={cn('flex h-[52px] items-center gap-2 px-3', collapsed && 'justify-center px-0')}>
          {!collapsed && (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#0B0B0B] px-[3px]"><img src="/administracion/logos/paradisio-orange.png" alt="" className="w-full" /></div>
              <span className="min-w-0 leading-tight"><span className="block truncate text-[13px] font-semibold tracking-tight">Paradisio</span><span className="block truncate text-[11px] text-muted">Entertainment Group</span></span>
            </div>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="rounded-md p-1.5 text-muted hover:bg-[#EFEFED] hover:text-ink" aria-label="Contraer barra lateral"><PanelLeft className="h-4 w-4" /></button>
        </div>
        <div className="px-2">
          <button onClick={() => setCmd(true)} className={cn('flex h-8 w-full items-center gap-2 rounded-md border border-line bg-white px-2 text-[13px] text-muted hover:border-[#D4D4D0]', collapsed && 'justify-center px-0')}>
            <Search className="h-3.5 w-3.5" />{!collapsed && <><span className="flex-1 text-left">Buscar…</span><kbd className="rounded border border-line bg-[#FAFAF9] px-1 text-[10px]">⌘</kbd><kbd className="rounded border border-line bg-[#FAFAF9] px-1 text-[10px]">K</kbd></>}
          </button>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          <Section label="General"><NavItem id="group" icon={<LayoutDashboard className="h-4 w-4 shrink-0" />} label="Resumen del grupo" /></Section>
          <Section label="Marcas">{brands.map((b) => <NavItem key={b.id} id={b.id} icon={<BrandTile id={b.id} size="xs" />} label={b.name} />)}</Section>
          <Section label="Gestión"><NavItem id="edit" icon={<SlidersHorizontal className="h-4 w-4 shrink-0" />} label="Editar datos" /></Section>
        </nav>
        {!collapsed && next && (
          <button onClick={() => go(next.brand, next.id)} className="mx-2 mb-2 rounded-lg border border-line bg-white p-3 text-left hover:border-[#D4D4D0]">
            <p className="flex items-center gap-1.5 text-[12px] text-muted"><CalendarDays className="h-3.5 w-3.5" />Próxima fecha · en {daysTo(next.date)} días</p>
            <p className="mt-1.5 flex items-center gap-2 text-[13px] font-medium"><BrandTile id={next.brand} size="xs" />{next.name}</p>
            <p className="mt-0.5 text-[12px] capitalize text-muted">{fmtDate(next.date)} · {next.venue || 'por confirmar'}</p>
          </button>
        )}
        {!collapsed && data.usingStaffPasscode && (
          <div className="mx-2 mb-2 flex gap-2 rounded-lg border border-[#F2D9B0] bg-[#FFF8EC] p-2.5 text-[11px] leading-snug text-[#7A4A06]"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />Estás con la clave del staff. Crea CEO_PASSCODE en Vercel.</div>
        )}
        <div className={cn('flex items-center gap-1 border-t border-line p-2', collapsed && 'flex-col')}>
          <button onClick={() => exportCsv(finance, withTaxes)} className="rounded-md p-1.5 text-muted hover:bg-[#EFEFED] hover:text-ink" title="Exportar CSV"><Download className="h-4 w-4" /></button>
          <button onClick={() => { ss('ceo_pass', null); setData(null); setPass(''); }} className="rounded-md p-1.5 text-muted hover:bg-[#EFEFED] hover:text-ink" title="Salir"><LogOut className="h-4 w-4" /></button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
          <div className="flex h-[52px] items-center gap-3 px-4">
            <button onClick={() => setCmd(true)} className="rounded-md p-1.5 text-muted hover:bg-[#F3F3F1] lg:hidden"><Search className="h-4 w-4" /></button>
            <h1 className="flex-1 truncate text-[14px] font-medium lg:text-center">{title}</h1>
            <div className="flex items-center gap-3">
              <Toggle checked={withTaxes} onChange={setWithTaxes} label={<span className="hidden sm:inline">{withTaxes ? 'Con impuestos' : 'Sin impuestos'}</span>} />
              <span className="hidden text-[12px] text-muted md:inline">Actualizado {updated}</span>
              <Button variant="ghost" size="icon" onClick={() => load(pass, false).catch(() => {})} aria-label="Actualizar"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /></Button>
            </div>
          </div>
          <div className="scroll-thin flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {[['group', 'Grupo'], ...brands.map((b) => [b.id, b.name]), ['edit', 'Editar']].map(([id, l]) => (
              <button key={id} onClick={() => go(id)} className={cn('shrink-0 rounded-md border px-2.5 py-1 text-[12px]', page === id ? 'border-ink bg-ink text-white' : 'border-line text-ink-2')}>{l}</button>
            ))}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {page === 'group' && <Group finance={finance} withTaxes={withTaxes} go={go} culqi={data.culqi} live={data.live} />}
              {page === 'edit' && draft && <Editor draft={draft} setDraft={setDraft} dirty={dirty} setDirty={setDirty} editId={editId} setEditId={setEditId} withTaxes={withTaxes} seeded={data.seeded}
                saving={saving} onSave={save} onDiscard={() => { setDraft(JSON.parse(JSON.stringify(finance))); setDirty(false); }}
                onReset={async () => { try { await api(pass, { action: 'reset' }); setDirty(false); const d = await api(pass); setData(d); setDraft(JSON.parse(JSON.stringify(d.finance))); flash('Datos de arranque restaurados'); } catch { flash('No se pudo restaurar'); } }} />}
              {page !== 'group' && page !== 'edit' && <Brand brandId={page} finance={finance} live={data.live} culqi={data.culqi} withTaxes={withTaxes} selected={sel[page]} onSelect={(id) => setSel((s) => ({ ...s, [page]: id }))} go={go} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Paleta de comandos ⌘K */}
      <Dialog.Root open={cmd} onOpenChange={setCmd}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-[18%] z-50 w-[min(560px,calc(100%-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-white shadow-2xl">
            <Dialog.Title className="sr-only">Buscar</Dialog.Title>
            <Command loop>
              <div className="flex items-center gap-2 border-b border-line px-3"><Search className="h-4 w-4 text-muted" /><Command.Input autoFocus placeholder="Busca una marca, una fecha o una acción…" className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" /></div>
              <Command.List className="scroll-thin max-h-[340px] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted">Nada encontrado.</Command.Empty>
                <Command.Group heading="Ir a" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
                  <Item onSelect={() => go('group')} icon={<LayoutDashboard className="h-4 w-4" />}>Resumen del grupo</Item>
                  {brands.map((b) => <Item key={b.id} onSelect={() => go(b.id)} icon={<BrandTile id={b.id} size="xs" />}>{b.name}</Item>)}
                  <Item onSelect={() => go('edit')} icon={<SlidersHorizontal className="h-4 w-4" />}>Editar datos</Item>
                </Command.Group>
                <Command.Group heading="Fechas" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
                  {events.map((e) => <Item key={e.id} value={`${e.name} ${fmtDate(e.date)} ${e.venue}`} onSelect={() => go(e.brand, e.id)} icon={<BrandTile id={e.brand} size="xs" />} right={<KindTag real={isActual(e)} />}>{e.name} <span className="text-muted">· {fmtShort(e.date)}</span></Item>)}
                </Command.Group>
                <Command.Group heading="Acciones" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-muted">
                  <Item onSelect={() => { setWithTaxes(!withTaxes); setCmd(false); }} icon={<Receipt className="h-4 w-4" />}>{withTaxes ? 'Ver sin IGV ni renta' : 'Ver con IGV y renta'}</Item>
                  <Item onSelect={() => { exportCsv(finance, withTaxes); setCmd(false); }} icon={<Download className="h-4 w-4" />}>Exportar todo a CSV (Excel)</Item>
                  <Item onSelect={() => { load(pass, false).catch(() => {}); setCmd(false); }} icon={<RefreshCw className="h-4 w-4" />}>Actualizar datos</Item>
                </Command.Group>
              </Command.List>
            </Command>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-20 right-6 z-50 rounded-lg bg-ink px-3.5 py-2 text-sm text-white shadow-xl">{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

function Item({ children, icon, right, onSelect, value }) {
  return (
    <Command.Item value={value} onSelect={onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] text-ink">
      <span className="flex w-5 justify-center text-muted">{icon}</span><span className="flex-1 truncate">{children}</span>{right}
    </Command.Item>
  );
}

function Login({ onLogin }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between border-r border-line bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0B0B0B] px-[3px]"><img src="/administracion/logos/paradisio-orange.png" alt="" className="w-full" /></div>
          <p className="text-[14px] font-semibold tracking-tight">Paradisio Entertainment Group</p>
        </div>
        <div className="space-y-3">
          {['club', 'beats', 'icon'].map((id, i) => (
            <motion.div key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-center gap-3">
              <BrandTile id={id} size="md" />
              <span className="text-[15px] font-medium">{{ club: 'Paradisio Club', beats: 'Paradisio Beats', icon: 'Icon' }[id]}</span>
            </motion.div>
          ))}
        </div>
        <p className="text-[12px] text-muted">Acceso privado</p>
      </div>
      <div className="flex items-center px-6 py-12 sm:px-16">
        <form className="w-full max-w-sm" onSubmit={async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { await onLogin(v.trim()); } catch (x) { setErr(x.message === 'unauthorized' ? 'Clave incorrecta.' : 'No se pudo conectar.'); } finally { setBusy(false); } }}>
          <p className="text-[12px] text-muted lg:hidden">Paradisio Entertainment Group</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Entrar</h1>
          <input type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Clave" className="mt-6 h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-ink" />
          <Button className="mt-3 h-10 w-full" disabled={busy || !v}>{busy ? 'Entrando…' : 'Entrar'}</Button>
          <p className="mt-3 min-h-5 text-sm text-bad">{err}</p>
        </form>
      </div>
    </div>
  );
}
