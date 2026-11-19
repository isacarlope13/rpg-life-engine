# OAKHAVEN — RELEASE 3.1: AUDITORÍA DE MIGRACIÓN SQL Y SINCRONIZACIÓN

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase8-data-continuity` (base `main` @ `8220155`, Release 3.0)  
**Archivo SQL auditado:** `supabase/drafts/20261119_phase8_data_continuity_sync.sql`  
**Clasificación:** **`APROBADO PARA REVISIÓN HUMANA DE MIGRACIÓN`** *(sin ejecutar SQL en producción, sin push, sin merge ni despliegue)*

---

## 1. Sentencias SQL Auditadas (`supabase/drafts/20261119_phase8_data_continuity_sync.sql`)
- `CREATE OR REPLACE FUNCTION public.fn_phase8_set_updated_at()` + triggers `BEFORE UPDATE` en `gym_workout_sets`, `work_projects`, `work_project_tasks` y `rubik_cubes`.
- `CREATE TABLE IF NOT EXISTS public.gym_workout_sets`: `id uuid PK`, `user_id uuid NOT NULL REFERENCES auth.users(id)`, `client_id text NOT NULL`, `UNIQUE (user_id, client_id)`, `CHECK` en `exercise_name`, `set_number`, `reps`, `weight_kg`, `rpe`, `version >= 1`, índice parcial `WHERE deleted_at IS NULL`, RLS (`SELECT/INSERT/UPDATE/DELETE` con `auth.uid() = user_id`), `REVOKE ALL FROM anon`, `GRANT ... TO authenticated`.
- `CREATE TABLE IF NOT EXISTS public.work_projects` y `public.work_project_tasks`: `FK project_id -> work_projects(id) ON DELETE CASCADE`, `UNIQUE (user_id, client_id)`, `CHECK` en `methodology`, `status`, `work_scope`, `priority`, RLS por usuario, `REVOKE ALL FROM anon`, `GRANT ... TO authenticated`.
- `ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS`: `tension_notes`, `lube_notes`, `maintenance_needs`, `custom_notes`, `algorithms_to_master`, `sync_version >= 1`, `updated_at` — verificado contra el esquema real de `20261109_v3_5_complete_engine_sync.sql` (`id`, `user_id`, `cube_id`, `brand`, `model`, `cube_type`, `is_magnetic`, `is_favorite`, `specs_metadata`).
- **Exclusión financiera:** Cero sentencias sobre `financial_transactions`, `player_treasury`, `fixed_costs`, `debt_bosses` ni `rubik_solves`.

---

## 2. Problemas Detectados y Corregidos en Esta Auditoría

1. **Incompatibilidad de columnas en `getRegisteredCubes()` (`src/lib/ai/bruno-milo-tools.ts`) — CORREGIDO:**
   - *Hallazgo:* Consultaba `model_name`, `status`, `custom_notes`, `maintenance_needs` sobre `public.rubik_cubes`, pero la tabla real de producción (`20261109_v3_5_complete_engine_sync.sql`) usa `model` e `is_favorite`.
   - *Corrección:* `getRegisteredCubes()` ahora consulta `id, cube_id, cube_type, brand, model, is_favorite` y `20261119_phase8_data_continuity_sync.sql` añade `custom_notes` y `maintenance_needs` de forma aditiva.
2. **Sobrescritura optimista sin verificación de versión en `POST /api/sync` (`src/app/api/sync/route.ts`) — CORREGIDO:**
   - *Hallazgo:* El `upsert` en modo Supabase no verificaba `incoming.version < remote.version` antes de escribir, y `rubik_cubes` no tenía rama de escritura por lista blanca.
   - *Corrección:* `POST /api/sync` ahora consulta las versiones existentes filtrando estrictamente por `.eq("user_id", userId)` (protegiendo incluso sesiones con cliente `service_role`), devuelve `CONFLICTO_REQUIERE_REVISION` con `conflicts[]` si `incomingVersion < remoteVersion` (sin sobrescribir en silencio), e implementa actualización por lista blanca en `rubik_cubes` sin tocar `rubik_solves`.
3. **Permisos explícitos `REVOKE/GRANT` y triggers `updated_at` en el SQL — CORREGIDO:**
   - Añadidos `REVOKE ALL ON TABLE ... FROM anon`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` y triggers `trg_*_updated_at`.

