---
name: Paradisio OS
description: Sistema operativo de Paradisio Entertainment Group — software financiero y operativo premium, monocromático, con identidad de vida nocturna
colors:
  light-canvas: "#F5F5F3"
  light-panel: "#FFFFFF"
  light-ink: "#0A0A0A"
  light-ink-2: "#5C5C57"
  light-ink-3: "#71716C"
  light-hairline: "#E8E8E5"
  light-good: "#0B7A54"
  light-bad: "#C2350F"
  midnight-canvas: "#050505"
  midnight-panel: "#0A0A0A"
  midnight-raised: "#111111"
  midnight-ink: "#F2F2F0"
  midnight-ink-2: "#A3A39E"
  midnight-ink-3: "#7E7E79"
  midnight-hairline: "#1C1C1C"
  midnight-swatch: "#2A2A2A"
  atmosphere-canvas: "#061210"
  atmosphere-base: "#0B1C19"
  atmosphere-glow-green: "#2C8A72"
  atmosphere-glow-deep: "#0B2A26"
  atmosphere-ink: "#F2F5F4"
  atmosphere-ink-2: "#A9BCB7"
  atmosphere-ink-3: "#86A09A"
  positive: "#3CC48F"
  negative: "#F2643F"
  projected: "#D9A85B"
  projected-light: "#8A5A12"
  brand-club: "#F0441A"
  brand-beats: "#0F9BB0"
  brand-icon: "#7B45FF"
typography:
  figure-hero:
    fontFamily: "Geist Mono Variable, ui-monospace"
    fontSize: "54px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.045em"
  figure-hero-mobile:
    fontFamily: "Geist Mono Variable, ui-monospace"
    fontSize: "44px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.045em"
  figure:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  figure-sm:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.005em"
  caption:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
  axis:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
  code:
    fontFamily: "Geist Mono Variable, ui-monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  control: "6px"
  surface: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.light-ink}"
    textColor: "{colors.light-panel}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 12px"
  surface:
    backgroundColor: "{colors.light-panel}"
    rounded: "{rounded.surface}"
    padding: "16px 24px"
  chart-tooltip:
    backgroundColor: "{colors.midnight-raised}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Paradisio OS

## Overview

**Creative North Star: "La cabina de la noche"**

Paradisio OS es el sistema operativo de Paradisio Entertainment Group, un grupo de entretenimiento multimarca (Paradisio Club, Paradisio Beats, Icon). No es un programa de contabilidad, ni un admin genérico, ni una colección de tarjetas financieras: es un producto de software premium, competitivo a nivel internacional, con identidad propia. Serio, monocromático y preciso, con la temperatura de la noche.

### Referencias visuales (definitivas)

Las dos capturas del dueño mandan sobre cualquier recomendación genérica de un skill:

- `design/references/midday-overview-dark.png` — **Midday**: gráfico de área con trazo fino y relleno rayado diagonal, cuadrícula horizontal punteada, cifra dominante en monoespaciada liviana con el símbolo de moneda pequeño y gris, tooltip oscuro flotante, selector de métrica arriba a la derecha del gráfico, paneles planos con borde de 1 px. Es la referencia del tema **Midnight** y del gráfico principal en los tres temas.
- `design/references/dashtrans-overview-atmosphere.webp` — **Dashtrans**: gradiente atmosférico oscuro, superficies translúcidas con vidrio contenido, gráficos blancos, miniaturas financieras (líneas, áreas, barras pequeñas) en los indicadores. Es la referencia del tema **Atmosphere** (en verde, no en azul) y de las miniaturas de los KPI.

Orden de autoridad: estas referencias y este documento, después Impeccable, después los demás skills.

**Key Characteristics:**
- Monocromo en la interfaz corporativa; el color se gana (marca o significado financiero).
- Una cifra dominante por vista, de la métrica elegida; nunca varias cifras iguales compitiendo.
- Gráficos de área con relleno rayado; escalonados para datos por fecha de evento; curva monótona para series continuas.
- Lo proyectado siempre distinto: ámbar apagado, rayado y punteado, separado de lo real y nunca en verde o rojo.
- Un dato faltante se dice ("no disponible", "sin dato") y se dibuja como hueco; nunca como cero.
- Movimiento que explica causa y efecto.

