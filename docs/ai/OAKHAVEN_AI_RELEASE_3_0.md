# OAKHAVEN AI — RELEASE 3.0
## Auditoría Integral del Primer Sistema Multiagente Completo (8 Especialistas + Presidente Rowan 2.0)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase7-rowan-command-center` (base `main` @ `684d822`)  
**Estado:** **`LISTO PARA REVISIÓN MANUAL`** *(TypeScript `0` errores, `322/322` pruebas aprobadas con pruebas instrumentadas de privacidad financiera en consultas directas y mixtas, `npm run build` exit code `0` con `34/34` rutas, E2E HTTP integral `5/5` bloques aprobados con los 9 personajes y `/api/ai/observability`; falta únicamente la prueba visual manual en navegador autenticado contra producción antes de autorizar merge/push a `main`)*

---

## 1. Estado de los Ocho Especialistas + Presidente Rowan 2.0

| Personaje | Edificio | Estado | Capacidades Verificadas |
|---|---|---|---|
| **Clara** | `atelier` (Crochet) | **ACTIVO** | Patrones PDF/MD, citas `[Página N]`, abreviaturas, materiales, proyectos reales, Nivel 2 confirmable. |
| **Lyra** | `biblioteca` (Estudio) | **ACTIVO** | Documentos académicos, exámenes deterministas con citas, evaluación adaptativa, flashcards SM-2 Nivel 2. |
| **Aura** | `oficina` (Trabajo) | **ACTIVO** | Proyectos reales (demos excluidas), tareas pendientes, análisis técnico, explicación de código, sprints Nivel 2. |
| **Eldrin** | `libreria` (Lectura) | **ACTIVO** | Libro actual, último agregado/leído/terminado vs wishlist, páginas semanales, citas y reseñas Nivel 2. |
| **Bruno** | `gimnasio` (Gym) | **ACTIVO** | Series reales (demos excluidas), tonelaje/RPE deterministas, guardia médica, `local_snapshot` etiquetado, rutinas Nivel 2. |
| **Milo** | `club_puzzles` (Cubos) | **ACTIVO** | PB por puzzle, `+2`, `DNF`, Ao5 (formato oficial WCA Art. 9f) vs Ao12 (entrenamiento), notación WCA, planes Nivel 2. |
| **Nora** | `cine` (Cine) | **ACTIVO** | Película/serie/musical, T/E exactos, favorita con `watchedAt`, watchlist sin afirmar streaming, reseñas Nivel 2 anti-duplicado `409`. |
| **Silas** | `banco_oakhaven` (Banco) | **ACTIVO (SOLO LECTURA)** | Enteros COP, exclusión de `INITIAL_FINANCIAL_MOVEMENTS`/`CASE_STUDY_ACCOUNTS`, separación COP/USD, simulaciones puras (`persisted: false`), `0` llamadas a Gemini. |
| **Presidente Rowan 2.0** | `ayuntamiento` | **ACTIVO (COMMAND CENTER)** | Orquestador multi-edificio (máx. 3 herramientas/turno), memoria contextual verificada, planes `Mi día` / `Qué retomar` / `Mi semana` / `Mi descanso`, respeto estricto a `disabled_skill_ids`, enlaces directos a edificios y cortafuegos financiero P0. |

---

## 2. Evidencia de Privacidad Financiera (Auditoría Crítica Hito 2)

Probado mediante instrumentación real (`onGeminiAttemptForTests`) en `tests/oakhaven-ai-phase7-rowan-command-center.test.ts` y `tests/oakhaven-ai-phase6-nora-silas.test.ts`:
1. **Expresiones temporales genéricas (`"¿Qué estudié esta semana?"`, `"¿Cuántas páginas leí esta semana?"`):** NO activan `getRecentExpenses`.
2. **Consultas financieras directas (`"¿Cuánto gasté esta semana en COP en el Banco?"`):** `geminiCallsOnFinance === 0` incluso con `allowGemini: true`.
3. **Consultas mixtas financieras:**
   - `"¿Qué hice esta semana y cuánto gasté?"` → **`mixedGeminiCalls === 0`** (`deterministic_grounded`).
   - `"Resume todas mis actividades, incluido Banco."` → **`mixedGeminiCalls === 0`** (`deterministic_grounded`).
   - `"¿Qué me recomienda Rowan para organizar mi presupuesto?"` → **`mixedGeminiCalls === 0`** (`deterministic_grounded`).
