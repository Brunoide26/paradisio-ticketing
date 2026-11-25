# Paradisio OS — Auditoría y plan de implementación

Estado: aprobado con cambios. **Decisiones del dueño (25/11):** los datos se quedan en el Redis del admin (sin Postgres) y entra una sola persona con la clave de administración (sin cuentas ni roles). Las secciones 3 y 4 quedan como referencia para cuando haga falta más de un usuario. Avance de la Fase 1: ver `02-fase-1.md`.
Fecha de la auditoría: 25/11/2026 (rama `main` en `59730be`).

---

## 1. Qué existe hoy

### 1.1 Arquitectura

| Pieza | Tecnología | Dónde |
|---|---|---|
| Sitio público + venta de entradas | HTML estático + JS inline | `index.html`, `entrada.html`, `orden.html` |
| Puerta (check-in con QR) | HTML estático | `staff.html` |
| Panel de tickets, promotores, invitaciones, reclamos | HTML estático (2.179 líneas) | `admin.html` |
| Portal de promotores | HTML estático | `promotor.html` |
| Dashboard de CEO | React 18 + Vite + Tailwind v4 + shadcn/efferd, compilado a `administracion/` | `dashboard/` |
| Backend | 30 funciones serverless de Vercel (CommonJS, sin framework) | `api/*.js`, `lib/*.js` |
| Persistencia | Upstash Redis (clave-valor). No hay base de datos relacional | `lib/tickets.js` |
| Pagos | Culqi (cobro + lectura de cargos para el dashboard) | `api/charge.js`, `lib/culqi-sync.js` |
| Correo | Resend | `lib/tickets.js`, `lib/reclamos.js` |
| Modo "coming soon" | `middleware.js` tapa el sitio público; deja pasar las herramientas internas y `/api` | `middleware.js` |

### 1.2 Datos reales que hay que preservar

En Redis (producción, no accesible desde este entorno):

- **Tickets** `ticket:{id}`, índice `all_ticket_ids`, tokens `entrada_token:*`, órdenes `order:*`, contadores `counters`, mesas reservadas `table:{eventId}:{unitId}`.
- **Promotores**: roster estático en `lib/promoters.js` + altas/bajas en Redis, logins con hash scrypt, sesiones, cupos e invitaciones por fecha (`promoter_*`, `invite:*`).
- **Reclamos** (Libro de Reclamaciones, obligación legal): `reclamo:*`.
- **Finanzas del dashboard**: un solo documento JSON en `ceo:finance`. Si nadie lo editó todavía, el dashboard usa `lib/ceo-seed.js` (4 fechas: Club 14/11 real, Beats 03/12, Club 05/12 presupuesto, Icon 19/12).
- **Caché de Culqi** (10 min).

Activos de marca: `administracion/logos/` (Club, Beats, Icon), `paradisio-logo.png`, `logo-*.png`, fuentes en `/fonts`. No se tocan.

### 1.3 Funciones que ya funcionan y deben sobrevivir

Venta de entradas y mesas con Culqi, QR por correo, check-in con reglas de horario (cortesía hasta 12 a.m., cobro tardío), anulación/reactivación, invitaciones de promotor con aprobación, portal de promotor con usuario y contraseña propios, ranking de promotores, Libro de Reclamaciones con plazos hábiles, exportación CSV y el dashboard de CEO actual (grupo, marcas, Culqi, puerta en vivo, editor de finanzas).

---

## 2. Problemas encontrados

### 2.1 Seguridad y acceso

1. **Una sola clave compartida** (`STAFF_PASSCODE`) abre el admin, la puerta y, mientras no exista `CEO_PASSCODE`, también las finanzas. No hay cuentas individuales ni roles, y no queda registro de quién hizo qué.
2. La clave viaja en el cuerpo de cada request y vive en `sessionStorage`. No hay sesión, expiración ni límite de intentos (los promotores sí tienen límite; el admin y el CEO no).
3. El cifrado de las contraseñas de promotor deriva su llave de `STAFF_PASSCODE`: cambiar la clave del staff afecta otro sistema.
4. Las finanzas se guardan como **un único JSON** con escritura "el último gana": dos personas editando al mismo tiempo se pisan, y no hay historial ni auditoría.