## Colors

### Temas
Tres temas elegibles (cabecera, menú de cuenta, paleta ⌘K y ⇧D). La preferencia se guarda (`os_theme`) y se aplica antes del primer pintado. Un solo sistema de tokens en `src/index.css`: `:root` (Claro), `.dark` (Midnight, base de los oscuros) y `[data-theme="atmosphere"]`.

- **Claro**: monocromo blanco refinado. Lienzo `{colors.light-canvas}`, panel `{colors.light-panel}`, bordes mínimos `{colors.light-hairline}`, tipografía fuerte.
- **Midnight** (tema oscuro principal, Midday): casi negros usados con intención para la jerarquía: lienzo `{colors.midnight-canvas}`, panel `{colors.midnight-panel}`, elevado `{colors.midnight-raised}`, líneas `{colors.midnight-hairline}`. Gráficos blancos, sin gradientes ni brillo. El negro puro no es obligatorio en cada superficie: la separación tonal sutil es la herramienta.
- **Atmosphere** (Dashtrans en verde): un solo gradiente atmosférico en el lienzo de toda la app (radiales verde `{colors.atmosphere-glow-green}` y verde profundo sobre `{colors.atmosphere-canvas}`), fijo al hacer scroll. Paneles de vidrio `rgba(255,255,255,0.045)` con borde `rgba(255,255,255,0.09)` y `backdrop-filter: blur(20px)`. El panel de la página es transparente para que el gradiente sea coherente; menús y paneles laterales usan vidrio más opaco por legibilidad. Acentos de marca sólo en sus datos.

### Contraste (medido)
| Tema | Tinta | Secundaria | Terciaria (`--faint`) |
|---|---|---|---|
| Claro, sobre panel | 19.8:1 | 6.7:1 | 4.9:1 |
| Midnight, sobre panel | 17.7:1 | 7.8:1 | 4.9:1 |
| Atmosphere, sobre vidrio | 15.3:1 | 8.4:1 | 6.0:1 |

`--hairline` y `--chart-grid` son sólo para líneas; nunca para texto. El anillo de foco usa la tinta del tema (`--ring`).

### Significado financiero
- `--good` / `--bad`: resultado o variación real favorable o desfavorable, siempre con signo, flecha o palabra ("Pérdida"). Claro usa `{colors.light-good}` (4.5:1 sobre blanco).
- `--proj` + rayado diagonal: todo lo proyectado. Lo proyectado no usa verde ni rojo, ni siquiera una utilidad proyectada positiva: el signo (+/−) lleva el significado.
- `--missing`: datos faltantes (rayado gris en sentido contrario al proyectado).

### Marcas
Club `{colors.brand-club}`, Beats `{colors.brand-beats}`, Icon `{colors.brand-icon}` identifican datos de cada marca: puntos en listas, la cinta de la agenda, series al dividir por marca, el selector de marca. Nunca como fondo de superficie ni en botones globales.

### Named Rules
- **La regla de la tinta**: si un color no significa marca o significado financiero, es gris.
- **La regla del horizonte**: el gradiente de Atmosphere vive en el lienzo, nunca dentro de una tarjeta ni detrás de texto suelto.

## Typography

Geist para todo; **Geist Mono liviana sólo para la cifra dominante** (dato de medición, como en Midday) y para códigos (tickets, RUC, referencias). Todas las cifras con números tabulares.

### Escala (la única permitida en el OS)
| Paso | Uso |
|---|---|
| 54 / 44 px Geist Mono 300 | Cifra dominante (`.figure-hero`), escritorio / móvil |
| 24 px | Cifras de indicadores |
| 20 px | Cifras secundarias, estados "no disponible" a tamaño de cifra |
| 14 px 500 | Títulos de sección y de widget (h2) |
| 13 px | Cuerpo, controles, etiquetas de indicadores |
| 12 px | Leyendas, metadatos |
| 11 px | Ejes de gráficos, contadores compactos (mínimo absoluto) |

