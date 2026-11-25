---
name: Paradisio OS
description: Plataforma financiera y operativa de Paradisio Entertainment Group — fintech monocromático con identidad de vida nocturna
colors:
  light-canvas: "#F4F4F2"
  light-surface: "#FFFFFF"
  light-ink: "#0A0A0A"
  light-ink-2: "#5E5E5A"
  light-ink-3: "#9A9A95"
  light-hairline: "#E6E6E3"
  midnight-canvas: "#000000"
  midnight-surface: "#0A0A0A"
  midnight-raised: "#121212"
  midnight-ink: "#F2F2F0"
  midnight-ink-2: "#8E8E8A"
  midnight-ink-3: "#5C5C59"
  midnight-hairline: "#1C1C1C"
  atmosphere-canvas: "#07080B"
  atmosphere-glass: "rgba(255,255,255,0.035)"
  atmosphere-glass-edge: "rgba(255,255,255,0.08)"
  atmosphere-glow: "rgba(150,160,190,0.10)"
  positive: "#22A06B"
  negative: "#E5484D"
  projected: "#B98A3E"
  brand-club: "#F0441A"
  brand-beats: "#0F9BB0"
  brand-icon: "#7B45FF"
typography:
  figure-hero:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "48px"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "-0.04em"
  figure:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
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
    textColor: "{colors.light-surface}"
    rounded: "{rounded.control}"
    height: "32px"
    padding: "0 12px"
  segmented:
    backgroundColor: "{colors.light-canvas}"
    textColor: "{colors.light-ink-2}"
    rounded: "{rounded.control}"
    height: "30px"
  surface:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.surface}"
    padding: "20px"
  chart-tooltip:
    backgroundColor: "{colors.midnight-raised}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
---

# Design System: Paradisio OS

## Overview

**Creative North Star: "La cabina de la noche"**

Paradisio OS es la cabina desde donde se dirige un grupo de vida nocturna: una herramienta financiera seria, monocromática y precisa, con la temperatura de la noche. La referencia directa es el dueño: **Midday v2** (midday.ai) para jerarquía, tipografía de cifras, gráficos de área con relleno rayado, widgets y densidad financiera; **Dashtrans** (capturas del dueño) para el tema oscuro atmosférico con superficies translúcidas y gradientes contenidos. Estas referencias mandan sobre cualquier recomendación genérica de un skill.

> Capturas de referencia: el dueño las adjuntó en la conversación pero no llegaron al agente que escribió este archivo. Guardarlas en `dashboard/design/references/` (midday-*.png, dashtrans-*.png) para que futuras sesiones las vean. Hasta entonces, este documento describe la dirección con las palabras del dueño.

La densidad es de herramienta: mucha información por pantalla, ordenada por tipografía y espacio, no por cajas. El color pertenece a dos cosas: las marcas (identidad de sus datos) y el significado financiero (positivo, negativo, proyectado). Todo lo demás es tinta sobre papel, en claro o en noche.

**Key Characteristics:**
- Monocromo absoluto en la interfaz corporativa; el color se gana.
- Cifras como tipografía protagonista: grandes, livianas, tabulares.
- Gráficos de área continuos con relleno de líneas diagonales; escalonados cuando el dato es por fecha.
- Lo proyectado siempre se ve distinto: rayado, punteado, en ámbar apagado, y separado de lo real.
- Superficies planas en claro y Midnight; translúcidas solo en Atmosphere.
- Movimiento que explica causa y efecto, nunca decorativo.

## Colors

### Temas
Tres temas, elegibles por el usuario (Claro, Midnight, Atmosphere). Mismo sistema, misma jerarquía; solo cambia la luz.

