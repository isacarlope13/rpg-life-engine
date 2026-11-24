# Procedimiento de Migración, Verificación y Rollback — Filet Crochet Studio (Fase 5)

> **Estado:** BORRADOR VERIFICADO EN PGLITE — **NO APLICADO EN SUPABASE REAL.**
> Archivo SQL: `supabase/drafts/20261124_filet_guided_progress_atomic.sql`

## 1. Pre-requisitos antes de aplicar en producción
1. Confirmar backup lógico reciente en Supabase (`pg_dump` o snapshot del proyecto).
2. Confirmar que el código de producción ya incluye el soporte opcional para `linked_filet_pattern` (`src/lib/state-builder.ts` y `/api/shortcuts/skill-session`).
3. Ejecutar previamente en un entorno staging o rama de base de datos aislada.

## 2. Procedimiento de Migración
1. Copiar `supabase/drafts/20261124_filet_guided_progress_atomic.sql` a `supabase/migrations/` tras aprobación humana explícita.
2. Aplicar en una sola transacción:
   - Añade columnas `NULL`-permitidas (`linked_pattern_id`, `linked_pattern_version_id`, `linked_pattern_snapshot`) a `public.knitting_projects` (operación no destructiva, 100 % retrocompatible con proyectos antiguos).
   - Crea `public.filet_guided_progress` y `public.filet_guided_operation_receipts` con RLS habilitado.
   - Crea `confirm_filet_row_atomic_v1` y `undo_filet_row_atomic_v1` con `SECURITY DEFINER`, `SET search_path = public`, bloqueo `FOR UPDATE` y `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`.

## 3. Verificación Post-Migración
1. Confirmar RLS activo:
   ```sql
   SELECT tablename, rowsecurity
     FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('filet_guided_progress', 'filet_guided_operation_receipts');
   ```
2. Confirmar privilegios de RPC (debe devolver `false` para `anon` y `authenticated`, `true` para `service_role`):
   ```sql
   SELECT has_function_privilege('authenticated', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE');
   SELECT has_function_privilege('service_role', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE');
   ```
3. Verificar que los proyectos existentes sin patrón conservan sus `completed_rows` y `status` sin cambios.

## 4. Procedimiento de Rollback Seguro
Si se detecta cualquier anomalía tras la migración, el rollback no afecta proyectos antiguos ni datos previos de `knitting_projects`:
```sql
BEGIN;
DROP FUNCTION IF EXISTS public.confirm_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, INT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.undo_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, TEXT);
DROP TABLE IF EXISTS public.filet_guided_operation_receipts;
DROP TABLE IF EXISTS public.filet_guided_progress;
-- Opcional (solo si se requiere limpiar columnas nuevas sin datos):
-- ALTER TABLE public.knitting_projects
--   DROP COLUMN IF EXISTS linked_pattern_snapshot,
--   DROP COLUMN IF EXISTS linked_pattern_version_id,
--   DROP COLUMN IF EXISTS linked_pattern_id;
COMMIT;
```
