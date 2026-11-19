# PLAN DE MIGRACIÓN SQL Y DESPLIEGUE SEGURO (FASE 8)

## 1. Archivo SQL Preparado (NO ejecutado en producción)
- **`supabase/drafts/20261119_phase8_data_continuity_sync.sql`**
- **Operaciones incluidas (100% aditivas, con RLS `auth.uid() = user_id` y `UNIQUE (user_id, client_id)`):**
  1. `CREATE TABLE IF NOT EXISTS public.gym_workout_sets` (Piloto P0 Gym).
  2. `CREATE TABLE IF NOT EXISTS public.work_projects` y `public.work_project_tasks` (Trabajo).
  3. `ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS` (`tension_notes`, `lube_notes`, `algorithms_to_master`, `sync_version`, `updated_at`) preservando intacta `public.rubik_solves`.
- **Exclusión financiera:** No toca `financial_transactions`, `player_treasury`, `fixed_costs`, `debt_bosses` ni documentos bancarios.

## 2. Secuencia de Despliegue Compatible Hacia Atrás
1. **Respaldo previo:** Exportar snapshot de tablas actuales desde el panel de Supabase (o copia JSON local desde cada biblioteca).
2. **Aprobación y ejecución manual del SQL:** Revisar y ejecutar `supabase/drafts/20261119_phase8_data_continuity_sync.sql` en el SQL Editor de Supabase.
3. **Verificación solo lectura:** Confirmar existencia de las 3 tablas nuevas, RLS habilitado y 0 filas visibles para cliente anónimo.
4. **Integración y despliegue de código:** Solo tras tu autorización, `git checkout main && git merge --no-ff feat/oakhaven-phase8-data-continuity && git push origin main`.
5. **Preservación de `localStorage`:** Los datos locales NO se borran al migrar; permanecen como respaldo offline.

## 3. Plan de Rollback
- **Código:** `git revert -m 1 <merge_commit_sha> && git push origin main` (compatible con Release 3.0).
- **Base de datos:** Al ser migraciones estrictamente aditivas (`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`), revertir el código NO requiere `DROP TABLE` ni provoca pérdida de datos.
