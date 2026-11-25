# Paradisio OS — Fase 3: informe

Alcance: ventas y reservas, promotores y gestión operativa.

## Principios
- **La ticketera no se toca.** Ventas, mesas, puerta y promotores se **leen** de los mismos tickets de Redis que usan la web, la puerta y el admin. No hay datos duplicados ni migración.
- **Sin datos personales en el OS.** Solo se calculan agregados por fecha, tipo, fase, canal, mesa y código de promotor; nunca nombres, DNI, correos ni teléfonos (hay una prueba automática para eso).
- **Comisiones sobre asistencia verificada** en puerta, no sobre registros. Sin regla de comisión definida, la comisión es "no disponible" (no se inventa).
- Los pagos a promotores y staff son **transacciones del libro** (Fase 2), así que entran a caja y a "pagado" sin duplicarse en el resultado del evento.
- Cada promotor sigue viendo **solo lo suyo** en su portal actual (`/promotor`); el OS es solo para el dueño.

## Qué se agregó

### Backend
- `lib/os/sales.js`: por fecha calcula:
  - registros, anulados, sin QR, QRs emitidos, asistentes (personas, contando mesas) y no-show;
  - entradas tardías y cobradas en puerta;
  - venta web, canales, fases/precios (SKU) y velocidad de venta por día;
  - estado de cada mesa y box del plano real de la web (posiciones del catálogo).
- `lib/os/promoters.js`: por evento calcula:
  - por promotor: QRs, asistentes verificados, asistencia, ventas con su código, meta y cumplimiento;
  - comisión (fijo + S/ por asistente + % entradas + % mesas), pagado (del libro) y por pagar;
  - totales por equipo.
- `lib/os/ops.js`:
  - directorio de contactos (local, artista/DJ, proveedor, staff, contratista), con tarifa, calificación y RUC;
  - tareas con responsable, fecha límite, estado y **dependencias** (se bloquean si dependen de algo sin terminar; se rechazan los ciclos);
  - **checklist estándar de producción**: 18 tareas con fechas relativas a la fecha del evento, de −28 a +7 días, con dependencias;
  - run of show (ordena pasada la medianoche) y staff asignado por evento.
- Documentos nuevos `os:promo` y `os:ops`, con versión, historial y auditoría como el resto.
- `api/os.js`:
  - en la carga, ventas y promotores por evento (eventos con "Fecha en la web de tickets");
  - acciones `promo.*` (equipos, miembros, reglas, metas) y `ops.*` (contactos, tareas, checklist, run of show, staff);
  - alertas nuevas: tareas vencidas, tareas bloqueadas por vencer y comisiones por pagar de eventos cerrados.
- Las transacciones admiten `promoterCode`, para ligar cada pago de comisión con su promotor.
- `test/os-phase3.test.js`: 8 pruebas nuevas (30 en total).

### Frontend
- **Ventas y reservas** (`/ventas`):
  - KPIs: registros, QRs, entraron, asistencia, venta web y mesas vendidas;
  - plano de mesas y boxes, velocidad de venta, canales y fases y precios.
- **Promotores** (`/promotores`):
  - *Por evento*: tabla con metas editables, comisión, pagado y botón **Pagar**, que abre la transacción ya llena con el monto pendiente; regla de comisión del evento.
  - *Historial*: totales por promotor en todas las fechas.
  - *Equipos*: crear equipos, asignar miembros y elegir líder.
- **Operaciones y proveedores** (`/operaciones`): directorio con filtros y tareas.
- **Mis tareas** (`/tareas`): todo lo pendiente, con vencidas, de esta semana y bloqueadas. Se marca como hecha con un clic.
- **Espacio del evento**, pestañas nuevas:
  - *Producción*: checklist con progreso, run of show y staff. El botón "→ Finanzas" registra el pago como comprometido.
  - *Ventas y reservas* y *Promotores*.
- **Navegación**: Mis tareas, Ventas y reservas, Promotores y Operaciones. "Nuevo" y ⌘K crean tareas y contactos.

