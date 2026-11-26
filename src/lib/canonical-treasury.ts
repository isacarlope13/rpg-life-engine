/**
 * ============================================================================
 * OAKHAVEN — FUENTE CANÓNICA ÚNICA DE TESORERÍA Y PROGRESIÓN
 * ============================================================================
 * Garantiza que `public.player_treasury` es la única fuente de verdad para:
 * - wallet_gp, vault_cap_gp, vault_remaining_gp, total_penalty_gp
 * - current_xp, player_level, current_streak_days, streak_multiplier, aegis_shields
 *
 * Evita divergencias con snapshots legados en `profiles.collections_state` y
 * previene estados inconsistentes como `vault_cap_gp = 0` con bóveda activa.
 */

export interface CanonicalTreasuryInput {
  billing_period?: unknown;
  monthly_income_cop?: unknown;
  fixed_costs_budget_cop?: unknown;
  fixed_costs_spent_cop?: unknown;
  variable_ops_budget_cop?: unknown;
  variable_ops_spent_cop?: unknown;
  vault_cap_gp?: unknown;
  vault_remaining_gp?: unknown;
  wallet_gp?: unknown;
  total_penalty_gp?: unknown;
  debt_strategy?: unknown;
  player_level?: unknown;
  current_xp?: unknown;
  current_streak_days?: unknown;
  streak_multiplier?: unknown;
  aegis_shields?: unknown;
}

export interface CanonicalTreasurySnapshot {
  billing_period: string;
  monthly_income_cop: number;
  fixed_costs_budget_cop: number;
  fixed_costs_spent_cop: number;
  variable_ops_budget_cop: number;
  variable_ops_spent_cop: number;
  vault_cap_gp: number;
  vault_remaining_gp: number;
  wallet_gp: number;
  total_penalty_gp: number;
  debt_strategy: "snowball" | "avalanche";
  player_level: number;
  current_xp: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
}

function finiteNumber(val: unknown, fallback = 0): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function resolveCanonicalTreasury(
  treasury: CanonicalTreasuryInput
): CanonicalTreasurySnapshot {
  const wallet_gp = Math.round(finiteNumber(treasury.wallet_gp, 0));
  const vault_remaining_gp = Math.max(0, Math.round(finiteNumber(treasury.vault_remaining_gp, 0)));
  const rawCap = Math.max(0, Math.round(finiteNumber(treasury.vault_cap_gp, 0)));
  // Invariante: si existe saldo en bóveda pero vault_cap_gp quedó en 0 por un onboarding previo,
  // derivamos una capacidad efectiva segura (>= vault_remaining_gp) para evitar divisiones por 0.
  const vault_cap_gp =
    rawCap > 0
      ? Math.max(rawCap, vault_remaining_gp)
      : vault_remaining_gp > 0
      ? Math.max(vault_remaining_gp, Math.max(0, wallet_gp) + vault_remaining_gp)
      : 0;

  const rawMult = finiteNumber(treasury.streak_multiplier, 1);

  return {
    billing_period: String(treasury.billing_period || ""),
    monthly_income_cop: Math.max(0, finiteNumber(treasury.monthly_income_cop, 0)),
    fixed_costs_budget_cop: Math.max(0, finiteNumber(treasury.fixed_costs_budget_cop, 0)),
    fixed_costs_spent_cop: Math.max(0, finiteNumber(treasury.fixed_costs_spent_cop, 0)),
    variable_ops_budget_cop: Math.max(0, finiteNumber(treasury.variable_ops_budget_cop, 0)),
    variable_ops_spent_cop: Math.max(0, finiteNumber(treasury.variable_ops_spent_cop, 0)),
    vault_cap_gp,
    vault_remaining_gp,
    wallet_gp,
    total_penalty_gp: Math.max(0, Math.round(finiteNumber(treasury.total_penalty_gp, 0))),
    debt_strategy: treasury.debt_strategy === "avalanche" ? "avalanche" : "snowball",
    player_level: Math.max(1, Math.round(finiteNumber(treasury.player_level, 1))),
    current_xp: Math.max(0, Math.round(finiteNumber(treasury.current_xp, 0))),
    current_streak_days: Math.max(0, Math.round(finiteNumber(treasury.current_streak_days, 0))),
    streak_multiplier: rawMult > 0 ? rawMult : 1,
    aegis_shields: Math.max(0, Math.round(finiteNumber(treasury.aegis_shields, 0))),
  };
}

/**
 * Calcula porcentaje seguro de progreso de bóveda (0..100), protegiendo contra vault_cap_gp = 0.
 */
export function computeSafeVaultProgressPct(
  vaultCapGp: number,
  vaultRemainingGp: number
): number {
  if (!Number.isFinite(vaultCapGp) || vaultCapGp <= 0) return 0;
  const unlocked = Math.max(0, vaultCapGp - Math.max(0, vaultRemainingGp));
  return Math.min(100, Math.max(0, Math.round((unlocked / vaultCapGp) * 100)));
}