- **Claro premium**: lienzo gris cálido muy suave `{colors.light-canvas}` alrededor de un panel blanco `{colors.light-surface}`. Tinta casi negra; líneas `{colors.light-hairline}`.
- **Midnight**: negro real `{colors.midnight-canvas}` en el lienzo, panel `{colors.midnight-surface}`. Es el tema de Midday: sin gradientes, sin brillo, contraste alto y gris neutro. Para la noche del evento y para quien trabaja a oscuras.
- **Atmosphere**: noche azulada `{colors.atmosphere-canvas}` con un gradiente radial contenido (máx. 10% de opacidad, `{colors.atmosphere-glow}`) detrás del contenido, y superficies de vidrio `{colors.atmosphere-glass}` con borde `{colors.atmosphere-glass-edge}` y `backdrop-filter: blur(20px)`. Inspirado en Dashtrans. El gradiente vive en el lienzo, nunca dentro de tarjetas ni detrás de texto.

### Significado financiero
- `{colors.positive}` resultado o variación favorable; `{colors.negative}` pérdida, vencido, alerta grave. Nunca como decoración ni para "dar vida".
- `{colors.projected}` + rayado diagonal: todo lo proyectado (presupuestos, pronósticos). Lo proyectado no usa verde ni rojo sólido.

### Marcas
`{colors.brand-club}`, `{colors.brand-beats}`, `{colors.brand-icon}` identifican datos de cada marca: series al dividir por marca, rieles de eventos, puntos en listas, selector de marca. Nunca como fondo de superficie, nunca en botones globales.

### Named Rules
- **La regla de la tinta**: si un color no significa marca o significado financiero, es gris.
- **La regla de la noche real**: Midnight usa negro de verdad (`#000`), no un negro teñido.

## Typography

Una sola familia, Geist, usada con intención; Geist Mono solo para códigos (tickets, RUC, referencias). Todas las cifras con números tabulares.

### Hierarchy
- **Cifra héroe** (`figure-hero`): el total principal de una vista. 40–56 px, peso 300, tracking −0.04em. Liviana y grande, como en Midday.
- **Cifra** (`figure`): KPIs secundarios, 20–26 px, peso 400.
- **Título** (`title`): título de página, 20 px peso 500. Sin "eyebrow" en mayúsculas.
- **Cuerpo** (`body`) 13 px; **Leyenda** (`caption`) 12 px gris.
- Etiquetas en minúscula de oración, nunca en MAYÚSCULAS con tracking.

### Named Rules
- **La regla de la cifra**: el número es el titular; la etiqueta es pequeña y gris y va encima o al lado, nunca compite.
- **Sin separadores de relleno**: no unir metadatos con "·" en cadena; si hay tres datos, se diseñan como tres datos.

## Layout

- Shell inset: barra lateral y cabecera sobre el lienzo; la página en un panel con scroll propio. Barra lateral de 232 px, minimizable a 56 px (⌘B).
- Rejilla de 12 columnas, ancho completo hasta 1480 px de contenido; gutter 16 px en móvil, 24 px en desktop.
- El resumen ejecutivo abre con el gráfico de ingresos a todo el ancho (cifra héroe + controles + gráfico), sin caja alrededor. Debajo, una franja de KPIs con sparklines y luego los widgets personalizables.
- Alineación a la izquierda siempre; nada centrado salvo estados vacíos pequeños.
- Móvil (390 px): una columna, controles en fila desplazable, gráficos a 200 px de alto, tablas con scroll horizontal propio; nunca scroll horizontal de página.
- Breakpoints de verificación: 390, 768, 1280, 1440.

## Elevation & Depth

- Claro y Midnight: planos. La separación es una línea de 1 px o un cambio de lienzo a panel. Sin sombras en tarjetas.
- Atmosphere: profundidad por translucidez (vidrio + desenfoque) y el gradiente del lienzo; sombra solo en elementos flotantes.
- Elementos flotantes (tooltip, menús, paneles laterales, paleta ⌘K): una sombra suave y amplia, única en el sistema.

## Shapes

- Controles 6 px, superficies 10 px, píldoras solo para estados y contadores. No todo lleva el mismo radio: el radio sigue a la jerarquía.
- Gráficos: barras con 2 px de radio superior; áreas sin radio.

## Components

