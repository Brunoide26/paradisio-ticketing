import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ss } from '../lib.js';

// Estado global de Paradisio OS: sesión, datos del servidor, espacio de
// trabajo (grupo o marca), impuestos, tema y paneles abiertos.

const Ctx = createContext(null);
export const useOS = () => useContext(Ctx);

const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* sin storage */ } return null; };

// Mensajes legibles para los errores de validación del servidor.
const ERRORS = {
  invalid_finance: 'Revisa fechas y montos', bad_amount: 'El monto debe ser mayor que cero', bad_date: 'Fecha inválida',
  bad_account: 'Elige la cuenta donde se movió el dinero', bad_to_account: 'Elige una cuenta de destino distinta',
  cost_needs_event: 'Un costo de evento necesita un evento; si no es de un evento, usa "Gasto corporativo"',
  expense_has_event: 'Un gasto corporativo no lleva evento; si es de un evento, usa "Costo de evento"',
  bad_ruc: 'RUC (11 dígitos) o DNI (8 dígitos) inválido', bad_fx: 'Falta el tipo de cambio', duplicate_external_ref: 'Esa referencia ya está registrada: sería un doble registro',
  bad_igv: 'El IGV no puede ser mayor que el monto', transfer_needs_date: 'Una transferencia necesita fecha de pago', bad_qty: 'Cantidad inválida',
  bad_opening_date: 'Falta la fecha del saldo inicial', bad_product: 'Elige un producto', too_large: 'Demasiados datos en un solo documento',
};

export async function osApi(pass, body = {}) {
  const r = await fetch('/api/os', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ passcode: pass, ...body }) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error('unauthorized'), { status: 401 });
  if (r.status === 429) throw Object.assign(new Error(j.message || 'locked'), { status: 429 });
  if (!r.ok) throw Object.assign(new Error(j.message || j.error || 'server'), { status: r.status, code: j.error });
  return j;
}

