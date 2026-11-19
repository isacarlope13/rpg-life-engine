# OAKHAVEN AI — RELEASE 2.5 (FASE 5: BRUNO Y MILO)
## Informe de Validación Final y Preparación de Despliegue

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase5-bruno-milo` (base `main` @ `1737fc1`, con Release 2.4 / Fase 4 integrado en `origin/main`)  
**Estado:** **`LISTO PARA REVISIÓN MANUAL`** *(TypeScript `0` errores, `316/316` pruebas aprobadas, `npm run build` exit code `0`, E2E HTTP autenticado local `5/5` checks aprobados; falta únicamente la prueba manual en navegador con tu cuenta real contra Supabase antes de autorizar merge/push a `main`)*

---

## 1. Estado Real de Bruno (Gym) y Milo (Cubos)

### Bruno (`gimnasio` / `sports`)
- **Exclusión de series demostrativas:** Las series iniciales precargadas (`demo-set-*`, `isDemo: true`, `dataOrigin: "demo_template"`) se excluyen en `filterRealGymSets()` y nunca intervienen en volumen, RPE ni récords.
- **Distinción explícita de origen de datos:**
  - *Sincronizados en Supabase:* sesiones en `activity_logs` (`domain = 'sports'`) y planes confirmados en `building_resources`.
  - *Navegador local (`local_snapshot`):* series detalladas de `oakhaven_gym_sets_v1`, etiquetadas explícitamente en las respuestas de Bruno y Rowan como **`navegador local (local_snapshot — no verificadas aún en servidor)`**.
  - *Demostrativos:* excluidos de cálculos y recomendaciones.
  - *No disponibles:* reconocidos explícitamente sin inventar cifras ni penalizar días de descanso.
- **Seguridad deportiva:** `detectMedicalOrInjuryQuery()` impide diagnósticos médicos y deriva a profesionales de salud ante dolor agudo o lesiones.
- **Nivel 2:** Propuestas idempotentes (`plan_gym_routine`, `requiresConfirmation: true`) guardadas únicamente al confirmar vía `POST /api/resources`; las propuestas rechazadas no se guardan.

### Milo (`club_puzzles` / `rubik`)
- **Precisión frente al Reglamento Oficial WCA (Art. 9f):**
  - **PB por puzzle:** mejor tiempo efectivo (excluyendo `DNF`) estrictamente separado por `cube_type` (`2x2` nunca se mezcla con `3x3`, `4x4`, `Pyraminx` ni `Megaminx`).
  - **Penalización `+2`:** suma exactamente `+2.00s` al tiempo base.
  - **Ao5 (formato oficial WCA, Art. 9f):** recorta 1 mejor y 1 peor; 1 `DNF` se descarta como el peor; ≥ 2 `DNF` resultan en `DNF`; menos de 5 solves devuelven `insufficient_solves`.
  - **Ao12 (estadística de entrenamiento, NO formato oficial de competencia WCA):** recorta 1 mejor y 1 peor de 12; etiquetado explícitamente como **`Ao12 (entrenamiento)`** en las respuestas de Milo y documentación.
- **Cronómetro y atajos:** Preservados intactos en `club-puzzles-building.tsx` sin crear cronómetros paralelos.
- **Nivel 2:** Propuestas idempotentes (`plan_cube_practice`) adaptadas al puzzle (Ortega/CLL para `2x2`, F2L/OLL/PLL solo para `3x3`) persistidas únicamente tras confirmación.

---

## 2. Resultados QA (Unitarias, Integración, Build y E2E)

| Nivel de Prueba | Comando / Entorno | Resultado | Evidencia |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores. |
| **Pruebas unitarias e integración** | `npm test` | **APROBADO** | **316 / 316 pruebas aprobadas**, `0` fallos, `12` suites (incluye `oakhaven-ai-phase5-bruno-milo.test.ts` + no regresión de Clara, Lyra, Aura, Eldrin, Nora y Silas). |
| **Build de producción Next.js** | `npm run build` | **APROBADO** | Exit code `0`, `33/33` páginas estáticas y empaquetado `.next/standalone` completo. |
| **E2E HTTP autenticado local** | `next dev` + `POST /api/auth/demo` (`local_engine` aislado, sin tocar Supabase producción) | **APROBADO (5/5 bloques)** | Bruno (demo excluida, volumen 380 kg, `local_snapshot` etiquetado, Nivel 2 confirmada y persistida tras recarga, rechazada no guardada); Milo (Nivel 2 confirmada y persistida tras recarga); Rowan (`local_snapshot` + cubos); regresión OK en los otros 6 especialistas; Nivel 3 bloqueado y `GP/XP/COP` intactos. |
| **E2E en navegador real contra Supabase producción** | No ejecutado por agente (sin cuentas de prueba en producción) | **PENDIENTE (MANUAL)** | Verificar tras autorizar despliegue en Railway con cuenta personal o de prueba. |

---

## 3. Errores / Precisiones Corregidos en Release 2.5
1. **Etiquetado explícito de `local_snapshot` (Bruno y Rowan):** Actualizados `src/lib/ai/specialist-engine.ts` y `src/lib/ai/mayor-rowan-engine.ts` para indicar explícitamente que las series recibidas vía `local_snapshot` provienen del navegador local y no están verificadas aún en servidor.
2. **Distinción reglamentaria WCA entre Ao5 y Ao12 (Milo):** Actualizados `src/lib/ai/bruno-milo-tools.ts`, `src/lib/ai/specialist-engine.ts` y `docs/ai/MILO_CUBES_SKILL.md` para diferenciar **`Ao5 (WCA)`** de **`Ao12 (entrenamiento)`**.

---

## 4. Limitaciones Conocidas
- Las series detalladas de Gym (`oakhaven_gym_sets_v1`) residen actualmente en `localStorage` del dispositivo y no en una tabla relacional propia de Supabase (no se crearon migraciones nuevas sin autorización).
- El E2E autenticado automatizado se ejecutó contra `local_engine` (`/api/auth/demo`); la validación visual en navegador autenticado contra Supabase producción permanece como paso manual previo o posterior al despliegue.

---

## 5. Estado de la Rama y Commits
- **Rama actual:** `feat/oakhaven-ai-phase5-bruno-milo` (sin `push`, sin `merge` a `main`, sin despliegue).
- **Base `origin/main`:** `1737fc1` (Release 2.4 / Fase 4 integrado).
- **Commits en esta rama:** `c549fec`, `5b68c10`, `4d2e58c` + commit de precisión y cierre Release 2.5.

---

## 6. Checklist de Despliegue (Requiere Autorización Explícita)
```powershell
git checkout main
git merge --no-ff feat/oakhaven-ai-phase5-bruno-milo -m "release: OakHaven AI Phase 5 (Bruno Gym + Milo WCA Cubes)"
git push origin main
```

## 7. Plan de Rollback
- **Reversión sin pérdida de datos:** No hubo migraciones SQL en Fase 5.
  ```powershell
  git checkout main
  git revert -m 1 <merge_commit_sha>
  git push origin main
  ```
- Alternativa inmediata: Rollback al deployment `1737fc1` en el panel de Railway.
