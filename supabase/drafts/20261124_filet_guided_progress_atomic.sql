-- ============================================================================
-- OAKHAVEN — FILET CROCHET STUDIO FASE 4 (BORRADOR SQL — NO APLICAR EN PROD)
-- ============================================================================
-- Migración borrador para garantizar atomicidad real en PostgreSQL entre:
--   1. El progreso guiado por fila/segmento (`public.filet_guided_progress`)
--   2. El registro de operaciones idempotentes (`public.filet_guided_operation_receipts`)
--   3. El contador canónico `public.knitting_projects.completed_rows` y `status`
--
-- Probada de forma aislada en PGlite (`tests/filet-crochet-phase4-sql.test.ts`).
-- NO ejecutar automáticamente contra Supabase real sin aprobación explícita.
-- ============================================================================

-- 1. Vínculo inmutable opcional en `knitting_projects` (100 % retrocompatible)
ALTER TABLE public.knitting_projects
  ADD COLUMN IF NOT EXISTS linked_pattern_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS linked_pattern_version_id VARCHAR(120),
  ADD COLUMN IF NOT EXISTS linked_pattern_snapshot JSONB;

-- 2. Estado de progreso guiado por proyecto (1 fila por propietario y proyecto)
CREATE TABLE IF NOT EXISTS public.filet_guided_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.knitting_projects(id) ON DELETE CASCADE,
  pattern_version_id VARCHAR(120) NOT NULL,
  active_row_number INT NOT NULL DEFAULT 1 CHECK (active_row_number >= 1),
  active_segment_index INT NOT NULL DEFAULT 0 CHECK (active_segment_index >= 0),
  completed_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  confirmed_rows INT[] NOT NULL DEFAULT '{}'::int[],
  revision INT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  last_device_id VARCHAR(120) NOT NULL DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- 3. Recibos idempotentes de operaciones de confirmación / retroceso
CREATE TABLE IF NOT EXISTS public.filet_guided_operation_receipts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_key VARCHAR(200) NOT NULL,
  project_id UUID NOT NULL REFERENCES public.knitting_projects(id) ON DELETE CASCADE,
  pattern_version_id VARCHAR(120) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('confirm_row', 'undo_row')),
  row_number INT NOT NULL CHECK (row_number >= 1),
  device_id VARCHAR(120) NOT NULL DEFAULT 'unknown',
  resulting_revision INT NOT NULL,
  resulting_completed_rows INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, operation_key)
);

CREATE INDEX IF NOT EXISTS idx_filet_guided_receipts_project
  ON public.filet_guided_operation_receipts(user_id, project_id, created_at DESC);

ALTER TABLE public.filet_guided_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filet_guided_operation_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own filet_guided_progress" ON public.filet_guided_progress;
CREATE POLICY "Users manage own filet_guided_progress"
  ON public.filet_guided_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own filet_guided_operation_receipts" ON public.filet_guided_operation_receipts;
CREATE POLICY "Users read own filet_guided_operation_receipts"
  ON public.filet_guided_operation_receipts
  FOR SELECT USING (auth.uid() = user_id);

