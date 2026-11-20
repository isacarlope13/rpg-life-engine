-- ============================================================================
-- OAKHAVEN FASE 10 — BORRADOR RPC ATÓMICO DE ONBOARDING SEGURO (v2 RACE-FREE)
-- ============================================================================
-- Propósito: Upsert transaccional atómico en player_treasury mediante
-- INSERT ... ON CONFLICT (user_id, billing_period) DO UPDATE.
-- - Seguro ante dos guardados simultáneos (sin race condition 23505).
-- - Preserva intactos wallet_gp, player_level, current_xp, current_streak_days,
--   fixed_costs_spent_cop, variable_ops_spent_cop y aegis_shields si ya existe.
-- - NO ejecutar automáticamente en producción; requiere aprobación humana.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_phase10_upsert_onboarding_treasury(
  p_billing_period text,
  p_monthly_income_cop integer,
  p_fixed_costs_budget_cop integer,
  p_variable_ops_budget_cop integer,
  p_vault_cap_gp integer,
  p_debt_strategy text DEFAULT 'snowball'
)
RETURNS TABLE (
  mode text,
  wallet_gp integer,
  player_level integer,
  current_xp integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existed boolean;
  v_strategy text := CASE WHEN p_debt_strategy = 'avalanche' THEN 'avalanche' ELSE 'snowball' END;
  v_income integer := GREATEST(0, p_monthly_income_cop);
  v_fixed integer := GREATEST(0, p_fixed_costs_budget_cop);
  v_var integer := GREATEST(0, p_variable_ops_budget_cop);
  v_vault integer := GREATEST(0, p_vault_cap_gp);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.player_treasury
    WHERE user_id = v_uid AND billing_period = p_billing_period
  ) INTO v_existed;

  INSERT INTO public.player_treasury (
    user_id,
    billing_period,
    monthly_income_cop,
    fixed_costs_budget_cop,
    fixed_costs_spent_cop,
    variable_ops_budget_cop,
    variable_ops_spent_cop,
    vault_cap_gp,
    vault_remaining_gp,
    wallet_gp,
    total_penalty_gp,
    debt_strategy,
    player_level,
    current_xp,
    current_streak_days,
    streak_multiplier,
    aegis_shields
  )
  VALUES (
    v_uid,
    p_billing_period,
    v_income,
    v_fixed,
    0,
    v_var,
    0,
    v_vault,
    v_vault,
    0,
    0,
    v_strategy,
    1,
    0,
    0,
    1.0,
    1
  )
  ON CONFLICT (user_id, billing_period) DO UPDATE
  SET
    monthly_income_cop = EXCLUDED.monthly_income_cop,
    fixed_costs_budget_cop = EXCLUDED.fixed_costs_budget_cop,
    variable_ops_budget_cop = EXCLUDED.variable_ops_budget_cop,
    vault_cap_gp = EXCLUDED.vault_cap_gp,
    debt_strategy = EXCLUDED.debt_strategy;

  RETURN QUERY
  SELECT
    CASE WHEN v_existed THEN 'edit'::text ELSE 'initial'::text END,
    t.wallet_gp,
    t.player_level,
    t.current_xp
  FROM public.player_treasury t
  WHERE t.user_id = v_uid AND t.billing_period = p_billing_period;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase10_upsert_onboarding_treasury(text, integer, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase10_upsert_onboarding_treasury(text, integer, integer, integer, integer, text) TO authenticated;