### Named Rules
- **La regla de la cifra**: el número es el titular; la etiqueta es pequeña, gris y va encima. El símbolo de moneda va pequeño y gris al lado de la cifra dominante.
- **Sin separadores de relleno**: no unir metadatos con "·". Tres datos se diseñan como tres datos (o se escriben como frase con comas).
- **Sin micro-etiquetas en MAYÚSCULAS** ni eyebrows sobre los títulos.

## Layout

- Shell inset: barra lateral (232 px, minimizable a 56 px con ⌘B) y cabecera sobre el lienzo; la página en un panel con scroll propio. Enlace "Saltar al contenido" como primer foco.
- Lienzo liso en Claro y Midnight (sin punteado).
- El resumen ejecutivo, de arriba abajo:
  1. Barra de página: vista guardada (preset) a la izquierda; período y "Personalizar" a la derecha.
  2. **Visualización financiera principal** (panel de ancho completo): métrica y rango como h2, cifra dominante, una línea de contexto, controles (Día/Semana/Mes, por marca, vs. período anterior, ver datos), gráfico de 272 px (210 px en móvil), leyenda y fuente con su última actualización.
  3. En móvil: "Requiere atención" (sólo urgentes e importantes) inmediatamente después.
  4. Franja de indicadores: una superficie con 4 celdas separadas por líneas.
  5. Widgets personalizables en rejilla de 12 columnas (gap 16 px).
- Alineación a la izquierda siempre. Breakpoints de verificación: 390, 768, 1280, 1440.

## Elevation & Depth

- Claro y Midnight: planos. Separación por borde de 1 px o cambio de lienzo a panel. Sin sombras en paneles.
- Atmosphere: profundidad por vidrio y por el gradiente del lienzo.
- Flotantes (tooltip, menús, toasts, barra de personalización, arrastre): `--float-shadow`, la única sombra del sistema.

## Shapes

Controles 6 px, superficies 10 px, píldoras sólo para contadores. Áreas de gráfico sin radio.

## Components

### Visualización financiera principal (firma del sistema) — `src/pages/overview/PrimaryChart.jsx`
- **Métrica elegible** (Ingresos por defecto): Ingresos, Utilidad neta, Gastos, Caja disponible, Flujo de caja, Venta web, Ingresos proyectados, Rentabilidad proyectada. Sólo se habilitan las que tienen datos; las demás aparecen desactivadas con el motivo ("Registra tus cuentas…"). Se recuerda la elegida.
- **Cifra dominante** con NumberFlow (450 ms): total real del rango; en métricas proyectadas, el total proyectado en ámbar. Nunca se suma lo proyectado: va en la línea de contexto como "Proyectado aparte".
- **Reglas de verdad** (`metrics.js`, con pruebas en `test/os-overview-metrics.test.js`):
  - Real y proyectado en series separadas; nunca se suman.
  - Faltante (fecha pasada sin liquidar, presupuesto sin costos) = hueco con banda rayada gris y marcador punteado; nunca cero ni línea.
  - Cero confirmado (semana sin fechas, día sin ventas web) = la línea toca la base.
  - El futuro sin datos reales no es cero.
  - Las dos fuentes de ingreso (liquidación por fecha y venta web por día) son métricas distintas; jamás se suman.
- **Trazo**: 1.5 px en tinta; relleno de líneas diagonales a 45° (`--chart-hatch`) que se desvanece hacia la base. **Escalonado** para métricas por fecha de evento; **curva monótona** (Fritsch–Carlson, sin pasarse de los datos) para series continuas.
- **Pocos datos**: con menos de 2 períodos reales no se dibuja tendencia: se marca el punto real con línea de referencia y el nombre de la fecha. Mejor, peor y promedio sólo con 3 o más períodos con valor. La comparación con el período anterior sólo se ofrece si ambos tienen 2 o más períodos con valor.
- **Proyectado**: mismo escalón, trazo punteado y rayado en `--proj`.
- **Ejes**: cuadrícula horizontal punteada; eje Y a la izquierda (como Midday); etiquetas de 11 px. Línea punteada "hoy".
- **Interacción**: crosshair vertical, marcador anillado, tooltip oscuro flotante que sigue al cursor (180 ms) con valor en mono, período, proyectado aparte, fechas del período. Clic o Enter fija el período y lista **todas** sus fechas para abrirlas. Teclado: Tab al gráfico, flechas, Inicio/Fin, Enter, Escape. Región en vivo para lectores de pantalla y botón "Ver datos" (tabla).
- **Transiciones**: al cambiar métrica o marca sobre los mismos períodos los valores se interpolan (450 ms); al cambiar agrupación o rango, fundido.

