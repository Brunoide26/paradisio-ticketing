# Paradisio OS — Rediseño visual e interacción

Rama `claude/os-redesign`. Sólo frontend: no cambian el API, los cálculos, la autenticación ni los datos.

## Referencias y licencias
- **Dashral (MIT)**: marco "inset" y el indicador deslizante (`useIndicator`, adaptado en `os/motion.jsx`).
- **shadcn-fintech (MIT)**: interacción de la rejilla de widgets con dnd-kit (`pages/overview/WidgetGrid.jsx`).
- **Midday (AGPL)**: sólo dirección visual (monocromo, cifras editoriales, lo proyectado rayado). No se copió código.

## Sistema
- Tokens en `index.css` (claro y oscuro), fuente Geist con cifras tabulares (`.num`), bordes finos y sin sombras.
- Color sólo para las marcas (Club, Beats, Icon) y para estados financieros reales (verde/rojo); lo proyectado, rayado y punteado.
- Movimiento en `os/motion.jsx` y variables `--dur-*`/`--ease-*`: micro 120 ms, estándar 200 ms, paneles 300 ms, cifras 450 ms. Respeta "reducir movimiento".

## Piezas compartidas (todas las páginas las usan)
- `Frame` (shell), `BrandSwitch`, `Notifications`, `AccountMenu`.
- `Kpi` dentro de `.kpi-strip`: una fila con celdas separadas por líneas, no una tarjeta por cifra.
- `StageBadge` neutro con punto de color; `KindTag` Real / Proyectado.
- `Bars` (barras finas), `DivergingBars` (positivos y negativos desde cero), `Segmented`.
- `DataTable`: encabezado fijo, búsqueda, filtros por columna, columnas visibles, CSV, filas desplegables, acciones por fila, selección múltiple y teclado (↑ ↓ Enter Espacio).

## Atajos
⌘K buscar · ⌘B barra lateral · 0–3 marca · C evento · T transacción · ⇧D tema.
