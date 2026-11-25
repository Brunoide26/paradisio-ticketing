import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { LayoutGrid, SlidersHorizontal, RefreshCw, LogOut, ChevronRight, KeyRound } from 'lucide-react';
import Group from './Group.jsx';
import Brand from './Brand.jsx';
import Editor from './Editor.jsx';
import { BrandTile, Toggle, Button } from './ui.jsx';
import { ss, cn } from './lib.js';

async function api(pass, body = {}) {
  const r = await fetch('/api/ceo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pass, ...body }) });
  if (r.status === 401) throw new Error('unauthorized');
  if (!r.ok) throw new Error('server');
  return r.json();
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

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const load = useCallback(async (p = pass, quiet = true) => {
    setLoading(true);
    try {
      const d = await api(p);
      setData(d);
      setDraft((cur) => (dirty && cur ? cur : JSON.parse(JSON.stringify(d.finance))));
      ss('ceo_pass', p);
      if (!quiet) flash('Datos actualizados');
      return true;
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

  const go = (p, eventId) => {
    setPage(p);
    if (eventId && p === 'edit') setEditId(eventId);
    else if (eventId) setSel((s) => ({ ...s, [p]: eventId }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!data) return <Login onLogin={async (p) => { setPass(p); await load(p); }} />;

  const finance = data.finance;
  const brands = finance.brands || [];
  const crumb = page === 'group' ? 'Resumen del grupo' : page === 'edit' ? 'Editar datos' : (brands.find((b) => b.id === page) || {}).name;
  const updated = new Date(data.generatedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  const save = async () => {
    setSaving(true);
    try { await api(pass, { action: 'save', finance: draft }); setData((d) => ({ ...d, finance: JSON.parse(JSON.stringify(draft)), seeded: false })); setDirty(false); flash('Cambios guardados'); }
    catch (e) { flash(e.message === 'server' ? 'Revisa fechas y montos' : 'No se pudo guardar'); }
    finally { setSaving(false); }
  };

  const NavItem = ({ id, icon, label }) => (
    <button onClick={() => go(id)} className={cn('group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors', page === id ? 'bg-line-soft font-medium text-ink' : 'text-ink-2 hover:bg-[#F7F6F3] hover:text-ink')}>
      {icon}<span className="flex-1 truncate">{label}</span>
      {page === id && <motion.span layoutId="nav-dot" className="h-1.5 w-1.5 rounded-full bg-ink" />}
    </button>
  );

  return (
    <div className="flex min-h-full overflow-x-clip">
      {/* Barra lateral */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-line bg-panel lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B0B0B] px-1"><img src="/administracion/logos/paradisio-orange.png" alt="" className="w-full" /></div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold tracking-tight">Paradisio</p>
            <p className="truncate text-[11px] text-muted">Entertainment Group</p>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            <NavItem id="group" icon={<LayoutGrid className="h-4 w-4" />} label="Resumen del grupo" />
          </div>
          <div>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Marcas</p>
            <div className="space-y-0.5">
              {brands.map((b) => <NavItem key={b.id} id={b.id} icon={<BrandTile id={b.id} size="sm" className="h-6 w-6" />} label={b.name} />)}
            </div>
          </div>
          <div>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">Gestión</p>
            <NavItem id="edit" icon={<SlidersHorizontal className="h-4 w-4" />} label="Editar datos" />
          </div>
        </nav>
        <div className="space-y-2 border-t border-line p-3">
          {data.usingStaffPasscode && (
            <div className="flex gap-2 rounded-lg bg-[#FCEEDC] p-2.5 text-[11px] leading-snug text-[#7A420B]"><KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />Entras con la clave del staff. Crea CEO_PASSCODE en Vercel para que sea solo tuya.</div>
          )}
          <button onClick={() => { ss('ceo_pass', null); setData(null); setPass(''); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-ink-2 hover:bg-[#F7F6F3]"><LogOut className="h-4 w-4" />Salir</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
              <span className="hidden truncate text-muted sm:inline">Paradisio Entertainment Group</span>
              <ChevronRight className="hidden h-3.5 w-3.5 text-cost sm:block" />
              <span className="truncate font-medium">{crumb}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Toggle checked={withTaxes} onChange={setWithTaxes} label={<span className="hidden sm:inline">{withTaxes ? 'Con impuestos' : 'Sin impuestos'}</span>} />
              <span className="hidden items-center gap-1.5 text-xs text-muted md:flex"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-good" /></span>Actualizado {updated}</span>
              <Button variant="outline" size="sm" onClick={() => load(pass, false).catch(() => {})} aria-label="Actualizar"><RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /></Button>
            </div>
          </div>
          {/* Navegación en móvil */}
          <div className="scroll-thin flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
            {[['group', 'Grupo'], ...brands.map((b) => [b.id, b.name]), ['edit', 'Editar']].map(([id, l]) => (
              <button key={id} onClick={() => go(id)} className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs', page === id ? 'bg-ink text-white' : 'bg-panel text-ink-2 border border-line')}>{l}</button>
            ))}
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              {page === 'group' && <Group finance={finance} withTaxes={withTaxes} go={go} />}
              {page === 'edit' && draft && <Editor draft={draft} setDraft={setDraft} dirty={dirty} setDirty={setDirty} editId={editId} setEditId={setEditId} withTaxes={withTaxes} seeded={data.seeded}
                saving={saving} onSave={save} onDiscard={() => { setDraft(JSON.parse(JSON.stringify(finance))); setDirty(false); }}
                onReset={async () => { try { await api(pass, { action: 'reset' }); setDirty(false); const d = await api(pass); setData(d); setDraft(JSON.parse(JSON.stringify(d.finance))); flash('Datos de arranque restaurados'); } catch { flash('No se pudo restaurar'); } }} />}
              {page !== 'group' && page !== 'edit' && <Brand brandId={page} finance={finance} live={data.live} withTaxes={withTaxes} selected={sel[page]} onSelect={(id) => setSel((s) => ({ ...s, [page]: id }))} go={go} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {toast && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed bottom-20 right-6 z-50 rounded-lg bg-ink px-3.5 py-2 text-sm text-white shadow-xl">{toast}</motion.div>}
      </AnimatePresence>
    </div>
  );
}

function Login({ onLogin }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-panel p-10 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B0B0B] px-1"><img src="/administracion/logos/paradisio-orange.png" alt="" className="w-full" /></div>
          <p className="text-sm font-semibold tracking-tight">Paradisio Entertainment Group</p>
        </div>
        <div>
          <p className="max-w-md text-[34px] font-semibold leading-[1.05] tracking-tight">Tres marcas, un solo tablero.</p>
          <div className="mt-8 flex gap-3">
            {['club', 'beats', 'icon'].map((id, i) => (
              <motion.div key={id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}><BrandTile id={id} size="lg" className="h-20 w-20" /></motion.div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">Paradisio Club · Paradisio Beats · Icon</p>
      </div>
      <div className="flex items-center px-6 py-12 sm:px-14">
        <form className="w-full max-w-sm" onSubmit={async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { await onLogin(v.trim()); } catch (x) { setErr(x.message === 'unauthorized' ? 'Clave incorrecta.' : 'No se pudo conectar.'); } finally { setBusy(false); } }}>
          <p className="text-xs text-muted lg:hidden">Paradisio Entertainment Group</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-ink-2">Usa tu clave para ver el tablero del grupo.</p>
          <input type="password" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Clave" className="mt-6 h-11 w-full rounded-lg border border-line bg-panel px-3.5 text-sm outline-none focus:border-ink" />
          <Button className="mt-3 h-11 w-full" disabled={busy || !v}>{busy ? 'Entrando…' : 'Entrar'}</Button>
          <p className="mt-3 min-h-5 text-sm text-bad">{err}</p>
        </form>
      </div>
    </div>
  );
}