### 2.2 Modelo de datos

5. **Dos identidades de evento que no se hablan**: la ticketera usa la fecha ISO (`2026-11-14`) y solo conoce Paradisio Club; las finanzas usan `club-2026-11-14` y se enlazan a mano con `liveEventId`. Además existen fechas movidas (`17/10 → 24/10 → 14/11`) resueltas en código.
6. El "estado" de una fecha (`planificación`, `presupuesto`, `confirmado`, `realizado`) mezcla dos cosas distintas: **en qué etapa está el evento** y **qué tan firmes son sus números**. "Realizado" es lo único que hoy distingue real de proyectado.
7. Marcas, sedes, proveedores, artistas, cuentas bancarias y categorías no son entidades: son texto libre dentro de cada línea.
8. No existe el nivel corporativo: gastos del grupo, aportes de capital, cuentas de caja o activos compartidos no tienen dónde vivir.

### 2.3 Cálculos financieros (los más importantes)

9. **Stock contado dos veces.** El resultado del 14/11 suma `stockLeft` (S/ 1.558,58) como si fuera ganancia. El presupuesto del 05/12 consume "el stock que quedó" sin cargarle ese costo. El mismo inventario mejora el resultado de las dos fechas.
10. **Compras de barra = consumo.** Disenzo, Makro, VIGO, etc. se registran enteros como costo del evento, y el remanente se corrige con un ajuste. No hay inventario inicial, compras, consumo e inventario final separados.
11. **Impuestos inconsistentes entre fechas.** La barra del 14/11 se registra en bruto (con IGV) y no tiene línea de IGV. El 05/12 sí tiene IGV y renta. El interruptor "con/sin impuestos" compara cosas distintas según la fecha.
12. **Culqi sin conciliar.** Lo cobrado por Culqi se muestra al lado de los ingresos cargados a mano (boxes y mesas), pero nada impide que el mismo dinero se sume dos veces si se carga en ambos lados. La comisión de Culqi también se carga a mano.
13. **Proyección de ingresos mezclada con utilidad.** En el dashboard actual, una fecha sin costos cargados muestra su ingreso como "utilidad proyectada" (pasa con Beats: S/ 600 de fee aparece como utilidad). Eso contradice directamente la regla "nunca combinar ingreso proyectado con utilidad proyectada". **Lo introduje yo en el rediseño anterior**; se corrige en la Fase 1.
14. La "inversión en marca" se lleva aparte (bien) pero no se registra como activo ni se deprecia: desaparece de cualquier reporte de caja.
15. No existen los estados de un gasto (presupuestado, comprometido, devengado, pagado, pendiente). Un costo hoy es solo un número.
16. Todos los cálculos viven en el frontend (`dashboard/src/lib.js`). Un CSV, un reporte por marca y otro por grupo pueden divergir.

---

## 3. Decisión central: dónde viven los datos

Lo que pides (modelo relacional normalizado, roles con alcance por organización, marca y evento, auditoría, migraciones seguras) **no se puede hacer bien sobre Redis clave-valor**. Propuesta:

- **PostgreSQL gestionado** (recomendado: Neon desde el Marketplace de Vercel; alternativa: Supabase). Se conecta con una sola variable `DATABASE_URL` en Vercel.
- **Drizzle ORM** con migraciones versionadas en el repo (SQL revisable, nunca destructivo).
- **Redis se queda** para lo que hace bien y ya funciona: ticketera, puerta, invitaciones, sesiones de promotor, caché de Culqi. Paradisio OS **lee** esos datos a través de un adaptador. No se migra la ticketera en caliente.
- La migración de finanzas **copia** `ceo:finance` (o el seed, si nunca se editó) a Postgres. Redis no se borra. Durante la transición el dashboard actual sigue funcionando.

