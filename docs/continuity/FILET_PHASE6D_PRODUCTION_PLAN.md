# Plan Definitivo de Producción (Fase 6D.3) — Filet Crochet Studio v1.0

> **Estado:** PREPARACIÓN DEFINITIVA COMPLETADA (FASE 6D.2 APROBADA).
> **SIN EJECUCIÓN EN PRODUCCIÓN:** Requiere autorización humana explícita e independiente antes de ejecutar el respaldo productivo, aplicar las 4 migraciones SQL en Supabase de producción, cambiar PR #3 de Draft a Ready, fusionar a `main` o desplegar en Railway.

---

## 1. Evidencia previa en Supabase Cloud aislado (Fases 6D.1 y 6D.2)
- Proyecto QA aislado: **`oakhaven-filet-qa-tmp`** (`ref: tklsdqfuzbyyaxqezlab`, `us-east-1`, **`PostgreSQL 17.12.0.000`**, costo **`$0.00 USD`**, 100 % datos sintéticos).
- Validados en infraestructura real: **GoTrue**, **PostgREST**, **Storage privado**, **RLS**, **triggers**, **permisos efectivos de RPCs**, **compatibilidad con `sb_secret`**, **Baby Lucio (80 cuadros) en 2 contextos independientes de Chrome**, **concurrencia simultánea con dos `operationId`**, **comportamiento `503` recuperable ante RPC ausente** y **endurecimiento de `fn_process_activity_reward()` / `activity_logs`** (0 advertencias SQL en `get_advisors(security)`).

---

## 2. Inventario definitivo de migraciones, dependencias y orden exacto

Las 4 migraciones definitivas han sido promovidas a `supabase/migrations/` con marcas cronológicas estrictamente alineadas con su orden de dependencias (resolviendo la colisión alfabética previa donde el borrador `20261112_atomic_skill_session.sql` ordenaba antes que `20261124_*`):

### 2.1 Verificación previa del esquema productivo (solo lectura)
Confirmar antes de aplicar la Migración #1 que el proyecto productivo dispone de:
- `public.knitting_projects`, `public.player_treasury`, `public.activity_logs` (con `treasury_id`, `idempotency_key` y `trg_before_insert_activity_log` → `fn_process_activity_reward()`), `public.reading_books`, `public.rubik_solves` (`supabase/schema.sql`).
- `public.profiles` con columna JSONB `collections_state` y `updated_at` (`onboarding_migration.sql` + `20261107_collections_and_trial.sql`).
- `public.building_resources` y bucket privado `oakhaven-private-resources` (`20261119_oakhaven_ai_phase1_sync.sql` + `20261119_phase2_private_storage_and_resources.sql`).

### 2.2 Orden exacto de aplicación en producción (Fase 6D.3)

| Orden | Archivo oficial en `supabase/migrations/` | Objetos creados / modificados | Dependencias previas |
| :---: | :--- | :--- | :--- |
| **1** | `2026112501_filet_guided_progress_atomic.sql` | Columnas nulas `linked_pattern_id`, `linked_pattern_version_id`, `linked_pattern_snapshot` en `public.knitting_projects`; tablas `filet_guided_progress`, `filet_guided_operation_receipts`; trigger `enforce_filet_project_counter`; RPCs `confirm_filet_row_atomic_v1` y `undo_filet_row_atomic_v1`. | `auth.users`, `public.knitting_projects`. |
| **2** | `2026112502_filet_workspace_sync.sql` | Tablas `filet_workspace_sync`, `filet_workspace_sync_receipts`; RLS `filet_workspace_read_owner`; RPC `save_filet_workspace_v1(uuid, uuid, bigint, jsonb)`. | `auth.users`. |
| **3** | `2026112503_atomic_skill_session.sql` | Tablas `skill_session_operation_receipts`, `filet_session_operation_aliases` (FK diferida); RPC `record_skill_session_atomic_v1` (`SECURITY INVOKER` + `auth.role() = 'service_role'`, identidad canónica `ses_univ_<owner>_<sessionId>`). | **Depende de #1** (`knitting_projects.linked_pattern_version_id`) + `profiles`, `player_treasury`, `activity_logs`, `fn_process_activity_reward()`. |
| **4** | `2026112504_reward_trigger_hardening.sql` | Fija `search_path = pg_catalog, public` en `fn_process_activity_reward()`; revoca `EXECUTE` de `PUBLIC`/`anon`/`authenticated` sobre el trigger; revoca `UPDATE`/`DELETE` de `PUBLIC`/`anon`/`authenticated` e `INSERT` de `anon` sobre `public.activity_logs`. | `public.fn_process_activity_reward()`, `public.activity_logs` y #3. |

