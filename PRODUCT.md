# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Asistentes al evento (público +18) que se registran para la lista gratis o compran una entrada pagada, y reciben su QR en pantalla y por correo.
- Staff de puerta que valida el ingreso escaneando o escribiendo el código del ticket (`staff.html`).
- Administradores del evento que revisan el listado completo de tickets, exportan CSV, y anulan/reactivan tickets (`admin.html`).

## Product Purpose

Sistema de venta y control de entradas para eventos del club nocturno Paradisio: landing de registro/compra, checkout con pago por tarjeta, entrega de QR, y check-in de puerta con panel de administración.

## Positioning

Paradisio es un club nocturno en Barranco, Lima, enfocado en house, funk, disco y techno clásico de los 90s-2000s, para público +18. La dirección visual actual (editorial, oscura, un solo acento de color, fotografía real) se define en DESIGN.md, no aquí.

## Operating Context

- Tier gratis "Cortesía Opening" disponible hasta las 12:00 am; después de esa hora solo aplica el tier pagado "Club" (S/45, acceso hasta las 3 am).
- El registro/pago y la entrega del ticket ocurren directamente en `index.html#entradas` — ya no existen páginas separadas de checkout o de lista de entradas (`checkout.html`/`tickets.html` fueron retiradas; toda esa lógica vive inline en `index.html`).
- Pago con tarjeta vía Culqi, integrado en el mismo flujo de `index.html`.
- El ticket generado se muestra en pantalla (con su QR) y se envía por correo (Resend).
- Aforo controlado por variables de entorno `FREE_CAP` / `PAID_CAP`.
- Check-in en puerta vía `staff.html` (código manual o cámara), que rechaza tickets ya usados o anulados.
- Panel `admin.html`, protegido con `STAFF_PASSCODE`, para listar, buscar, exportar y anular/reactivar tickets.

## Capabilities and Constraints

- Backend serverless (funciones de Vercel) + Upstash Redis para persistencia de tickets y contadores.
- Envío de correo vía Resend; pagos vía Culqi (llave pública en frontend, llave secreta solo en backend).
- Autenticación simple de staff/admin por passcode compartido (`STAFF_PASSCODE`), sin cuentas individuales.
- Fuentes autoalojadas (Unbounded, DM Sans) en `/fonts`; `vercel.json` habilita URLs limpias (`/admin`, `/staff` sin `.html`).
- Logo con variantes (`logo-white.png`, `logo-yellow.png`); `logo.jpg` es legado y ya no se usa activamente.

## Brand Commitments

- Nombre: Paradisio.
- Club nocturno en Lima, distrito de Barranco.
- Género musical: house, funk, disco y techno clásico (era 90s-2000s).
- Público objetivo: +18.
- Tono de marca (constraint vinculante dado por el usuario): maximalista, energético, inspirado en la cultura rave/flyer de Ibiza pero con identidad propia.
- Paleta vinculante dada por el usuario (actualizada): rojo-naranja `#FF2800` como único acento, sobre negro casi puro `#090909` y blanco cálido `#F2EDE4`. (Registrado aquí como constraint de marca; el sistema visual completo se define en DESIGN.md, no en este archivo.)

## Evidence on Hand

- Código funcional existente: `index.html` (landing + registro/pago + entrega de ticket, todo integrado), `staff.html`, `admin.html`, `lib/tickets.js`, `api/*.js` — check-in y panel admin implementados por separado.
- `README.md` documenta el flujo de despliegue (Vercel + Upstash + Resend + Culqi) y la estructura del proyecto.
- Sin testimonios, casos de estudio, ni cifras de asistencia reales — no inventar métricas de eventos pasados.

## Product Principles

1. El tier gratis premia llegar temprano (antes de 12am); después, todos pagan el mismo cover (Club, S/45), sin excepciones.
2. El QR es la única prueba de entrada válida; un ticket anulado se rechaza en puerta aunque el QR se vea igual.
3. Staff de puerta y admin comparten una clave simple, no cuentas individuales — mantener ese modelo salvo que se indique lo contrario.
4. La identidad visual completa (paleta, tipografía, tono) vive en DESIGN.md y evoluciona ahí, no en este archivo.
