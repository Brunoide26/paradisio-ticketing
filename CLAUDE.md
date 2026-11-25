# Paradisio — notas para agentes

## Dos superficies con diseño distinto
- **Web pública de tickets** (`index.html`, `admin.html`, `staff.html`…): contexto en `PRODUCT.md` y `DESIGN.md` de la raíz.
- **Paradisio OS** (`dashboard/` → se compila a `administracion/`): contexto en `dashboard/PRODUCT.md` y `dashboard/DESIGN.md`. Impeccable los resuelve solo cuando el objetivo está dentro de `dashboard/`.

No mezclar las dos direcciones visuales.

## Skills de diseño (en `.claude/skills/`, versiones fijadas en `skills-lock.json`)
Orden de trabajo para cualquier cambio visual del OS. Si dos skills se contradicen, gana `dashboard/DESIGN.md`, después Impeccable.

1. **impeccable**: dirección y revisión principal. Empezar con `.claude/skills/impeccable/scripts/impeccable context --target <archivo>`; critique/audit/polish con sus referencias. Antes de editar UI, leer `reference/craft-floor.md`. Al terminar, correr el detector: `.claude/skills/impeccable/scripts/impeccable detect --json <archivos>`.
2. **frontend-design**: calidad de implementación y lista de rasgos genéricos a evitar.
3. **ui-ux-pro-max**: solo investigación y referencia secundaria (patrones de dashboard, visualización). Sus paletas y tipografías genéricas no reemplazan `dashboard/DESIGN.md`.
4. **shadcn**: implementación de componentes (el proyecto usa shadcn new-york, Tailwind v4, React 19).
5. **web-design-guidelines**: auditoría final de accesibilidad y UX.

El hook automático de Impeccable (revisa cada edición) **no está activado** en el repositorio. Para activarlo en tu máquina: `.claude/skills/impeccable/scripts/impeccable hooks on` (descarga su motor desde GitHub Releases, verificado por checksum).

## Reglas que ningún cambio visual puede romper
- No tocar autenticación, cálculos financieros (`lib/os/*`, `api/*`), datos ni infraestructura desde un trabajo de diseño.
- Lo real y lo proyectado nunca se suman; un dato faltante es "no disponible", no cero.
- Compilar con `cd dashboard && npx vite build`; pruebas con `npm test` en la raíz.
