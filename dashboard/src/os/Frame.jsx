// Marco del OS ("inset", con Dashral Inset y Linear como referencia):
// barra lateral y cabecera sobre el fondo del shell, la página en un panel redondeado con su propio scroll.
import React, { Fragment, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  PanelLeftCloseIcon, PanelLeftOpenIcon, ChevronRightIcon, SearchIcon, MenuIcon, BellIcon, ChevronsUpDownIcon,
  MoonIcon, SunIcon, DownloadIcon, RefreshCwIcon, SlidersHorizontalIcon, LogOutIcon, ReceiptIcon, ArrowUpRightIcon, SparklesIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { THEMES } from './store.jsx';
import { useKeypress } from '@/hooks/use-keypress';
import { useIndicator, Indicator, spring, t } from './motion.jsx';
import { BrandTile } from '../ui.jsx';
import { cn, brandColor } from '../lib.js';

export function GroupLogo({ className }) {
  return (
    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-md bg-[#0B0B0B] px-[3px] ring-1 ring-black/5 dark:ring-white/10', className)}>
      <img alt="" width="22" height="9" className="w-full" src="/administracion/logos/paradisio-orange.png" />
    </span>
  );
}

const lsGet = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

function isActive(item, pathname) {
  const paths = [item.to, ...(item.match || [])];
  return paths.some((p) => (item.end || p === '/' ? pathname === p : pathname === p || pathname.startsWith(p + '/')));
}

// ---------- Barra lateral ----------
function NavItem({ item, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const active = isActive(item, pathname);
  const link = (
    <NavLink to={item.to} end={item.end} onClick={onNavigate} aria-current={active ? 'page' : undefined} data-current={active || undefined}
      className={cn('press relative z-10 flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        '[&>svg]:size-4 [&>svg]:shrink-0',
        active ? 'font-medium text-foreground [&>svg]:text-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/70 hover:text-foreground [&>svg]:text-muted-foreground',
        'collapsed:mx-auto collapsed:size-8 collapsed:justify-center collapsed:px-0')}>
      {item.icon}
      <span className="flex-1 truncate collapsed:sr-only">{item.title}</span>
      {item.badge != null && (
        <span className={cn('num rounded px-1 text-[11px] text-muted-foreground collapsed:absolute collapsed:right-1 collapsed:top-1 collapsed:size-1.5 collapsed:rounded-full collapsed:bg-bad collapsed:p-0 collapsed:text-[0px]', item.badgeTone === 'bad' && 'text-bad')}>{item.badge}</span>
      )}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>{item.title}{item.badge != null && <span className="ml-1.5 opacity-60">{item.badge}</span>}</TooltipContent>
    </Tooltip>
  );
}

function NavGroup({ group, collapsed, onNavigate }) {
  const { pathname } = useLocation();
  const inside = group.items.some((i) => isActive(i, pathname));
  const key = `os_navgroup_${group.label}`;
  const [open, setOpen] = useState(() => !group.collapsible || inside || lsGet(key, '1') === '1');
  const listId = useId();
  useEffect(() => { if (inside) setOpen(true); }, [inside]);
  const toggle = () => { const n = !open; setOpen(n); lsSet(key, n ? '1' : '0'); };
  const shown = open || collapsed || !group.collapsible;
  return (
    <div>
      {group.collapsible ? (
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls={listId}
          className="group/label mb-0.5 flex h-7 w-full items-center gap-1 rounded-md px-2.5 text-[12px] text-faint transition-colors hover:text-foreground collapsed:hidden">
          {group.label}
          <ChevronRightIcon className={cn('size-3 transition-transform duration-[var(--dur-standard)] ease-[var(--ease-standard)]', open && 'rotate-90')} aria-hidden />
        </button>
      ) : <p className="mb-0.5 flex h-7 items-center px-2.5 text-[12px] text-faint collapsed:hidden">{group.label}</p>}
      <div aria-hidden className="mx-2 mb-2 hidden h-px bg-sidebar-border collapsed:block" />
      <div className="grid transition-[grid-template-rows] duration-[var(--dur-layout)] ease-[var(--ease-standard)] motion-reduce:transition-none" style={{ gridTemplateRows: shown ? '1fr' : '0fr' }} inert={!shown}>
        <ul id={listId} className="-m-[3px] min-h-0 space-y-px overflow-hidden p-[3px]">
          {group.items.map((item) => <li key={item.to + item.title}><NavItem item={item} collapsed={collapsed} onNavigate={onNavigate} /></li>)}
        </ul>
      </div>
    </div>
  );
}

function SidebarBody({ groups, collapsed, onToggle, onNavigate, note, account }) {
  const [navRef, rect] = useIndicator('[data-current]', [collapsed]);
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 pl-3.5 pr-2 collapsed:justify-center collapsed:px-0">
        <Link to="/" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring collapsed:hidden">
          <GroupLogo />
          <span className="min-w-0 leading-none">
            <span className="block truncate text-[13px] font-semibold tracking-tight">Paradisio OS</span>
            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Entertainment Group</span>
          </span>
        </Link>
        {onToggle && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={onToggle} aria-label="Minimizar barra lateral" className="press ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground collapsed:hidden"><PanelLeftCloseIcon className="size-4" /></button>
              </TooltipTrigger>
              <TooltipContent side="right">Minimizar <kbd className="ml-1 opacity-60">⌘B</kbd></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={onToggle} aria-label="Expandir barra lateral" className="group/exp relative hidden size-8 items-center justify-center rounded-md hover:bg-sidebar-accent collapsed:flex">
                  <GroupLogo className="transition-opacity group-hover/exp:opacity-0" />
                  <PanelLeftOpenIcon className="absolute size-4 opacity-0 transition-opacity group-hover/exp:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir <kbd className="ml-1 opacity-60">⌘B</kbd></TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
      <nav ref={navRef} aria-label="Navegación" className="scroll-thin relative flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-2 pb-3 pt-1 collapsed:space-y-1">
        <Indicator rect={rect} className="z-0 rounded-md bg-panel shadow-[0_0_0_1px_var(--panel-border)]" />
        {groups.map((g) => <NavGroup key={g.label} group={g} collapsed={collapsed} onNavigate={onNavigate} />)}
      </nav>
      <div className="shrink-0 space-y-1.5 p-2">
        <div className="collapsed:hidden">{note}</div>
        {account}
      </div>
    </div>
  );
}

// ---------- Selector global de marca (segmentado, con indicador que se desliza) ----------
export function BrandSwitch({ value, onChange, brands, counts, className }) {
  const opts = [{ id: 'group', name: 'Grupo', full: 'Todo el grupo' }, ...brands.map((b) => ({ id: b.id, name: b.name.replace(/^Paradisio\s+/i, ''), full: b.name }))];
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div role="tablist" aria-label="Marca" className={cn('relative flex h-10 items-center md:h-8 gap-0.5 rounded-lg bg-muted p-0.5', className)}>
        {opts.map((o) => {
          const on = value === o.id;
          return (
            <button key={o.id} type="button" role="tab" aria-selected={on} title={o.full} onClick={() => onChange(o.id)}
              className={cn('press relative flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] md:h-7 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                on ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {on && <motion.span layoutId="brand-pill" transition={spring.indicator} className="absolute inset-0 rounded-md bg-panel shadow-[0_0_0_1px_var(--panel-border)]" />}
              <span className="relative flex items-center gap-1.5">
                {o.id === 'group'
                  ? <span className="grid size-2 grid-cols-2 gap-px" aria-hidden>{['club', 'beats', 'icon'].map((b) => <i key={b} className="rounded-[1px]" style={{ background: on ? brandColor(b) : 'currentColor', opacity: on ? 1 : 0.5 }} />)}<i className="rounded-[1px] bg-current opacity-30" /></span>
                  : <i className="size-2 rounded-full transition-opacity" style={{ background: brandColor(o.id), opacity: on ? 1 : 0.55 }} aria-hidden />}
                {o.name}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

// ---------- Centro de notificaciones ----------
export function Notifications({ items, onOpen, onAction, onSeeAll }) {
  const high = items.filter((a) => a.level === 'high').length;
  const [tab, setTab] = useState('all');
  const list = tab === 'high' ? items.filter((a) => a.level === 'high') : items;
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Atención (${items.length})`} className="press relative flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
              <BellIcon className="size-4" />
              <AnimatePresence>
                {items.length > 0 && (
                  <motion.span key={items.length} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.indicator}
                    className={cn('num absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold text-background ring-2 ring-shell', high ? 'bg-bad' : 'bg-foreground/60')}>{items.length}</motion.span>
                )}
              </AnimatePresence>
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Requiere atención</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-[380px] overflow-hidden p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <p className="text-[13px] font-medium">Atención</p>
          <div className="ml-auto flex rounded-md bg-muted p-0.5 text-[12px]">
            {[['all', `Todo · ${items.length}`], ['high', `Urgente · ${high}`]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn('rounded px-2 py-0.5 transition-colors', tab === k ? 'bg-background font-medium shadow-xs' : 'text-muted-foreground')}>{l}</button>
            ))}
          </div>
        </div>
        <ul className="scroll-thin max-h-[380px] overflow-y-auto">
          {list.length === 0 && <li className="px-3 py-8 text-center text-[13px] text-muted-foreground">Todo en orden.</li>}
          <AnimatePresence initial={false}>
            {list.map((a, i) => (
              <motion.li key={a.title + (a.event || '') + i} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={t.standard} className="group border-b border-divider last:border-0">
                <div className="flex gap-2.5 px-3 py-2.5">
                  <span className={cn('mt-[5px] size-1.5 shrink-0 rounded-full', a.level === 'high' ? 'bg-bad' : a.level === 'med' ? 'border border-foreground' : 'bg-faint')} />
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onOpen(a)} className="block text-left text-[13px] font-medium hover:underline">{a.title}</button>
                    <p className="text-[12px] leading-snug text-muted-foreground">{a.text}</p>
                    {onAction && a.event && (
                      <div className="mt-1 flex gap-3">
                        <button type="button" onClick={() => onOpen(a)} className="text-[12px] font-medium underline-offset-4 hover:underline">Revisar</button>
                        <button type="button" onClick={() => onAction(a)} className="text-[12px] font-medium underline-offset-4 hover:underline">Editar números</button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <button type="button" onClick={onSeeAll} className="flex w-full items-center justify-center gap-1 border-t py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground">Abrir bandeja de atención<ArrowUpRightIcon className="size-3.5" /></button>
      </PopoverContent>
    </Popover>
  );
}


// ---------- Tema ----------
const THEME_ICON = { light: SunIcon, midnight: MoonIcon, atmosphere: SparklesIcon };
function ThemeSwatch({ id }) {
  const bg = { light: 'linear-gradient(135deg,#fff 50%,#E8E8E5 50%)', midnight: 'linear-gradient(135deg,#0A0A0A 50%,#2A2A2A 50%)', atmosphere: 'radial-gradient(circle at 25% 20%,#2C8A72,#0B2A26 70%)' }[id];
  return <i aria-hidden className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10 dark:ring-white/15" style={{ background: bg }} />;
}
export function ThemeMenu({ theme, onTheme }) {
  const Icon = THEME_ICON[theme] || SunIcon;
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Tema: ${(THEMES.find((x) => x.id === theme) || {}).label}`} className="press flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={theme} initial={{ opacity: 0, rotate: -40, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 40, scale: 0.7 }} transition={t.standard} className="flex"><Icon className="size-4" /></motion.span>
              </AnimatePresence>
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Tema <kbd className="ml-1 opacity-70">⇧D</kbd></TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" sideOffset={6} className="w-48">
        <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={onTheme}>
          {THEMES.map((x) => <DropdownMenuRadioItem key={x.id} value={x.id}><ThemeSwatch id={x.id} />{x.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Fuentes de datos y su última sincronización ----------
const ago = (iso) => {
  if (!iso) return null;
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'hace un momento';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
export function SyncSources({ generatedAt, integrations, loading, onRefresh, onOpen }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(i); }, []);
  const bad = integrations.some((i) => i.status === 'error');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Datos ${loading ? 'sincronizando' : `actualizados ${ago(generatedAt)}`}. Ver fuentes`}
          className="press flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          <span className={cn('size-1.5 rounded-full', loading ? 'animate-pulse bg-warn' : bad ? 'bg-bad' : 'bg-good')} />
          <span className="hidden xl:inline">{loading ? 'Sincronizando…' : ago(generatedAt)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">Fuentes de datos</p>
            <p className="text-[12px] text-muted-foreground">Cálculos del OS {ago(generatedAt)}</p>
          </div>
          <button type="button" onClick={onRefresh} className="press flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] hover:bg-accent"><RefreshCwIcon className={cn('size-3.5', loading && 'animate-spin')} />Actualizar</button>
        </div>
        <ul className="max-h-[320px] overflow-y-auto py-1">
          {integrations.map((i) => (
            <li key={i.id} className="flex items-start gap-2.5 px-3 py-1.5">
              <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', i.status === 'ok' ? 'bg-good' : i.status === 'error' ? 'bg-bad' : i.status === 'warn' ? 'bg-warn' : 'bg-faint')} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{i.name}</span>
                <span className="block text-[12px] text-muted-foreground">{i.lastSync ? `Sincronizado ${ago(i.lastSync)}` : i.kind === 'manual' ? 'Carga manual después de cada fecha' : i.status === 'warn' ? 'Requiere revisión' : 'Activo'}</span>
              </span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onOpen} className="flex w-full items-center justify-center gap-1 border-t py-2 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground">Ver integraciones<ArrowUpRightIcon className="size-3.5" /></button>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Cuenta ----------
export function AccountMenu({ collapsed, staff, theme, onTheme, withTaxes, onTaxes, onExport, onRefresh, onEdit, onLogout }) {
  const trigger = (
    <button type="button" className="press flex h-9 w-full items-center gap-2.5 rounded-md px-1.5 text-left outline-none hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-accent collapsed:mx-auto collapsed:w-9 collapsed:justify-center collapsed:px-0">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">PE</span>
      <span className="min-w-0 flex-1 leading-none collapsed:hidden">
        <span className="block truncate text-[13px] font-medium">Dirección</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{staff ? 'Con clave del staff' : 'Acceso de administración'}</span>
      </span>
      <ChevronsUpDownIcon className="size-3.5 text-muted-foreground collapsed:hidden" />
    </button>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'top'} align="start" sideOffset={6} className="w-60">
        <DropdownMenuLabel className="font-normal"><span className="block text-[13px] font-medium">Paradisio Entertainment Group</span><span className="text-[11px] text-muted-foreground">{staff ? 'Entraste con la clave del staff' : 'Acceso de administración'}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center justify-between text-[12px] font-normal text-muted-foreground">Tema<kbd className="text-[11px]">⇧D</kbd></DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={onTheme}>
          {THEMES.map((x) => <DropdownMenuRadioItem key={x.id} value={x.id} onSelect={(e) => e.preventDefault()}><ThemeSwatch id={x.id} />{x.label}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={withTaxes} onCheckedChange={onTaxes} onSelect={(e) => e.preventDefault()}><ReceiptIcon className="mr-0" />Incluir IGV y renta</DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onExport}><DownloadIcon />Exportar CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={onRefresh}><RefreshCwIcon />Actualizar datos</DropdownMenuItem>
        <DropdownMenuItem onSelect={onEdit}><SlidersHorizontalIcon />Editar datos de eventos</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onLogout}><LogOutIcon />Salir</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Próximo evento, compacto, al pie de la barra lateral.
export function NextEventNote({ ev, dayLabel, rel, onOpen }) {
  if (!ev) return null;
  return (
    <button type="button" onClick={onOpen} className="press group flex w-full items-center gap-2.5 rounded-md border border-sidebar-border px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent">
      <span className="flex w-8 shrink-0 flex-col items-center leading-none">
        <span className="text-[11px] text-muted-foreground">{dayLabel.split(' ')[0]}</span>
        <span className="num text-[14px] font-semibold">{dayLabel.split(' ')[1]}</span>
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><i className="size-1.5 rounded-full" style={{ background: brandColor(ev.brand) }} />Próxima fecha, {rel}</span>
        <span className="block truncate text-[12px] font-medium">{ev.name}</span>
      </span>
    </button>
  );
}

// ---------- Marco ----------
export default function Frame({ groups, crumbs, brandSwitch, actions, note, account, children, mainRef, onSearch }) {
  const [collapsed, setCollapsed] = useState(() => lsGet('os_nav', 'open') === 'collapsed');
  const [mobile, setMobile] = useState(false);
  const { pathname } = useLocation();
  const toggle = () => setCollapsed((c) => { lsSet('os_nav', c ? 'open' : 'collapsed'); return !c; });
  useKeypress({ combo: ['meta+b', 'ctrl+b'], callback: toggle });
  useEffect(() => { setMobile(false); }, [pathname]);

  return (
    <div data-slot="inset-shell" data-nav={collapsed ? 'collapsed' : 'open'} className="flex h-svh overflow-hidden">
      <a href="#contenido" className="sr-only z-[70] rounded-md bg-foreground px-3 py-2 text-[13px] text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Saltar al contenido</a>
      <aside data-sidebar-panel className="hidden h-svh w-[232px] shrink-0 transition-[width] duration-[var(--dur-layout)] ease-[var(--ease-standard)] motion-reduce:transition-none lg:block collapsed:w-[56px]">
        <SidebarBody groups={groups} collapsed={collapsed} onToggle={toggle} note={note} account={account(collapsed)} />
      </aside>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[280px] gap-0 border-r-0 bg-shell p-0 sm:max-w-[280px]">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SheetDescription className="sr-only">Secciones de Paradisio OS</SheetDescription>
          <SidebarBody groups={groups} collapsed={false} onNavigate={() => setMobile(false)} note={note} account={account(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-2 py-2 md:px-3 lg:pl-1">
          <button type="button" onClick={() => setMobile(true)} aria-label="Abrir menú" className="press flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent lg:hidden"><MenuIcon className="size-4" /></button>
          <nav aria-label="Ruta" className="flex min-w-0 items-center gap-1 text-[13px]">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={i}>
                  {i > 0 && <ChevronRightIcon className="hidden size-3.5 shrink-0 text-faint md:block" aria-hidden />}
                  {last ? <span className="truncate font-medium" aria-current="page">{c.label}</span>
                    : <Link to={c.to} className="hidden truncate text-muted-foreground transition-colors hover:text-foreground md:inline">{c.label}</Link>}
                </Fragment>
              );
            })}
          </nav>
          {brandSwitch && <div className="order-last w-full md:order-none md:ml-3 md:w-auto">{brandSwitch}</div>}
          <div className="ml-auto flex items-center gap-0.5">
            <button type="button" onClick={onSearch} className="press hidden h-8 items-center gap-2 rounded-md border border-panel-border bg-panel pl-2.5 pr-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground md:flex">
              <SearchIcon className="size-3.5" /><span className="w-28 text-left xl:w-40">Buscar…</span><kbd className="rounded border bg-muted px-1 text-[11px]">⌘K</kbd>
            </button>
            <button type="button" onClick={onSearch} aria-label="Buscar" className="press flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"><SearchIcon className="size-4" /></button>
            {actions}
          </div>
        </header>
        <main ref={mainRef} id="contenido" tabIndex={-1} data-slot="workspace" className="outline-none scroll-thin relative mx-2 mb-2 min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl lg:ml-0">
          {children}
        </main>
      </div>
    </div>
  );
}