## 4. Autenticación y permisos

- **Cuentas individuales** con acceso por enlace mágico de correo (Resend ya está configurado; no hay contraseñas que filtrar). Sesión en cookie `httpOnly`, `Secure`, `SameSite=Lax`, guardada en Postgres con expiración y revocación.
- **Roles con alcance**: un usuario recibe un rol en un ámbito (`organización`, `marca` o `evento`).
  - `owner` (todo), `finance` (finanzas de su alcance), `manager` (operación de su marca), `staff` (operación de evento, sin finanzas), `viewer` (solo lectura).
  - Promotor sigue en su portal actual; en la Fase 3 se integra como rol `promoter` limitado a sus datos.
- **Autorización siempre en el servidor**: cada endpoint resuelve usuario → permisos → alcance antes de leer o escribir. El frontend solo oculta botones; nunca es la barrera.
- **Auditoría**: cada escritura registra quién, cuándo, qué entidad, antes y después.
- La clave del staff sigue funcionando para `admin.html` y `staff.html` hasta que se migren; el dashboard nuevo deja de aceptarla.

## 5. Modelo de datos (núcleo)

```
organization ─┬─ brand ──────────── event ─┬─ event_budget_line
              │                            ├─ event_stage_history
              ├─ venue ─────────────────── ┘ ├─ ticketing_link (eventId de la ticketera)
              ├─ counterparty (proveedor, artista, sponsor, cliente)
              ├─ account (banco, caja, Culqi, Yape)
              ├─ transaction ─── transaction_line (marca?, evento?, categoría, monto, impuesto)
              ├─ category (plan de cuentas simple: ingreso, costo, gasto, activo, pasivo, patrimonio)
              ├─ user ─── membership (rol + alcance)
              ├─ task (organización | marca | evento)
              └─ audit_log
```

Reglas del modelo:

- `brand_id` y `event_id` son **opcionales** en transacciones y tareas: un gasto corporativo no pertenece a ninguna marca.
- Montos en **céntimos enteros** con `currency` (`PEN`/`USD`) y `fx_rate` a PEN guardado en la transacción. Nunca flotantes.
- Fechas: `occurred_on` (devengo) y `paid_on` (caja) por separado, en `America/Lima`.
- `kind` de transacción distingue: venta, costo, gasto, compra de inventario, aporte de capital, préstamo, depósito de cliente, transferencia entre cuentas. **Un aporte de capital nunca es venta; un depósito de cliente no es ingreso hasta que el evento ocurre.**
- Presupuesto y real viven en tablas distintas (`event_budget_line` vs. `transaction_line`), así que **no se pueden sumar por accidente**.
- Fuentes de ingreso con `source` (`manual`, `culqi`, `pos`, `ticketing`) y `external_ref` único: la base rechaza registrar dos veces el mismo cobro.
- Etapas del evento separadas de la firmeza de los números: `Concepto → Evaluación financiera → Confirmado → Preproducción → En venta → En vivo → Liquidación → Cerrado` (+ `Cancelado`).

## 6. Capa de cálculo financiero

Un único módulo en el servidor (`lib/os/finance/`) calcula todo; el frontend solo muestra. Cada métrica tiene una definición escrita y la pantalla permite ver de qué líneas sale.

| Métrica | Definición |
|---|---|
| Ingreso reconocido | Ventas de eventos ya realizados (más ventas corporativas), sin depósitos de clientes de eventos futuros ni aportes de capital |
| Costo de ventas de barra | Inventario inicial + compras asignadas − inventario final (con conteos). Sin conteos: "no disponible", no cero |
| Resultado del evento | Ingreso reconocido − costos directos del evento. La inversión en marca no entra: es activo |
| Margen | Resultado / ingreso reconocido. Sin ingreso: "no disponible" |
| Caja disponible | Suma de saldos de cuentas a la fecha (solo si hay saldo inicial cargado) |
| Por pagar / por cobrar | Obligaciones devengadas no pagadas / ventas devengadas no cobradas |
| Ingreso proyectado / Costo proyectado / Utilidad proyectada | Solo desde el presupuesto aprobado. La utilidad proyectada solo existe si el presupuesto tiene costos; si no, se muestra "incompleto" |
| Variación | Real − presupuesto, por línea y por categoría |

