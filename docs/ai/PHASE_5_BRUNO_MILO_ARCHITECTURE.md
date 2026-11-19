# OAKHAVEN AI FASE 5 — Arquitectura de Bruno (Gym) y Milo (Cubos WCA)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase5-bruno-milo` (creada desde `main` @ `1737fc1`, con Release 2.4 ya integrado)

## 1. Principio rector: Cálculos 100% Deterministas en Servidor

Todas las métricas numéricas de Gym (tonelaje `reps × weightKg`, RPE medio, peso máximo y último peso por ejercicio) y de Cubos WCA (PB, media válida, desviación estándar σ, Ao5 y Ao12 con penalizaciones `+2` y `DNF`) se calculan en TypeScript determinista en `src/lib/ai/bruno-milo-tools.ts`. **Gemini nunca inventa tiempos, promedios ni cargas**; únicamente redacta explicaciones o síntesis sobre los resultados ya verificados.

## 2. Flujo de Datos y Planificador Multi-Herramienta

```text
Usuario pregunta en Gym (`gimnasio`) o Cubos (`club_puzzles`)
   ↓
POST /api/ai/specialist/chat (autenticación + rate limit)
   ↓
askBuildingSpecialist()
   ├─ Defensa Nivel 3 (bloquea pagos, COP, GP, XP)
   ├─ selectAuthorizedToolsForIntent() (máx. 4 herramientas del edificio)
   ├─ Bruno: detectMedicalOrInjuryQuery() + getLastRealWorkout() + getTrainingConsistency()
   ├─ Milo: getCubeSolveHistory(cubeType) + getRegisteredCubes() + explainCubeNotation()
   ├─ Documentos privados: readWorkoutPlan() / readAlgorithmSheet() (aislados por edificio y usuario)
   ├─ Propuesta Nivel 2 (requiresConfirmation: true + idempotencyKey -> POST /api/resources)
   └─ Pulido opcional con Gemini (fallback determinista si falla o hay timeout)
```

## 3. Reutilización de Infraestructura Existente
- **Bibliotecas privadas:** `building_resources`, `/api/resources`, `resource-query-tools.ts`, `document-extractor.ts` y `BuildingSpecialistPanel` (ahora con selector de documentos activo en 6 edificios: Atelier, Estudio, Oficina, Librería, Gym y Cubos).
- **Cronómetro y sesiones:** No se creó ningún cronómetro paralelo; `ClubPuzzlesBuilding` y `GymBuilding` mantienen sus cronómetros, atajos y motor universal intactos.
- **Presidente Rowan:** `getLastWorkout` y `getRecentCubeSolves` ahora incluyen última serie real no demostrativa (peso/volumen) y último algoritmo practicado.
