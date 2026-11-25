# Paradisio OS — Fase 1: informe

Decisiones tomadas por el dueño (25/11/2026):

- **Datos**: se queda todo en el Redis que ya usa el admin. No se agrega Postgres.
- **Acceso**: una sola persona (el dueño), con la clave de administración de siempre (`CEO_PASSCODE`, o `STAFF_PASSCODE` mientras no exista). Sin cuentas ni roles por ahora.
- Los módulos de fases futuras **no aparecen** en la navegación hasta que funcionen.

## Qué cambió

### Backend

| Archivo | Qué hace |
|---|---|
| `lib/ceo-data.js` | Lectura y validación de finanzas, agregados en vivo de la ticketera y Culqi. Movido tal cual desde `api/ceo.js` para compartirlo; `api/ceo.js` responde exactamente lo mismo que antes. |
| `lib/os/stages.js` | Etapas del evento: Concepto → Evaluación financiera → Confirmado → Preproducción → En venta → En vivo → Liquidación → Cerrado (+ Cancelado). Traduce el `status` viejo y lo mantiene sincronizado. |
| `lib/os/finance.js` | **Capa de cálculo única**. Todas las cifras del OS salen de aquí. Define cada métrica (`METRICS`), calcula evento, marca y grupo, detecta problemas de datos y arma la lista de atención. |
| `api/os.js` | Endpoint del OS: `load`, `summary`, `save`, `event.update`, `event.create`, `activity`. Valida la clave en el servidor en cada request. |
| `test/os-finance.test.js` | 11 pruebas de las reglas financieras (`npm test`). |
| `vercel.json` | Reescribe `/administracion/*` al `index.html` para que las rutas profundas (`/administracion/eventos/…`) funcionen al recargar o compartir. |

Seguridad y datos:

- **Límite de intentos**: 8 claves incorrectas desde una IP bloquean 15 minutos (`os:auth_fail:{ip}`).
- **Control de versión**: si el documento cambió desde que lo cargaste, la escritura se rechaza (409) en vez de pisar cambios.
- **Historial**: antes de cada escritura se guarda la versión anterior en `ceo:finance:history` (últimas 50). Si algo sale mal, se puede recuperar.
- **Auditoría**: cada cambio queda en `os:audit` (últimas 500) con fecha, acción, evento y qué campos cambiaron (antes → después).
- El OS ya **no ofrece "Restaurar arranque"** (borraba `ceo:finance`). El endpoint viejo lo sigue teniendo, pero nadie lo llama.
- No se tocó la ticketera, la puerta, los promotores ni los reclamos.

### Frontend (`dashboard/` → `/administracion`)

- **React 19.** Los componentes shadcn v4 asumen React 19: con React 18, menús y popovers abiertos desde un `Button` quedaban fuera de pantalla. Esto también afectaba al dashboard anterior.
- **Rutas reales** (`react-router`): `/`, `/atencion`, `/calendario`, `/eventos`, `/eventos/:id`, `/finanzas`, `/finanzas/datos`, `/marcas/:id`, `/actividad`.
- **Shell**:
  - Barra lateral plegable a íconos, con grupos que se pueden contraer (Espacio de trabajo, Negocio, Marcas, Sistema).
  - Selector de espacio de trabajo persistente: Todo el grupo, Club, Beats, Icon.
  - Ruta de migas, notificaciones (lista de atención), botón "Nuevo" (tecla `C`) y ⌘K.
  - Interruptor de impuestos, hora de la última sincronización, modo claro/oscuro y menú de cuenta.
- **Paneles laterales**:
  - **Evento**: cifras, alertas, edición de nombre, etapa, fecha, marca, local, inventario inicial y notas.
  - **Métrica**: definición, fórmula y qué eventos la componen. Se abren desde cualquier KPI, tabla, tablero, calendario o alerta.
- **Resumen ejecutivo**:
  - KPIs reales: ingresos, resultado, margen, y caja / por pagar / por cobrar como **no disponibles**.
  - KPIs proyectados, punteados: ingresos y utilidad (solo de presupuestos completos).
  - Resultado por evento, lista de atención, próximos eventos, portafolio por marca, real vs. presupuesto y actividad reciente.
  - Filtros de período y de marca (vía espacio de trabajo).
