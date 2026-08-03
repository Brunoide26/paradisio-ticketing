# Entradas: correo, página de entrada y compra múltiple — Especificación

Handoff para Claude Code. `DESIGN.md` es la fuente única de verdad para tipografía, color y layout en todo lo que sigue.

Tres bloques. Se implementan en orden: A → B → C. Cada uno se muestra y aprueba antes de commitear.

---

# BLOQUE A — Entregabilidad del correo

**Problema que resuelve:** si el QR cae en spam o en Promociones, el asistente llega a la puerta sin entrada y se genera cola.

## A.1 Remitente

- **From:** `Paradisio <info@paradisioclub.com>`
- Si hoy sale desde `noreply@`, eliminarlo. Los filtros penalizan direcciones que no aceptan respuesta, y una respuesta con un problema real se perdería.
- **Reply-to:** la misma dirección.

## A.2 Asunto

```
Tu entrada para Paradisio — 28 de agosto
```

Sin mayúsculas sostenidas, sin signos de exclamación, sin palabras tipo "GRATIS" o "ÚLTIMA OPORTUNIDAD".

## A.3 Contenido

Un correo que es prácticamente solo una imagen de QR se clasifica como spam. Necesita texto real:

- Nombre del asistente
- Tipo de entrada y código `PDS-XXXXXX`
- Fecha del evento
- Hora de validez según el tier (Cortesía hasta 12:00 am / pagadas hasta 3:00 am)
- Venue: Espacio NHN, Barranco, Lima
- Recordatorio: **documento de identidad físico y original**, y **mayores de 18 años**
- Nota de que el QR sirve para un solo ingreso

## A.4 Versión de texto plano

Enviar el campo `text` de Resend además del `html`, con la misma información. Mandar solo HTML es señal negativa para los filtros.

## A.5 Nada de marketing

- Sin píxeles de tracking
- Sin botones de "síguenos"
- Sin promoción cruzada de futuros eventos

El contenido puramente transaccional es lo que mantiene el correo fuera de la pestaña Promociones de Gmail, que clasifica por contenido y no por reputación.

## A.6 Aviso en pantalla

En la confirmación post-compra de `index.html`, debajo del mensaje de éxito:

> Tu entrada llegó a **[correo]**. Si no la ves en unos minutos, revisa spam y promociones, y márcala como "No es spam".

El correo se muestra dinámicamente.

---

# BLOQUE B — Página de entrada individual

## B.1 `entrada.html`

Página brandeada según `DESIGN.md`. **Mobile-first**, pero correcta también en desktop. Es lo que el asistente abre en la puerta.

Contenido:

- Logo Paradisio
- **QR grande y centrado, con fondo claro bajo el QR** aunque el resto de la página sea oscuro. Los escáneres fallan con QR blanco sobre negro; en la puerta a las 11 de la noche eso se traduce en cola. Esto no es negociable por estética.
- Nombre del asistente y número de documento
- Tipo de entrada y código `PDS-XXXXXX`
- Fecha, hora de validez según el tier, y Espacio NHN, Barranco
- Recordatorio: documento físico original y +18
- Nota de que el QR sirve para un solo ingreso

## B.2 Seguridad de la URL — crítico

**La URL no puede ser adivinable.** Si fuera `/entrada?id=PDS-000042`, cualquiera cambia el número y ve entradas ajenas con el DNI de otra persona expuesto.

- Generar un **token aleatorio criptográficamente seguro de al menos 32 caracteres** por entrada
- Guardarlo en Redis junto al ticket
- Ruta: `/entrada?t={token}`
- **Nunca** exponer el código `PDS-XXXXXX` ni un ID secuencial en la URL
- Token inválido o inexistente → página de error brandeada, sin filtrar si el token existió alguna vez ni ninguna otra información

## B.3 Enlace desde el correo

El correo incluye un botón claro **"Ver mi entrada"** apuntando a `/entrada?t={token}`, **además** del QR embebido. El QR embebido se mantiene: si el asistente está sin señal en la puerta, el correo ya descargado le sirve.