## Verificado
- Recorrido con Playwright contra el API real y un Redis en memoria con tickets de prueba (solo locales):
  - ventas y plano: 3 de 13 mesas, venta web S/ 4,595;
  - regla de comisión: S/ 10 por asistente + 10 % de mesas;
  - comisión de Antonia: 21 × 10 + 10 % de S/ 1,500 = **S/ 360**, pagada desde el botón → "al día";
  - meta: 21/25 = 84 %;
  - equipos con líder, historial y directorio;
  - checklist estándar del 05/12: 18 tareas, dependencias bloqueadas y vencidas marcadas;
  - run of show ordenado (22:30 → 23:00 → 01:00);
  - staff → transacción comprometida;
  - Mis tareas, Atención y móvil.

  **Sin errores de consola.**
- `npm test`: 30 de 30.

## Limitaciones y supuestos
- Ventas y promotores solo existen para eventos enlazados a la ticketera ("Fecha en la web de tickets"). Hoy es Paradisio Club; Beats e Icon no venden por la web.
- La ticketera no registra el **monto** cobrado en puerta: se muestra un estimado (cobros × precio de puerta) y el real se carga en la liquidación.
- **Depósitos y saldos de mesas**: la web cobra la mesa completa. Si se acepta un adelanto por fuera, se registra como "Anticipo de cliente" en Finanzas.
- **Guest lists, cortesías y QRs** se siguen gestionando en el admin actual (`/admin`); el OS los muestra agregados.
- **Fases de precio y mesas** salen del catálogo de la web. Para cambiarlos hay que hacerlo en la web (o en variables de entorno), no en el OS.
- La regla de comisión es por evento y la misma para todos los promotores de esa fecha. Bonos individuales: anotarlos en la regla y pagarlos como transacción.

## Pendiente (Fases 4 y 5)
Marketing y contenido, sponsorships, equipo, CRM con consentimiento, documentos, integraciones, analítica avanzada y modo en vivo.

## Ajuste posterior: espacios por marca

Pedido del dueño: cada marca tiene que verse por separado, con qué le entra al grupo y qué le queda, y lo mismo para promotores, proveedores y pagos.

- **Comparativo de marcas** (`/marcas`):
  - una tarjeta por marca, con su proyectado aparte;
  - una tabla lado a lado: fechas, ingresos, costos, personal, resultado, margen, % del grupo, comisiones, pagado y por pagar, con la columna Grupo;
  - un gráfico de resultado por marca.

  Si una marca no tiene fechas realizadas muestra "—", no cero.
- **Espacio de cada marca** (`/marcas/:id`):
  - *Resumen*:
    - qué le entra, en qué se le va, **personal por área** (barra, seguridad, limpieza, caja) y promotores;
    - sus fechas reales y proyectadas en tablas separadas;
    - sus pagos.
  - *Fechas*: la vista de siempre.
  - *Costos y proveedores*: costos reales y presupuestados en tablas separadas, proveedores del libro y staff asignado.
  - *Promotores*.
- **Barra lateral**: en Marcas, "Comparativo de marcas" y cada marca (con la etiqueta "nueva" mientras no tenga fechas realizadas).
- **Servidor**: `os.brands` calcula, por marca, con la misma capa de cálculo; `staffArea()` clasifica el personal por área según el concepto del costo.

Datos cargados en producción (con la llave, auditados como "claude", sin tocar las finanzas):
- **Directorio**: 5 equipos (seguridad, bartenders, mozos, cajera, limpieza).
- **Staff asignado**:
  - 14/11 (real): S/ 800 + 505 + 140 + 100 + 140;
  - 05/12 (presupuesto): S/ 760 + 680 + 140.
- **Inventario**: 12 productos con el conteo de cierre del 14/11, por S/ 1,558.73. La diferencia de S/ 0.15 con finanzas es redondeo de costos unitarios.
  - Las líneas que mezclan varios productos ("Gin, Campari y vermouth", "Mixers y jarabes", "Vodka y Kahlúa", "Pisco y vino") quedaron como **lote** con su costo total, porque no hay costo por botella.
  - Para separarlas, edita el producto o crea los productos individuales y haz un ajuste.
