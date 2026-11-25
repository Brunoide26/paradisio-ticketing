import React, { useEffect, useMemo, useState } from 'react';
import { Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOS } from './store.jsx';
import { Field, sel, fmtDay } from './kit.jsx';
import { cn, limaISO, money } from '../lib.js';

// Qué campos aplican a cada tipo de transacción.
const IN_KINDS = ['sale', 'other_income', 'deposit', 'capital', 'loan_in'];
const KIND_HELP = {
  sale: 'Cobro de una venta. Si es de un evento, es el dinero de ingresos que ya están en su liquidación: no se vuelve a sumar.',
  other_income: 'Ingreso corporativo que no pertenece a un evento (sí entra al resultado del grupo).',
  deposit: 'Adelanto de un cliente (por ejemplo, un box) para una fecha que todavía no ocurre. Es una deuda con el cliente, no ingreso.',
  capital: 'Dinero que ponen los socios. Entra a caja; nunca es venta.',
  loan_in: 'Préstamo recibido. Entra a caja; es una deuda.',
  cost: 'Pago de un costo de un evento (local, DJ, staff…). El costo ya está en la liquidación del evento: esto registra el pago.',
  expense: 'Gasto del grupo que no es de un evento (contador, software, oficina…). Entra al resultado del grupo.',
  inventory: 'Compra de stock. Es inventario, no gasto: el costo entra al evento cuando se consume.',
  loan_out: 'Pago de un préstamo.',
  refund: 'Devolución de dinero a un cliente.',
  transfer: 'Mover dinero entre tus cuentas (por ejemplo, de Culqi a BCP). No es ingreso ni gasto.',
};

function useLists() {
  const { data } = useOS();
  const events = data.finance.events.slice().sort((a, b) => b.date.localeCompare(a.date));
  return { events, brands: data.finance.brands, accounts: (data.ledger.accounts || []).filter((a) => !a.archived), enums: data.os.enums };
}