## B.4 Enlace desde la confirmación

En la confirmación post-compra de `index.html`, reemplazar el QR embebido por un botón **"Ver mi entrada"** que abra `/entrada?t={token}` en pestaña nueva.

## B.5 Impresión

`@media print` limpio, por si alguien decide imprimir la entrada.

---

# BLOQUE C — Compra múltiple con entrada nominal

## C.1 Modelo: dos flujos que no se mezclan

### Cortesía (gratuita)

- **Una por persona.** Cantidad fija en 1, sin selector.
- **Correo y DNI únicos entre cortesías.** Si ya existe una cortesía con ese correo o ese documento, se rechaza con mensaje claro.
- **La unicidad NO cruza con entradas pagadas.** La misma persona puede tener una cortesía y además comprar una Club. Son productos distintos.

### Pagada

- Un comprador, N entradas.
- **Entrada nominal por asistente**: cada QR está atado a un nombre y un documento que se verifican en puerta.

## C.2 Checkout pagado

1. El comprador elige cantidad (**1 a 10**).
2. Se renderizan N bloques de datos de asistente, cada uno con:
   - Nombre y apellido
   - Tipo y número de documento
   - Fecha de nacimiento
   - Correo — **obligatorio** para el asistente 1 (el comprador), **opcional** para los asistentes 2 a N
3. Botón **"usar mis datos"** en el primer bloque para autocompletarlo.
4. Validaciones por asistente:
   - **+18 obligatorio**, bloquea el envío como ya hace hoy
   - Documento no repetido dentro de la misma compra
5. Un solo cobro por el total.

## C.3 Generación

- Un QR, un código `PDS-XXXXXX` y un **token individual de 32+ caracteres** por asistente.
- Un **token de orden** adicional que agrupa las N entradas.

## C.4 Páginas

### `/entrada?t={token}` — individual

La del Bloque B. Una por asistente.

### `/orden?t={tokenOrden}` — del comprador

- Muestra las N entradas en un **carrusel deslizable horizontalmente**: swipe en mobile, flechas + drag en desktop
- Un QR por vista, con indicador de posición tipo **"2 de 5"**
- Cada vista: QR grande con fondo claro, nombre y documento **de ese asistente**, tipo de entrada, código `PDS`, fecha, horario de validez y venue
- El comprador puede tomar captura de una vista individual y pasársela a esa persona
- **Botón "compartir esta entrada"** en cada vista, que copia el link `/entrada?t={token}` individual — para mandar el link directo en vez de una captura

## C.5 Correos

- **Al comprador:** un correo con el resumen de la compra y el botón a `/orden?t={tokenOrden}`
- **A cada asistente que haya dado correo:** su correo individual con su QR y el botón a su `/entrada?t={token}`. Misma plantilla y mismas reglas del Bloque A.
- **Si un asistente no dio correo:** su entrada existe igual y vive en la página del comprador. El comprador se la hace llegar.

## C.6 Check-in

`staff.html` debe seguir funcionando igual:

- Cada QR es un ingreso **único e independiente**. Escanear el QR del asistente 3 no afecta a los otros.
- **Al escanear, el panel debe mostrar el nombre y el documento del titular**, para que la puerta pueda verificar contra el documento físico. Sin esto, la entrada nominal es nominal solo en el papel.

## C.7 Admin

- Las entradas de una misma compra deben poder verse **agrupadas por orden**, además del listado plano actual.
- El CSV debe incluir una columna de **ID de orden**.

---

# Orden de trabajo

1. Implementar Bloque A → mostrar el correo renderizado (HTML y texto plano) → aprobar → commitear
2. Implementar Bloque B → mostrar la página en mobile y desktop → aprobar → commitear
3. Implementar Bloque C → mostrar el carrusel en mobile y desktop, y el checkout con 3 asistentes → aprobar → commitear

No commitear nada sin aprobación explícita.