---

## 3. Verificación post-migración (solo lectura)
```sql
-- 1. RLS activo en las 6 tablas nuevas
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN (
     'filet_guided_progress', 'filet_guided_operation_receipts',
     'filet_workspace_sync', 'filet_workspace_sync_receipts',
     'skill_session_operation_receipts', 'filet_session_operation_aliases'
   )
 ORDER BY tablename;

-- 2. Privilegios efectivos de RPCs, trigger y activity_logs
SELECT
  has_function_privilege('anon', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS anon_confirm,
  has_function_privilege('authenticated', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS auth_confirm,
  has_function_privilege('service_role', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS svc_confirm,
  has_function_privilege('authenticated', 'public.save_filet_workspace_v1(uuid,uuid,bigint,jsonb)', 'EXECUTE') AS auth_ws,
  has_function_privilege('service_role', 'public.save_filet_workspace_v1(uuid,uuid,bigint,jsonb)', 'EXECUTE') AS svc_ws,
  has_function_privilege('authenticated', 'public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)', 'EXECUTE') AS auth_sess,
  has_function_privilege('service_role', 'public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)', 'EXECUTE') AS svc_sess,
  has_function_privilege('authenticated', 'public.fn_process_activity_reward()', 'EXECUTE') AS auth_trigger_exec,
  has_table_privilege('authenticated', 'public.activity_logs', 'UPDATE') AS auth_act_upd,
  has_table_privilege('authenticated', 'public.activity_logs', 'DELETE') AS auth_act_del,
  has_table_privilege('anon', 'public.activity_logs', 'INSERT') AS anon_act_ins;
```
Resultado esperado: `rowsecurity = true` en las 6 tablas; `false` para `anon_*`, `auth_*`, `auth_trigger_exec`, `auth_act_upd`, `auth_act_del`, `anon_act_ins`; `true` para todos los `svc_*`.

---

## 4. Seguridad del sistema de recompensas (`fn_process_activity_reward` y `activity_logs`)
- **Riesgos confirmados en Fase 6D.2 (probados en vivo sobre QA):**
  1. `fn_process_activity_reward()` tenía `search_path` mutable y `EXECUTE` heredado para `anon`/`authenticated`. **Resuelto en Migración #4.**
  2. Un usuario autenticado podía ejecutar `UPDATE`/`DELETE` directos sobre sus propias filas confirmadas en `public.activity_logs`. **Resuelto en Migración #4 (`42501` verificado en vivo).**
  3. Un usuario autenticado podía insertar filas directas en `public.activity_logs` vía PostgREST porque los endpoints legacy (`src/app/api/shortcuts/habit-log/route.ts:88` y `src/app/api/shortcuts/skill-session/route.ts:1160` en `main`) aún usan `userClient` (`authenticated`).
- **Decisión arquitectónica segura (sin romper Release 3.3 ni otros módulos):**
  - En Fase 6D.2 **NO** se revoca `INSERT` autenticado en `activity_logs` para preservar compatibilidad 100 % con `main` (Release 3.3), `habit-log` y sesiones tradicionales.
  - En producción el riesgo está mitigado por el modo propietario único fail-closed (`OAKHAVEN_OWNER_USER_ID` + registro público cerrado) y porque Filet finaliza exclusivamente vía `record_skill_session_atomic_v1` (`service_role`).
  - **Seguimiento posterior (fuera del alcance de Filet v1.0):** migrar `habit-log` y el camino no Filet de `skill-session` a `supabaseAdmin`/RPC atómica y entonces revocar `INSERT` de `authenticated` en `public.activity_logs`.