-- 4. RPC Atómica: Confirmar una fila y actualizar `knitting_projects.completed_rows`
--    en una única transacción serializada con FOR UPDATE.
CREATE OR REPLACE FUNCTION public.confirm_filet_row_atomic_v1(
  p_owner_id UUID,
  p_project_id UUID,
  p_pattern_version_id TEXT,
  p_row_number INT,
  p_operation_key TEXT,
  p_expected_revision INT DEFAULT NULL,
  p_device_id TEXT DEFAULT 'device-local',
  p_completed_segments_count INT DEFAULT NULL,
  p_expected_segments_count INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.knitting_projects%ROWTYPE;
  v_progress public.filet_guided_progress%ROWTYPE;
  v_receipt public.filet_guided_operation_receipts%ROWTYPE;
  v_new_confirmed INT[];
  v_new_completed INT;
  v_new_revision INT;
  v_next_row INT;
  v_new_status VARCHAR(20);
BEGIN
  IF p_owner_id IS NULL OR p_project_id IS NULL THEN
    RAISE EXCEPTION 'owner_id y project_id son obligatorios';
  END IF;
  IF p_operation_key IS NULL OR btrim(p_operation_key) = '' THEN
    RAISE EXCEPTION 'operation_key estable es obligatorio';
  END IF;
  IF p_row_number IS NULL OR p_row_number < 1 THEN
    RAISE EXCEPTION 'row_number debe ser >= 1';
  END IF;
  -- Validación de segmentos en servidor (Bloque 7): rechazar confirmaciones incompletas
  IF p_expected_segments_count IS NOT NULL THEN
    IF p_expected_segments_count < 1 OR p_completed_segments_count IS NULL OR p_completed_segments_count < p_expected_segments_count THEN
      RAISE EXCEPTION 'INCOMPLETE_SEGMENTS: faltan segmentos por completar en la fila %', p_row_number;
    END IF;
  END IF;

  -- Serializar acceso concurrente (dos dispositivos) sobre el proyecto
  SELECT *
    INTO v_project
    FROM public.knitting_projects
   WHERE id = p_project_id
     AND user_id = p_owner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto de tejido no encontrado o no pertenece al propietario';
  END IF;

  IF v_project.linked_pattern_version_id IS NOT NULL
     AND v_project.linked_pattern_version_id <> p_pattern_version_id THEN
    RAISE EXCEPTION 'PATTERN_VERSION_MISMATCH: el proyecto está vinculado a otra versión inmutable';
  END IF;

  IF p_row_number > v_project.total_rows_target THEN
    RAISE EXCEPTION 'row_number (%) excede total_rows_target (%)', p_row_number, v_project.total_rows_target;
  END IF;

  -- Replay exacto por operation_key
  SELECT *
    INTO v_receipt
    FROM public.filet_guided_operation_receipts
   WHERE user_id = p_owner_id
     AND operation_key = p_operation_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'replayed', true,
      'conflict', false,
      'delta_completed_rows', 0,
      'completed_rows', v_project.completed_rows,
      'revision', v_receipt.resulting_revision,
      'status', v_project.status
    );
  END IF;

  -- Asegurar fila en filet_guided_progress
  INSERT INTO public.filet_guided_progress (
    user_id, project_id, pattern_version_id, active_row_number, confirmed_rows, revision, last_device_id
  )
  VALUES (
    p_owner_id, p_project_id, p_pattern_version_id, 1, '{}'::int[], 0, COALESCE(p_device_id, 'device-local')
  )
  ON CONFLICT (user_id, project_id) DO NOTHING;

  SELECT *
    INTO v_progress
    FROM public.filet_guided_progress
   WHERE user_id = p_owner_id
     AND project_id = p_project_id
   FOR UPDATE;

  IF v_progress.pattern_version_id <> p_pattern_version_id THEN
    RAISE EXCEPTION 'PATTERN_VERSION_MISMATCH: progreso vinculado a otra versión del patrón';
  END IF;

  -- Regla 5: Si la fila ya fue confirmada (ej. por otro dispositivo), NO duplicar
  IF p_row_number = ANY(v_progress.confirmed_rows) THEN
    INSERT INTO public.filet_guided_operation_receipts (
      user_id, operation_key, project_id, pattern_version_id, action, row_number, device_id,
      resulting_revision, resulting_completed_rows
    )
    VALUES (
      p_owner_id, p_operation_key, p_project_id, p_pattern_version_id, 'confirm_row', p_row_number,
      COALESCE(p_device_id, 'device-local'), v_progress.revision, v_project.completed_rows
    )
    ON CONFLICT (user_id, operation_key) DO NOTHING;

    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'replayed', true,
      'conflict', false,
      'delta_completed_rows', 0,
      'completed_rows', v_project.completed_rows,
      'revision', v_progress.revision,
      'status', v_project.status
    );
  END IF;

  -- Detección de conflicto de revisión optimista
  IF p_expected_revision IS NOT NULL AND v_progress.revision <> p_expected_revision THEN
    RETURN jsonb_build_object(
      'success', false,
      'applied', false,
      'replayed', false,
      'conflict', true,
      'delta_completed_rows', 0,
      'server_revision', v_progress.revision,
      'server_confirmed_rows', to_jsonb(v_progress.confirmed_rows),
      'completed_rows', v_project.completed_rows
    );
  END IF;

  -- Aplicar confirmación atómica (+1 exacto)
  SELECT ARRAY(
    SELECT DISTINCT x
      FROM unnest(array_append(v_progress.confirmed_rows, p_row_number)) AS x
     ORDER BY x
  ) INTO v_new_confirmed;

  v_new_completed := LEAST(v_project.total_rows_target, COALESCE(cardinality(v_new_confirmed), 0));
  v_new_revision := v_progress.revision + 1;
  v_next_row := LEAST(v_project.total_rows_target, p_row_number + 1);
  v_new_status := CASE
    WHEN v_new_completed >= v_project.total_rows_target THEN 'completed'
    ELSE v_project.status
  END;

  UPDATE public.filet_guided_progress
     SET confirmed_rows = v_new_confirmed,
         active_row_number = v_next_row,
         active_segment_index = 0,
         completed_segments = '[]'::jsonb,
         revision = v_new_revision,
         last_device_id = COALESCE(p_device_id, 'device-local'),
         updated_at = NOW()
   WHERE user_id = p_owner_id
     AND project_id = p_project_id;

  UPDATE public.knitting_projects
     SET completed_rows = v_new_completed,
         status = v_new_status,
         updated_at = NOW()
   WHERE id = p_project_id
     AND user_id = p_owner_id;

  INSERT INTO public.filet_guided_operation_receipts (
    user_id, operation_key, project_id, pattern_version_id, action, row_number, device_id,
    resulting_revision, resulting_completed_rows
  )
  VALUES (
    p_owner_id, p_operation_key, p_project_id, p_pattern_version_id, 'confirm_row', p_row_number,
    COALESCE(p_device_id, 'device-local'), v_new_revision, v_new_completed
  );

  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'replayed', false,
    'conflict', false,
    'delta_completed_rows', 1,
    'completed_rows', v_new_completed,
    'confirmed_rows', to_jsonb(v_new_confirmed),
    'revision', v_new_revision,
    'status', v_new_status
  );