- **Eventos**:
  - **Lista**: orden por columna, búsqueda, filtro por etapa, paginación y CSV.
  - **Tablero**: columnas por etapa, con "Mover a…".
  - **Calendario**: mensual, lunes primero, en hora de Lima.
- **Espacio del evento**: barra de etapas clicable, alertas, real vs. presupuesto y el detalle financiero y operativo que ya existía (Culqi, puerta, barra, stock).
- **Finanzas**: estado de resultados por evento, con real y proyectado en tablas separadas, totales e inventario inicial/final.
- **Datos financieros**: el editor de siempre, ahora con etapa e inventario inicial, aviso al salir con cambios sin guardar y guardado con control de versión.
- **Atención** y **Registro de actividad** como páginas propias.
- **Formato Perú**: `es-PE`, PEN (USD soportado en el formateador) y "hoy" calculado en `America/Lima`.

## Correcciones de cálculo

| Problema (auditoría §2.3) | Ahora |
|---|---|
| 9. Stock contado dos veces | Resultado = ingresos − costos + stock final − **inventario inicial**. El evento que sigue a un cierre con stock muestra una alerta hasta que se registra cuánto usa; no se inventa el número. |
| 11. Impuestos inconsistentes | Se avisa en los eventos reales sin líneas de IGV/renta. Los datos no se cambiaron: hay que decidir si la barra del 14/11 está con IGV incluido. |
| 12. Culqi sin conciliar | Se compara lo cobrado por Culqi con las líneas de entradas, boxes y mesas, y se avisa la diferencia. **Nunca se suman.** |
| 13. Ingreso mostrado como utilidad | Un presupuesto sin costos muestra "Incompleto" y queda fuera de la utilidad proyectada (pasaba con Beats). |
| 15. Estados del gasto | Al pasar un evento a Liquidación se guarda su presupuesto aprobado, así que desde ahí hay **real vs. presupuesto**. Comprometido / pagado / pendiente llega en la Fase 2. |
| 16. Cálculos en el navegador | Totales del OS en el servidor. El detalle por línea de la vista de evento (heredado) usa la misma fórmula en `src/lib.js`; se unifica en la Fase 2. |

## Qué funciona (verificado)

- Recorrido completo con Playwright contra el `api/os.js` real y un Redis en memoria con el seed:
  - login (clave mala y buena), resumen, panel de métrica, cambio de espacio de trabajo;
  - lista, tablero y calendario;
  - edición desde el panel (registrar inventario inicial baja la utilidad del 05/12 de S/ 4,207.06 a S/ 2,648.48 y quita la alerta);
  - espacio del evento, finanzas, datos financieros (aviso de salida y guardado), atención, actividad, marca;
  - crear evento con la tecla `C`, ⌘K, enlace directo, modo oscuro y móvil.
- **Sin errores de consola.**
- Conflicto de versión (409), etapa inválida (400), captura del presupuesto al pasar a Liquidación, historial y auditoría: probados contra el endpoint.
- `npm test`: 11 de 11.

## Pendiente

- **Fase 2**: transacciones, cuentas y saldos (caja), por pagar / por cobrar, estados de costo (presupuestado, comprometido, pagado), inventario con conteos, simulador de rentabilidad, y unificar el detalle por línea en la capa del servidor.
- **No implementado**: Inbox de tareas, "Mis tareas", plantillas y duplicado de eventos, checklists y vista "en vivo". No aparecen en la navegación.
- La lista de atención y el resumen respetan el interruptor de impuestos; el **panel lateral de evento muestra siempre las cifras con impuestos**.

## Supuestos

- Números **reales** = etapa Liquidación o Cerrado (antes, `status: realizado`). "En vivo" todavía cuenta como presupuesto.
- La fecha que sigue a un cierre con stock es la única que puede heredarlo.
- Las líneas "Entradas" y "Boxes y mesas" son las que pasan por Culqi; se usan solo para conciliar.

## Qué verificar en producción

1. Crear `CEO_PASSCODE` en Vercel para que la clave del staff deje de abrir el OS (el OS lo avisa en Atención mientras falte).
2. Abrir `/administracion` y confirmar que se ven las finanzas guardadas en Redis (no las de arranque), y que las rutas profundas cargan al recargar.
3. Decidir si los S/ 1,558.58 de stock del 14/11 los usa el 05/12 y registrarlos como inventario inicial.
4. Revisar si la barra del 14/11 (S/ 8,638) está con IGV incluido.
