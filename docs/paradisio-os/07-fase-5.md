# Paradisio OS — Fase 5: informe

Alcance: integraciones, analítica avanzada y modo en vivo del día del evento. Con esto quedan cubiertas las cinco fases del plan.

## Integraciones (`/integraciones`)
- Estado de cada fuente: **automática** o **manual**, última sincronización y último dato recibido. **Nunca** se muestra el valor de una llave (hay una prueba para eso).

| Fuente | Tipo | Cómo |
|---|---|---|
| Web de tickets | Automática | Tiempo real (registros, QRs, puerta, promotores); último registro y último escaneo |
| Culqi (venta online) | Automática | API de solo lectura, cada 10 min |
| Culqi POS (barra) | Manual | Sin API pública: reporte después de cada fecha |
| Wally | Manual | Sin API: cierre después de cada fecha |
| BCP | Manual | Sin API para empresas pequeñas: estado de cuenta en Excel |
| Correo (Resend) | Automática | Envío de QRs y reclamos |
| Llave de Claude | Automática | Carga de reportes post-evento |
| Clave propia del OS | — | Avisa si falta `CEO_PASSCODE` |

- **Conciliar Culqi con el libro:**
  - trae cada cobro **exitoso** de Culqi como transacción "Venta / cobro" ligada a su fecha (por la ventana de venta), más su **comisión** como costo;
  - cada cobro tiene referencia única (`chr_…`, `fee:chr_…`): al volver a correrlo solo entran los nuevos;
  - son cobros de montos que ya están en la liquidación, así que entran a caja y no al resultado (regla de la Fase 2);
  - `lib/culqi-sync.js` gana `chargesForEvents()`, de solo lectura y sin tocar lo existente.

## Analítica (`/analitica`)
Solo fechas reales (Liquidación o Cerrado). Cada indicador es "no disponible" si falta el dato.

- **Por fecha:** asistentes verificados; ingreso, barra, costo y resultado por asistente; resultado y margen.
- **Costo por cliente nuevo:** marketing ÷ clientes nuevos del CRM.
- **Recurrencia:** % del público que ya había venido.
- **Conversión de promotores** y asistencia con QR.
- **Venta en la última semana:** % de los registros que llegaron en los 7 días previos.
- **Variación vs. presupuesto** y **crecimiento** contra la fecha anterior de la misma marca.
- **Comparativos** por marca, local y mes, que aparecen **desde la segunda fecha cerrada**.
- Respeta los botones de marca.

## En vivo (`/en-vivo`), pensado para el celular
- Abre la fecha de hoy (o la de anoche hasta el mediodía); si no, la próxima.
- Se actualiza cada **30 segundos** mientras la página está abierta y muestra la hora de la última sincronización y qué se actualiza solo y qué es manual.
- **Puerta:** adentro vs. **aforo** (editable por fecha), QRs por entrar, después de hora, último escaneo y entradas cada 15 minutos.
- **Venta:** web y mesas en tiempo real; Culqi con su hora; POS marcado como manual.
- **Run of show** con la línea actual resaltada (hora de Lima), **staff** con confirmación y **barra** según el conteo de apertura.
- **Incidentes:** gravedad, área y descripción, con hora; se marcan resueltos. Los graves sin resolver aparecen en Atención.
- Nuevo campo `capacity` (aforo) en los eventos y nuevo documento `os:incidents`, con versión, historial y auditoría.

## Verificado
- `npm test`: **40 de 40** (5 nuevas).
- Playwright contra el API real, con un Redis en memoria y un **Culqi simulado** (solo locales). **Sin errores de consola.**
  - **Conciliación:** primera importación = 3 cobros + 3 comisiones (el rechazado no entra); segunda = 0 nuevos.
  - **Analítica:** ingreso/asistente S/ 115.75 con los datos de prueba; comparativos ocultos con una sola fecha.
  - **En vivo:** aforo 300 → 34.7 %, incidente grave → alerta, resolver.
  - **Móvil:** iPhone 13.
- Bug corregido: el botón de importar quedaba deshabilitado después de crear la cuenta de Culqi.

## Supuestos
- Una fecha de la ticketera sin evento enlazado en el OS (por ejemplo, la Apertura del 28/08) se cuenta como **Paradisio Club**, porque la web de tickets es del Club.
- El aforo no existía en ningún dato: se ingresa por fecha.
- El modo en vivo consulta todos los tickets en cada actualización (30 s). Para un solo usuario está bien; con mucho volumen convendría un endpoint más liviano.

## Pendiente
- POS de barra y Wally en vivo: requieren una API del proveedor o exportaciones automáticas.
- Adjuntos y casilla de consentimiento de marketing (ver Fase 4).
