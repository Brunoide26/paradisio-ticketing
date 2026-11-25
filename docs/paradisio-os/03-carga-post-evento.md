# Carga de reportes después de cada evento

Decisión del dueño (25/11/2026): después de cada evento sube los reportes a una sesión de Claude, y Claude actualiza Paradisio OS directamente con una llave de API propia.

## Configuración (una sola vez)

1. **Generar la llave**: 32 caracteres o más, al azar. Por ejemplo, en una terminal de Mac: `openssl rand -hex 32`, o con un generador de contraseñas.
2. **Vercel** → proyecto → Settings → Environment Variables: crear `OS_API_TOKEN` (Production) con esa llave y **volver a desplegar** (las variables nuevas solo aplican en un despliegue nuevo).
3. **Claude**: pega la misma llave en el formulario seguro de credenciales que abre la sesión, para el host `www.paradisioclub.com`. Queda guardada en el entorno de Claude y se inyecta en cada request; nunca aparece en el chat ni en el código.

Para **revocar**: borrar `OS_API_TOKEN` en Vercel y volver a desplegar. Desde ese momento la llave deja de servir.

## Después de cada evento

Sube a la sesión lo que tengas de esa fecha:

| Reporte | Qué se saca | Dónde va en el OS |
|---|---|---|
| **Wally** (cierre) | Ventas y costos de la noche que registre Wally | Ingresos / costos del evento |
| **Culqi POS** (reporte de ventas) | Ventas de barra por terminal, operaciones, ticket promedio, medios de pago | Ingreso "Barra" + bloque de barra (terminales, medios de pago) |
| **BCP** (estado de cuenta en Excel) | Pagos a proveedores, staff, local; depósitos | Costos del evento (Fase 2: también movimientos de caja) |
| Conteo de stock al cierre (si lo hay) | Inventario que quedó, a costo | Stock final y detalle de stock |

Lo que hace Claude:

1. Lee los archivos y arma ingresos, costos, stock y barra del evento.
2. **Cuadra** antes de cargar: Culqi POS contra la barra, BCP contra los costos cargados, Culqi online contra entradas, boxes y mesas. Si algo no cuadra, lo dice y pregunta.
3. Carga con `event.numbers`: reemplaza solo lo que trae el reporte. Cada carga:
   - queda en **Registro de actividad** con la etiqueta "Claude", qué cambió (totales antes → después) y de qué reporte salió;
   - guarda la versión anterior en el historial (últimas 50), así que se puede deshacer;
   - se rechaza si hubo cambios desde otra pestaña desde que Claude leyó los datos.
4. Si corresponde, mueve el evento a **Liquidación**: el presupuesto queda guardado y aparece "real vs. presupuesto".
5. Te deja un resumen: resultado, margen, diferencias y lo que falta.

## API

`POST https://www.paradisioclub.com/api/os` con `Authorization: Bearer <OS_API_TOKEN>`.

- `{ "action": "load" }`: datos, cálculos y la versión actual (`version`).
- `{ "action": "event.numbers", "id": "<evento>", "baseVersion": "<version>", "source": "Culqi POS 14/11", "numbers": { ... } }`
  - `income`, `costs`: `[{ label, category, amount }]`
  - `brandInvestment`: `[{ label, amount }]`
  - `stockLeft`, `openingStock`: número o `null`
  - `stock`: `[{ label, detail, cost }]`
  - `bar`: `{ operations, avgTicket, terminals: [{ label, ops, amount }], payments: [{ label, amount }], vsProjection, cocktails }` o `null`

  Solo se reemplazan las claves enviadas.
- `{ "action": "event.update", "id", "patch": { stage, venue, ... }, "baseVersion" }` y `{ "action": "event.create", "event": { ... } }`, igual que desde la interfaz.

Los formatos exactos de Wally, Culqi POS y BCP se documentan aquí cuando llegue el primer reporte real de cada uno.
