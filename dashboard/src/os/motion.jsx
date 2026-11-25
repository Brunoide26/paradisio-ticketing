// Sistema de movimiento del OS: tiempos, curvas y primitivas reutilizables.
// Mismos valores que las variables CSS (--dur-*, --ease-*) de index.css.
// Regla: el movimiento explica causa y efecto; nunca retrasa contenido ni bloquea la interacción.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, MotionConfig, useReducedMotion } from 'motion/react';

export const dur = { micro: 0.12, standard: 0.2, layout: 0.3, number: 0.45 };
export const ease = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0, 1],
  exit: [0.3, 0, 1, 1],
};
// Resortes sólo para lo que se arrastra, indicadores y cambios de diseño.
export const spring = {
  indicator: { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 },
  layout: { type: 'spring', stiffness: 380, damping: 36 },
  drag: { type: 'spring', stiffness: 600, damping: 40 },
};
export const t = {
  micro: { duration: dur.micro, ease: ease.standard },
  standard: { duration: dur.standard, ease: ease.standard },
  enter: { duration: dur.standard, ease: ease.enter },
  layout: { duration: dur.layout, ease: ease.standard },
};

// Raíz: respeta "reducir movimiento" del sistema en todos los componentes de motion.
export function MotionRoot({ children }) {
  return <MotionConfig reducedMotion="user" transition={t.standard}>{children}</MotionConfig>;
}

// Transición de página: entra con un leve desplazamiento; no espera a que salga la anterior.
export function PageTransition({ id, children, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={id} className={className}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur.layout, ease: ease.enter }}>
      {children}
    </motion.div>
  );
}

// Aparece al montarse (para elementos nuevos, no para la carga inicial completa).
export function Appear({ children, delay = 0, className, as = 'div', ...p }) {
  const C = motion[as];
  return <C className={className} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ ...t.enter, delay }} {...p}>{children}</C>;
}

// Dónde está el elemento activo dentro de un contenedor, para que un indicador se deslice hasta él.
// Adaptado de useIndicator de Dashral (MIT, © 2026 Hasral Gana).
export function useIndicator(selector, deps = []) {
  const ref = useRef(null);
  const [rect, setRect] = useState(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const measure = () => {
      const el = [...box.querySelectorAll(selector)].find((x) => x.offsetParent !== null && !x.closest('[inert]'));
      if (!el) { setRect(null); return; }
      const b = box.getBoundingClientRect(); const r = el.getBoundingClientRect();
      const next = { x: r.left - b.left + box.scrollLeft - box.clientLeft, y: r.top - b.top + box.scrollTop - box.clientTop, w: r.width, h: r.height };
      setRect((c) => (c && c.x === next.x && c.y === next.y && c.w === next.w && c.h === next.h ? c : next));
    };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(box);
    const mo = new MutationObserver(measure);
    mo.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-current', 'aria-selected', 'data-state', 'data-current', 'inert', 'hidden'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [selector, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, rect];
}

// Indicador deslizante (fondo) que sigue a useIndicator.
export const indicatorClass = 'pointer-events-none absolute left-0 top-0 transition-[translate,width,height] duration-[var(--dur-layout)] ease-[var(--ease-standard)] motion-reduce:transition-none';
export function Indicator({ rect, className, style }) {
  if (!rect) return null;
  return <span aria-hidden className={`${indicatorClass} ${className || ''}`} style={{ translate: `${rect.x}px ${rect.y}px`, width: rect.w, height: rect.h, ...style }} />;
}
