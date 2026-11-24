-- DRAFT: apply explicitly before enabling Filet finalization.
-- Server-only kernel. The caller must derive p_owner_id from verified authentication.
-- Reuses fn_process_activity_reward unchanged; it does not introduce reward formulas.
BEGIN;

CREATE TABLE IF NOT EXISTS public.skill_session_operation_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
  request_hash text NOT NULL CHECK (length(request_hash) = 64),
  activity_log_id uuid NOT NULL UNIQUE REFERENCES public.activity_logs(id),
  response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_key)
);
ALTER TABLE public.skill_session_operation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.skill_session_operation_receipts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.skill_session_operation_receipts TO service_role;

CREATE TABLE IF NOT EXISTS public.filet_session_operation_aliases (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  operation_key text NOT NULL CHECK (length(operation_key) BETWEEN 1 AND 200),
  canonical_key text NOT NULL,
  PRIMARY KEY (user_id, operation_key),
  FOREIGN KEY (user_id, canonical_key)
    REFERENCES public.skill_session_operation_receipts(user_id, operation_key)
    DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.filet_session_operation_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.filet_session_operation_aliases FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.filet_session_operation_aliases TO service_role;

CREATE OR REPLACE FUNCTION public.record_skill_session_atomic_v1(
  p_owner_id uuid,
  p_operation_key text,
  p_session_id uuid,
  p_treasury_id uuid,
  p_request jsonb,
  p_activity jsonb,
  p_resource jsonb DEFAULT '{"kind":"none"}'::jsonb,
  p_collections_state jsonb DEFAULT NULL,
  p_expected_profile_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_key text := btrim(p_operation_key);
  v_alias text := v_key;
  v_filet_session text := p_request->>'filet_session_id';
  v_filet_version text := p_request->>'filet_pattern_version_id';
  v_bound_key text;
  v_project jsonb;
  v_hash text;
  v_activity_key text;
  v_receipt public.skill_session_operation_receipts%ROWTYPE;
  v_log public.activity_logs%ROWTYPE;
  v_treasury public.player_treasury%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_before_level integer;
  v_before_wallet bigint;
  v_kind text := coalesce(p_resource->>'kind', 'none');
  v_delta integer;
  v_resource jsonb := NULL;
  v_snapshot jsonb;
  v_patch jsonb;
  v_response jsonb;
  v_collection_key text;
  v_progress_patch jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Server role required' USING ERRCODE = '42501';
  END IF;
  IF v_filet_session IS NOT NULL OR v_filet_version IS NOT NULL THEN
    IF v_filet_session IS NULL OR v_filet_session !~ '^ses_[0-9]{1,16}_[a-z0-9]{1,6}$'
       OR nullif(v_filet_version, '') IS NULL OR v_kind <> 'none'
       OR p_request->>'domain' IS DISTINCT FROM 'knitting'
       OR p_request ? 'rows_completed' THEN
      RAISE EXCEPTION 'Invalid Filet session identity' USING ERRCODE = '22023';
    END IF;
    SELECT to_jsonb(project) INTO v_project FROM public.knitting_projects project
      WHERE project.id = (p_request->>'project_id')::uuid AND project.user_id = p_owner_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned Filet project required' USING ERRCODE = '42501'; END IF;
    IF v_project->>'linked_pattern_version_id' IS DISTINCT FROM v_filet_version THEN
      RAISE EXCEPTION 'Filet pattern version changed' USING ERRCODE = '22023';
    END IF;
    -- This is also the legacy universal-session key, so a legacy activity can never be paid again.
    v_key := 'ses_univ_' || p_owner_id::text || '_' || v_filet_session;
    PERFORM pg_advisory_xact_lock(hashtextextended('filet-alias:' || p_owner_id::text || ':' || v_alias, 0));
    SELECT canonical_key INTO v_bound_key FROM public.filet_session_operation_aliases
      WHERE user_id = p_owner_id AND operation_key = v_alias;
    IF FOUND AND v_bound_key <> v_key THEN
      RAISE EXCEPTION 'Filet operation already belongs to another session' USING ERRCODE = '22023';
    END IF;
    IF v_alias <> v_key AND left(v_alias, 9) = 'ses_univ_' THEN
      RAISE EXCEPTION 'Reserved universal session key' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF p_owner_id IS NULL OR p_session_id IS NULL OR v_key IS NULL OR length(v_key) NOT BETWEEN 1 AND 200
     OR p_request IS NULL OR jsonb_typeof(p_request) <> 'object'
     OR p_activity IS NULL OR jsonb_typeof(p_activity) <> 'object'
     OR p_resource IS NULL OR jsonb_typeof(p_resource) <> 'object' THEN
    RAISE EXCEPTION 'Invalid session command' USING ERRCODE = '22023';
  END IF;
  v_hash := encode(sha256(convert_to((p_request - 'idempotency_key' - 'user_id' - 'ownerId')::text, 'UTF8')), 'hex');
  -- Match scopeIdempotencyKey in request-auth.ts, including its binary separator.
  v_activity_key := 'u' || left(encode(sha256(convert_to(p_owner_id::text, 'UTF8') || decode('00','hex') || convert_to(v_key, 'UTF8')), 'hex'), 48);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id::text || ':' || v_key, 0));
  IF v_filet_session IS NOT NULL THEN
    INSERT INTO public.filet_session_operation_aliases(user_id, operation_key, canonical_key)
      VALUES (p_owner_id, v_alias, v_key) ON CONFLICT (user_id, operation_key) DO NOTHING;
  END IF;
  SELECT * INTO v_receipt FROM public.skill_session_operation_receipts
    WHERE user_id = p_owner_id AND operation_key = v_key;
  IF FOUND THEN
    IF v_receipt.request_hash <> v_hash THEN
      RAISE EXCEPTION 'Operation payload changed' USING ERRCODE = '22023';
    END IF;
    RETURN v_receipt.response || jsonb_build_object('replayed', true, 'reward_impact',
      (v_receipt.response->'reward_impact') || jsonb_build_object('idempotent_replay', true));
  END IF;
  -- Legacy rows do not prove all secondary effects completed. Never pay them again.
  IF EXISTS (SELECT 1 FROM public.activity_logs WHERE user_id = p_owner_id AND idempotency_key = v_activity_key) THEN
    RAISE EXCEPTION 'Legacy operation requires reconciliation' USING ERRCODE = '55000';
  END IF;
  IF coalesce(p_activity->>'duration_minutes', '') !~ '^[0-9]+$'
     OR (p_activity->>'duration_minutes')::integer <= 0
     OR coalesce(p_activity->>'requested_gp', '') !~ '^[0-9]+$'
     OR coalesce(p_activity->>'earned_xp', '') !~ '^[0-9]+$'
     OR p_request->>'domain' IS DISTINCT FROM p_activity->>'domain'
     OR (p_request->>'duration_minutes')::numeric IS DISTINCT FROM (p_activity->>'duration_minutes')::numeric THEN
    RAISE EXCEPTION 'Invalid activity proposal' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_treasury FROM public.player_treasury
    WHERE id = p_treasury_id AND user_id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Owned treasury required' USING ERRCODE = '42501'; END IF;
  v_before_level := v_treasury.player_level;
  v_before_wallet := v_treasury.wallet_gp;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Existing profile required' USING ERRCODE = 'P0002'; END IF;
  IF p_collections_state IS NOT NULL THEN
    IF jsonb_typeof(p_collections_state) <> 'object' THEN
      RAISE EXCEPTION 'Invalid snapshot' USING ERRCODE = '22023';
    END IF;
    IF p_expected_profile_updated_at IS NULL OR v_profile.updated_at IS DISTINCT FROM p_expected_profile_updated_at THEN
      RAISE EXCEPTION 'Profile revision changed' USING ERRCODE = '40001';
    END IF;
    IF p_collections_state ? 'skillSessionState' AND
       p_collections_state->'skillSessionState'->>'ownerId' IS DISTINCT FROM p_owner_id::text THEN
      RAISE EXCEPTION 'Snapshot owner mismatch' USING ERRCODE = '42501';
    END IF;
  END IF;
  INSERT INTO public.activity_logs (
    id, user_id, treasury_id, domain, activity_name, duration_minutes,
    requested_gp, earned_xp, session_metadata, notes, idempotency_key, source
  ) VALUES (
    p_session_id, p_owner_id, p_treasury_id, (p_activity->>'domain')::public.skill_domain,
    p_activity->>'title', (p_activity->>'duration_minutes')::integer,
    (p_activity->>'requested_gp')::bigint, (p_activity->>'earned_xp')::integer,
    coalesce(p_activity->'metadata', '{}'::jsonb), p_activity->>'notes', v_activity_key, 'skill_session'
  ) RETURNING * INTO v_log;
  -- The existing reward trigger runs exactly once, inside this same transaction.
  IF v_kind = 'book' AND v_log.domain::text = 'reading' THEN
    v_delta := coalesce((p_resource->>'delta')::integer, 0);
    IF v_delta < 0 THEN RAISE EXCEPTION 'Negative page delta' USING ERRCODE = '22023'; END IF;
    UPDATE public.reading_books SET
      pages_read = least(total_pages, pages_read + v_delta),
      status = CASE WHEN pages_read + v_delta >= total_pages THEN 'completed' ELSE 'reading' END,
      updated_at = now()
    WHERE id = (p_resource->>'id')::uuid AND user_id = p_owner_id
    RETURNING to_jsonb(reading_books.*) INTO v_resource;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned book required' USING ERRCODE = '42501'; END IF;
  ELSIF v_kind = 'knitting' AND v_log.domain::text = 'knitting' THEN
    v_delta := coalesce((p_resource->>'delta')::integer, 0);
    IF v_delta < 0 THEN RAISE EXCEPTION 'Negative row delta' USING ERRCODE = '22023'; END IF;
    UPDATE public.knitting_projects SET
      completed_rows = least(total_rows_target, completed_rows + v_delta),
      status = CASE WHEN completed_rows + v_delta >= total_rows_target THEN 'completed' ELSE 'in_progress' END,
      updated_at = now()
    WHERE id = (p_resource->>'id')::uuid AND user_id = p_owner_id
    RETURNING to_jsonb(knitting_projects.*) INTO v_resource;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owned project required' USING ERRCODE = '42501'; END IF;
  ELSIF v_kind = 'rubik' AND v_log.domain::text = 'rubik' THEN
    INSERT INTO public.rubik_solves (user_id, cube_type, cube_model, time_seconds, penalty, scramble,
      is_pb, ao5_after, ao12_after, algorithm_practiced)
    VALUES (p_owner_id, coalesce(p_resource->>'cube_type', '3x3'), p_resource->>'cube_model',
      (p_resource->>'time_seconds')::numeric, coalesce(p_resource->>'penalty', 'NONE'), coalesce(p_resource->>'scramble', ''),
      coalesce((p_resource->>'is_pb')::boolean, false), (p_resource->>'ao5_after')::numeric,
      (p_resource->>'ao12_after')::numeric, p_resource->>'algorithm_practiced')
    RETURNING to_jsonb(rubik_solves.*) INTO v_resource;
  ELSIF v_kind <> 'none' THEN
    RAISE EXCEPTION 'Resource/domain mismatch' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_treasury FROM public.player_treasury WHERE id = p_treasury_id;
  v_response := jsonb_build_object(
    'success', true, 'mode', 'supabase', 'replayed', false,
    'session_logged', jsonb_build_object('id', v_log.id, 'domain', v_log.domain, 'title', v_log.activity_name,
      'duration_minutes', v_log.duration_minutes, 'gp_earned', v_log.transferred_gp, 'xp_earned', v_log.earned_xp,
      'details', v_log.notes, 'metadata', v_log.session_metadata, 'timestamp', v_log.completed_at),
    'reward_impact', jsonb_build_object('transferred_gp', v_log.transferred_gp, 'idempotent_replay', false,
      'streak_multiplier_applied', v_log.streak_multiplier_applied, 'streak_days', v_treasury.current_streak_days,
      'shield_earned', v_log.shield_earned, 'leveled_up', v_treasury.player_level > v_before_level,
      'amortized_overdrawn_gp', least(greatest(-v_before_wallet,0),v_log.transferred_gp),
      'curse_lifted', v_before_wallet < 0 AND v_treasury.wallet_gp >= 0,
      'vault_capped', v_log.transferred_gp < round(v_log.requested_gp * v_log.streak_multiplier_applied)),
    'treasury_snapshot', jsonb_build_object('wallet_gp', v_treasury.wallet_gp, 'vault_remaining_gp', v_treasury.vault_remaining_gp,
      'current_xp', v_treasury.current_xp, 'player_level', v_treasury.player_level), 'resource', v_resource);
  v_snapshot := coalesce(v_profile.collections_state, '{}'::jsonb);
  IF p_collections_state IS NOT NULL THEN
    SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb) INTO v_patch
    FROM jsonb_each(p_collections_state)
    WHERE key = 'skillSessionState'
       OR (v_filet_session IS NULL AND key IN ('readingBooks','knittingProjects','rubikCubes','workProjects'));
    v_snapshot := v_snapshot || v_patch;
  END IF;
  -- Keep an existing visual resource projection aligned with the actual row result.
  IF v_kind IN ('book','knitting') AND v_resource IS NOT NULL THEN
    v_collection_key := CASE WHEN v_kind = 'book' THEN 'readingBooks' ELSE 'knittingProjects' END;
    v_progress_patch := CASE WHEN v_kind = 'book'
      THEN jsonb_build_object('pages_read', v_resource->'pages_read', 'status', v_resource->'status')
      ELSE jsonb_build_object('completed_rows', v_resource->'completed_rows', 'status', v_resource->'status') END;
    IF jsonb_typeof(v_snapshot->v_collection_key) = 'array' THEN
      SELECT coalesce(jsonb_agg(CASE WHEN item->>'id' = v_resource->>'id'
        THEN item || v_progress_patch ELSE item END), '[]'::jsonb) INTO v_patch
      FROM jsonb_array_elements(v_snapshot->v_collection_key) AS elements(item);
      v_snapshot := jsonb_set(v_snapshot, ARRAY[v_collection_key], v_patch);
    END IF;
  END IF;
  -- Canonicalize this operation's application cache from the committed SQL reward.
  IF p_collections_state ? 'skillSessionState' THEN
    IF jsonb_typeof(v_snapshot->'skillSessionState'->'sessions') <> 'array'
       OR jsonb_typeof(v_snapshot->'skillSessionState'->'receipts') <> 'array' THEN
      RAISE EXCEPTION 'Invalid session cache shape' USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'skillSessionState'->'sessions') AS sessions(item)
                   WHERE item->>'id' = p_session_id::text)
       OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_snapshot->'skillSessionState'->'receipts') AS receipts(item)
                      WHERE item->>0 = 'skill_session:' || v_key AND item->1->'session'->>'id' = p_session_id::text) THEN
      RAISE EXCEPTION 'Session cache does not contain the active operation' USING ERRCODE = '22023';
    END IF;
    SELECT jsonb_agg(CASE WHEN item->>'id' = p_session_id::text
      THEN item || (v_response->'session_logged') ELSE item END) INTO v_patch
    FROM jsonb_array_elements(v_snapshot->'skillSessionState'->'sessions') AS sessions(item);
    v_snapshot := jsonb_set(v_snapshot, ARRAY['skillSessionState','sessions'], v_patch);
    SELECT jsonb_agg(CASE WHEN item->>0 = 'skill_session:' || v_key THEN jsonb_build_array(item->0,
      (item->1) || jsonb_build_object('session', (item->1->'session') || (v_response->'session_logged'),
        'reward_impact', (v_response->'reward_impact') || jsonb_build_object('idempotent_replay',true))) ELSE item END) INTO v_patch
    FROM jsonb_array_elements(v_snapshot->'skillSessionState'->'receipts') AS receipts(item);
    v_snapshot := jsonb_set(v_snapshot, ARRAY['skillSessionState','receipts'], v_patch);
  END IF;
  -- Snapshot financial projections come from the existing treasury, never from the proposal.
  v_snapshot := v_snapshot || jsonb_build_object(
    'wallet_gp', v_treasury.wallet_gp, 'vault_remaining_gp', v_treasury.vault_remaining_gp,
    'current_xp', v_treasury.current_xp, 'player_level', v_treasury.player_level,
    'current_streak_days', v_treasury.current_streak_days, 'streak_multiplier', v_treasury.streak_multiplier,
    'aegis_shields', v_treasury.aegis_shields);
  UPDATE public.profiles SET collections_state = v_snapshot, updated_at = now() WHERE id = p_owner_id;
  INSERT INTO public.skill_session_operation_receipts(user_id, operation_key, request_hash, activity_log_id, response)
    VALUES (p_owner_id, v_key, v_hash, v_log.id, v_response);
  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)
  TO service_role;

COMMIT;
