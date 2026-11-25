import React, { useEffect, useMemo, useState } from 'react';
import { Trash2Icon, PlusIcon, XIcon } from 'lucide-react';
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
        {(data.marketing.campaigns || []).length > 0 && f.kind !== 'transfer' && !isIn && (
          <Field label="Campaña (gasto de medios)"><select className={sel} value={f.campaignId || ''} onChange={set('campaignId')}><option value="">Ninguna</option>{data.marketing.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        )}
        {(data.sponsors.deals || []).length > 0 && isIn && (
          <Field label="Sponsor (cobro del acuerdo)"><select className={sel} value={f.sponsorId || ''} onChange={set('sponsorId')}><option value="">Ninguno</option>{data.sponsors.deals.map((d) => <option key={d.id} value={d.id}>{d.sponsor}</option>)}</select></Field>
        )}
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

export function ContactForm({ id, preset, onClose }) {
  const { data, opsAct } = useOS();
  const existing = id ? (data.ops.contacts || []).find((c) => c.id === id) : null;
  const [f, setF] = useState(existing ? { ...existing, rate: existing.rate ?? '', rating: existing.rating ?? '' } : { type: 'supplier', name: '', role: '', company: '', phone: '', email: '', instagram: '', ruc: '', rate: '', rateUnit: '', rating: '', notes: '', ...(preset || {}) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const staffIn = Object.entries(data.ops.staff || {}).filter(([, list]) => list.some((s) => s.contactId === id)).map(([evId]) => data.finance.events.find((e) => e.id === evId)).filter(Boolean);
  const paidTx = existing ? (data.ledger.transactions || []).filter((t) => t.counterparty && t.counterparty.toLowerCase() === existing.name.toLowerCase()) : [];
  return (
    <>
      <SheetHeader className="border-b pb-3"><SheetTitle>{existing ? existing.name : 'Nuevo contacto'}</SheetTitle><SheetDescription>Locales, artistas y DJs, proveedores, staff y contratistas.</SheetDescription></SheetHeader>
      <form id="ct-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await opsAct('ops.contact.upsert', { contact: f }, 'Contacto guardado'); onClose(); } catch { /* */ } finally { setBusy(false); } }}>
        <Field label="Tipo"><select className={sel} value={f.type} onChange={set('type')}>{Object.entries(data.os.enums.contactTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Nombre"><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Rol / servicio"><Input value={f.role} onChange={set('role')} placeholder="DJ, seguridad, sonido, bartender…" /></Field>
        <Field label="Empresa"><Input value={f.company} onChange={set('company')} /></Field>
        <Field label="Celular"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Correo"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Instagram"><Input value={f.instagram} onChange={set('instagram')} /></Field>
        <Field label="RUC o DNI"><Input value={f.ruc} onChange={set('ruc')} /></Field>
        <Field label="Tarifa (S/)"><Input type="number" step="0.01" min="0" className="mono" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Por"><Input value={f.rateUnit} onChange={set('rateUnit')} placeholder="noche, hora, set…" /></Field>
        <Field label="Calificación (1 a 5)"><Input type="number" min="1" max="5" value={f.rating} onChange={set('rating')} /></Field>
        <Field label="Notas, acuerdos y cotizaciones" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-20" /></Field>
        {existing && <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={!!f.archived} onCheckedChange={(v) => setF((x) => ({ ...x, archived: v }))} />Archivado</label>}
        {existing && (staffIn.length > 0 || paidTx.length > 0) && (
          <div className="rounded-md border p-3 text-[12px] sm:col-span-2">
            <p className="font-medium">Historial</p>
            {staffIn.map((e) => <p key={e.id} className="text-muted-foreground">Staff en {e.name} · {fmtDay(e.date)}</p>)}
            {paidTx.length > 0 && <p className="text-muted-foreground">{paidTx.length} pago(s) registrados por {money(paidTx.reduce((s, t) => s + t.amount, 0))}</p>}
          </div>
        )}
      </form>
      <div className="flex justify-end gap-2 border-t p-3"><Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button type="submit" form="ct-form" size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button></div>
    </>
  );
}

export function TaskForm({ id, preset, onClose }) {
  const { data, opsAct } = useOS();
  const tasks = data.ops.tasks || [];
  const existing = id ? tasks.find((t) => t.id === id) : null;
  const view = id ? (data.os.tasks || []).find((t) => t.id === id) : null;
  const [f, setF] = useState(existing ? { ...existing, due: existing.due || '', eventId: existing.eventId || '' } : { title: '', eventId: '', owner: '', due: '', status: 'todo', dependsOn: [], notes: '', group: '', ...(preset || {}) });
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const events = data.finance.events.slice().sort((a, b) => b.date.localeCompare(a.date));
  const candidates = tasks.filter((t) => t.id !== id && (!f.eventId || t.eventId === f.eventId));
  const owners = [...new Set(tasks.map((t) => t.owner).filter(Boolean))];
  return (
    <>
      <SheetHeader className="border-b pb-3"><SheetTitle>{existing ? 'Tarea' : 'Nueva tarea'}</SheetTitle>{view && view.blockedBy.length > 0 && <SheetDescription className="text-[#C98500]">Bloqueada por: {view.blockedBy.map((b) => b.title).join(' · ')}</SheetDescription>}</SheetHeader>
      <form id="tk-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await opsAct('ops.task.upsert', { task: { ...f, eventId: f.eventId || null, due: f.due || null } }, 'Tarea guardada'); onClose(); } catch { /* */ } finally { setBusy(false); } }}>
        <Field label="Tarea" className="sm:col-span-2"><Input required value={f.title} onChange={set('title')} /></Field>
        <Field label="Evento"><select className={sel} value={f.eventId} onChange={set('eventId')}><option value="">General (sin evento)</option>{events.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select></Field>
        <Field label="Estado"><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(data.os.enums.taskStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Responsable"><Input list="owners" value={f.owner} onChange={set('owner')} /></Field>
        <datalist id="owners">{owners.map((o) => <option key={o} value={o} />)}</datalist>
        <Field label="Fecha límite"><Input type="date" value={f.due} onChange={set('due')} /></Field>
        <Field label="Área"><Input value={f.group} onChange={set('group')} placeholder="Producción, Barra, Pagos…" /></Field>
        <Field label="Depende de" className="sm:col-span-2">
          <div className="scroll-thin max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
            {candidates.length === 0 && <span className="text-[12px] text-muted-foreground">No hay otras tareas{f.eventId ? ' en este evento' : ''}.</span>}
            {candidates.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-[12px] text-foreground">
                <input type="checkbox" checked={(f.dependsOn || []).includes(t.id)} onChange={(e) => setF((x) => ({ ...x, dependsOn: e.target.checked ? [...(x.dependsOn || []), t.id] : (x.dependsOn || []).filter((d) => d !== t.id) }))} />
                <span className={cn(t.status === 'done' && 'text-muted-foreground line-through')}>{t.title}</span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-16" /></Field>
      </form>
      <div className="flex items-center gap-2 border-t p-3">
        {existing && <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={async () => { if (!sure) { setSure(true); return; } try { await opsAct('ops.task.delete', { id: existing.id }, 'Tarea eliminada'); onClose(); } catch { /* */ } }}><Trash2Icon />{sure ? 'Confirmar' : 'Eliminar'}</Button>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="tk-form" size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </>
  );
}

// ---------- Fase 4: formularios genéricos de marketing, sponsors y documentos ----------
function useBase() {
  const { data } = useOS();
  return { events: data.finance.events.slice().sort((a, b) => b.date.localeCompare(a.date)), brands: data.finance.brands, E: data.os.enums };
}
const EventSelect = ({ value, onChange, events, label = 'Evento (opcional)', className }) => (
  <Field label={label} className={className}><select className={sel} value={value || ''} onChange={onChange}><option value="">Ninguno</option>{events.map((e) => <option key={e.id} value={e.id}>{fmtDay(e.date)} · {e.name}</option>)}</select></Field>
);
const BrandSelect = ({ value, onChange, brands, label = 'Marca' }) => (
  <Field label={label}><select className={sel} value={value || ''} onChange={onChange}><option value="">Grupo / varias</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
);

function ItemSheet({ title, description, formId, onClose, onDelete, busy, children }) {
  const [sure, setSure] = useState(false);
  return (
    <>
      <SheetHeader className="border-b pb-3"><SheetTitle>{title}</SheetTitle>{description && <SheetDescription>{description}</SheetDescription>}</SheetHeader>
      {children}
      <div className="flex items-center gap-2 border-t p-3">
        {onDelete && <Button type="button" variant="outline" size="sm" className="text-destructive" onClick={async () => { if (!sure) { setSure(true); return; } await onDelete(); }}><Trash2Icon />{sure ? 'Confirmar' : 'Eliminar'}</Button>}
        <Button variant="outline" size="sm" className="ml-auto" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form={formId} size="sm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </>
  );
}

function useItemForm(doc, list, action, id, blank, preset, onClose, msg) {
  const { data, com } = useOS();
  const existing = id ? (data[doc][list] || []).find((x) => x.id === id) : null;
  const [f, setF] = useState(() => ({ ...blank, ...(existing || {}), ...(existing ? {} : preset || {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const submit = async (e, transform = (x) => x) => { e.preventDefault(); setBusy(true); try { await com(doc, `${action}.upsert`, { item: transform(f) }, msg); onClose(); } catch { /* toast */ } finally { setBusy(false); } };
  const remove = existing ? async () => { try { await com(doc, `${action}.delete`, { id: existing.id }, 'Eliminado'); onClose(); } catch { /* */ } } : null;
  return { f, setF, set, busy, submit, remove, existing };
}

export function ContentForm({ id, preset, onClose }) {
  const { data } = useOS();
  const { events, brands, E } = useBase();
  const { f, set, busy, submit, remove, existing } = useItemForm('marketing', 'content', 'mkt.content', id, { title: '', brand: '', eventId: '', campaignId: '', channel: 'ig_post', status: 'idea', owner: '', designer: '', due: '', publishOn: '', link: '', notes: '', results: { reach: '', interactions: '' } }, preset, onClose, 'Contenido guardado');
  const [res, setRes] = useState(f.results || { reach: '', interactions: '' });
  return (
    <ItemSheet title={existing ? 'Contenido' : 'Nuevo contenido'} description="Una pieza: post, reel, story, correo o flyer." formId="ct4-form" onClose={onClose} onDelete={remove} busy={busy}>
      <form id="ct4-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={(e) => submit(e, (x) => ({ ...x, results: res }))}>
        <Field label="Título" className="sm:col-span-2"><Input required value={f.title} onChange={set('title')} placeholder="Reel anuncio line-up 5/12" /></Field>
        <Field label="Canal"><select className={sel} value={f.channel} onChange={set('channel')}>{Object.entries(E.channels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Estado"><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(E.contentStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <BrandSelect value={f.brand} onChange={set('brand')} brands={brands} />
        <EventSelect value={f.eventId} onChange={set('eventId')} events={events} />
        <Field label="Campaña" className="sm:col-span-2"><select className={sel} value={f.campaignId || ''} onChange={set('campaignId')}><option value="">Ninguna</option>{(data.marketing.campaigns || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Responsable"><Input value={f.owner} onChange={set('owner')} /></Field>
        <Field label="Diseñador/a"><Input value={f.designer} onChange={set('designer')} /></Field>
        <Field label="Entrega (para aprobar)"><Input type="date" value={f.due || ''} onChange={set('due')} /></Field>
        <Field label="Publicación"><Input type="date" value={f.publishOn || ''} onChange={set('publishOn')} /></Field>
        <Field label="Enlace (arte, Drive o publicación)" className="sm:col-span-2"><Input value={f.link} onChange={set('link')} placeholder="https://…" /></Field>
        <Field label="Alcance (si ya se publicó)"><Input type="number" min="0" className="mono" value={res.reach ?? ''} onChange={(e) => setRes((x) => ({ ...x, reach: e.target.value }))} /></Field>
        <Field label="Interacciones"><Input type="number" min="0" className="mono" value={res.interactions ?? ''} onChange={(e) => setRes((x) => ({ ...x, interactions: e.target.value }))} /></Field>
        <Field label="Notas / brief" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-20" /></Field>
      </form>
    </ItemSheet>
  );
}

export function CampaignForm({ id, preset, onClose }) {
  const { events, brands, E } = useBase();
  const { f, setF, set, busy, submit, remove, existing } = useItemForm('marketing', 'campaigns', 'mkt.campaign', id, { name: '', brand: '', eventId: '', objective: '', channels: [], budget: '', start: '', end: '', status: 'planned', notes: '' }, preset, onClose, 'Campaña guardada');
  return (
    <ItemSheet title={existing ? existing.name : 'Nueva campaña'} description="El gasto real sale de las transacciones ligadas a esta campaña." formId="cmp-form" onClose={onClose} onDelete={remove} busy={busy}>
      <form id="cmp-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Nombre" className="sm:col-span-2"><Input required value={f.name} onChange={set('name')} /></Field>
        <BrandSelect value={f.brand} onChange={set('brand')} brands={brands} />
        <EventSelect value={f.eventId} onChange={set('eventId')} events={events} />
        <Field label="Objetivo" className="sm:col-span-2"><Input value={f.objective} onChange={set('objective')} placeholder="Vender boxes del 5/12, 300 registros…" /></Field>
        <Field label="Presupuesto de medios (S/)"><Input type="number" step="0.01" min="0" className="mono" value={f.budget ?? ''} onChange={set('budget')} /></Field>
        <Field label="Estado"><select className={sel} value={f.status} onChange={set('status')}>{Object.entries(E.campaignStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Inicio"><Input type="date" value={f.start || ''} onChange={set('start')} /></Field>
        <Field label="Fin"><Input type="date" value={f.end || ''} onChange={set('end')} /></Field>
        <Field label="Canales" className="sm:col-span-2">
          <div className="flex flex-wrap gap-2">{Object.entries(E.channels).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1 text-[12px] text-foreground"><input type="checkbox" checked={(f.channels || []).includes(k)} onChange={(e) => setF((x) => ({ ...x, channels: e.target.checked ? [...(x.channels || []), k] : (x.channels || []).filter((c) => c !== k) }))} />{v}</label>
          ))}</div>
        </Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-16" /></Field>
      </form>
    </ItemSheet>
  );
}

export function AssetForm({ id, preset, onClose }) {
  const { brands, E } = useBase();
  const { f, set, busy, submit, remove, existing } = useItemForm('marketing', 'assets', 'mkt.asset', id, { name: '', type: 'logo', brand: '', url: '', tags: '', notes: '' }, preset, onClose, 'Recurso guardado');
  return (
    <ItemSheet title={existing ? existing.name : 'Nuevo recurso de marca'} description="Enlace a la carpeta o archivo (Drive, Dropbox, Canva…)." formId="ast-form" onClose={onClose} onDelete={remove} busy={busy}>
      <form id="ast-form" className="grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Nombre" className="sm:col-span-2"><Input required value={f.name} onChange={set('name')} /></Field>
        <Field label="Tipo"><select className={sel} value={f.type} onChange={set('type')}>{Object.entries(E.assetTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <BrandSelect value={f.brand} onChange={set('brand')} brands={brands} />
        <Field label="Enlace" className="sm:col-span-2"><Input required value={f.url} onChange={set('url')} placeholder="https://drive.google.com/…" /></Field>
        <Field label="Etiquetas" className="sm:col-span-2"><Input value={f.tags} onChange={set('tags')} placeholder="logo blanco, png, 2026" /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-14" /></Field>
      </form>
    </ItemSheet>
  );
}

export function DealForm({ id, preset, onClose }) {
  const { events, brands, E } = useBase();
  const { f, setF, set, busy, submit, remove, existing } = useItemForm('sponsors', 'deals', 'sp.deal', id, { sponsor: '', contactName: '', email: '', phone: '', stage: 'prospect', brands: [], eventIds: [], cash: '', inKind: '', inKindValue: '', contractStart: '', contractEnd: '', renewalDate: '', deliverables: [], proposalUrl: '', notes: '' }, preset, onClose, 'Sponsor guardado');
  const toggle = (k, v) => (e) => setF((x) => ({ ...x, [k]: e.target.checked ? [...(x[k] || []), v] : (x[k] || []).filter((y) => y !== v) }));
  const setDl = (i, k, v) => setF((x) => ({ ...x, deliverables: x.deliverables.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));
  return (
    <ItemSheet title={existing ? existing.sponsor : 'Nuevo sponsor'} description="El monto del acuerdo es proyectado; lo real es lo cobrado (transacciones con este sponsor)." formId="deal-form" onClose={onClose} onDelete={remove} busy={busy}>
      <form id="deal-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Sponsor / marca" className="sm:col-span-2"><Input required value={f.sponsor} onChange={set('sponsor')} /></Field>
        <Field label="Etapa"><select className={sel} value={f.stage} onChange={set('stage')}>{Object.entries(E.dealStages).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Contacto"><Input value={f.contactName} onChange={set('contactName')} /></Field>
        <Field label="Correo"><Input type="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Celular"><Input value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Marcas que cubre" className="sm:col-span-2"><div className="flex flex-wrap gap-3">{brands.map((b) => <label key={b.id} className="flex items-center gap-1.5 text-[12px] text-foreground"><input type="checkbox" checked={(f.brands || []).includes(b.id)} onChange={toggle('brands', b.id)} />{b.name}</label>)}</div></Field>
        <Field label="Fechas que cubre" className="sm:col-span-2"><div className="scroll-thin max-h-28 space-y-1 overflow-y-auto rounded-md border p-2">{events.map((e) => <label key={e.id} className="flex items-center gap-1.5 text-[12px] text-foreground"><input type="checkbox" checked={(f.eventIds || []).includes(e.id)} onChange={toggle('eventIds', e.id)} />{fmtDay(e.date)} · {e.name}</label>)}</div></Field>
        <Field label="Aporte en efectivo (S/)"><Input type="number" step="0.01" min="0" className="mono" value={f.cash ?? ''} onChange={set('cash')} /></Field>
        <Field label="Valor del aporte en especie (S/)"><Input type="number" step="0.01" min="0" className="mono" value={f.inKindValue ?? ''} onChange={set('inKindValue')} /></Field>
        <Field label="Qué aporta en especie" className="sm:col-span-2"><Input value={f.inKind} onChange={set('inKind')} placeholder="Ej. 20 botellas, barra con marca, staff de activación" /></Field>
        <Field label="Inicio del contrato"><Input type="date" value={f.contractStart || ''} onChange={set('contractStart')} /></Field>
        <Field label="Fin del contrato"><Input type="date" value={f.contractEnd || ''} onChange={set('contractEnd')} /></Field>
        <Field label="Fecha de renovación"><Input type="date" value={f.renewalDate || ''} onChange={set('renewalDate')} /></Field>
        <Field label="Propuesta / contrato (enlace)"><Input value={f.proposalUrl} onChange={set('proposalUrl')} placeholder="https://…" /></Field>
        <Field label="Entregables al sponsor" className="sm:col-span-2">
          <div className="space-y-1.5">
            {(f.deliverables || []).map((d, i) => (
              <div key={d.id || i} className="flex items-center gap-2">
                <input type="checkbox" checked={!!d.done} onChange={(e) => setDl(i, 'done', e.target.checked)} aria-label="Hecho" />
                <Input className="h-8 flex-1" value={d.title} onChange={(e) => setDl(i, 'title', e.target.value)} placeholder="Logo en flyer, mención en stories…" />
                <Input type="date" className="h-8 w-36" value={d.due || ''} onChange={(e) => setDl(i, 'due', e.target.value)} />
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar" onClick={() => setF((x) => ({ ...x, deliverables: x.deliverables.filter((_, j) => j !== i) }))}><XIcon /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setF((x) => ({ ...x, deliverables: [...(x.deliverables || []), { title: '', due: '', done: false }] }))}><PlusIcon />Entregable</Button>
          </div>
        </Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-16" /></Field>
      </form>
    </ItemSheet>
  );
}

export function DocumentForm({ id, preset, onClose }) {
  const { data } = useOS();
  const { events, brands, E } = useBase();
  const { f, set, busy, submit, remove, existing } = useItemForm('documents', 'documents', 'doc.item', id, { title: '', type: 'contract', url: '', brand: '', eventId: '', contactId: '', sponsorId: '', signedOn: '', expires: '', notes: '' }, preset, onClose, 'Documento guardado');
  return (
    <ItemSheet title={existing ? existing.title : 'Nuevo documento'} description="Guarda el enlace (Drive, Dropbox…), no el archivo." formId="doc-form" onClose={onClose} onDelete={remove} busy={busy}>
      <form id="doc-form" className="scroll-thin grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Título" className="sm:col-span-2"><Input required value={f.title} onChange={set('title')} /></Field>
        <Field label="Tipo"><select className={sel} value={f.type} onChange={set('type')}>{Object.entries(E.docTypes4).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <BrandSelect value={f.brand} onChange={set('brand')} brands={brands} />
        <Field label="Enlace" className="sm:col-span-2"><Input required value={f.url} onChange={set('url')} placeholder="https://drive.google.com/…" /></Field>
        <EventSelect value={f.eventId} onChange={set('eventId')} events={events} className="sm:col-span-2" />
        <Field label="Proveedor / contacto"><select className={sel} value={f.contactId || ''} onChange={set('contactId')}><option value="">Ninguno</option>{(data.ops.contacts || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Sponsor"><select className={sel} value={f.sponsorId || ''} onChange={set('sponsorId')}><option value="">Ninguno</option>{(data.sponsors.deals || []).map((d) => <option key={d.id} value={d.id}>{d.sponsor}</option>)}</select></Field>
        <Field label="Firmado el"><Input type="date" value={f.signedOn || ''} onChange={set('signedOn')} /></Field>
        <Field label="Vence el" hint="Avisa 30 días antes."><Input type="date" value={f.expires || ''} onChange={set('expires')} /></Field>
        <Field label="Notas" className="sm:col-span-2"><Textarea value={f.notes} onChange={set('notes')} className="min-h-14" /></Field>
      </form>
    </ItemSheet>
  );
}
