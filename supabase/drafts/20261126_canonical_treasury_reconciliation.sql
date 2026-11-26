-- ============================================================================
-- OAKHAVEN — BORRADOR PARA REVISIÓN (NO APLICADO EN PRODUCCIÓN)
-- Reconciliación de capacidad de bóveda y sincronización de snapshot legacy
-- ============================================================================
-- Propósito:
-- 1. Garantizar que ninguna fila de `public.player_treasury` quede con
--    `vault_cap_gp = 0` cuando `vault_remaining_gp > 0`.
-- 2. Alinear `profiles.collections_state` con la fuente canónica `player_treasury`
--    para eliminar desfases cosméticos de caché (ej. bono de racha 1.25x).
--
-- NOTA: Revisar antes de ejecutar manualmente. NO altera wallet_gp ni current_xp.
-- ============================================================================

-- Verificación previa (solo lectura):
-- SELECT user_id, billing_period, wallet_gp, vault_cap_gp, vault_remaining_gp, current_xp, player_level
-- FROM public.player_treasury
-- WHERE vault_cap_gp <= 0 AND vault_remaining_gp > 0;

BEGIN;

UPDATE public.player_treasury
SET
  vault_cap_gp = GREATEST(vault_remaining_gp, GREATEST(0, wallet_gp) + vault_remaining_gp),
  updated_at = now()
WHERE vault_cap_gp <= 0
  AND vault_remaining_gp > 0;

UPDATE public.profiles p
SET
  collections_state = COALESCE(p.collections_state, '{}'::jsonb) || jsonb_build_object(
    'wallet_gp', pt.wallet_gp,
    'vault_cap_gp', pt.vault_cap_gp,
    'vault_remaining_gp', pt.vault_remaining_gp,
    'current_xp', pt.current_xp,
    'player_level', pt.player_level,
    'current_streak_days', pt.current_streak_days
  ),
  updated_at = now()
FROM public.player_treasury pt
WHERE pt.user_id = p.id
  AND pt.billing_period = to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM');

COMMIT;