4. **Historial y resúmenes generales:** `stripFinancialHistoryForGemini()` elimina turnos previos con `COP`/`$`/`Banco`/`saldo`/`deuda` y `getVillageSummary` elimina `weeklySpentCop` antes de cualquier llamada a Gemini.
5. **Silas:** `geminiAttemptsForSilas === 0` incluso con `allowGemini: true`.
6. **Bloqueo de mutaciones:** pagos, transferencias, cambios de saldo y alteraciones de `GP`/`XP`/`COP` bloqueados (`mode: "blocked_safety"`).

---

## 3. Resultados QA y E2E (Separados por Nivel)

| Nivel | Comando / Entorno | Resultado | Evidencia |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores. |
| **Unitarias e integración** | `npm test` | **APROBADO** | **322 / 322 pruebas aprobadas**, `0` fallos, `14` suites. |
| **Build de producción Next.js** | `npm run build` | **APROBADO** | Exit code `0`, `34/34` rutas (incluyendo `/api/ai/observability`) + `.next/standalone`. |
| **E2E HTTP integral (9 personajes + observabilidad)** | `next dev` + `POST /api/auth/demo` (`e2e-release-3-0.mjs`, `local_engine`) | **APROBADO (5/5 bloques)** | `GET /api/ai/observability` sin auth → `401`; 8 especialistas OK (Silas `deterministic_grounded`); Rowan Command Center (`Mi día`, `Qué retomar`, `Mi semana` sin Banco, multi-edificio con enlaces, consulta mixta financiera determinista, `disabled_skill_ids` respetado); `GET /api/ai/observability` autenticado Zero-PII (`14` reqs, `0` Gemini, `0` errores, `0` PII); `GP/XP/COP` 100% intactos. |
| **E2E navegador autenticado contra Supabase producción** | No ejecutado por agente | **NO EJECUTADO (MANUAL)** | Recorrido manual en navegador pendiente antes o tras el despliegue (sin usar cuentas personales reales en tests automatizados). |

---

## 4. Observabilidad, Persistencia y Rendimiento
- **Observabilidad (`GET /api/ai/observability`):** protegida con `requireShortcutUser` (`401` si no hay sesión), contadores reales por agente, latencia media/última y tokens reportados por Gemini cuando existan. Garantía **Zero-PII** comprobada en E2E. Contadores en memoria se reinician al reiniciar el contenedor de Railway (sin migraciones nuevas). No inventa precios de tokens.
- **Persistencia:** `building_resources`, `cinema_entries`, `reading_books`, `activity_logs`, `rubik_solves`, `financial_transactions` con RLS activo en Supabase; respaldo local protegido sin sobrescritura con arreglos vacíos.
- **Rendimiento y Experiencia Cozy:** `/cozy` compila limpio (`91.5 kB` / `311 kB` First Load JS), 0 llamadas a Gemini al abrir edificios o animaciones, interruptores de desactivación respetados tanto por especialistas como por Rowan, uso manual 100% funcional sin IA.

---

## 5. Problemas Pendientes y Riesgos
- **Pendiente previo al despliegue:** Validación visual manual en navegador autenticado desde `/cozy` (Ayuntamiento + enlaces a edificios + móvil).
- **Riesgos controlados:** Métricas de observabilidad en memoria (efímeras por contenedor); `FixedCostItem` sin `due_day` reportado honestamente como `null`; series detalladas de Gym en `oakhaven_gym_sets_v1` etiquetadas explícitamente como `local_snapshot`.

---

## 6. Rama, Commits, Despliegue y Rollback
- **Rama actual:** `feat/oakhaven-ai-phase7-rowan-command-center` (base `origin/main` @ `684d822`, sin `push`, `merge` ni despliegue).
- **Commits locales:** `97d8a1a`, `044c471`, `a90bd36` + commit de cierre Release 3.0 (`disabled_skill_ids` en Rowan, pruebas mixtas financieras e informe Release 3.0).
- **Procedimiento de despliegue (cuando autorices):**
  ```powershell
  git checkout main
  git merge --no-ff feat/oakhaven-ai-phase7-rowan-command-center -m "release: OakHaven AI 3.0 (Rowan 2.0 Command Center, P0 privacy & Zero-PII observability)"
  git push origin main
  ```
- **Plan de rollback (sin pérdida de datos ni SQL destructivo):**
  ```powershell
  git checkout main
  git revert -m 1 <merge_commit_sha>
  git push origin main
  ```
  *(o rollback inmediato al deployment `684d822` en Railway).*
