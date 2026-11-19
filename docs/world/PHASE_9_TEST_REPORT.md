# OAKHAVEN — FASE 9: REPORTE DE PRUEBAS (PUEBLO VIVO 5.0)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase9-living-village-5`

| Nivel de Prueba | Comando / Alcance | Resultado |
|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** (`0` errores) |
| **Suite completa de pruebas** | `npm test` (incluye `tests/oakhaven-phase9-living-village-5.test.ts` + 329 pruebas previas de regresión, finanzas, IA, RLS, CAS y PGlite) | **335 / 335 pruebas aprobadas** (`16` suites) |
| **Build de producción Next.js** | `npm run build` | **APROBADO (exit code `0`)** (`35/35` rutas) |
| **Prueba visual autenticada en navegador real (Desktop + Móvil)** | Pendiente de revisión interactiva en entorno autenticado | **PENDIENTE (NO SIMULADA)** |

## Cobertura Específica de Fase 9 (`tests/oakhaven-phase9-living-village-5.test.ts`)
1. Límites del avatar explorador (`EXPLORER_BOUNDS`), paso direccional y detección de edificios cercanos (`findNearestBuilding`).
2. Señales visuales confirmadas (`deriveBuildingVisualSignals`): sesión activa, propuestas pendientes, registros confirmados, libros/proyectos/solves y estado sereno en días de descanso (sin penalización ni alteración de GP/XP/COP).
3. Habitantes dinámicos sin IA (`getResidentAmbientState`): modo silencioso, acompañamiento en sesión activa y saludo sin inventar historial.
4. Planos temáticos de los 8 edificios definitivos (`getInteriorRoomTheme`) con mobiliario interactivo.
5. Persistencia segura de preferencia de animaciones reducidas (`loadAmbientMotionPreference` / `saveAmbientMotionPreference`).
6. Verificación estructural de `IntersectionObserver`, `data-ambient-paused`, `onTouchStart`, `touch-none`, Presidente Rowan en plaza, barra móvil `"Ir directo:"`, `role="tablist"` (`min-h-[44px]`), `prefers-reduced-motion` y conexión de `CompanionsModal`.
