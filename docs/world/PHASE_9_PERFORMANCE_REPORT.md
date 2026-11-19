# OAKHAVEN — FASE 9: REPORTE DE RENDIMIENTO Y ACCESIBILIDAD

**Fecha:** 2026-11-19

## 1. Optimizaciones de Rendimiento
- **Cero dependencias nuevas:** No se añadió Phaser ni librerías de animación en JS; el bundle compartido (`First Load JS`) se mantiene en ~103 kB.
- **Animaciones 100% CSS GPU:** Todas las animaciones ambientales (`oakhaven-float`, `oakhaven-drift`, `oakhaven-rain`, `oakhaven-firefly`, `oakhaven-ripple`) operan únicamente sobre `transform: translate3d(...)` y `opacity`, sin provocar layout reflow ni usar `setInterval`.
- **Pausa automática fuera de pantalla:** `InteractiveVillageScene` emplea `IntersectionObserver` para establecer `data-ambient-paused="true"` cuando el mapa sale del viewport, pausando todas las animaciones CSS vía `animation-play-state: paused !important`.
- **Cero llamadas automáticas a Gemini:** Ni la animación idle, ni los diálogos breves de Rowan/especialistas, ni las señales visuales disparan peticiones a modelos IA.

## 2. Accesibilidad (WCAG 2.1 AA)
- **Movimiento reducido:** Respeto automático de `@media (prefers-reduced-motion: reduce)` más control manual persistente (`Movimiento / Reducido`) en la barra superior del pueblo.
- **Navegación sin fricción:** Caminar con el avatar es 100% opcional; todos los edificios son accesibles en 1 toque desde la barra `"Ir directo:"`, en la vista de Fichas (`grid`) o haciendo clic/teclado en el mapa.
- **Teclado y lectores de pantalla:** `aria-label`, `aria-pressed`, `role="tablist"`/`role="tab"` en estaciones móviles, `tabIndex={0}` en especialistas y edificios, atajos `1-9`, `Esc`, `WASD`/Flechas, `+`/`-` y `Enter`.
- **Objetivos táctiles móviles:** Botones de cámara (`36px`), accesos rápidos (`min-h-[40px]`), D-pad táctil (`36px`) y pestañas de estaciones interiores (`min-h-[44px]`), con `touch-none` en el lienzo 2D para evitar conflictos de gestos.