Los datos faltantes se muestran como **no disponibles**, nunca como cero.

## 7. Diseño de la interfaz

- Shell inspirado en Efferd App Shell 5 + Linear. Ya está instalado; se reutiliza:
  - **Barra lateral** con grupos plegables (Espacio de trabajo, Negocio, Marcas, Sistema) y el selector de espacio de trabajo arriba: Grupo, Club, Beats, Icon.
  - **Encabezado** con ruta, búsqueda ⌘K, notificaciones, creación rápida y cuenta.
  - **Paneles laterales derechos** para revisar o editar sin cambiar de página.
- Rejilla de 12 columnas a todo el ancho; densidad compacta (texto de 13 px, filas de 36 px, radio de 6–8 px, sombras mínimas).
- Superficies neutras (blanco y gris cálido) con modo claro y oscuro. El color de cada marca solo identifica sus datos: punto, borde izquierdo, serie de gráfico.
- **Real sólido, proyectado punteado y rotulado "Proyectado"**, como ya está en el dashboard.
- Español de Perú, PEN por defecto con USD disponible, formato `es-PE`, zona `America/Lima`.
- Rutas reales (`/administracion/eventos/:id` …) con `react-router` y reescritura en `vercel.json`, para que cada KPI enlace a su detalle y se pueda compartir un link.
- **Regla de producto**: ningún botón, pestaña o filtro aparece si no funciona. Los módulos de fases futuras **no se muestran** en la barra lateral hasta que existan (o aparecen deshabilitados con "Próximamente", según prefieras).

## 8. Hoja de ruta

| Fase | Alcance | Depende de |
|---|---|---|
| **1. Fundación** | Postgres + migraciones; migración no destructiva de las finanzas actuales; cuentas, enlace mágico, sesiones, roles con alcance, auditoría; shell nuevo (sidebar plegable, selector de espacio, ⌘K, creación rápida, paneles laterales, claro/oscuro); capa de cálculo con las correcciones 9–13; Resumen ejecutivo con datos reales; lista y pipeline de eventos (Kanban por etapa) con ficha de resumen | `DATABASE_URL` en Vercel |
| **2. Eventos y finanzas** | Espacio completo de evento (presupuesto, real, liquidación, reporte posterior); transacciones con adjuntos, cuentas y saldos, por pagar y por cobrar, presupuestos con estados, flujo de caja y proyección; inventario (catálogo, compras, conteos, consumo, transferencias); simulador de rentabilidad con escenarios | Fase 1 |
| **3. Ventas y operación** | La ticketera de Redis enlazada a eventos del OS; mesas y reservas con depósitos; promotores con equipos, metas y comisiones por evento (el portal actual pasa a usar cuentas del OS); proveedores, sedes, staff, run-of-show y checklists | Fase 2 |
| **4. Comercial** | Calendario de contenido y campañas, sponsorships multi-marca, equipo, CRM con consentimiento, documentos | Fase 3 |
| **5. Inteligencia** | Integraciones (POS, Culqi conciliado, bancos), analítica comparativa, modo "en vivo" para el día del evento | Fase 4 |

Al cerrar cada fase entrego: qué cambió, qué funciona, qué falta, supuestos y qué hay que verificar.

## 9. Riesgos y supuestos

- No tengo acceso a Redis de producción: la migración se probará con el seed y con un export que puedes correr tú (script incluido) antes de apuntar a producción.
- El sitio público está en "coming soon"; la ticketera no se toca en las Fases 1–2.
- El repositorio es público: ninguna llave, contraseña ni dato personal entra al código.
- La Fase 1 se entrega en varios PRs pequeños y revisables (datos y auth → shell → resumen ejecutivo → eventos), no en un solo cambio gigante.
