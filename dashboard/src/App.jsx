import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutDashboardIcon, SlidersHorizontalIcon, RefreshCwIcon, DownloadIcon, KeyRoundIcon, CalendarDaysIcon, ReceiptIcon } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { GroupLogo } from '@/components/app-sidebar';
import { NavUser } from '@/components/nav-user';
import { LatestChange } from '@/components/latest-change';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useKeypress } from '@/hooks/use-keypress';
import Group from './Group.jsx';
import Brand from './Brand.jsx';
import Editor from './Editor.jsx';
import { BrandTile, KindTag } from './ui.jsx';
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
  useKeypress({ combo: ['meta+k', 'ctrl+k'], callback: () => setCmd((v) => !v), enabled: !!data, enableOnInputs: true });

  const go = (p, eventId) => {
    setPage(p); setCmd(false);
    if (eventId && p === 'edit') setEditId(eventId);
    else if (eventId) setSel((s) => ({ ...s, [p]: eventId }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const logout = () => { ss('ceo_pass', null); setData(null); setPass(''); };
  const refresh = () => load(pass, false).catch(() => {});

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

  const navGroups = [
    { label: 'General', items: [{ id: 'group', title: 'Resumen del grupo', icon: <LayoutDashboardIcon /> }] },
    { label: 'Marcas', items: brands.map((b) => ({ id: b.id, title: b.name, icon: <BrandTile id={b.id} size="xs" className="size-4!" /> })) },
    { label: 'Gestión', items: [{ id: 'edit', title: 'Editar datos', icon: <SlidersHorizontalIcon /> }] },
  ];

  const sidebarNote = (
    <>
      {next && (
        <LatestChange onClick={() => go(next.brand, next.id)}
          eyebrow={<><CalendarDaysIcon className="size-3.5" />Próxima fecha · en {daysTo(next.date)} días</>}
          title={<><BrandTile id={next.brand} size="xs" />{next.name}</>}
          description={<span className="capitalize">{fmtDate(next.date)} · {next.venue || 'por confirmar'}</span>} />
      )}
      {data.usingStaffPasscode && (
        <LatestChange tone="warn" title={<><KeyRoundIcon className="size-3.5" />Clave del staff</>} description="Estás con la clave del staff. Crea CEO_PASSCODE en Vercel." />
      )}
    </>
  );

  const headerActions = (
    <>
      <div className="flex items-center gap-2">
        <Switch id="taxes" checked={withTaxes} onCheckedChange={setWithTaxes} />
        <Label htmlFor="taxes" className="hidden text-[13px] font-normal text-muted-foreground sm:inline">{withTaxes ? 'Con impuestos' : 'Sin impuestos'}</Label>
      </div>
      <span className="hidden text-[12px] text-muted-foreground md:inline">Actualizado {updated}</span>
      <Button variant="outline" size="icon-sm" onClick={() => exportCsv(finance, withTaxes)} aria-label="Exportar CSV" title="Exportar CSV"><DownloadIcon /></Button>
      <Button variant="outline" size="icon-sm" onClick={refresh} aria-label="Actualizar" title="Actualizar"><RefreshCwIcon className={cn(loading && 'animate-spin')} /></Button>
    </>
  );

  return (
    <TooltipProvider>
      <AppShell page={page} title={title} navGroups={navGroups} onNavigate={(id) => go(id)} onSearch={() => setCmd(true)}
        headerActions={headerActions} sidebarNote={sidebarNote}
        user={<NavUser staff={data.usingStaffPasscode} onExport={() => exportCsv(finance, withTaxes)} onRefresh={refresh} onEdit={() => go('edit')} onLogout={logout} />}>
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {page === 'group' && <Group finance={finance} withTaxes={withTaxes} go={go} culqi={data.culqi} live={data.live} />}
            {page === 'edit' && draft && <Editor draft={draft} setDraft={setDraft} dirty={dirty} setDirty={setDirty} editId={editId} setEditId={setEditId} withTaxes={withTaxes} seeded={data.seeded}
              saving={saving} onSave={save} onDiscard={() => { setDraft(JSON.parse(JSON.stringify(finance))); setDirty(false); }}
              onReset={async () => { try { await api(pass, { action: 'reset' }); setDirty(false); const d = await api(pass); setData(d); setDraft(JSON.parse(JSON.stringify(d.finance))); flash('Datos de arranque restaurados'); } catch { flash('No se pudo restaurar'); } }} />}
            {page !== 'group' && page !== 'edit' && <Brand brandId={page} finance={finance} live={data.live} culqi={data.culqi} withTaxes={withTaxes} selected={sel[page]} onSelect={(id) => setSel((s) => ({ ...s, [page]: id }))} go={go} />}
          </motion.div>
        </AnimatePresence>
      </AppShell>

      {/* Paleta de comandos ⌘K */}
      <CommandDialog open={cmd} onOpenChange={setCmd} title="Buscar" description="Busca una marca, una fecha o una acción">
        <CommandInput placeholder="Busca una marca, una fecha o una acción…" />
        <CommandList className="scroll-thin">
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Ir a">
            <CommandItem onSelect={() => go('group')}><LayoutDashboardIcon />Resumen del grupo</CommandItem>
            {brands.map((b) => <CommandItem key={b.id} value={`marca ${b.name}`} onSelect={() => go(b.id)}><BrandTile id={b.id} size="xs" />{b.name}</CommandItem>)}
            <CommandItem onSelect={() => go('edit')}><SlidersHorizontalIcon />Editar datos</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Fechas">
            {events.map((e) => (
              <CommandItem key={e.id} value={`${e.name} ${fmtDate(e.date)} ${e.venue || ''} ${e.id}`} onSelect={() => go(e.brand, e.id)}>
                <BrandTile id={e.brand} size="xs" /><span className="flex-1 truncate">{e.name} <span className="text-muted-foreground">· {fmtShort(e.date)}</span></span><KindTag real={isActual(e)} />
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Acciones">
            <CommandItem onSelect={() => { setWithTaxes(!withTaxes); setCmd(false); }}><ReceiptIcon />{withTaxes ? 'Ver sin IGV ni renta' : 'Ver con IGV y renta'}</CommandItem>
            <CommandItem onSelect={() => { exportCsv(finance, withTaxes); setCmd(false); }}><DownloadIcon />Exportar todo a CSV (Excel)</CommandItem>
            <CommandItem onSelect={() => { refresh(); setCmd(false); }}><RefreshCwIcon />Actualizar datos</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} role="status" className="fixed bottom-20 right-6 z-50 rounded-lg border bg-background px-3.5 py-2 text-sm shadow-xl">{toast}</motion.div>}
      </AnimatePresence>
    </TooltipProvider>
  );
}

function Login({ onLogin }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-full bg-muted lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <GroupLogo />
          <p className="text-[14px] font-semibold tracking-tight">Paradisio Entertainment Group</p>
        </div>
        <div className="space-y-3">
          {[['club', 'Paradisio Club'], ['beats', 'Paradisio Beats'], ['icon', 'Icon']].map(([id, name], i) => (
            <motion.div key={id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }} className="flex items-center gap-3">
              <BrandTile id={id} size="md" />
              <span className="text-[15px] font-medium">{name}</span>
            </motion.div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground">Acceso privado</p>
      </div>
      <div className="flex items-start px-6 pt-[14vh] sm:px-16">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <p className="text-[12px] text-muted-foreground lg:hidden">Paradisio Entertainment Group</p>
            <CardTitle className="text-2xl tracking-tight">Entrar</CardTitle>
            <CardDescription>Panel de dirección del grupo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { await onLogin(v.trim()); } catch (x) { setErr(x.message === 'unauthorized' ? 'Clave incorrecta.' : 'No se pudo conectar.'); } finally { setBusy(false); } }}>
              <Label htmlFor="pass" className="sr-only">Clave</Label>
              <Input id="pass" type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Clave" className="h-10" />
              <Button className="mt-3 h-10 w-full" disabled={busy || !v}>{busy ? 'Entrando…' : 'Entrar'}</Button>
              <p className="mt-3 min-h-5 text-sm text-destructive">{err}</p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
