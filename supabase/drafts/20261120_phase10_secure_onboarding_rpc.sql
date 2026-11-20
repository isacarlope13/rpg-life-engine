-- ============================================================================
-- OAKHAVEN FASE 10 — BORRADOR RPC ATÓMICO DE ONBOARDING SEGURO (NO EJECUTAR)
-- ============================================================================
-- Propósito: Proveer una función transaccional opcional en PostgreSQL que
-- persista perfil y tesorería en una sola transacción ACID sin reiniciar
-- wallet_gp, player_level, current_xp ni rachas cuando ya existe progreso.
-- NO ejecutar automáticamente en producción; requiere aprobación humana.
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
  v_exists boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.player_treasury
    WHERE user_id = v_uid AND billing_period = p_billing_period
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.player_treasury t
    SET
      monthly_income_cop = GREATEST(0, p_monthly_income_cop),
      fixed_costs_budget_cop = GREATEST(0, p_fixed_costs_budget_cop),
      variable_ops_budget_cop = GREATEST(0, p_variable_ops_budget_cop),
      vault_cap_gp = GREATEST(0, p_vault_cap_gp),
      debt_strategy = CASE WHEN p_debt_strategy = 'avalanche' THEN 'avalanche' ELSE 'snowball' END
    WHERE t.user_id = v_uid AND t.billing_period = p_billing_period;

    RETURN QUERY
    SELECT 'edit'::text, t.wallet_gp, t.player_level, t.current_xp
    FROM public.player_treasury t
    WHERE t.user_id = v_uid AND t.billing_period = p_billing_period;
  ELSE
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
      GREATEST(0, p_monthly_income_cop),
      GREATEST(0, p_fixed_costs_budget_cop),
      0,
      GREATEST(0, p_variable_ops_budget_cop),
      0,
      GREATEST(0, p_vault_cap_gp),
      GREATEST(0, p_vault_cap_gp),
      0,
      0,
      CASE WHEN p_debt_strategy = 'avalanche' THEN 'avalanche' ELSE 'snowball' END,
      1,
      0,
      0,
      1.0,
      1
    );

    RETURN QUERY
    SELECT 'initial'::text, 0, 1, 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_phase10_upsert_onboarding_treasury(text, integer, integer, integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_phase10_upsert_onboarding_treasury(text, integer, integer, integer, integer, text) TO authenticated;
