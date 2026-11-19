# OAKHAVEN AI FASE 5 — Informe de Pruebas (Bruno y Milo)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase5-bruno-milo`

## 1. Resultados ejecutados

| Verificación | Comando | Resultado | Detalle |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores. |
| **Suite completa de pruebas** | `npm test` | **APROBADO** | **316 / 316 pruebas aprobadas**, `0` fallos, `0` omitidas, `12` suites. |
| **Suite dedicada Fase 5** | `tests/oakhaven-ai-phase5-bruno-milo.test.ts` | **APROBADO** | 3 bloques integrales: Bruno (exclusión demo, tonelaje 380 kg, RPE 7.5, seguridad médica, rutina Nivel 2, aislamiento), Milo (WCA Ao5 con +2 y 1 DNF = 14.67s, 2 DNFs = DNF, insuficientes solves, Ao12, separación estricta 3x3 vs 2x2, notación WCA, plan Nivel 2) y Rowan + Nivel 3 + GP/XP/COP intactos. |
| **Build de producción Next.js** | `npm run build` | **APROBADO** | Exit code `0`, `✓ Compiled successfully in 9.6s`, lint y tipos válidos, `33/33` páginas estáticas y empaquetado `.next/standalone` completados. |

## 2. Distinción de cobertura
- **Automatizado y comprobado:** Cálculos deterministas de Gym y WCA, aislamiento multiusuario y por edificio, bloqueo Nivel 3, idempotencia de propuestas Nivel 2 y regresión cero de Clara, Lyra, Aura, Eldrin, Nora y Silas.
- **Pendiente antes de despliegue:** Prueba manual en navegador autenticado en **Gym (Bruno)** y **Cubos (Milo)** confirmando una propuesta Nivel 2 y recargando la página.