export function TxForm({ id, preset, onClose }) {
  const { data, upsertTx, deleteTx } = useOS();
  const { events, brands, accounts, enums } = useLists();
  const existing = id ? (data.ledger.transactions || []).find((t) => t.id === id) : null;
  const blank = { kind: 'cost', description: '', date: limaISO(), dueDate: '', paidOn: '', amount: '', currency: 'PEN', fxRate: '', accountId: accounts[0]?.id || '', toAccountId: '', eventId: '', brand: '', category: '', counterparty: '', ruc: '', docType: '', docNumber: '', igv: '', method: '', notes: '', committed: false, ...(preset || {}) };
  const [f, setF] = useState(existing ? { ...blank, ...existing, dueDate: existing.dueDate || '', paidOn: existing.paidOn || '', igv: existing.igv ?? '', fxRate: existing.currency === 'USD' ? existing.fxRate : '' } : blank);
  const [paid, setPaid] = useState(existing ? !!existing.paidOn : !!(preset && preset.paidOn));
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const isIn = IN_KINDS.includes(f.kind);
  const canCommit = (f.kind === 'cost' || f.kind === 'expense') && !paid;
  const needsEvent = f.kind === 'cost';
  const noEvent = f.kind === 'expense' || f.kind === 'transfer' || f.kind === 'capital' || f.kind === 'loan_in' || f.kind === 'loan_out';
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const tx = { ...f, paidOn: paid || f.kind === 'transfer' ? f.paidOn || f.date : null, accountId: paid || f.kind === 'transfer' ? f.accountId : null, eventId: noEvent ? null : f.eventId || null, committed: canCommit && f.committed };
    try { await upsertTx(tx); onClose(); } catch { /* toast */ } finally { setBusy(false); }
  };
  return (
    <>
      <SheetHeader className="border-b pb-3">
        <SheetTitle>{existing ? 'Editar transacción' : 'Nueva transacción'}</SheetTitle>
        <SheetDescription>{KIND_HELP[f.kind]}</SheetDescription>
      </SheetHeader>
      <form id="tx-form" onSubmit={submit} className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2">
        <Field label="Tipo" className="sm:col-span-2">
          <select className={sel} value={f.kind} onChange={set('kind')}>{Object.entries(enums.txKinds).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        </Field>
        <Field label="Descripción" className="sm:col-span-2"><Input value={f.description} onChange={set('description')} placeholder={enums.txKinds[f.kind].label} /></Field>
        <Field label="Monto"><Input required type="number" step="0.01" min="0.01" className="mono" value={f.amount} onChange={set('amount')} /></Field>
        <Field label="Moneda"><select className={sel} value={f.currency} onChange={set('currency')}><option value="PEN">PEN (soles)</option><option value="USD">USD (dólares)</option></select></Field>
        {f.currency === 'USD' && <Field label="Tipo de cambio (S/ por US$)" className="sm:col-span-2"><Input required type="number" step="0.0001" className="mono" value={f.fxRate} onChange={set('fxRate')} placeholder="3.75" /></Field>}
        <Field label="Fecha del gasto / venta" hint="Cuándo ocurrió (devengo)."><Input required type="date" value={f.date} onChange={set('date')} /></Field>
        <Field label="Vence" hint="Para por pagar / por cobrar."><Input type="date" value={f.dueDate} onChange={set('dueDate')} disabled={paid && f.kind !== 'transfer'} /></Field>
        {f.kind !== 'transfer' && (
          <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={paid} onCheckedChange={setPaid} />{isIn ? 'Ya se cobró' : 'Ya se pagó'}</label>
        )}
        {(paid || f.kind === 'transfer') && <>
          <Field label={isIn ? 'Fecha de cobro' : 'Fecha de pago'}><Input type="date" value={f.paidOn || f.date} onChange={set('paidOn')} /></Field>
          <Field label={f.kind === 'transfer' ? 'Desde la cuenta' : 'Cuenta'}>
            <select className={sel} required value={f.accountId} onChange={set('accountId')}><option value="">Elige…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select>
          </Field>
          {f.kind === 'transfer' && <Field label="Hacia la cuenta" className="sm:col-span-2"><select className={sel} required value={f.toAccountId} onChange={set('toAccountId')}><option value="">Elige…</option>{accounts.filter((a) => a.id !== f.accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>}
          {accounts.length === 0 && <p className="text-[12px] text-bad sm:col-span-2">Primero crea una cuenta en Finanzas → Cuentas.</p>}
        </>}
        {canCommit && <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={!!f.committed} onCheckedChange={(v) => setF((x) => ({ ...x, committed: v }))} />Solo comprometido (acordado, todavía no se debe)</label>}
        {!noEvent && (
          <Field label={needsEvent ? 'Evento (obligatorio)' : 'Evento (opcional)'} className="sm:col-span-2">
            <select className={sel} required={needsEvent} value={f.eventId || ''} onChange={set('eventId')}><option value="">{needsEvent ? 'Elige…' : 'Ninguno'}</option>{events.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select>
          </Field>
        )}
        {!f.eventId && f.kind !== 'transfer' && (
          <Field label="Marca (opcional)"><select className={sel} value={f.brand || ''} onChange={set('brand')}><option value="">Grupo (corporativo)</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        )}
        {f.kind !== 'transfer' && <Field label="Categoría"><Input list="tx-cats" value={f.category} onChange={set('category')} placeholder="Local, Talento, Contador…" /></Field>}
        <datalist id="tx-cats">{['Local', 'Talento', 'Personal', 'Barra', 'Promotores', 'Producción', 'Marketing', 'Comisiones', 'Impuestos', 'Contador', 'Software', 'Oficina', 'Legal', 'Transporte'].map((c) => <option key={c} value={c} />)}</datalist>
        {f.kind !== 'transfer' && <>
          <Field label="Proveedor / cliente"><Input value={f.counterparty} onChange={set('counterparty')} /></Field>
          <Field label="RUC o DNI"><Input inputMode="numeric" value={f.ruc} onChange={set('ruc')} placeholder="11 o 8 dígitos" /></Field>
          <Field label="Comprobante"><select className={sel} value={f.docType || ''} onChange={set('docType')}><option value="">—</option>{enums.docTypes.map((d) => <option key={d} value={d}>{{ factura: 'Factura', boleta: 'Boleta', recibo_honorarios: 'Recibo por honorarios', ticket: 'Ticket', ninguno: 'Sin comprobante' }[d]}</option>)}</select></Field>
          <Field label="N.º de comprobante"><Input value={f.docNumber} onChange={set('docNumber')} placeholder="F001-123" /></Field>
          <Field label="IGV incluido (monto)"><Input type="number" step="0.01" className="mono" value={f.igv} onChange={set('igv')} /></Field>
          <Field label="Medio de pago"><Input list="tx-methods" value={f.method} onChange={set('method')} /></Field>
          <datalist id="tx-methods">{['Transferencia', 'Efectivo', 'Yape', 'Plin', 'Tarjeta', 'Culqi', 'Cheque'].map((c) => <option key={c} value={c} />)}</datalist>
        </>}
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-14" /></Field>
        <p className="text-[11px] text-muted-foreground sm:col-span-2">Adjuntos (fotos de comprobantes) llegan más adelante; por ahora anota el número de comprobante.</p>
      </form>
      <div className="flex items-center gap-2 border-t p-3">
        {existing && <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={async () => { if (!sure) { setSure(true); return; } try { await deleteTx(existing.id); onClose(); } catch { /* */ } }}><Trash2Icon />{sure ? 'Confirmar eliminación' : 'Eliminar'}</Button>}
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="tx-form" size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </>
  );
}

export function AccountForm({ id, onClose }) {
  const { data, upsertAccount } = useOS();
  const existing = id ? (data.ledger.accounts || []).find((a) => a.id === id) : null;
  const [f, setF] = useState(existing ? { ...existing, openingBalance: existing.openingBalance ?? '', openingDate: existing.openingDate || '', fxRate: existing.fxRate ?? '' } : { name: '', type: 'bank', currency: 'PEN', institution: '', number: '', openingBalance: '', openingDate: limaISO(), fxRate: '', archived: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <SheetHeader className="border-b pb-3">
        <SheetTitle>{existing ? 'Editar cuenta' : 'Nueva cuenta'}</SheetTitle>
        <SheetDescription>Banco, caja, Culqi o billetera digital. Con saldo inicial se calcula la caja disponible.</SheetDescription>
      </SheetHeader>
      <form id="acc-form" className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await upsertAccount(f); onClose(); } catch { /* */ } finally { setBusy(false); } }}>
        <Field label="Nombre" className="sm:col-span-2"><Input required value={f.name} onChange={set('name')} placeholder="BCP Soles" /></Field>
        <Field label="Tipo"><select className={sel} value={f.type} onChange={set('type')}>{Object.entries(data.os.enums.accountTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Moneda"><select className={sel} value={f.currency} onChange={set('currency')}><option value="PEN">PEN</option><option value="USD">USD</option></select></Field>
        <Field label="Institución"><Input value={f.institution} onChange={set('institution')} placeholder="BCP, Culqi…" /></Field>
        <Field label="N.º de cuenta (últimos dígitos)"><Input value={f.number} onChange={set('number')} placeholder="…1234" /></Field>
        <Field label="Saldo inicial"><Input type="number" step="0.01" className="mono" value={f.openingBalance} onChange={set('openingBalance')} placeholder="Sin saldo inicial" /></Field>
        <Field label="Al día"><Input type="date" value={f.openingDate} onChange={set('openingDate')} /></Field>
        {f.currency === 'USD' && <Field label="Tipo de cambio de referencia" hint="Para sumar esta cuenta a la caja en soles." className="sm:col-span-2"><Input type="number" step="0.0001" className="mono" value={f.fxRate} onChange={set('fxRate')} /></Field>}
        {existing && <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={!!f.archived} onCheckedChange={(v) => setF((x) => ({ ...x, archived: v }))} />Archivada (ya no se usa)</label>}
      </form>
      <div className="flex justify-end gap-2 border-t p-3">
        <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="acc-form" size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </>
  );
}

export function ProductForm({ id, onClose }) {
  const { data, upsertProduct } = useOS();
  const existing = id ? (data.inventory.products || []).find((p) => p.id === id) : null;
  const [f, setF] = useState(existing ? { ...existing, minStock: existing.minStock ?? '' } : { name: '', kind: 'bar', category: '', unit: 'botella', unitCost: '', minStock: '', archived: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <SheetHeader className="border-b pb-3"><SheetTitle>{existing ? 'Editar producto' : 'Nuevo producto'}</SheetTitle><SheetDescription>Inventario compartido entre las marcas.</SheetDescription></SheetHeader>
      <form id="prd-form" className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await upsertProduct(f); onClose(); } catch { /* */ } finally { setBusy(false); } }}>
        <Field label="Nombre" className="sm:col-span-2"><Input required value={f.name} onChange={set('name')} placeholder="Gin Beefeater 750 ml" /></Field>
        <Field label="Tipo"><select className={sel} value={f.kind} onChange={set('kind')}>{Object.entries(data.os.enums.productKinds).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Categoría"><Input list="prd-cats" value={f.category} onChange={set('category')} /></Field>
        <datalist id="prd-cats">{['Gin', 'Vodka', 'Ron', 'Tequila', 'Whisky', 'Pisco', 'Licores', 'Cerveza', 'Vino', 'Mixers', 'Energizantes', 'Hielo', 'Descartables', 'Sonido', 'Luces', 'Decoración'].map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Unidad"><Input value={f.unit} onChange={set('unit')} placeholder="botella, lata, unidad" /></Field>
        <Field label="Costo por unidad (S/)"><Input required type="number" step="0.01" min="0" className="mono" value={f.unitCost} onChange={set('unitCost')} /></Field>
        <Field label="Stock mínimo" hint="Avisa cuando baje de aquí."><Input type="number" step="0.01" min="0" className="mono" value={f.minStock} onChange={set('minStock')} /></Field>
        {existing && <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={!!f.archived} onCheckedChange={(v) => setF((x) => ({ ...x, archived: v }))} />Archivado</label>}
      </form>
      <div className="flex justify-end gap-2 border-t p-3"><Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button type="submit" form="prd-form" size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button></div>
    </>
  );
}

// Movimiento suelto (compra, merma, cortesía, ajuste…).
export function MoveForm({ preset, onClose }) {
  const { data, addMoves } = useOS();
  const products = (data.inventory.products || []).filter((p) => !p.archived);
  const events = data.finance.events.slice().sort((a, b) => b.date.localeCompare(a.date));
  const [f, setF] = useState({ type: 'purchase', productId: products[0]?.id || '', qty: '', date: limaISO(), eventId: '', unitCost: '', note: '', ...(preset || {}) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const types = Object.entries(data.os.enums.moveTypes).filter(([k]) => k !== 'count');
  return (
    <>
      <SheetHeader className="border-b pb-3"><SheetTitle>Movimiento de inventario</SheetTitle><SheetDescription>Para conteos de apertura y cierre de un evento usa "Conteo del evento".</SheetDescription></SheetHeader>
      <form id="mov-form" className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await addMoves([f]); onClose(); } catch { /* */ } finally { setBusy(false); } }}>
        <Field label="Tipo"><select className={sel} value={f.type} onChange={set('type')}>{types.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Fecha"><Input type="date" required value={f.date} onChange={set('date')} /></Field>
        <Field label="Producto" className="sm:col-span-2"><select className={sel} required value={f.productId} onChange={set('productId')}>{products.length === 0 && <option value="">Primero crea un producto</option>}{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}</select></Field>
        <Field label={f.type === 'adjustment' ? 'Cantidad (+ suma, − resta)' : 'Cantidad'}><Input required type="number" step="0.001" className="mono" value={f.qty} onChange={set('qty')} /></Field>
        {f.type === 'purchase' && <Field label="Costo unitario de esta compra"><Input type="number" step="0.01" className="mono" value={f.unitCost} onChange={set('unitCost')} /></Field>}
        <Field label="Evento (opcional)" className="sm:col-span-2"><select className={sel} value={f.eventId} onChange={set('eventId')}><option value="">Ninguno</option>{events.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select></Field>
        <Field label="Nota" className="sm:col-span-2"><Input value={f.note} onChange={set('note')} /></Field>
        {f.type === 'purchase' && <p className="text-[11px] text-muted-foreground sm:col-span-2">El pago de esta compra se registra aparte como transacción "Compra de inventario".</p>}
      </form>
      <div className="flex justify-end gap-2 border-t p-3"><Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button type="submit" form="mov-form" size="sm" disabled={busy || !products.length}>{busy ? 'Guardando…' : 'Registrar'}</Button></div>
    </>
  );
}

// Conteo de apertura o cierre de un evento: todos los productos de una vez.
export function CountDialog({ open, onOpenChange, eventId, phase: initialPhase = 'open' }) {
  const { data, addMoves } = useOS();
  const products = (data.inventory.products || []).filter((p) => !p.archived && p.kind !== 'asset');
  const ev = data.finance.events.find((e) => e.id === eventId);
  const [phase, setPhase] = useState(initialPhase);
  const [qty, setQty] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setQty({}); setPhase(initialPhase); } }, [open, initialPhase]);
  const filled = Object.entries(qty).filter(([, v]) => v !== '' && v != null);
  const value = useMemo(() => filled.reduce((s, [id, v]) => s + (Number(v) || 0) * ((products.find((p) => p.id === id) || {}).unitCost || 0), 0), [qty]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ev) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Conteo del evento</DialogTitle>
          <DialogDescription>{ev.name} · {fmtDay(ev.date)}. Cuenta lo que hay físicamente; deja vacío lo que no contaste.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1 rounded-md bg-muted p-0.5 text-[13px]">
          {[['open', 'Apertura (antes de abrir)'], ['close', 'Cierre (al terminar)']].map(([k, l]) => <button key={k} type="button" onClick={() => setPhase(k)} className={cn('flex-1 rounded px-2 py-1', phase === k ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground')}>{l}</button>)}
        </div>
        <div className="scroll-thin max-h-[50vh] divide-y overflow-y-auto rounded-md border">
          {products.length === 0 && <p className="p-4 text-[13px] text-muted-foreground">No hay productos. Créalos en Inventario.</p>}
          {products.map((p) => (
            <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="text-[11px] text-muted-foreground">{p.unit} · {money(p.unitCost, 2)}</span></span>
              <Input type="number" step="0.001" min="0" className="mono h-8 w-24 text-right" value={qty[p.id] ?? ''} onChange={(e) => setQty((x) => ({ ...x, [p.id]: e.target.value }))} aria-label={`Cantidad de ${p.name}`} />
            </label>
          ))}
        </div>
        <DialogFooter className="items-center">
          <span className="mr-auto text-[12px] text-muted-foreground">{filled.length} producto(s) · {money(value, 2)} a costo</span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={busy || !filled.length} onClick={async () => {
            setBusy(true);
            try {
              await addMoves(filled.map(([productId, v]) => ({ type: 'count', productId, qty: Number(v), date: phase === 'close' ? ev.date : ev.date, eventId, phase })), `Conteo de ${phase === 'open' ? 'apertura' : 'cierre'} guardado`);
              onOpenChange(false);
            } catch { /* */ } finally { setBusy(false); }
          }}>{busy ? 'Guardando…' : 'Guardar conteo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
