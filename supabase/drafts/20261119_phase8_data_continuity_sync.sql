-- ============================================================================
-- OAKHAVEN FASE 8 — DATA CONTINUITY & MULTI-DEVICE SYNC (BORRADOR ADITIVO)
-- ============================================================================
-- IMPORTANTE:
-- 1. Migración 100% ADITIVA y reversible (NO elimina tablas ni datos existentes).
-- 2. EXCLUYE deliberadamente tablas/documentos financieros sensibles.
-- 3. NO ejecutar automáticamente; requiere revisión y aprobación manual del usuario.
-- 4. Compatible hacia atrás con Release 3.0 (el código detecta si las tablas aún no existen).
-- ============================================================================

-- 1. PILOTO P0: GYM — Series reales de entrenamiento multidispositivo
CREATE TABLE IF NOT EXISTS public.gym_workout_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  session_id text,
  exercise_name text NOT NULL CHECK (char_length(trim(exercise_name)) > 0 AND char_length(exercise_name) <= 160),
  set_number integer NOT NULL DEFAULT 1 CHECK (set_number >= 1 AND set_number <= 100),
  reps integer NOT NULL DEFAULT 0 CHECK (reps >= 0 AND reps <= 1000),
  weight_kg numeric(6,2) NOT NULL DEFAULT 0 CHECK (weight_kg >= 0 AND weight_kg <= 1500),
  rpe numeric(3,1) NOT NULL DEFAULT 7 CHECK (rpe >= 1 AND rpe <= 10),
  completed boolean NOT NULL DEFAULT false,
  performed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_workout_sets_user_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_gym_workout_sets_user_performed
  ON public.gym_workout_sets (user_id, performed_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.gym_workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gym_workout_sets_select_own" ON public.gym_workout_sets;
CREATE POLICY "gym_workout_sets_select_own"
  ON public.gym_workout_sets FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gym_workout_sets_insert_own" ON public.gym_workout_sets;
CREATE POLICY "gym_workout_sets_insert_own"
  ON public.gym_workout_sets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gym_workout_sets_update_own" ON public.gym_workout_sets;
CREATE POLICY "gym_workout_sets_update_own"
  ON public.gym_workout_sets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gym_workout_sets_delete_own" ON public.gym_workout_sets;
CREATE POLICY "gym_workout_sets_delete_own"
  ON public.gym_workout_sets FOR DELETE
  USING (auth.uid() = user_id);

-- 2. TRABAJO: Proyectos reales y tareas estructuradas multidispositivo
CREATE TABLE IF NOT EXISTS public.work_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  name text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 180),
  description text NOT NULL DEFAULT '',
  methodology text NOT NULL DEFAULT 'kanban' CHECK (methodology IN ('none', 'scrum', 'kanban', 'lean')),
  current_stage text NOT NULL DEFAULT 'En progreso',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold', 'archived')),
  work_scope text NOT NULL DEFAULT 'professional' CHECK (work_scope IN ('professional', 'personal')),
  total_minutes_invested integer NOT NULL DEFAULT 0 CHECK (total_minutes_invested >= 0),
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_projects_user_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_work_projects_user_updated
  ON public.work_projects (user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.work_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_projects_select_own" ON public.work_projects;
CREATE POLICY "work_projects_select_own"
  ON public.work_projects FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_projects_insert_own" ON public.work_projects;
CREATE POLICY "work_projects_insert_own"
  ON public.work_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_projects_update_own" ON public.work_projects;
CREATE POLICY "work_projects_update_own"
  ON public.work_projects FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_projects_delete_own" ON public.work_projects;
CREATE POLICY "work_projects_delete_own"
  ON public.work_projects FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.work_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.work_projects(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  title text NOT NULL CHECK (char_length(trim(title)) > 0 AND char_length(title) <= 220),
  description text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_minutes integer CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0),
  is_completed boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_project_tasks_user_client_unique UNIQUE (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_work_project_tasks_user_project
  ON public.work_project_tasks (user_id, project_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.work_project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "work_project_tasks_select_own" ON public.work_project_tasks;
CREATE POLICY "work_project_tasks_select_own"
  ON public.work_project_tasks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_project_tasks_insert_own" ON public.work_project_tasks;
CREATE POLICY "work_project_tasks_insert_own"
  ON public.work_project_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_project_tasks_update_own" ON public.work_project_tasks;
CREATE POLICY "work_project_tasks_update_own"
  ON public.work_project_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "work_project_tasks_delete_own" ON public.work_project_tasks;
CREATE POLICY "work_project_tasks_delete_own"
  ON public.work_project_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- 3. CUBOS: Columnas aditivas para notas técnicas y control de versión (preserva rubik_solves)
ALTER TABLE public.rubik_cubes
  ADD COLUMN IF NOT EXISTS tension_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lube_notes text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS algorithms_to_master text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sync_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
