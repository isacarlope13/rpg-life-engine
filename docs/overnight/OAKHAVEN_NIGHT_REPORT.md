# OAKHAVEN — INFORME DE DESARROLLO NOCTURNO

**Fecha:** 2026-11-19  
**Rama de trabajo aislada:** `feat/oakhaven-night-dev-20261119` (sin merge a `main`, sin push, sin despliegue)

---

## A. RESUMEN EJECUTIVO

- **Qué cambió:**
  1. **Consistencia del Pueblo (Hito A):** Se unificaron los alias entre registros (`dojo`/`gym` → `gimnasio`, `banco` → `banco_oakhaven`, `trabajo` → `oficina`, `estudio` → `biblioteca`, `cubos` → `club_puzzles`, `lectura` → `libreria`, `crochet` → `atelier`), se separó explícitamente el alcance semántico de **Banco** (`domainScope: "finance"`) frente a **Trabajo** (`domainScope: "work"`) sin romper tipos ni datos históricos, y se ajustó la configuración inicial por defecto para mostrar activos los dominios núcleo mientras los edificios fuera de alcance quedan en estado `paused` (preservados sin borrar código ni datos).
  2. **Atelier / Crochet jugable sin fricción (Hito B):** El contador táctil grande (`-1`, `+1 Vuelta`, `+5`, `Deshacer`) ahora funciona **sin exigir iniciar cronómetro**, guarda un borrador local por usuario para evitar pérdida al salir/recargar, y ofrece un botón directo **`Guardar +N vueltas sin cronómetro`** con `idempotency_key` única para evitar recompensas duplicadas. El cronómetro sigue disponible en 1 clic como herramienta opcional.
  3. **Interiores compartidos unificados (Hito C):** Se migraron **Estudio (`biblioteca-building.tsx`)** y **Cubos (`club-puzzles-building.tsx`)** desde `BuildingInteriorShell` al motor unificado `LivingInteriorRoom`, conservando todas sus herramientas y datos. Además se añadió `disableHotkeys` a `LivingInteriorRoom` y soporte seguro de barra espaciadora en Cubos para que los atajos `1-5`/`Esc` nunca choquen con el cronómetro WCA.
- **Qué puedes hacer ahora que antes no podías:**
  - Entrar a cualquiera de los **7 edificios implementados** del núcleo personal con la misma experiencia de interior vivo, barra de sesión activa, atajos de teclado y navegación uniforme.
  - Usar el contador de vueltas de Crochet en el celular con una mano sin encender el cronómetro y guardar el avance sin duplicar GP/XP.
  - Usar la barra espaciadora en el cronómetro WCA de Cubos sin activar accidentalmente atajos del edificio.
- **Qué falta:**
  - **CINE (`BLD-007`)**: Sigue registrado como `implemented: false` en `PERSONAL_VILLAGE_CORE_BUILDINGS` (no se simuló un backend falso). Requiere definir tabla/almacenamiento cuando lo apruebes.
  - Pruebas visuales interactivas en navegador real (móvil/escritorio) y revisión humana antes de hacer merge a `main` y desplegar.
- **Estado para despliegue:** **LISTO PARA REVISIÓN PREVIA A DESPLIEGUE** (todos los tests unitarios y TypeScript pasaron en verde en esta rama aislada).

---

## B. CAMBIOS REALIZADOS POR HITO

### Hito A — Consistencia del Pueblo (Commit `1722a50`)
- **Objetivo:** Alinear los 8 edificios definitivos entre registros y preferencias, separar Banco vs Trabajo y ocultar fuera de alcance sin borrar datos.
- **Resultado:** Completado y verificado.
- **Archivos modificados:**
  - `src/lib/sanctuary/village-buildings-registry.ts`
  - `src/lib/sanctuary/buildings-registry.ts`
  - `src/lib/sanctuary/world-preferences-engine.ts`
- **Funciones nuevas / mejoradas:** `PERSONAL_VILLAGE_CORE_BUILDINGS`, `resolveCanonicalBuildingId`, `isPersonalCoreBuilding`, `domainScope: "finance"` en `banco_oakhaven`, alias retrocompatibles en ambos registros y valores por defecto enfocados en el núcleo personal.
- **Riesgos:** Bajo; retrocompatibilidad total conservada (`tests/village-world-40.test.ts` 8/8 en verde).

### Hito B — Crochet como Primer Recorrido Jugable (Commit `4c3a4bc`)
- **Objetivo:** Permitir contar y guardar vueltas sin obligar a iniciar cronómetro, manteniendo el cronómetro opcional y evitando duplicación de recompensas.
- **Resultado:** Completado y verificado.
- **Archivos modificados:**
  - `src/components/sanctuary/atelier-building.tsx`
- **Funciones nuevas / mejoradas:** Borrador local por usuario (`oakhaven_atelier_row_draft_v1_*`), `handleSaveQuickRowsWithoutTimer` con `idempotency_key` única y limpieza de delta tras guardar.
- **Nota de preferencia previa:** En tu instrucción nocturna solicitaste explícitamente contador sin cronómetro obligatorio; si luego prefieres volver a exigir cronómetro, puede hacerse configurable con un toggle.

