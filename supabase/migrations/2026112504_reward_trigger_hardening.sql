-- ============================================================================
-- OAKHAVEN — FASE 6D.2: ENDURECIMIENTO MÍNIMO DE RECOMPENSAS Y ACTIVITY_LOGS
-- ============================================================================
-- 100 % idempotente, aditivo y retrocompatible con Release 3.3 (main),
-- habit-log y sesiones tradicionales no Filet.
--
-- Dependencias: public.fn_process_activity_reward() y public.activity_logs
-- (supabase/schema.sql) y 2026112503_atomic_skill_session.sql.
--
-- Alcance exacto:
--   1. Fija search_path inmutable en fn_process_activity_reward() (SECURITY DEFINER).
--   2. Revoca EXECUTE directo sobre la función trigger a PUBLIC, anon y authenticated.
--   3. Revoca UPDATE/DELETE de cliente sobre public.activity_logs para impedir
--      alteración o borrado de actividades ya confirmadas, conservando SELECT e
--      INSERT autenticado (bajo RLS auth.uid() = user_id) hasta que los módulos
--      legacy (habit-log y skill-session no Filet) migren completamente a RPC.
--   4. Revoca INSERT anónimo explícitamente sobre public.activity_logs.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'fn_process_activity_reward'
       AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    ALTER FUNCTION public.fn_process_activity_reward()
      SET search_path = pg_catalog, public;

    REVOKE ALL ON FUNCTION public.fn_process_activity_reward()
      FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

REVOKE UPDATE, DELETE ON TABLE public.activity_logs
  FROM PUBLIC, anon, authenticated;

REVOKE INSERT ON TABLE public.activity_logs
  FROM PUBLIC, anon;

COMMIT;
