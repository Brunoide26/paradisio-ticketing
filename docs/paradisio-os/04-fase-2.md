# Paradisio OS — Fase 2: informe

Alcance: espacios de evento completos, gestión financiera, presupuestos, transacciones e inventario. Todo sobre el mismo Redis, sin tocar la ticketera ni los datos de eventos existentes.

## Regla central: nada se cuenta dos veces

| Qué | Dónde vive | Entra al resultado |
|---|---|---|
| Ingresos y costos de un evento | Liquidación del evento (`ceo:finance`) | Sí, una vez, en el evento |
| Pago o cobro de esos montos | Transacción ligada al evento (`os:ledger`) | **No**: es movimiento de caja |
| Gasto o ingreso corporativo (sin evento) | Transacción `expense` / `other_income` | Sí, en el resultado del grupo |
| Compra de inventario | Transacción `inventory` + movimiento de compra | **No**: es activo; entra cuando se consume |
| Aporte de capital, préstamo | Transacción `capital` / `loan_*` | **No** |
| Anticipo de cliente (box de una fecha futura) | Transacción `deposit` | **No**: es deuda con el cliente hasta la fecha |
| Transferencia entre cuentas | Transacción `transfer` | **No** |

El servidor también lo hace cumplir:
- un **costo de evento** sin evento se rechaza;
- un **gasto corporativo** con evento se rechaza;
- una referencia externa repetida (mismo cobro de Culqi, mismo movimiento del banco) se rechaza.

## Qué se agregó

### Backend
- `lib/os/docs.js`: documentos `os:ledger` y `os:inventory` con versión, historial (últimas 50) y auditoría, igual que las finanzas.
- `lib/os/ledger.js`: cuentas y transacciones. Valida y calcula:
  - saldo por cuenta y caja disponible;
  - por pagar (con vencidos), comprometido, por cobrar y anticipos;
  - resultado corporativo por categoría;
  - flujo de caja mensual real y proyección de 8 semanas, con lo pendiente sólido y los presupuestos punteados;
  - pagos y cobros por evento.
- `lib/os/inventory.js`: productos y movimientos (compra, devolución, merma, cortesía, asignación, ajuste, conteo). Calcula:
  - stock actual desde el último conteo;
  - consumo por evento = apertura + compras − cierre;
  - valor del inventario y stock bajo.
- `api/os.js`, nuevas acciones: `account.upsert`, `tx.upsert`, `tx.delete`, `inv.product.upsert`, `inv.move.add` (uno o varios), `inv.move.delete` y `event.duplicate`. Alertas nuevas en Atención: pagos vencidos, stock bajo y cuentas sin saldo inicial.
- `test/os-ledger.test.js`: 11 pruebas nuevas (22 en total).

### Frontend
- **Finanzas**, con pestañas:
  - **Resumen**: estado de resultados del grupo (eventos + corporativo) y eventos reales y proyectados en tablas separadas.
  - **Transacciones**: tabla con filtros por tipo y estado.
  - **Cuentas**: saldos al día.
  - **Por pagar y cobrar**: incluye lo comprometido y los anticipos.
  - **Flujo de caja**.
  - **Presupuestos**: aprobado, comprometido, real, pagado, pendiente y variación, sin sumarlos entre sí.
  - **Simulador**.
  - **Datos de eventos**: el editor de siempre.
- **Simulador de rentabilidad**:
  - tres escenarios (pesimista, conservador y optimista) con asistencia, % que paga, precio de entrada, gasto en barra por persona, boxes, costo de barra % y comisiones %;
  - costos fijos editables, margen de contribución y asistentes para no perder;
  - parte de un evento real: asistencia de puerta, barra por persona, costo de barra descontando el stock final y costos fijos;
  - si falta un dato clave dice **"Falta dato"** en vez de calcular;
  - "Usar" guarda un escenario como presupuesto de un evento futuro.
- **Inventario y barra**: productos (stock, mínimo, valor), movimientos y consumo por evento, con un conteo de apertura y cierre de todos los productos a la vez. Avisa si el stock final contado no coincide con el cargado en finanzas.
- **Espacio de evento**: pestañas *Finanzas y operación*, *Pagos y cobros* (pagado, por pagar, comprometido, cobrado, por cobrar), *Inventario* y *Simulador* (eventos que no han ocurrido), más **Duplicar** (plantilla con los mismos ingresos y costos como presupuesto).
- **Tabla reutilizable** (`os/DataTable.jsx`): orden, búsqueda, columnas visibles (se recuerdan), paginación y CSV.
- **Resumen ejecutivo**: caja, por pagar y por cobrar salen del libro. Sin datos siguen como "no disponible".
- **Creación rápida** ("Nuevo"): evento (C), transacción (T), movimiento, cuenta y producto. También desde ⌘K.

## Verificado
- Recorrido con Playwright contra el API real y un Redis en memoria:
  1. Crear la cuenta BCP con saldo inicial.
  2. Registrar el pago del local del 14/11, un gasto de contador y un costo vencido del 05/12.
  3. Revisar el resumen de finanzas: caja S/ 3,650, por pagar S/ 2,500 vencido y resultado del grupo −S/ 2,032 (sin contar dos veces el pago del local).
  4. Recorrer transacciones, por pagar, flujo y presupuestos.
  5. En el simulador: punto de equilibrio de 226 asistentes, verificado a mano; guardar un escenario como presupuesto.
  6. Crear productos y hacer conteo de apertura y cierre: consumo y aviso de diferencia con finanzas.
  7. Revisar las pestañas del evento, duplicar, mostrar u ocultar columnas y la vista móvil.

  **Sin errores de consola.**
- `npm test`: 22 de 22.

## Pendiente
- **Adjuntos** (fotos de facturas y boletas): necesitan almacenamiento de archivos (por ejemplo, Vercel Blob). Por ahora se guarda tipo y número de comprobante.
- **Importar extractos** de BCP, Wally y Culqi POS: lo hago yo con la llave de API cuando me pases los reportes (ver `03-carga-post-evento.md`). Un importador dentro de la app puede venir después.
- **Reembolsos al personal** y **activos fijos con depreciación**: el modelo los admite (gasto con categoría, inversión en marca), pero no tienen pantalla propia.
- Fases 3 a 5: ventas y reservas, promotores, operaciones, marketing, CRM, integraciones y modo en vivo.

## Supuestos
- Fecha de devengo (`date`) y fecha de pago (`paidOn`) separadas. Sin `paidOn` es pendiente.
- Los USD se convierten con el tipo de cambio de cada transacción. Las cuentas en USD necesitan un tipo de cambio de referencia para sumarse a la caja en soles.
- El inventario es uno solo para las tres marcas, y un conteo es el stock total en ese momento.