### Gráfico de área (firma del sistema)
- Curva continua (`monotone`) con trazo de 1.5 px en tinta y relleno de **líneas diagonales a 45°** (patrón de 6 px, 1 px de línea, 35–55% de opacidad), que se desvanece hacia la base.
- Variante **escalonada** (`stepAfter`) para series por fecha de evento, donde el ingreso ocurre en un día puntual.
- Lo proyectado continúa la serie con trazo punteado y rayado en `{colors.projected}`.
- Ejes: solo horizontal, línea de cuadrícula punteada muy tenue, etiquetas de 11 px grises; eje Y a la derecha. Sin leyendas grandes; la leyenda es una línea de texto.
- Al pasar el mouse: línea vertical fina, punto en la serie, tooltip oscuro con período, monto, cambio vs. período previo y eventos.
- Altura 220–280 px en desktop. Nunca un gráfico grande con un solo dato: si hay menos de 2 puntos, se muestra una lectura textual compacta.

### Sparklines de KPI
- 72×24 px, trazo de 1.25 px, sin ejes; último punto marcado. Gris para neutro; color solo si el KPI tiene significado (positivo/negativo).
- Solo con serie real de al menos 3 puntos; si no, no se dibuja.

### Cifras
- NumberFlow para todo total que cambia con filtros (450 ms, curva estándar). La variación va al lado: flecha fina + porcentaje en color de significado.

### Navegación
- Barra lateral con grupos plegables, indicador activo que se desliza, iconos de 16 px con trazo 1.6.
- Selector de marca segmentado en la cabecera, con el punto de color de cada marca.
- Paleta ⌘K, atajos visibles en tooltips.

### Tablas
- Encabezado fijo, filas de 40 px, sin rayado zebra, números alineados a la derecha, filas expandibles, acciones contextuales, selección múltiple.

### Controles
- Segmentados con fondo que se desliza (Animate UI Highlight). Botón primario en tinta sólida; secundario sin borde visible hasta el hover.

## Motion

- Tiempos: micro 120 ms, estándar 200 ms, paneles 300 ms, cifras 450 ms. Curva estándar `cubic-bezier(0.2, 0, 0, 1)`; resortes solo para indicadores y arrastre.
- Gráficos: los datos se transforman al cambiar filtros (no se redibujan desde cero); el tooltip sigue al cursor con 180 ms.
- Sin animaciones de entrada en cascada en cada tarjeta. Una sola entrada de página, sutil.
- `prefers-reduced-motion`: sin desplazamientos, solo cambios de opacidad instantáneos.

## Accessibility

- Contraste AA en los tres temas; el gris terciario solo para texto no esencial.
- El significado nunca solo por color: signo (+/−), flecha o texto acompañan al verde y al rojo; lo proyectado además va rayado.
- Foco visible de 2 px en todos los controles; todo operable con teclado.
- Áreas táctiles de 32 px mínimo en móvil (40 px en acciones principales de En vivo).

## Do's and Don'ts

### Do:
- Abrir cada vista con su cifra más importante en grande, y su tendencia.
- Mostrar altos y bajos: mejor y peor período, cambio vs. período anterior.
- Separar real de proyectado en forma, color y posición.
- Decir "no disponible" y por qué cuando falta un dato.
- Usar el color de marca solo para identificar datos de esa marca.

### Don't:
- No filas de 6–8 tarjetas de KPI idénticas.
- No una caja con borde alrededor de cada sección; no tarjetas dentro de tarjetas.
- No gráficos de barras gigantes con uno o dos datos; no el estilo por defecto de Recharts.
- No gradientes decorativos ni brillos (salvo el lienzo de Atmosphere, contenido).
- No insignias de colores para todo; no etiquetas en MAYÚSCULAS con tracking; no cadenas "A · B · C"; no "→" pegado al texto de los enlaces.
- No negro teñido como sustituto del negro en Midnight.
- No animaciones en cascada al cargar ni hover que mueve tarjetas.
- No adoptar paletas genéricas de "fintech" (azul marino/pizarra, verde de acento) ni la tipografía IBM Plex que sugieren los skills genéricos: la dirección la fijan Midday y Dashtrans.
