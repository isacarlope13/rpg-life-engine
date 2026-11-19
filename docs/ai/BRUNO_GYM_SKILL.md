# SKILL DE BRUNO — Entrenador Inteligente de Gym (`gimnasio`)

- **Identificador:** `oakhaven.specialist.gym.bruno`
- **Edificio / Dominio:** `gimnasio` / `sports`
- **Módulo:** `src/lib/ai/bruno-milo-tools.ts`

## 1. Separación estricta de series DEMO vs REALES
En `src/components/sanctuary/gym-building.tsx`, las 3 series iniciales de ejemplo ("Sentadilla Goblet") se marcaron explícitamente con `id: "demo-set-*"`, `completed: false`, `isDemo: true` y `dataOrigin: "demo_template"`.

`filterRealGymSets()` excluye cualquier serie marcada como `isDemo` o `demo_template`, garantizando que Bruno **jamás** reporte series precargadas como entrenamientos realizados por el usuario.

## 2. Seguridad deportiva
`detectMedicalOrInjuryQuery()` intercepta consultas sobre dolor agudo, lesiones, esguinces, mareos o diagnósticos: Bruno aclara que es un acompañante de entrenamiento (no médico), no prescribe cargas extremas ni diagnósticos y recomienda atención profesional. Además, nunca penaliza días de descanso.

## 3. Herramientas y Persistencia
- **Nivel 1:** `getLastRealWorkout`, `getTrainingConsistency`, `calculateTrainingVolume`, `getGymPersonalRecords`, `listGymResources`, `readWorkoutPlan`.
- **Nivel 2:** `proposeNextWorkout` (`actionType: "plan_gym_routine"`, `requiresConfirmation: true`, `idempotencyKey`) guarda la rutina propuesta en `building_resources` (`gimnasio`) al confirmar.
- **Datos reales vs locales:** Las sesiones de entrenamiento se consultan de Supabase `activity_logs` (`domain = 'sports'`); las series detalladas viven actualmente en `oakhaven_gym_sets_v1` (localStorage del dispositivo) y se envían filtradas en `local_snapshot` sin borrar el almacenamiento local.