### Hito C — Experiencia de Interiores Compartidos (Commit `fa56ef8`)
- **Objetivo:** Migrar Estudio y Cubos a `LivingInteriorRoom` sin perder herramientas y evitar conflictos de teclado con el cronómetro WCA.
- **Resultado:** Completado y verificado.
- **Archivos modificados:**
  - `src/components/sanctuary/living-interior-room.tsx` (`disableHotkeys?: boolean`)
  - `src/components/sanctuary/biblioteca-building.tsx` (Estudio migrado a `LivingInteriorRoom`)
  - `src/components/sanctuary/club-puzzles-building.tsx` (Cubos migrado a `LivingInteriorRoom` + barra espaciadora WCA segura + `disableHotkeys={practiceTimerRunning}`)
  - `tests/night-dev-milestones.test.ts` y `package.json`

### Hitos D y E
- **Hito D:** Integrado parcialmente mediante `disableHotkeys` en `LivingInteriorRoom`, accesibilidad móvil de botones ≥ 56 px y recuperación de borrador local.
- **Hito E:** No se tocó `CINE` para respetar la regla de no simular backend ni crear tablas sin aprobación.

---

## C. ESTADO DE CALIDAD

| Verificación | Estado | Evidencia real |
|---|---|---|
| **Typecheck (`npx tsc --noEmit`)** | **PASÓ** | Exit code `0`, 0 errores de TypeScript. |
| **Lint (`npm run lint`)** | **NO EJECUTADO** | `next lint` abrió asistente interactivo porque el repo no tiene `.eslintrc` configurado. |
| **Tests (`npm test`)** | **PASÓ** | **287 / 287 pruebas aprobadas**, 0 fallos, 0 omitidas (5 suites). |
| **Build (`npm run build`)** | **NO EJECUTADO (en esta rama)** | Verificado previamente en `main` (`Compiled successfully`, 29/29 páginas); no repetido para ahorrar cuota y evitar `EPERM` local de Windows en `.next/standalone`. |
| **Pruebas funcionales (unitarias de flujos)** | **PASÓ** | Cubiertas por `oakhaven-45-user-journeys.test.ts`, `atelier-hybrid-crochet.test.ts` y `night-dev-milestones.test.ts`. |
| **Pruebas visuales (navegador en vivo)** | **NO EJECUTADO** | No se levantó navegador interactivo en el turno nocturno; requiere inspección visual humana. |
| **Seguridad y separación COP/GP/XP** | **PASÓ** | Ningún secreto introducido; RLS, auth y reglas financieras intactas (`financial-intelligence-39.test.ts` y `stabilization-sprint.test.ts` en verde). |

---

## D. ESTADO DE GIT

- **Rama actual:** `feat/oakhaven-night-dev-20261119` (creada desde `main` en `a337119`).
- **Commits locales en esta rama:**
  1. `1722a50` — `feat(village): Hito A - unify 8 core building aliases, finance domainScope, and default paused out-of-scope skills`
  2. `4c3a4bc` — `feat(atelier): Hito B - support timer-optional row counting, local draft recovery, and idempotent quick-save`
  3. `fa56ef8` — `feat(interiors): Hito C - migrate Estudio and Cubos to LivingInteriorRoom with WCA hotkey guard and tests`
  4. *(Commit final de documentación con este informe y `CODEX_HANDOFF.md`)*
- **Estado de integración:** Sin merge a `main`, sin `push`, sin despliegue.

---

## E. ESTADO DE CUOTA

- **Cuota de 5 horas / Cuota semanal:** **NO VERIFICABLE** (el entorno de herramientas no expone medidores oficiales de cuota).

---

## F. ESTADO DE DESPLIEGUE

**LISTO PARA REVISIÓN PREVIA A DESPLIEGUE.**

---

## G. INSTRUCCIONES PARA TI (REVISIÓN Y DESPLIEGUE MANUAL)

1. **Iniciar la aplicación en local:**
   ```powershell
   cd C:\Users\isaca_6khxtdy\.gemini\antigravity\scratch\rpg-life-engine
   npm run dev
   ```
2. **Pantallas y recorridos para probar:**
   - Abre `http://localhost:3000/play` (y `/cozy` o `/dashboard` si los usas).
   - **Pueblo:** Verifica que aparecen los edificios núcleo (Banco, Estudio, Trabajo, Gym, Cubos, Lectura, Crochet) y que los demás están en reposo sin perder historial.
   - **Crochet (Atelier):** Entra → suma vueltas con `+1 Vuelta` / `+5` / `-1` / `Deshacer` **sin encender el cronómetro** → recarga la página para comprobar que el borrador sigue ahí → pulsa **`Guardar +N vueltas sin cronómetro`** → verifica que el contador vuelve a `0`.
   - **Estudio (`biblioteca`) y Cubos (`club_puzzles`):** Entra a ambos y verifica la nueva cabecera unificada de `LivingInteriorRoom`, atajos `1-5`/`Esc`, y en Cubos prueba iniciar/detener el cronómetro con la **barra espaciadora** (confirmando que `Esc` y `1-5` no interrumpen el solve mientras corre).
3. **Si todo te gusta y quieres desplegar:**
   ```powershell
   git checkout main
   git merge feat/oakhaven-night-dev-20261119
   git push origin main
   ```
4. **Si quieres volver a la versión anterior (sin estos cambios):**
   ```powershell
   git checkout main
   ```
   *(Tu rama `main` no fue tocada en ningún momento).*
