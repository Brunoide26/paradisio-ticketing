# Paradisio OS — Fase 4: informe

Alcance: marketing y contenido, sponsorships, equipo, CRM (audiencia) y documentos. Todas las secciones respetan los botones de marca (Grupo / Club / Beats / Icon).

## Reglas
- **Sponsors:** el monto de un acuerdo es **proyectado**. Lo real es lo cobrado: transacciones del libro con ese sponsor. Los aportes **en especie** se valorizan aparte y **nunca** suman a ingresos.
  - Cobro de un sponsor de **una fecha**: transacción "Venta / cobro" ligada al evento; el ingreso va en la liquidación de esa fecha (línea "Sponsors").
  - Cobro de un sponsor **multi-marca o del grupo**: transacción "Otro ingreso", que entra al resultado corporativo.
- **Campañas:** el gasto real sale del libro (transacciones con la campaña elegida). El presupuesto es un tope, no un gasto. Los "registros en la ventana" solo existen si la fecha vende por la web de tickets.
- **Audiencia (CRM):**
  - Cada persona se identifica en el servidor con un **hash** de su correo o DNI. El navegador nunca recibe nombres completos, DNI, correos ni teléfonos (hay una prueba automática que lo verifica).
  - La política de privacidad exige **consentimiento expreso** para comunicaciones de marketing (finalidad 8), pero **la web no tiene esa casilla**: hoy hay 0 personas con consentimiento. Por eso no se exportan contactos.
- **Documentos:** se guardan como **enlaces** (Drive, Dropbox…), no archivos: no hay almacenamiento de archivos configurado. Solo se aceptan enlaces `http(s)`.

## Qué se agregó

### Backend
- `lib/os/commercial.js`:
  - contenido: canal, estado idea → brief → diseño → revisión → aprobado → publicado, responsable, diseñador, entrega, publicación, enlace y resultados;
  - campañas: presupuesto vs. gastado y comprometido del libro, piezas, registros en la ventana y costo por registro;
  - recursos de marca;
  - sponsors: etapas prospecto → … → renovación / perdido, marcas y fechas que cubre, efectivo, especie, contrato, renovación y entregables; cobrado y por cobrar del libro;
  - documentos ligados a fecha, proveedor o sponsor, con vencimiento;
  - alertas: contenido atrasado, entregables vencidos, renovación en 30 días, contrato vencido y documentos por vencer o vencidos.
- `lib/os/crm.js`: personas, asistentes, recurrentes, nuevos vs. recurrentes por fecha, retención entre fechas, segmentos (tamaño), canal de llegada, promotores que más clientes trajeron, edades, gasto y clientes frecuentes con iniciales. Se calcula para el grupo y por marca.
- Documentos nuevos `os:marketing`, `os:sponsors` y `os:documents`, con versión, historial y auditoría.
- Las transacciones admiten `campaignId` y `sponsorId`. Se agrega el tipo de contacto "Equipo interno".
- `test/os-phase4.test.js`: 5 pruebas nuevas (35 en total).

### Frontend
- **Marketing y contenido** (`/marketing`):
  - tablero por estado y calendario (con las fechas de evento);
  - campañas con presupuesto, gastado, disponible, piezas y registros;
  - recursos de marca.
- **Sponsors y alianzas** (`/sponsors`): KPIs (en negociación y firmado como proyectado; cobrado, por cobrar y en especie), pipeline por etapa y entregables pendientes con check.
- **Equipo** (`/equipo`): personas del equipo interno y su carga de tareas (abiertas, vencidas, hechas) según el responsable de cada tarea.
- **Audiencia (CRM)** (`/audiencia`): aviso de consentimiento, KPIs, nuevos vs. recurrentes, retención, segmentos, canales, edades, promotores y clientes frecuentes (iniciales).
- **Documentos** (`/documentos`): tabla con tipo, a qué está ligado, firma y vencimiento, y botón Abrir.
- **Transacciones**: campos "Campaña" (gastos) y "Sponsor" (cobros).
- **Barra lateral**: grupos nuevos *Comercial* (Marketing, Sponsors, Audiencia) y *Organización* (Equipo, Documentos). "Nuevo" y ⌘K crean contenido, campañas, sponsors y documentos.

## Verificado
- Recorrido con Playwright contra el API real y un Redis en memoria con tickets de prueba (solo locales), **sin errores de consola**:
  - campaña con presupuesto S/ 800 y gasto ligado S/ 500 → disponible S/ 300;
  - 3 piezas de contenido (una atrasada) y calendario;
  - sponsor firmado: S/ 4,000 + S/ 1,200 en especie, cobro de S/ 2,000 → por cobrar S/ 2,000, entregable vencido y renovación próxima;
  - persona del equipo y documento por vencer;
  - audiencia con 2 fechas: retención 66.7 % de la Apertura al 14/11;
  - Icon sin registros muestra su mensaje;
  - nuevas alertas en Atención.
- La respuesta completa del servidor no contiene nombres ni correos de los tickets.
- `npm test`: 35 de 35.

## Pendiente / recomendaciones
- **Casilla de consentimiento de marketing en el registro** (opcional, desmarcada por defecto), guardada en el ticket como `marketingConsent`. Sin eso no se puede usar la base para campañas, según tu propia política. Puedo agregarla a la web cuando reabra la venta.
- **Adjuntar archivos** (contratos, facturas) en vez de enlaces: requiere activar un almacenamiento como Vercel Blob.
- **Fase 5**: integraciones, analítica avanzada y modo en vivo.
