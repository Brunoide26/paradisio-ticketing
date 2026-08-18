# Paradisio — Rediseño de checkout y sistema de promotores

Handoff para Claude Code. `DESIGN.md` manda en todo lo visual.

Tres bloques, en este orden: A → B → C. Cada uno se muestra y aprueba antes de commitear.

---

# BLOQUE A — Rediseño del flujo de compra

## A.0 Primero: quitar Preventa Crew

Quedó pendiente de un cambio anterior. Elimina el SKU **Crew** (S/110, 4 entradas) y su equivalente en la ventana Club, si existe.

Catálogo final:

| Ventana | SKU | Precio | Personas |
|---|---|---:|---:|
| **PREVENTA** (hasta mié 26/08 23:59) | Cortesía Opening | S/0 | 1 |
| | Preventa Individual | S/35 | 1 |
| | Preventa Duo | S/60 | 2 |
| | Preventa Trío | S/85 | 3 |
| **CLUB** (jue 27/08 00:00 – vie 28/08 19:00) | Club Individual | S/45 | 1 |
| | Club Duo | S/80 | 2 |
| | Club Trío | S/115 | 3 |

## A.1 El problema actual

La sección de entradas es una lista vertical de cinco filas casi idénticas: precio gigante a la izquierda, descripción al centro, botón chico a la derecha. En desktop el ojo recorre media pantalla entre el precio y el botón. En mobile todo se apila y se vuelve un scroll largo sin jerarquía. Y el formulario aparece debajo sin separación clara, así que no se entiende dónde termina una decisión y empieza la siguiente.

**Diagnóstico:** todo tiene el mismo peso visual y todo está a la vez en pantalla.

## A.2 La solución: flujo por pasos

Un paso a la vez, con indicador de progreso. La referencia es cómo lo resuelve Why Not Stay, pero con la identidad de Paradisio.

### Indicador de progreso

Arriba del panel, siempre visible: `1 — 2 — 3 — 4`

El paso actual en `#FF2800`, los completados marcados, los pendientes atenuados. Se puede volver atrás tocando un paso ya completado.

### PASO 1 · ELIGE TU ENTRADA

Cards, no filas. Cada card:

- **Toda la card es tappable.** No un botón chico a la derecha — el área de toque es la card completa. Esto es lo que más mejora la experiencia en mobile.
- Borde visible que se enciende en `#FF2800` al seleccionar
- Jerarquía dentro de la card: precio grande → nombre del SKU → cuántas personas incluye → nota de validez
- La Cortesía va primera y visualmente distinta (es gratis, pero con restricción horaria)

Contenido por card:

```
S/35
PREVENTA INDIVIDUAL
1 persona
Entra a cualquier hora de la noche
```

```
FREE
CORTESÍA OPENING
1 persona
Ingreso libre hasta las 12:00 a.m. · Sujeto a aforo
```

**Diferencial explícito.** El argumento de venta es la hora, no el precio. Que se lea de un vistazo que la cortesía tiene corte y las pagadas no.

Botón **"Continuar"** fijo abajo en mobile, deshabilitado hasta elegir.

### PASO 2 · TUS DATOS

Un bloque por asistente según el SKU. El primero etiquetado **"Tú (comprador)"**, los demás **"Asistente 2"**, **"Asistente 3"**.

Campos: nombre, apellido, tipo y número de documento, fecha de nacimiento, correo (obligatorio solo en el bloque 1).

**Campo de código de promotor** — ver Bloque B.

Validaciones en línea, no al enviar. Botón "Continuar" fijo abajo.

### PASO 3 · RESUMEN Y PAGO

- Qué compró y para cuántas personas
- Desglose: subtotal, descuento si aplica, total
- Checkbox legal
- Botón **"Pagar S/35"** con el monto real, fijo abajo

### PASO 4 · CONFIRMACIÓN

Ya está implementada. QR directo o carrusel embebido.

## A.3 Requisitos transversales

- **Se puede volver atrás sin perder lo escrito.** Nada de reiniciar el formulario.
- **Mobile-first.** El botón de acción siempre fijo abajo, nunca perdido en el scroll.
- **Desktop no es una página larga otra vez.** Mismo flujo por pasos, con más aire y ancho máximo cómodo. No vuelvas a la lista vertical.
- **Un solo tema visual a la vez.** El bloque rojo pleno de "ENTRADAS" compite con las cards; revisa que la jerarquía funcione.
- Todo según `DESIGN.md`.

---

# BLOQUE B — Códigos de promotor

## B.1 Cómo funciona

Cada promotor tiene un código y un link propio. El link pre-llena el código; el campo también se puede escribir a mano si alguien lo recibe por voz.

- **En compras pagadas:** 10% de descuento sobre el total, aplicable a todos los SKUs incluidos combos.
- **En cortesías:** no hay descuento (ya es gratis), pero sí atribución.

