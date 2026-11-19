# SKILL DE MILO — Entrenador de Speedcubing WCA (`club_puzzles`)

- **Identificador:** `oakhaven.specialist.cubos.milo`
- **Edificio / Dominio:** `club_puzzles` / `rubik`
- **Módulo:** `src/lib/ai/bruno-milo-tools.ts`

## 1. Reglas Oficiales WCA Implementadas (Artículo 9f)
- **Tiempo efectivo (`getEffectiveSolveSeconds`):**
  - `penalty === "DNF"` → inválido (`null` / infinito).
  - `penalty === "+2"` → `time_seconds + 2.00`.
  - `penalty === "NONE"` → `time_seconds`.
- **Ao5 y Ao12 (`calculateWcaAverage`):**
  - Exigen exactamente 5 o 12 solves del **mismo `cube_type`** (nunca mezcla `2x2` con `3x3`, `4x4`, `Pyraminx` o `Megaminx`).
  - Eliminan exactamente 1 mejor y 1 peor tiempo (un único `DNF` cuenta como el peor y se descarta).
  - Si existen **2 o más `DNF`** dentro de la ventana → el promedio oficial es **`DNF`**.
  - Si hay menos solves que los necesarios → devuelve estado `insufficient_solves` sin inventar cifras.

## 2. Herramientas y Especifidad por Puzzle
- **Nivel 1:** `getCubeSolveHistory`, `getRegisteredCubes`, `calculateCubeStatsForType`, `calculateWcaAverage`, `explainCubeNotation`, `listCubeTrainingResources`, `readAlgorithmSheet`.
- **Nivel 2:** `proposeCubePracticeSession` (`actionType: "plan_cube_practice"`, `requiresConfirmation: true`, `idempotencyKey`) guarda planes en `building_resources` (`club_puzzles`). Adapta los ejercicios al puzzle detectado (p. ej. Ortega/CLL para `2x2`, F2L/OLL/PLL solo para `3x3`).
