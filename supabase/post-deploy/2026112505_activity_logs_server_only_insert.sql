-- ============================================================================
-- OAKHAVEN — POST-DEPLOY MIGRATION #5: SERVER-ONLY INSERT EN ACTIVITY_LOGS
-- ============================================================================
-- UBICACIÓN INTENCIONAL: `supabase/post-deploy/` (FUERA de `supabase/migrations/`)
-- para impedir que cualquier comando masivo de migraciones la aplique ANTES
-- de que el nuevo servidor Next.js (con escritores server-side `service_role`)
-- esté desplegado y verificado en Railway.
--
-- ADVERTENCIA DE COMPATIBILIDAD:
--   NO es retrocompatible con `main @ cb06321` (Release 3.3), cuyos endpoints
--   legacy (`habit-log` y `skill-session` no Filet) insertaban en `activity_logs`
--   usando el cliente `authenticated`.
--   Aplicar EXCLUSIVAMENTE después del despliegue verificado de la aplicación
--   actualizada.
--
-- 100 % idempotente. Conserva:
--   - SELECT del propietario autenticado (RLS `auth.uid() = user_id`)
--   - SELECT / INSERT de `service_role` (disparando `fn_process_activity_reward()`)
--   - Bloqueo total de INSERT / UPDATE / DELETE para `PUBLIC`, `anon` y `authenticated`
-- ============================================================================

BEGIN;

-- 1. Revocar cualquier permiso de escritura (tabla y columnas) para roles cliente
REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_logs
  FROM PUBLIC, anon, authenticated;

-- 2. Garantizar lectura de propietario autenticado y escritura exclusiva de service_role
GRANT SELECT ON TABLE public.activity_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.activity_logs TO service_role;

-- 3. Asegurar RLS activo y reemplazar políticas amplias `FOR ALL` por `FOR SELECT` explícito
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users manage own activities" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_user_isolation" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_read_owner" ON public.activity_logs;

CREATE POLICY "activity_logs_read_owner"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