**Lo que más importa no es el descuento, es saber quién trajo a quién.** Ese dato define a qué promotores conservar para VOL. 2.

## B.2 Los 14 promotores

| Nombre | Código | Link |
|---|---|---|
| Sergio Requena | `SERGIO` | paradisioclub.com/p/SERGIO |
| Guillermo Chiroque | `GUILLERMO` | paradisioclub.com/p/GUILLERMO |
| Lucienne Navach | `LUCIENNE` | paradisioclub.com/p/LUCIENNE |
| Diego Murdoch | `DIEGO` | paradisioclub.com/p/DIEGO |
| Daniel Gurtra | `DANIEL` | paradisioclub.com/p/DANIEL |
| Mariano Gambirazio | `MARIANO` | paradisioclub.com/p/MARIANO |
| Josué Masalias | `JOSUE` | paradisioclub.com/p/JOSUE |
| Alejandro Garay | `ALEJANDRO` | paradisioclub.com/p/ALEJANDRO |
| Joaquín Velasco | `JOAQUIN` | paradisioclub.com/p/JOAQUIN |
| Gonzalo Abad | `GONZALO` | paradisioclub.com/p/GONZALO |
| Gabriel Zarzar | `GABRIEL` | paradisioclub.com/p/GABRIEL |
| Carolina Huamán | `CAROLINA` | paradisioclub.com/p/CAROLINA |
| Micaela Byrne | `MICAELA` | paradisioclub.com/p/MICAELA |
| Antonella Meléndez | `ANTONELLA` | paradisioclub.com/p/ANTONELLA |

Los códigos son nombres de pila porque se recuerdan, se dictan por voz y se corrigen fácil si alguien los escribe mal. Sin tildes ni caracteres especiales.

Guárdalos en Redis o en config con: código, nombre completo, activo/inactivo. **Debe poder desactivarse un código sin tocar el deploy.**

Los códigos se van a filtrar — alguien los compartirá en un grupo. Con 10% eso no duele y la atribución sigue funcionando.

## B.3 Página `/p/{codigo}`

Ruta directa, distinta del landing. Sin scroll de marca, sin secciones informativas. Solo:

- Logo Paradisio
- Fecha, venue, hora
- **"Código de {NOMBRE} aplicado"** visible
- El flujo por pasos del Bloque A, arrancando en el paso 1
- Nada más

Objetivo: que alguien que llega desde una story pueda generar o comprar en menos de 30 segundos.

Código inexistente o inactivo → redirige al landing normal, sin error.

## B.4 Campo de código en ambos flujos

**En Cortesía:** campo **"Código de promotor (opcional)"**. No da descuento, solo atribución.

**En pagadas:** campo **"Código de descuento (opcional)"**. Aplica 10%.

En ambos casos:
- Si viene por `/p/{codigo}`, se pre-llena y se muestra el nombre del promotor
- El campo **sigue siendo escribible** aunque venga pre-llenado — alguien puede recibir el código por voz
- Código inválido: mensaje claro, no bloquea el envío
- El descuento se aplica **antes** de mandar el monto a Culqi
- En el resumen: subtotal, descuento, total

---

# BLOQUE C — Panel de promotores en el admin

Nueva pestaña **"Promotores"** en `admin.html`.

## C.1 Tabla

| Columna | Contenido |
|---|---|
| Promotor | Nombre y código |
| Cortesías | QRs gratis generados con su código |
| Pagadas | Entradas pagadas vendidas |
| Personas | Total de asistentes (los combos cuentan por persona, no por orden) |
| Ingreso | Generado, después del descuento |
| **Ingresaron** | **Cuántos de sus QRs efectivamente entraron al evento** |
| Conversión | Ingresaron ÷ personas, en porcentaje |

Ordenable por cualquier columna. Exportable a CSV.

**La columna "Ingresaron" es la más importante.** Un promotor que genera 40 QRs de los que llegan 5 vale menos que uno que genera 15 de los que llegan 12. Ese dato decide quién sigue en VOL. 2.

## C.2 Compartir links

Botón por promotor que copie su link completo al portapapeles, listo para mandar por WhatsApp.

## C.3 Activar y desactivar

Toggle por promotor. Al desactivar, su código deja de aplicar descuento y su link redirige al landing. Los tickets ya emitidos con ese código conservan la atribución.

---

# Orden de trabajo

1. **Bloque A** → mostrar el flujo completo en mobile (390px) y desktop, los cuatro pasos → aprobar → commitear
2. **Bloque B** → mostrar `/p/SERGIO` en mobile y el campo de código en ambos flujos → aprobar → commitear
3. **Bloque C** → mostrar la pestaña de promotores → aprobar → commitear

No commitear nada sin aprobación explícita.

**Contexto de urgencia:** el evento es el viernes 28 de agosto. La preventa ya está viva y vendiendo. Cualquier cambio que rompa el checkout cuesta ventas reales, así que prueba el flujo completo de punta a punta antes de mostrar cada bloque.
