# OAKHAVEN AI — RELEASE 2.6 (FASE 6: NORA Y SILAS)
## Validación Final, Auditoría de Privacidad Financiera y Preparación de Despliegue

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase6-nora-silas` (base `main` @ `5334800`, con Release 2.5 publicado)  
**Estado:** **`LISTO PARA REVISIÓN MANUAL`** *(TypeScript `0` errores, `319/319` pruebas aprobadas con prueba instrumentada de `0` llamadas a Gemini para Silas, `npm run build` exit code `0`, E2E HTTP autenticado local `5/5` bloques aprobados; falta únicamente la prueba manual en navegador con cuenta real contra Supabase antes de autorizar merge/push a `main`)*

---

## 1. Funciones Reales de Nora (Cine / `cine`)
- Consulta colección personal desde `public.cinema_entries` (Supabase con RLS) o respaldo `local_snapshot` sin sobrescribir registros locales con arreglos vacíos.
- Diferencia película (`movie`), serie (`series` con `season` y `episode`) y musical (`musical` con `favoriteSongOrScene`).
- Separa estado `favorite` de evento `watchedAt` (las favoritas conservan su fecha de visionado) y jamás trata la `watchlist` como contenido visto.
- Recomienda etiquetando explícitamente **`Basada en tu watchlist`**, **`Basada en tu historial`** o **`Sugerencia general`** (sin afirmar disponibilidad en plataformas de streaming).
- Propone reseñas Nivel 2 idempotentes (`add_cinema_review`, `requiresConfirmation: true`) persistidas en `building_resources`, con bloqueo de duplicados `409 Conflict`, y entradas de cine (`add_cinema_entry`) anti-duplicados.

## 2. Funciones Reales de Silas (Guardián Financiero Privado / `banco_oakhaven`)
- **Solo lectura estricta:** analiza ingresos, gastos, flujo neto y desglose por categoría en enteros exactos en `COP`, sin mover dinero ni proponer mutaciones financieras.
- Separa `COP` de `USD`/otras divisas sin conversiones inventadas; detecta posibles gastos duplicados sin eliminarlos; advierte frescura de datos (`isStale > 14 días`).
- Consulta obligaciones registradas (`fixed_costs` y `debt_bosses`) con `dueDay: null` cuando el modelo no guarda fecha de vencimiento (sin inventar fechas ni asumir pagos).
- Ejecuta simulaciones presupuestarias y de abono a deuda sobre copias puras (`persisted: false`), etiquetadas **`ESCENARIO HIPOTÉTICO — SIN ESCRITURA`**, y explica `GP` vs `COP` sin conversión automática.

## 3. Resultado de Seguridad Financiera (Auditoria Crítica Hito 3)
- **Aislamiento de Gemini comprobado mediante prueba instrumentada:** En `tests/oakhaven-ai-phase6-nora-silas.test.ts`, mediante el gancho `onGeminiAttemptForTests` en `askBuildingSpecialist()`, se verificó que aun con `allowGemini: true`, llamar a Silas (`banco_oakhaven`) ejecuta **`geminiAttemptsForSilas === 0`** y devuelve `mode: "deterministic_grounded"`.
- **Bloqueo de documentos bancarios:** El selector documental de `BuildingSpecialistPanel` excluye `banco_oakhaven`; `resource-query-tools.ts` bloquea lectura automática de recursos `is_sensitive_financial: true` ante otros especialistas (Nora, Clara, Lyra, etc.) y ante otros usuarios (`USER_B`).
- **Enmascaramiento:** `maskFinancialIdentifiers()` reemplaza secuencias de 6–19 dígitos por `[CUENTA_OCULTA]`.
- **Bloqueo Nivel 3:** Cualquier intento de pago, transferencia o modificación de saldo/obligaciones devuelve `mode: "blocked_safety"`.
- **Límites transparentes en producción:** La prueba instrumentada garantiza el camino de código actual de `specialist-engine.ts`; en producción la seguridad depende además de mantener RLS activo en Supabase, variables de entorno protegidas en Railway y no habilitar `OAKHAVEN_AI_ENABLED` sobre endpoints no auditados.

## 4. Evidencia de Exclusión de Datos Demostrativos
- `isDemoFinancialMovement()` filtra el conjunto completo de `INITIAL_FINANCIAL_MOVEMENTS` (`mts5z6dfjzde`, etc.) y prefijos `demo-*`/`seed-*`/`case-study-*`.
- `isDemoBankAccount()` filtra `CASE_STUDY_ACCOUNTS` (`acc_nu_39`, `acc_nequi_39`).
- Verificado tanto en Silas (`getVerifiedFinancialMovements`) como en Presidente Rowan (`getRecentExpenses`).

## 5. Estado de Persistencia
- `cinema_entries` y `building_resources` activos con RLS en Supabase (verificados en vivo en Release 2.3/2.4).
- En `local_engine`, `local-resources-memory.ts` preserva aislamiento por `userId` y bloqueo de duplicados `409`.
- Desactivación individual (`disabled_skill_ids`) comprobada en E2E para Nora y Silas (`mode: "disabled"`).

## 6. Integración con Presidente Rowan y Regresión de los 8 Especialistas
- Rowan consulta `getLastWatchedMedia` (película vista, serie en curso, musical pendiente) y `getRecentExpenses` (excluyendo `INITIAL_FINANCIAL_MOVEMENTS`, sin acceso a extractos bancarios).
- Regresión ejecutada y aprobada en E2E HTTP y suite automatizada para **Clara, Lyra, Aura, Eldrin, Bruno y Milo** sin escalación de permisos.

## 7. Resultados de Pruebas (Separados por Nivel)

| Nivel de Prueba | Comando / Entorno | Resultado | Evidencia |
|---|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** | Exit code `0`, `0` errores. |
| **Pruebas unitarias e integración** | `npm test` | **APROBADO** | **319 / 319 pruebas aprobadas**, `0` fallos, `13` suites (incluye prueba instrumentada `geminiAttemptsForSilas === 0`). |
| **E2E HTTP autenticado (entorno local)** | `next dev` + `POST /api/auth/demo` (`e2e-release-2-6.mjs`, `local_engine`) | **APROBADO (5/5 bloques)** | Nora (watchlist, T1 E14, favorita, reseña Nivel 2 confirmada + bloqueo duplicado `409` + persistencia tras recarga), Silas (`deterministic_grounded`, demo excluida, simulación sin escritura, Nivel 3 bloqueado), desactivación individual de Nora y Silas, Rowan + regresión de los otros 6 especialistas, GP/XP/COP intactos. |
| **E2E en navegador autenticado contra Supabase producción** | No ejecutado por agente (política de no crear cuentas ni tocar datos financieros personales reales) | **NO EJECUTADO (MANUAL)** | Requerido como verificación manual en navegador con cuenta real o de prueba tras desplegar o en preview. |

## 8. Resultado del Build
- `npm run build`: **APROBADO (exit code `0`)** — compilación, lint/tipos, `33/33` páginas estáticas y empaquetado `.next/standalone` completados.

## 9. Estado E2E
- **E2E HTTP local (`local_engine`):** **5/5 bloques aprobados**.
- **E2E navegador autenticado en Supabase producción:** **Pendiente manual** (no simulado ni declarado aprobado).

## 10. Riesgos Pendientes
- `FixedCostItem` aún no registra `due_day` (reportado honestamente como `null` por Silas).
- Verificación visual en móvil y contra Supabase real pendiente del usuario en navegador.

## 11. Commits Locales (`feat/oakhaven-ai-phase6-nora-silas`)
- `0c548c2` — `feat(ai-phase6): activate Nora (Cinema) and Silas (Private Read-Only Financial Guardian)`
- `cc7c9ea` — `test(ai-phase6): add Nora, Silas financial privacy, and Rowan Phase 6 acceptance tests`
- `1347481` — `docs(ai-phase6): add Nora, Silas, financial security, test report, and handoff docs`
- *(más el commit de instrumentación Gemini + informe Release 2.6)*

## 12. Plan de Despliegue (Requiere Autorización Explícita)
```powershell
git checkout main
git merge --no-ff feat/oakhaven-ai-phase6-nora-silas -m "release: OakHaven AI Phase 6 (Nora Cinema + Silas Financial Guardian)"
git push origin main
```

## 13. Plan de Rollback
- Sin migraciones SQL nuevas en Fase 6; reversión limpia sin pérdida de datos:
  ```powershell
  git checkout main
  git revert -m 1 <merge_commit_sha>
  git push origin main
  ```
- Alternativa inmediata en Railway: Rollback al deployment `5334800`.

## 14. Preparación para Fase 7
Con los **8 especialistas activos** y Presidente Rowan integrados, la Fase 7 podrá enfocarse en observabilidad/telemetría de costos y latencia sin datos sensibles, panel de control de los 8 especialistas y auditoría integral de extremo a extremo de todo OakHaven AI.