---

## 5. Estrategia de respaldo, integridad, recuperación y rollback no destructivo

### 5.1 Disponibilidad real de backups en el plan actual
- La organización Supabase (`pzphldqaogngteugugzf`) opera en **Plan Free (`tier_free`)**, el cual **NO incluye backups diarios automáticos ni PITR (Point-in-Time Recovery)**.
- Por ello, **es obligatorio ejecutar un respaldo lógico manual (`pg_dump`) previo a la Migración #1 en Fase 6D.3** (nunca durante 6D.2 ni sin autorización).

### 5.2 Procedimiento concreto de respaldo (ejecutar solo en Fase 6D.3 autorizada)
1. Generar respaldo cifrado local fuera del repositorio (ej. directorio privado fuera de Git) usando el cliente `pg_dump` de PostgreSQL 17 contra la conexión directa/session pooler del proyecto productivo:
   - Tablas críticas: `public.profiles`, `public.player_treasury`, `public.activity_logs`, `public.knitting_projects`, `public.building_resources`, `public.reading_books`, `public.rubik_solves`, `public.rubik_cubes`, `public.debt_bosses`, `public.financial_transactions`, `public.wishlist_items`, `public.quest_catalog`.
   - Formato custom (`-Fc`) + esquema completo (`--schema=public`).
2. **Verificación de integridad del respaldo:**
   - Calcular y registrar `SHA-256` del archivo `.dump`.
   - Ejecutar `pg_restore --list <archivo.dump>` para confirmar lectura íntegra del catálogo de tablas y datos antes de tocar producción.
3. **Protección de datos personales:**
   - Nunca guardar el `.dump` en el repositorio Git, artefactos de conversación ni carpetas compartidas; cifrar o almacenar en ubicación privada del propietario y eliminar copias temporales tras confirmar estabilidad post-despliegue.

### 5.3 Procedimiento de recuperación y rollback no destructivo
- **Rollback de aplicación (Railway):** usar *Rollback* al despliegue previo `54407ef8-5a14-4c96-9ac9-9036d10d7b8f` (Release 3.3). Como las 4 migraciones son aditivas y retrocompatibles, Release 3.3 vuelve a operar de inmediato y **conserva intactas todas las sesiones, actividades, patrones y recibos creados después del despliegue**.
- **Rollback de base de datos (no destructivo por defecto):**
  1. Contención inmediata sin pérdida de datos: `REVOKE EXECUTE` a `service_role` sobre la RPC afectada → la app entra en `503` recuperable preservando la cola local y todos los datos confirmados.
  2. **Prohibido ejecutar `DROP TABLE` o `DROP COLUMN` como rollback predeterminado.**
  3. Solo en caso extremo de corrupción estructural (no aplicable a migraciones aditivas), restaurar desde el `.dump` verificado en una ventana de mantenimiento tras exportar primero cualquier fila creada post-despliegue (`created_at >= <ventana_deploy>`).

---

## 6. Compatibilidad entre versiones y activación gradual

| Aplicación | Esquema | Resultado verificado |
|---|---|---|
| `main` actual (Release 3.3) | Esquema anterior | Aprobado (línea base verificada). |
| `main` actual (Release 3.3) | Esquema ampliado (4 migraciones) | **Aprobado sin regresiones:** columnas `linked_pattern_*` nulas; trigger ignora proyectos tradicionales; `activity_logs` conserva `SELECT`/`INSERT` autenticado y `fn_process_activity_reward()` dispara con `search_path` fijo. |
| Rama Filet | Esquema ampliado (4 migraciones) | **Aprobado integralmente** (Baby Lucio 80 cuadros, 2 contextos Chrome, concurrencia, exports, Clara, sesión tradicional). |
| Rama Filet | RPC ausente / revocada | **Aprobado fail-closed:** `503` recuperable (`Progreso remoto no disponible` / `FILET_SESSION_PENDING`) con `0` escrituras parciales. |