END;
$$;

-- 5. RPC Atómica: Retroceder la última fila confirmada respetando invariantes (>= 0)
CREATE OR REPLACE FUNCTION public.undo_filet_row_atomic_v1(
  p_owner_id UUID,
  p_project_id UUID,
  p_pattern_version_id TEXT,
  p_row_number INT,
  p_operation_key TEXT,
  p_device_id TEXT DEFAULT 'device-local'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project public.knitting_projects%ROWTYPE;
  v_progress public.filet_guided_progress%ROWTYPE;
  v_receipt public.filet_guided_operation_receipts%ROWTYPE;
  v_new_confirmed INT[];
  v_new_completed INT;
  v_new_revision INT;
BEGIN
  SELECT * INTO v_project
    FROM public.knitting_projects
   WHERE id = p_project_id AND user_id = p_owner_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto de tejido no encontrado o no pertenece al propietario';
  END IF;

  SELECT * INTO v_receipt
    FROM public.filet_guided_operation_receipts
   WHERE user_id = p_owner_id AND operation_key = p_operation_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'applied', false,
      'replayed', true,
      'delta_completed_rows', 0,
      'completed_rows', v_project.completed_rows,
      'revision', v_receipt.resulting_revision
    );
  END IF;

  SELECT * INTO v_progress
    FROM public.filet_guided_progress
   WHERE user_id = p_owner_id AND project_id = p_project_id
   FOR UPDATE;

  IF NOT FOUND OR NOT (p_row_number = ANY(v_progress.confirmed_rows)) THEN
    RETURN jsonb_build_object(
      'success', false,
      'applied', false,
      'replayed', false,
      'delta_completed_rows', 0,
      'completed_rows', v_project.completed_rows,
      'revision', COALESCE(v_progress.revision, 0)
    );
  END IF;

  IF v_progress.pattern_version_id <> p_pattern_version_id THEN
    RAISE EXCEPTION 'PATTERN_VERSION_MISMATCH';
  END IF;

  v_new_confirmed := array_remove(v_progress.confirmed_rows, p_row_number);
  v_new_completed := GREATEST(0, COALESCE(cardinality(v_new_confirmed), 0));
  v_new_revision := v_progress.revision + 1;

  UPDATE public.filet_guided_progress
     SET confirmed_rows = v_new_confirmed,
         active_row_number = p_row_number,
         active_segment_index = 0,
         completed_segments = '[]'::jsonb,
         revision = v_new_revision,
         last_device_id = COALESCE(p_device_id, 'device-local'),
         updated_at = NOW()
   WHERE user_id = p_owner_id AND project_id = p_project_id;

  UPDATE public.knitting_projects
     SET completed_rows = v_new_completed,
         status = CASE WHEN status = 'completed' AND v_new_completed < total_rows_target THEN 'in_progress' ELSE status END,
         updated_at = NOW()
   WHERE id = p_project_id AND user_id = p_owner_id;

  INSERT INTO public.filet_guided_operation_receipts (
    user_id, operation_key, project_id, pattern_version_id, action, row_number, device_id,
    resulting_revision, resulting_completed_rows
  )
  VALUES (
    p_owner_id, p_operation_key, p_project_id, p_pattern_version_id, 'undo_row', p_row_number,
    COALESCE(p_device_id, 'device-local'), v_new_revision, v_new_completed
  );

  RETURN jsonb_build_object(
    'success', true,
    'applied', true,
    'replayed', false,
    'delta_completed_rows', -1,
    'completed_rows', v_new_completed,
    'confirmed_rows', to_jsonb(v_new_confirmed),
    'revision', v_new_revision
  );
END;
$$;

-- 6. Hardening de permisos (Bloque 7): solo `service_role` puede invocar las RPCs SECURITY DEFINER
REVOKE ALL ON TABLE public.filet_guided_operation_receipts FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, INT, TEXT, INT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.undo_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, INT, TEXT, INT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.undo_filet_row_atomic_v1(UUID, UUID, TEXT, INT, TEXT, TEXT) TO service_role;
