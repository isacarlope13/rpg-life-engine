# CONTRATO DE ORQUESTACIÓN DE PRESIDENTE ROWAN 2.0

## 1. Reglas de Composición de Skills
- **Presupuesto por turno:** `MAX_TOOL_CALLS_PER_TURN = 3` (sin bucles ni recursión entre agentes).
- **Sin escalación de privilegios:** Rowan solo invoca herramientas de solo lectura (Nivel 1) acotadas al `authenticatedUserId` del servidor.
- **Separación financiera estricta:** `isExplicitFinancialQuestion()` exige intención explícita (`gasté`, `banco`, `dinero`, `COP`, `presupuesto`, `deuda`, `obligación`, `quincena`, `ingresos`, `compra`). Palabras genéricas como `"semana"` **jamás** activan `getRecentExpenses`.

## 2. Memoria Contextual y Planificación Cotidiana
- **`buildOakHavenContextualMemory(ctx)`:** reúne únicamente hechos verificados de edificios no financieros (`oficina`, `biblioteca`, `libreria`, `atelier`, `cine`, `gimnasio`, `club_puzzles`), etiquetando cada elemento como `recorded_fact`, `derived_summary`, `local_unverified` o `ai_suggestion`.
- **`buildRowanDailyPlan(ctx, mode)`:** soporta `mi_dia`, `que_retomar`, `mi_semana`, `siguientes_pasos` y `mi_descanso`, sin castigos por inactividad y sin crear sesiones, eventos ni recompensas automáticamente.

## 3. Ciclo de Vida de Propuestas Supervisadas (Hito 8)
`ProposalLifecycleStatus = "pending" | "confirmed" | "applied" | "rejected" | "failed"` — las propuestas Nivel 2 nunca se ejecutan durante una consulta informativa y requieren confirmación humana explícita e `idempotencyKey`.