---

## 3. Evidencia de Aislamiento y Prueba en PostgreSQL Real (PGlite)

Ejecutado en PostgreSQL real aislado (`tests/phase8-migration-sql.test.ts` sobre `@electric-sql/pglite`):
- **Idempotencia:** `20261119_phase8_data_continuity_sync.sql` ejecutado **2 veces consecutivas** sin errores.
- **Compatibilidad de esquema:** ejecutado sobre las definiciones reales de `public.rubik_cubes`, `public.rubik_solves` y `public.financial_transactions`.
- **Aislamiento RLS (`USER_A` vs `USER_B` vs `anon`):**
  - `anon` rechazado con permiso denegado (`REVOKE ALL`).
  - `USER_A` inserta y lee `gym_workout_sets`, `work_projects`, `work_project_tasks` y actualiza `rubik_cubes`.
  - `USER_B` ve **0 filas** de `USER_A` y es bloqueado por RLS al intentar insertar con `user_id = USER_A`.
  - `UNIQUE (user_id, client_id)` rechaza duplicados exactos.
- **Integridad financiera y WCA:** `public.financial_transactions` y `public.rubik_solves` permanecen 100% intactas.
- **Auditoría de `requireShortcutUser` (`src/lib/request-auth.ts`) + `/api/sync`:** `userId` siempre proviene de la sesión/token verificado en servidor; todas las consultas `GET` y `POST` filtran por `.eq("user_id", userId)` incluso si el cliente subyacente opera con `service_role`.

---

## 4. Pruebas Ejecutadas vs Pendientes

| Nivel | Comando / Entorno | Resultado |
|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** (`0` errores) |
| **Pruebas unitarias, integración y SQL PGlite** | `npm test` | **328 / 328 pruebas aprobadas** (`16` suites, incluye `tests/phase8-migration-sql.test.ts`) |
| **Build de producción Next.js** | `npm run build` | **APROBADO (exit code `0`)** (`35/35` rutas + `.next/standalone`) |
| **E2E multidispositivo (2 navegadores reales contra Supabase producción)** | Pendiente de ejecución manual del SQL | **PENDIENTE (NO SIMULADO)** — ejecutar tras aplicar el SQL en Supabase con cuenta de prueba. |

---

## 5. Respaldo, Checklist de Aplicación SQL, Despliegue y Rollback

### Checklist para aplicar SQL (manual en Supabase)
1. **Respaldo previo:** Descargar backup / snapshot de Supabase y exportar copia JSON local desde las bibliotecas.
2. **Inspección previa:** Confirmar en SQL Editor `SELECT column_name FROM information_schema.columns WHERE table_name = 'rubik_cubes';`.
3. **Ejecución:** Ejecutar `supabase/drafts/20261119_phase8_data_continuity_sync.sql` en el SQL Editor de Supabase.
4. **Verificación solo lectura:** Confirmar existencia de `gym_workout_sets`, `work_projects`, `work_project_tasks`, RLS habilitado y 0 filas visibles para `anon`.

### Checklist para desplegar código (solo tras confirmar SQL y autorización)
```powershell
git checkout main
git merge --no-ff feat/oakhaven-phase8-data-continuity -m "release: OakHaven 3.1 (Data Continuity & Multi-Device Sync)"
git push origin main
```

### Rollback diferenciado
- **Rollback de código (inmediato, sin pérdida de datos):** `git revert -m 1 <merge_commit_sha> && git push origin main` (o rollback a `8220155` en Railway).
- **Rollback de base de datos:** NO ejecutar `DROP TABLE` ni `DROP COLUMN` si ya existen datos sincronizados; la migración es 100% aditiva y compatible hacia atrás con Release 3.0.

---

## 6. Riesgos Residuales
- El E2E visual en 2 navegadores reales contra Supabase producción solo puede completarse después de aplicar el SQL.
- `work_tasks` en `POST /api/sync` mantiene estado seguro `PENDIENTE_DE_SINCRONIZAR` hasta activar su UI dedicada de tareas estructuradas en Oficina.
