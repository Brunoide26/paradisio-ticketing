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

Paradisio es un club nocturno en Barranco, Lima, enfocado en house, funk, disco y techno clásico de los 90s-2000s, para público +18. Su identidad visual busca sentirse maximalista y energética, inspirada en la cultura rave/flyer de Ibiza pero con carácter propio — no una réplica genérica de esa estética.

## Operating Context

- Lista gratis disponible hasta una hora límite (11:00 pm); después de esa hora solo aplica la entrada pagada (cover).
- Pago con tarjeta vía Culqi; el checkout ocurre en `checkout.html`.
- El ticket generado se muestra en pantalla (`tickets.html`) y se envía por correo (Resend) con el QR adjunto.
- Aforo controlado por variables de entorno `FREE_CAP` / `PAID_CAP`.
- Check-in en puerta vía `staff.html` (código manual o cámara), que rechaza tickets ya usados o anulados.
- Panel `admin.html`, protegido con `STAFF_PASSCODE`, para listar, buscar, exportar y anular/reactivar tickets.

## Capabilities and Constraints

- Backend serverless (funciones de Vercel) + Upstash Redis para persistencia de tickets y contadores.
- Envío de correo vía Resend; pagos vía Culqi (llave pública en frontend, llave secreta solo en backend).
- Autenticación simple de staff/admin por passcode compartido (`STAFF_PASSCODE`), sin cuentas individuales.
- Fuentes autoalojadas (Orbitron, Inter) en `/fonts`; `vercel.json` habilita URLs limpias (`/tickets`, `/checkout`, `/admin`, `/staff` sin `.html`).
- Logo con variantes (`logo-white.png`, `logo-yellow.png`); `logo.jpg` es legado y ya no se usa activamente.

## Brand Commitments

- Nombre: Paradisio.
- Club nocturno en Lima, distrito de Barranco.
- Género musical: house, funk, disco y techno clásico (era 90s-2000s).
- Público objetivo: +18.
- Tono de marca (constraint vinculante dado por el usuario): maximalista, energético, inspirado en la cultura rave/flyer de Ibiza pero con identidad propia.
- Paleta vinculante dada por el usuario: naranja `#FD5400`, amarillo `#FFC700`, rojo `#E8291C`, negro. (Registrado aquí como constraint de marca; el sistema visual completo se define en DESIGN.md vía `/impeccable document` o `new-work`, no en este archivo.)

## Evidence on Hand

- Código funcional existente: `index.html`, `checkout.html`, `tickets.html`, `staff.html`, `admin.html`, `lib/tickets.js`, `api/*.js` — landing, checkout, generación/entrega de ticket, check-in y panel admin ya implementados.
- `README.md` documenta el flujo de despliegue (Vercel + Upstash + Resend + Culqi) y la estructura del proyecto.
- Sin testimonios, casos de estudio, ni cifras de asistencia reales — no inventar métricas de eventos pasados.

## Product Principles

1. La lista gratis premia llegar temprano (antes de 11pm); después, todos pagan el mismo cover, sin excepciones.
2. El QR es la única prueba de entrada válida; un ticket anulado se rechaza en puerta aunque el QR se vea igual.
3. Staff de puerta y admin comparten una clave simple, no cuentas individuales — mantener ese modelo salvo que se indique lo contrario.
4. La identidad visual de Paradisio evita clonar la estética genérica de flyer de Ibiza; debe sentirse maximalista y energética pero con carácter propio.