export function OSProvider({ children }) {
  const [pass, setPass] = useState(ss('ceo_pass') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workspace, setWorkspaceState] = useState(ls('os_workspace') || 'group');
  const [withTaxes, setWithTaxes] = useState(true);
  const [theme, setThemeState] = useState(ls('os_theme') || 'light');
  const [drawer, setDrawer] = useState(null); // { type: 'event', id } | { type: 'metric', id, scope }
  const [creating, setCreating] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);

  const flash = useCallback((m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2800); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const setTheme = (t) => { setThemeState(t); ls('os_theme', t); };
  const setWorkspace = (w) => { setWorkspaceState(w); ls('os_workspace', w); };

  const logout = useCallback(() => { ss('ceo_pass', null); setPass(''); setData(null); }, []);

  const load = useCallback(async (p = pass, { quiet = true } = {}) => {
    setLoading(true);
    try {
      const d = await osApi(p, { action: 'load' });
      setData(d);
      ss('ceo_pass', p);
      if (!quiet) flash('Datos actualizados');
      return d;
    } catch (e) {
      if (e.status === 401) logout();
      else if (!quiet) flash('No se pudo actualizar');
      throw e;
    } finally { setLoading(false); }
  }, [pass, flash, logout]);

  const login = async (p) => { await load(p); setPass(p); };

  useEffect(() => { if (pass && !data) load(pass).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escrituras: siempre con la versión cargada; si alguien guardó después, el servidor responde 409.
  const mutate = useCallback(async (body, okMsg) => {
    try {
      const r = await osApi(pass, { ...body, baseVersion: data ? data.version : null });
      await load(pass);
      if (okMsg) flash(okMsg);
      return r;
    } catch (e) {
      if (e.status === 409) { flash('Hubo cambios desde otra pestaña. Recargué los datos: vuelve a intentarlo.'); await load(pass).catch(() => {}); }
      else if (e.status === 401) logout();
      else flash(e.code === 'invalid_finance' ? 'Revisa fechas y montos' : 'No se pudo guardar');
      throw e;
    }
  }, [pass, data, load, flash, logout]);

  // Libro e inventario: control de versión con la versión de su propio documento.
  const docMutate = useCallback(async (doc, body, okMsg) => {
    try {
      const r = await osApi(pass, { ...body, baseVersion: data && data[doc] ? data[doc].updatedAt || null : null });
      await load(pass);
      if (okMsg) flash(okMsg);
      return r;
    } catch (e) {
      if (e.status === 409) { flash('Hubo cambios desde otra pestaña. Recargué los datos: vuelve a intentarlo.'); await load(pass).catch(() => {}); }
      else if (e.status === 401) logout();
      else flash(ERRORS[e.code] || ERRORS[e.message] || 'No se pudo guardar');
      throw e;
    }
  }, [pass, data, load, flash, logout]);
  const upsertAccount = (account) => docMutate('ledger', { action: 'account.upsert', account }, 'Cuenta guardada');
  const upsertTx = (tx) => docMutate('ledger', { action: 'tx.upsert', tx }, 'Transacción guardada');
  const deleteTx = (id) => docMutate('ledger', { action: 'tx.delete', id }, 'Transacción eliminada');
  const upsertProduct = (product) => docMutate('inventory', { action: 'inv.product.upsert', product }, 'Producto guardado');
  const addMoves = (moves, msg = 'Movimiento registrado') => docMutate('inventory', { action: 'inv.move.add', moves }, msg);
  const deleteMove = (id) => docMutate('inventory', { action: 'inv.move.delete', id }, 'Movimiento eliminado');
  const duplicateEvent = (id, date, name) => mutate({ action: 'event.duplicate', id, date, name }, 'Evento duplicado');
  const saveEventNumbers = (id, numbers, source, msg = 'Presupuesto guardado') => mutate({ action: 'event.numbers', id, numbers, source }, msg);
  const updateEvent = (id, patch, msg = 'Evento actualizado') => mutate({ action: 'event.update', id, patch }, msg);
  const createEvent = (event) => mutate({ action: 'event.create', event }, 'Evento creado');
  const saveFinance = (finance) => mutate({ action: 'save', finance }, 'Cambios guardados');

  const value = useMemo(() => ({
    pass, data, loading, login, logout, load, osApi: (b) => osApi(pass, b),
    workspace, setWorkspace, withTaxes, setWithTaxes, theme, setTheme,
    drawer, setDrawer, creating, setCreating, cmd, setCmd, toast, flash,
    updateEvent, createEvent, saveFinance, upsertAccount, upsertTx, deleteTx, upsertProduct, addMoves, deleteMove, duplicateEvent, saveEventNumbers,
  }), [pass, data, loading, workspace, withTaxes, theme, drawer, creating, cmd, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Resumen del servidor para el alcance actual (grupo/marca, rango, impuestos).
// El de "grupo, todo, con impuestos" viene en la carga; los demás se piden.
export function useSummary({ brand = null, from = null, to = null } = {}) {
  const { data, pass, withTaxes } = useOS();
  const key = JSON.stringify([brand, from, to, withTaxes, data && data.version, data && data.generatedAt]);
  const isDefault = !brand && !from && !to && withTaxes;
  const [state, setState] = useState({ key: null, value: null, error: null });
  useEffect(() => {
    if (!data || isDefault) return;
    let alive = true;
    setState((s) => ({ ...s, loadingKey: key }));
    osApi(pass, { action: 'summary', brand, from, to, withTaxes })
      .then((r) => alive && setState({ key, value: r, error: null }))
      .catch((e) => alive && setState({ key, value: null, error: e }));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return { summary: null, attention: [], loading: true };
  if (isDefault) return { summary: data.os.summary, ledger: data.os.ledgerSummary, attention: data.os.attention, loading: false };
  const ok = state.key === key && state.value;
  return { summary: ok ? state.value.summary : null, ledger: ok ? state.value.ledgerSummary : null, attention: ok ? state.value.attention : [], loading: !ok && !state.error, error: state.error };
}
