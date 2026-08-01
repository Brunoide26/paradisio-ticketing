# Libro de Reclamaciones Virtual — Especificación de implementación

Handoff para Claude Code. Todo el estilado se subordina a `DESIGN.md`.

**Base normativa:** Ley N.º 29571 (Código de Protección y Defensa del Consumidor), D.S. N.º 011-2011-PCM y sus modificatorias, en particular el **D.S. N.º 101-2022-PCM** (formato vigente del Anexo I y plazo de respuesta de 15 días hábiles improrrogables).

---

## 1. Reglas no negociables

Estas son las que Culqi e INDECOPI verifican. Ninguna es opcional.

1. **Formulario nativo en el propio dominio.** Nada de Google Forms, Typeform, enlaces externos ni archivos en Drive.
2. **Accesible desde la página de inicio.** Enlace visible en el footer de `index.html`, presente en todas las páginas del sitio.
3. **Aviso del Libro de Reclamaciones visible** (Anexo II del D.S. 011-2011-PCM) junto al enlace.
4. **Numeración correlativa** de las hojas de reclamación, sin saltos.
5. **Copia automática al correo del consumidor** al terminar el registro, más opción de imprimir la hoja.
6. **HTTPS en la URL del formulario** (ya cubierto por Vercel).
7. **La fecha de nacimiento NO debe ser campo obligatorio.** INDECOPI ha sancionado formularios que bloquean el envío por exigir campos no contemplados en el Anexo I. No la pidas aquí — es distinto del flujo de compra de entradas, donde sí es obligatoria por la verificación de edad.
8. **No condicionar el envío** a que el usuario tenga una compra previa, se registre o cree una cuenta. Cualquier persona debe poder presentar una queja.

---

## 2. Ruta y archivos

```
/libro-reclamaciones          → libro-reclamaciones.html
/api/reclamo.js               → registro + correlativo + envío de correo
/api/admin-reclamos.js        → listado para el panel admin (protegido)
```

En `admin.html`, agregar una pestaña "Reclamaciones" junto a la de tickets.

---

## 3. Campos del formulario (Anexo I vigente)

### Bloque 1 — Datos del proveedor (fijos, solo lectura, mostrados en pantalla)

```
Razón social:   Bruno Yofreed Espinoza Pérez
RUC:            10720126589
Nombre comercial: Paradisio Club
Domicilio:      Jr. 28 de Julio 277, Barranco, Lima
Fecha del reclamo: [auto, fecha del sistema]
N.º de hoja:    [auto, correlativo]
```

### Bloque 2 — Identificación del consumidor

| Campo | Tipo | Obligatorio |
|---|---|---|
| Nombres y apellidos | texto | Sí |
| Tipo de documento | select: DNI / CE / Pasaporte / RUC | Sí |
| Número de documento | texto | Sí |
| Domicilio | texto | Sí |
| Correo electrónico | email | Sí |
| Teléfono | tel | No |
| ¿Es menor de edad? | checkbox | No |
| Nombre del padre, madre o apoderado | texto | Solo si marcó menor de edad |

### Bloque 3 — Identificación del bien contratado

| Campo | Tipo | Obligatorio |
|---|---|---|
| Tipo | radio: Producto / Servicio | Sí |
| Descripción (evento, tipo de entrada, código de ticket) | textarea | Sí |
| Monto reclamado en S/ | número | No |

### Bloque 4 — Detalle de la reclamación

| Campo | Tipo | Obligatorio |
|---|---|---|
| Tipo | radio: **Reclamo** / **Queja** | Sí |
| Detalle | textarea (máx. 2000 caracteres) | Sí |
| Pedido concreto del consumidor | textarea (máx. 1000 caracteres) | Sí |

**Texto explicativo obligatorio junto al selector**, redactado tal cual:

> **Reclamo:** disconformidad relacionada a los productos o servicios.
> **Queja:** disconformidad no relacionada a los productos o servicios; o malestar o descontento respecto a la atención al público.

### Bloque 5 — Nota legal al pie del formulario

Debe mostrarse antes del botón de envío:

> La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el INDECOPI.
>
> El proveedor deberá dar respuesta al reclamo o queja en un plazo no mayor a quince (15) días hábiles improrrogables, contados desde el día siguiente de su presentación.

Checkbox obligatorio: *"Declaro que la información brindada es veraz y autorizo el tratamiento de mis datos personales para la atención de esta reclamación."*

---

## 4. Correlativo

Formato: `PDS-LR-000001`, incremental y sin saltos.

Usar un contador atómico en Redis (`INCR reclamos:counter`) para evitar colisiones en registros concurrentes. Guardar cada hoja bajo `reclamo:PDS-LR-000001` con todos los campos más `createdAt`, `status` (`pendiente` / `respondido`) y `respuesta` (vacío al inicio).

---

## 5. Correo automático (Resend)

Se dispara al registrar, con dos destinatarios:

1. **Al consumidor**, a la dirección que ingresó: asunto `Hoja de Reclamación PDS-LR-000001 — Paradisio Club`. Cuerpo con la hoja completa reproducida, la fecha de presentación, el plazo de respuesta de 15 días hábiles y la nota legal.
2. **A ritmo@paradisioclub.com**: alerta interna con el detalle y la fecha límite de respuesta ya calculada.

Reutilizar la configuración de Resend que ya usa `register-free.js`.

---

## 6. Pantalla de confirmación

Tras el envío exitoso, mostrar en pantalla:

- El número de hoja asignado
- La hoja completa en formato imprimible
- Un botón **"Imprimir hoja"** (`window.print()`) con una hoja de estilos `@media print` limpia
- Aviso de que se envió una copia al correo registrado

---

## 7. Aviso del Libro de Reclamaciones (footer)

Texto obligatorio junto al enlace, en todas las páginas:

> **LIBRO DE RECLAMACIONES**
> Conforme a lo establecido en el Código de Protección y Defensa del Consumidor, este establecimiento cuenta con un Libro de Reclamaciones a tu disposición.

Estilado según `DESIGN.md`. No usar el ícono genérico descargado de internet si rompe la identidad; el texto es lo exigible.

---

## 8. Panel admin

En `admin.html`, pestaña "Reclamaciones":

- Tabla: N.º de hoja, fecha, nombre, tipo (reclamo/queja), estado, **días hábiles restantes**
- Semáforo por fila: verde >7 días restantes, ámbar 3–7, rojo <3 o vencido
- Vista de detalle con el campo **"Observaciones y acciones adoptadas por el proveedor"**, editable
- Botón para marcar como respondido y enviar la respuesta por correo al consumidor
- Exportación CSV

El cálculo de días hábiles debe excluir sábados, domingos y feriados nacionales. Para 2026, cargar los feriados en una constante y revisarla — no calcular a ciegas.

---

## 9. Advertencia operativa

El plazo de **15 días hábiles es improrrogable**. Responder tarde se sanciona desde 1 UIT aunque el reclamo de fondo no tenga razón. Con la UIT 2026 eso son varios miles de soles por una bandeja de correo sin revisar.

Alguien tiene que ser dueño de esa bandeja. Con un solo evento el volumen será bajo, pero el riesgo no es proporcional al volumen.

---

## 10. Respaldo físico

Cuando el Libro Virtual no esté disponible (caída del sitio, falla en el recinto), debe existir un **Libro de Reclamaciones físico** de respaldo a disposición del público. Para la noche del evento: llevar impresas al menos 20 hojas del formato Anexo I en juegos de 3 copias, en la mesa de producción o en puerta.
