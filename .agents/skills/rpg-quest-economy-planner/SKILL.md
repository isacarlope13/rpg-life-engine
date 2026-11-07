---
name: rpg-quest-economy-planner
description: Skill especializada para diseñar misiones diarias (Quests) y la Tienda de Recompensas (Wishlist) calibradas matemáticamente al Tope de Bóveda GP mensual del usuario.
---

# Skill 8: Planificador Económico de Misiones & Tienda (`rpg-quest-economy-planner`)

## 1. Propósito y Endpoint
Se activa en el Paso 5 del Onboarding y en la recalibración de temporada:
- `POST /api/onboarding/ai` (`action: "plan_quests_and_rewards"`)
- Función asociada: `planQuestsAndRewardsWithAI` y `sanitizeQuestsAndWishlist` en `src/lib/onboarding-ai.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Inflación de la Economía GP
1. **Recompensa por Misión (`reward_gp`):**
   - Se calcula en función de `vault_cap / 28` multiplicado por la dificultad (`easy: 0.85x`, `medium: 1.0x`, `hard: 1.25x`).
   - Ninguna misión individual puede superar el 50% de `vault_cap`.
2. **Escalonamiento de la Tienda (`wishlist`):**
   - Prioridad 1 (Micro-gusto semanal): `~8%–10%` de `vault_cap`.
   - Prioridad 2 (Hobby / Habilidad): `~20%–25%` de `vault_cap`.
   - Prioridad 3 (Experiencia / Salida): `~40%–45%` de `vault_cap`.
   - Prioridad 4 (Loot Épico): `~75%–85%` de `vault_cap`.
