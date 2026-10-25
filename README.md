# Paradisio — sistema de tickets

## Modo actual: página de evento (free entry + entradas + mesas)

`paradisioclub.com` es la página de **Paradisio by Jägermeister** (formato tipo WHAN/Discofobia): flyer, fecha, lugar con "Cómo llegar", y tres bloques de compra.

1. **Free entry (lista):** la persona se apunta con nombre, apellidos, correo, DNI, fecha de nacimiento, celular e Instagram. **No recibe QR al toque**: ve "Gracias por registrarte, tu invitación será aprobada y enviada días previos al evento". Válido hasta las 11 p.m. (`PROMO_VALIDITY_LABEL` / `PROMO_ENTRY_CUTOFF`).
2. **Entradas pagadas:** selector +/− por tipo, barra fija con el total, datos nominales por asistente y pago con tarjeta (Culqi). El QR sale en pantalla y por correo.
3. **Mesas y boxes:** "Ver mapa" abre el plano; se elige una mesa (en el mapa o por tipo), se ponen los datos del titular y se paga. La mesa queda tomada con un candado atómico antes de cobrar (no se vende dos veces). Un solo QR para todo el grupo; el scanner muestra "MESA X · N PERSONAS".

- **Links de promotores:** cada promotor tiene `paradisioclub.com/?ref=CODIGO` (o `/p/CODIGO`). Todo lo que saque esa persona —free entry, entradas y mesas— queda a su nombre (el ref se recuerda 7 días en el navegador). Se copian desde `/admin` → Promotores → "Copiar link" o "Copiar todos los links". Descuento por link: apagado (`PROMOTER_DISCOUNT_RATE`, ej. `0.10`).
- **Enviar los QRs del free entry:** `/admin` → "Enviar QRs pendientes (N)". Se mandan en tandas y eso aprueba cada registro. Para rechazar a alguien, anula su registro antes de enviar. Un registro pendiente es rechazado en puerta ("NO APROBADO"). Abrir / cerrar la lista: botones de la misma tarjeta.
- **Probar un pago real antes de abrir la venta:** poner `TEST_SKU_ENABLED=true` en Vercel, entrar a `paradisioclub.com/?qa=1` y comprar la entrada "Prueba interna" de S/1 con una tarjeta real. Llega el QR por correo y aparece en el admin. Después borrar la variable.
- **Plano y reservas:** el mapa es el plano del local redibujado en vector (`planSvg` en `index.html`). Box 5 y 6 = **Box Paradisio** (10 personas, junto al DJ booth); Box 1 a 4 = **Box After Hours** (8 personas); 6 **Mesas** (6 personas) repartidas. Las posiciones de las mesas están en `TABLE_UNITS` (en % del plano).
- **Precios, cupos, mesas y mapa:** `lib/catalog.js` (o variables `TICKET_TYPES_JSON`, `TABLE_TYPES_JSON`, `TABLE_UNITS_JSON` en Vercel). El servidor siempre cobra lo de ese archivo.
- **Fecha:** igual que antes (`EVENT_DATE_ISO`, `EVENT_NAME`, `EVENT_DATE_LABEL`, `EVENT_SHORT_DATE`, `EVENT_ADDRESS`, `PROMO_ENTRY_CUTOFF`…). Todo va por fecha en el admin.
- **Fecha actual: sábado 14 de noviembre, 9 PM** (free entry hasta las 11 p.m.). Las fechas del 17/10 y 24/10 se movieron aquí: todo lo emitido para ellas (QRs canjeados, registros, stats de promotores) cuenta como del 14/11 y esos QRs siguen entrando (`MOVED_EVENTS` en `lib/events.js`). Su correo decía la fecha vieja: reenviarlo desde el admin ("Reenviar QR") manda la nueva.

---

Landing + registro gratis + pago con tarjeta (Culqi) + QR automático en pantalla y por correo + panel de check-in en puerta.

## Qué necesitas crear (todo gratis para este volumen de gente)

1. **Cuenta en Vercel** — vercel.com (hosting + backend)
2. **Cuenta en Upstash** — upstash.com (base de datos de tickets, plan gratis)
3. **Cuenta en Resend** — resend.com (envío de correos, gratis hasta 3,000/mes)
4. **Cuenta en Culqi** — culqi.com (pagos) → afiliate.culqi.com, validación 1-3 días hábiles

---

## Paso 1 — Upstash (base de datos)

1. Entra a upstash.com → crea cuenta gratis → "Create Database"
2. Nombre: `paradisio`, tipo Regional, región más cercana a Perú (ej. us-east o sa-east si existe)
3. Ve a la pestaña **REST API** de tu base de datos
4. Copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

## Paso 2 — Resend (correos)

1. Entra a resend.com → crea cuenta gratis
2. Ve a **API Keys** → crea una → cópiala (es tu `RESEND_API_KEY`)
3. Para que el correo no caiga en spam y salga desde tu propio nombre, en **Domains** agrega tu dominio (si tienes uno) y sigue las instrucciones de verificación DNS. Si todavía no tienes dominio propio, puedes usar el dominio de pruebas de Resend mientras tanto (con limitaciones), o comprar uno rápido (ej. paradisioclub.pe) — te recomiendo esto último antes del evento.
4. `FROM_EMAIL` = `Paradisio <tickets@tudominio.com>`