- **Feature flag:** no se requiere nueva infraestructura de flags.

---

## 7. Orden de integración con PR financiera #2 (`f5de183`)
1. **Primero:** **PR #3 — Filet Crochet Studio** (`MERGEABLE_STATE=clean` sobre `main @ cb06321`, validada E2E en Supabase Cloud real).
2. **Segundo:** **PR #2 — Financial Owner Ledger** (rebase sobre `main` actualizado con unión aditiva controlada en exactamente 4 archivos ortogonales: `package.json`, `src/app/api/shortcuts/skill-session/route.ts`, `src/lib/demo-store.ts`, `src/lib/state-builder.ts`; `0` conflictos SQL y `0` conflictos en workflows CI).

---

## 8. Plan de despliegue Railway (verificado en solo lectura)
- **Servicio productivo:** `rpg-life-engine` (`4e5c7acf-d169-429a-bce3-77c6c5d1e5e0`) en proyecto `independent-fascination`, entorno `production`, dominio `https://rpg-life-engine-production.up.railway.app` (`port: 8080`, `1` réplica, región `iad`).
- **Despliegue automático:** conectado a `isacarlope13/rpg-life-engine` rama **`main`** con **`checkSuites: false`**.
  - **CRÍTICO:** hacer merge de PR #3 a `main` **disparará automáticamente el build y despliegue en Railway sin esperar a GitHub Actions**.
- **Builder y Node:** `RAILPACK` (`buildEnvironment: V3`), respetando `package.json` `"engines": { "node": "22.x" }`.
- **Variables de entorno verificadas por nombre (sin leer valores):** `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `OAKHAVEN_OWNER_USER_ID`, `OAKHAVEN_PUBLIC_SIGNUP_ENABLED`, `SUPABASE_SERVICE_ROLE_KEY`.
  - `NEXT_PUBLIC_APP_URL` no está definida, pero `src/lib/app-url.ts` (`PRODUCTION_DEFAULT_URL`) resuelve exactamente a `https://rpg-life-engine-production.up.railway.app`, compatible con la validación `Origin` de `/api/filet/workspace` y `/api/filet/progress`. (Opcionalmente fijar `NEXT_PUBLIC_APP_URL=https://rpg-life-engine-production.up.railway.app` si se añade dominio propio).
- **Secuencia obligatoria en Fase 6D.3:**
  1. Respaldo lógico (`pg_dump`) + verificación `SHA-256` / `pg_restore --list`.
  2. Aplicar las 4 migraciones SQL (`2026112501` → `2026112504`) en Supabase de producción.
  3. Ejecutar verificación post-migración (Sección 3) y `get_advisors(security)`.
  4. Pasar PR #3 de Draft a Ready, verificar CI en verde y realizar merge a `main` (dispara Railway automáticamente).
  5. Monitorear build `RAILPACK`, arranque en `port 8080` y ejecutar smoke tests.

---

## 9. Smoke tests post-despliegue y criterios de detención / aceptación
- **Smoke tests:**
  1. `GET /api/health` (`200`) y `GET /api/state` (anónimo → `401`; propietaria → `200`).
  2. Sesión tradicional de tejido sin `linked_filet_pattern`: incremento normal de `completed_rows`, XP y GP.
  3. Filet Studio: componer patrón, guardar `v1`, exportar PDF/SVG/PNG/JSON, crear proyecto vinculado, confirmar Vuelta 1 (`completed_rows = 1`), recargar y finalizar sesión verificando `1` actividad sin duplicar `completed_rows`.
- **Criterios de detención (Abort / Rollback):** cualquier `5xx` sostenido en `/api/state`, `/api/shortcuts/skill-session`, `/api/filet/workspace` o `/api/filet/progress`; fallo en verificación RLS/RPC; doble conteo de vueltas/XP/GP o regresión en proyectos tradicionales.
- **Criterios de aceptación:** 4 migraciones aplicadas sin pérdida de datos, `0` advertencias SQL en security advisor, smoke tests en verde y validación física posterior programada en iPhone/Galaxy Tab e impresión `1:1`.
