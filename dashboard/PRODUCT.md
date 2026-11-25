# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- El CEO/dueño de Paradisio Entertainment Group. Es el único usuario: entra con la clave de administración, revisa números en desktop y en el celular (también la noche del evento) y toma decisiones de dinero, producción y marca.
- Agentes (Claude) que cargan reportes post-evento con una llave de API (`OS_API_TOKEN`); sus cambios quedan auditados como "claude".

## Product Purpose

Paradisio OS es la plataforma interna de gestión del grupo (Paradisio Club, Paradisio Beats e Icon): finanzas reales y proyectadas por evento y por marca, caja y obligaciones, ventas y reservas, promotores, inventario de barra, operaciones y staff, marketing, sponsors, audiencia, integraciones y modo en vivo. Éxito es entender en segundos cómo va el negocio y qué requiere atención, sin confundir nunca lo real con lo proyectado.

## Positioning

Un OS financiero y operativo hecho para una productora de vida nocturna en Lima: las cifras salen de la web de tickets propia, Culqi, el libro de transacciones y la liquidación de cada fecha, y cada marca conserva su identidad dentro de un grupo neutro.

## Operating Context

- Se usa a diario en desktop (1280–1600 px) y en el celular la noche del evento (`/en-vivo`).
- Fuentes de datos: web de tickets (registros, QRs, puerta, promotores), Culqi (API de solo lectura), Culqi POS de barra, Wally y BCP (reportes manuales post-evento).
- Ritmo: fechas puntuales (pocas por mes); entre fechas hay semanas sin ingresos. La historia real todavía es corta (una fecha cerrada a nov. 2026) y crece con cada evento.
- Idioma español (Perú), moneda PEN (USD disponible), formato es-PE, zona America/Lima.

## Capabilities and Constraints

- Frontend: React 19 + Vite 5 + Tailwind v4 + shadcn (new-york) + Recharts 3 + motion 14 + NumberFlow + dnd-kit + Animate UI. Se compila a `administracion/` y se sirve en `/administracion`.
- Backend: funciones de Vercel (`api/os.js`) + Upstash Redis. Toda la lógica financiera vive en el servidor (`lib/os/*`); el frontend solo muestra.
- El rediseño visual no puede cambiar autenticación, cálculos financieros, datos ni infraestructura.
- Reglas financieras que la interfaz debe respetar: lo real (Liquidación o Cerrado) y lo proyectado (presupuestos) nunca se suman; un presupuesto sin costos no tiene utilidad ("Incompleto"); un dato faltante se muestra como no disponible, nunca como cero; aportes, préstamos, anticipos, transferencias y compras de inventario no son resultado.

## Brand Commitments

- Nombre: Paradisio OS, de Paradisio Entertainment Group.
- Colores de marca, solo como acento de identidad: Paradisio Club `#F0441A`, Paradisio Beats `#0F9BB0`, Icon `#7B45FF`. Logos en `administracion/logos/`.
- La interfaz corporativa es neutra y monocromática; la identidad de cada marca aparece en sus datos, eventos y acciones.
- Referencias visuales dadas por el dueño: Midday (midday.ai, v2) y Dashtrans (capturas del dueño). Ver `dashboard/DESIGN.md`.

## Evidence on Hand

- Datos reales en producción: 1 fecha cerrada (14/11, Paradisio by Jägermeister), 3 presupuestos (Beats 3/12, Club 5/12, Icon 19/12), ventas web diarias de la ticketera, cobros de Culqi, staff e inventario cargados.
- No existen todavía: varias fechas cerradas para comparar, cuentas bancarias registradas, sponsors ni campañas. La interfaz no debe inventarlos.

## Product Principles

- Real primero, proyectado aparte: nunca mezclar, sumar ni estilizar igual.
- Un dato faltante se dice, no se rellena.
- Tendencia antes que decoración: cuándo se ganó, cuándo no y cómo evoluciona cada marca.
- Densidad de herramienta financiera: escaneable, precisa y rápida, sin teatro.
- Cada cifra se puede abrir para ver de dónde sale.

## Accessibility & Inclusion

- Contraste WCAG AA (4.5:1 texto, 3:1 elementos gráficos), foco visible, navegación por teclado, `prefers-reduced-motion` respetado, uso real en celular de noche (lectura con poca luz).