## Paso 3 — Culqi (pagos)

1. Entra a `afiliate.culqi.com` y regístrate como comercio (persona natural con negocio o empresa)
2. Espera la validación (1-3 días hábiles)
3. En tu **CulqiPanel** → Llaves de integración → copia:
   - **Llave pública** (`pk_live_...` o `pk_test_...` para pruebas) → va en `index.html`, variable `CULQI_PUBLIC_KEY`
   - **Llave secreta** (`sk_live_...` o `sk_test_...`) → va en Vercel como `CULQI_SECRET_KEY` — esta NUNCA se pone en el HTML, solo en el backend
4. Empieza probando con las llaves de **test** antes de pasar a producción

## Paso 4 — Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub (o usa `vercel` CLI directo desde tu compu)
2. En vercel.com → "Add New Project" → importa el repo
3. En **Settings → Environment Variables**, agrega todas las variables de `.env.example` con tus valores reales
4. Click **Deploy**
5. Vercel te da una URL tipo `paradisio.vercel.app` — puedes conectar tu dominio propio después en Settings → Domains

## Paso 5 — Conectar la llave pública de Culqi en el HTML

Abre `index.html`, busca esta línea y reemplázala con tu llave pública real:

```js
const CULQI_PUBLIC_KEY = 'PON_AQUI_TU_LLAVE_PUBLICA_DE_CULQI';
```

Vuelve a desplegar (`git push` si usas GitHub, se redespliega solo).

## Paso 6 — Probar todo el flujo

1. Abre tu URL de Vercel
2. Prueba "Anotarme gratis" con tu propio correo → deberías ver el QR en pantalla Y recibirlo por email
3. Prueba "Comprar entrada" con una **tarjeta de prueba de Culqi** (las encuentras en su documentación de testing) → mismo resultado
4. Abre `/staff.html`, pon tu `STAFF_PASSCODE`, y prueba escanear/escribir el código de un ticket para hacer check-in

## Paso 7 — El día del evento

- Comparte `tu-dominio.com/staff.html` con quien esté en la puerta (dales el passcode)
- Pueden escribir el código manualmente, o si quieres lectura por cámara, se puede agregar un lector de QR con la cámara del celular más adelante (te lo puedo armar cuando quieras)

---

## Estructura del proyecto

```
/index.html             → página pública real: hero, countdown, info del evento, y las entradas (registro/pago) integradas en la misma página
/staff.html               → panel de check-in en puerta (con lector de QR por cámara)
/admin.html                → dashboard: ver todos los registros, exportar CSV, anular tickets
/logo.jpg                   → tu logo
/api/register-free.js        → registro lista gratis + verificación de edad + envío de QR
/api/charge.js                 → cobro con Culqi + verificación de edad + envío de QR
/api/availability.js            → cupos disponibles
/api/checkin.js                  → validar entrada en puerta
/api/admin-list.js                 → lista completa de tickets (protegido con STAFF_PASSCODE)
/api/admin-void.js                   → anular/reactivar un ticket (protegido con STAFF_PASSCODE)
/lib/tickets.js                        → funciones compartidas (Redis, Resend, QR, verificación de edad)
```

## Flujo de navegación

1. `paradisioclub.com` — la página pública real: hero, countdown, fecha, lugar y la sección de entradas, todo en una sola página (`index.html#entradas`).
2. Al hacer click en un tier ("Cortesía Opening" o "Club"), se abre el formulario de registro/pago **inline, en la misma página** (ya no hay un `checkout.html` ni un `tickets.html` separados — esas páginas se retiraron y toda esa lógica vive directamente en `index.html`).

## Verificación de edad (+18)

El checkout pide **fecha de nacimiento** + una casilla de declaración jurada. Si la persona tiene menos de 18 años:
- En el navegador, se bloquea antes de enviar el formulario
- **Además, el backend (`register-free.js` y `charge.js`) vuelve a calcular la edad y rechaza la creación del ticket** aunque alguien intente saltarse la validación del navegador — así que no depende solo del frontend, que se puede manipular.

## Color de marca

Rojo-naranja oficial: `#FF2800`

## Panel de admin (`/admin.html`)

Entra con tu `STAFF_PASSCODE`. Desde ahí puedes:
- Ver la lista completa de quién se registró/compró, con búsqueda por nombre, email, WhatsApp o código
- Exportar todo a CSV (útil para cruzar con Culqi o para tu equipo)
- **Anular un ticket** — si alguien pide reembolso o detectas un duplicado, lo anulas y ya no podrá usarse para entrar aunque muestre el QR (el check-in de puerta lo va a rechazar y avisar "ANULADO")
- Reactivarlo si fue un error

## Lector de QR con cámara (`/staff.html`)

Ahora el panel de puerta tiene un botón "📷 Escanear QR con cámara" — usa la cámara del celular para leer el QR directo, sin escribir el código a mano. Si prefieren texto (o la cámara falla), el campo manual sigue disponible debajo.

## Notas importantes

- El aforo (`FREE_CAP`, `PAID_CAP`) se controla por variables de entorno — cámbialas en Vercel si el número de invitados cambia.
- Si quieres reiniciar los contadores para probar sin ensuciar los datos reales, borra la clave `counters` en el panel de Upstash antes del evento.
- Guarda tu `STAFF_PASSCODE` solo con las personas de confianza en la puerta.
