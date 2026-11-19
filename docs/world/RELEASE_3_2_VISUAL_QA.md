# OAKHAVEN — RELEASE 3.2: REPORTE DE QA VISUAL, MÓVIL, ACCESIBILIDAD Y RENDIMIENTO

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase9-living-village-5` (base `main` @ `5813eea`, Release 3.1)  
**Clasificación:** **`LISTO PARA DESPLEGAR`** *(con prueba en dispositivos físicos iOS Safari / Android Chrome documentada como verificación post-despliegue)*

---

## 1. Pruebas Automatizadas
- `npx tsc --noEmit`: **APROBADO** (`0` errores).
- `npm test`: **335 / 335 pruebas aprobadas** (`16` suites, incluyendo regresión completa de finanzas, GP/XP, sesiones, RLS, `/api/sync`, CAS, PGlite y Fase 9).
- `npm run build`: **APROBADO (exit code `0`, `35/35` rutas)**.

## 2. Navegador Desktop Real (`1440×900`, `1024×768`, `768×1024` en `http://localhost:3100/cozy`)
Ejecutado con sesión Demo aislada (sin tocar datos reales del usuario):
- **Carga inicial y Consola:** `0` errores de hidratación de React, `0` llamadas automáticas a `/api/ai/*` antes de interacción del usuario, `0` errores de consola tras corregir el listener `wheel` no-pasivo.
- **Clima y Atmósfera:** Cambio fluido entre `Sol`, `Lluvia`, `Otoño` y `Noche`; ondas de río animadas por CSS.
- **Cámara y Zoom:** Zoom `+`/`-` (`100% -> 115% -> 85%`) y zoom con rueda focal sin errores de `passive event listener`.
- **Avatar y Modo Caminar:** Activación/desactivación de `Caminar`, D-pad táctil y movimiento por teclado (`ArrowRight`/`WASD`) dentro de límites, preservando acceso directo con 1 clic.
- **Presidente Rowan (`🦉`):** Visible en Plaza Central con globo de diálogo basado en registros reales (`12 registros confirmados...`), elevado a `zIndex: 60` para quedar sobre edificios adyacentes.
- **Compañeros (`Vecinos (14)`):** Abre correctamente, filtros (`14` total, `6` Saber & Foco, `5` Artes & Oficios, `3` Naturaleza & Vitalidad) y cierre con `Escape`.
- **Interiores (`LivingInteriorRoom`):** Acceso directo vía `Ir directo:` a `El Atelier de Hilados & Textil`; 3 elementos de mobiliario interactivo y las 5 estaciones cambian correctamente (`aria-pressed="true"`), y `Volver al Pueblo` regresa al mapa sin perder estado.
- **Evidencia visual capturada (host-verificada):**
  - `final_step_50.png` / `final_step_69.png` en el directorio de evidencia del navegador sobre `http://localhost:3100`.

## 3. Emulación Móvil (`390×844`, `375×667`, `320×667`)
| Viewport | Overflow Horizontal Inicial | Overflow Tras Corrección P1 | Barra `Ir directo:` & `role="tablist"` | D-Pad vs HUD Cámara |
|---|---|---|---|---|
| **390×844** | `+42px` (`CozyHeader` sin `flex-wrap`) | **`0px` (APROBADO)** | **APROBADO** (`5` pestañas legibles, `aria-selected`) | Sin solapamiento (`top-3 left-3`) |
| **375×667** | `+57px` | **`0px` (APROBADO)** | **APROBADO** | Corregido de `76×70px` -> `top-3 left-3` (**`0px` solapamiento**) |
| **320×667** | `+112px` | **`0px` (APROBADO)** | **APROBADO** | Corregido de `76×78px` -> `top-3 left-3` (**`0px` solapamiento**) |

## 4. Dispositivos Físicos Reales
- **iOS Safari / Android Chrome físicos:** **NO DISPONIBLES EN ESTE ENTORNO (NO SIMULADOS)**. Queda registrado para validación rápida en dispositivo físico tras el despliegue en producción.

## 5. Defectos Reales Detectados y Corregidos (HITO 7)
1. **[P1] Overflow horizontal en móvil (`390px`/`375px`/`320px`):** `CozyHeader` (`src/components/cozy/cozy-header.tsx`) tenía filas de botones sin `flex-wrap`. **Corregido** y re-verificado con `0px` de overflow en los 3 viewports.
2. **[P1] Solapamiento de D-pad con HUD de cámara en `320px`/`375px`:** El HUD inferior envuelve en 2 filas en móvil; el D-pad se reubicó en `top-3 left-3 sm:top-auto sm:bottom-4 sm:left-4` (esquina superior izquierda en móvil, inferior izquierda en desktop), eliminando cualquier solapamiento.
3. **[P1] Guardia de foco teclado en cámara y escena:** `useVillageCamera` y `InteractiveVillageScene` ahora ignoran `WASD`/flechas/`Espacio` cuando un `input`, `textarea`, `select`, `contenteditable` o `button` tiene foco.
4. **[P2] Error de consola en zoom con rueda (`passive event listener`):** Reemplazado `onWheel` de React por listener nativo `{ passive: false }` en `useVillageCamera`. Re-verificado con **0 errores de consola**.
5. **[P2] Solapamiento del globo de Rowan por edificios adyacentes:** Elevado `zIndex` de Rowan a `60` cuando `rowanSpeechOpen` está activo. Re-verificado visualmente en `1440×900`.

## 6. Rendimiento y Accesibilidad
- **Bundle medido (`next build`):** `First Load JS` compartido = **`103 kB`**, `/cozy` = **`93.5 kB`** (`316 kB` total), `0` dependencias externas añadidas.
- **FPS / Lighthouse:** No medidos en este entorno (no se inventan cifras).
- **Animaciones y pausa:** 100% CSS GPU (`transform`/`opacity`), pausa automática fuera de pantalla (`IntersectionObserver` -> `data-ambient-paused="true"`), `prefers-reduced-motion: reduce` + toggle persistente `Movimiento / Reducido`.

## 7. Integridad y Sincronización
- Finanzas COP, GP/XP, sesiones universales, confirmaciones Nivel 2, bloqueo Nivel 3, privacidad financiera de Silas/Rowan y uso sin Gemini intactos (verificado en las 335 pruebas y en la sesión navegador con `0` llamadas automáticas a `/api/ai/*`).
- **Nota de sincronización en producción:** La prueba E2E multidispositivo contra Supabase producción sigue supeditada a que el SQL de Release 3.1 (`supabase/drafts/20261119_phase8_data_continuity_sync.sql`) haya sido aplicado en Supabase; no se declara sincronización multidispositivo en la nube verificada aquí.