### Indicadores — `KpiStrip.jsx`
Cuatro celdas en una superficie: Resultado real, Caja disponible, Por cobrar, Utilidad proyectada (ámbar, rayado). Cada celda abre de dónde sale su número; la flecha es visible siempre (no sólo al pasar el mouse). Miniaturas (línea, área o barras de 88×28 px) sólo con serie real de 3 o más puntos; si no, cifra limpia.

### Widgets personalizables — `WidgetGrid.jsx`
- **Modo normal**: limpio, sin controles de edición; cada widget es un panel plano con título h2 de 14 px y un enlace a su sección.
- **Modo personalizar**: barra flotante propia (añadir, restaurar, listo); en cada widget asa de arrastre, tamaño (S/M/L/XL) y quitar. Quitar ofrece **Deshacer** (6 s). Orden con teclado (dnd-kit, anuncios en español). Presets guardados por vista; se conserva lo guardado por el usuario.

### Bandeja de atención
Cada alerta: qué pasó (título), nivel en texto (Urgente / Importante / Aviso), a qué fecha y marca afecta, por qué importa, y una acción principal con nombre de verbo ("Cargar costos"). Alertas repetidas se agrupan con su cuenta. Posponer 24 h.

### Agenda de producción
Cinta de las próximas 6 semanas con cada fecha en su día (punto de marca) y debajo la corrida: bloque de fecha, marca y cuenta regresiva, nombre, etapa (StageBadge), preparación (ingresos, costos, local) y lo proyectado en ámbar.

### Navegación
Barra lateral con grupos plegables e indicador deslizante; selector de marca segmentado; paleta ⌘K; fuentes de datos con su última sincronización en la cabecera.

## Motion

- Tiempos: micro 120 ms, estándar 200 ms, paneles 300 ms, cifras 450 ms. Curva `cubic-bezier(0.2, 0, 0, 1)`; resortes sólo para indicadores y arrastre.
- Cubre: cambio de marca (indicador deslizante + interpolación del gráfico), métrica, tema (transición de colores de 300 ms), rango, barra lateral, paneles, personalización (aparecen asas y tamaños), interacción del gráfico, cifras (NumberFlow), menús, carga (esqueleto con las medidas finales).
- Sin cascadas de entrada. `prefers-reduced-motion`: sin desplazamientos ni interpolaciones.

## Accessibility

- AA en los tres temas (tabla arriba). Significado nunca sólo por color.
- Jerarquía: h1 (oculto visualmente; la ruta de migas lo muestra) → h2 por sección y widget.
- Foco visible de 2 px con la tinta del tema en todos los controles; gráfico operable con teclado; tabla alternativa.
- Áreas táctiles de 32 px mínimo.

## Do's and Don'ts

### Do:
- Abrir con la métrica elegida en grande y su gráfico.
- Decir "no disponible" y por qué; ofrecer la acción que lo resuelve.
- Separar real de proyectado en forma, color y posición.
- Usar el color de marca sólo para identificar datos de esa marca.

### Don't:
- No dibujar una tendencia continua con un solo dato ni interpolar sobre datos desconocidos.
- No volver a un gráfico de barras grande.
- No filas de tarjetas de KPI idénticas; no tarjetas dentro de tarjetas.
- No el estilo por defecto de Recharts ni tooltips claros genéricos en el gráfico principal.
- No gradientes decorativos ni brillos (salvo el lienzo de Atmosphere).
- No insignias de colores para todo (sí para estados con significado); no MAYÚSCULAS con tracking; no cadenas "A · B · C"; no "→" pegado al texto.
- No paletas genéricas de "fintech" ni IBM Plex.
