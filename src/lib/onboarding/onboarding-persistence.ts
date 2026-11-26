import type { OnboardingPayload, SkillDomain } from "@/types/rpg";

export interface OnboardingSectionOutcome {
  ok: boolean;
  mode: "created" | "updated" | "preserved" | "skipped" | "error";
  error?: string;
}

export interface SafeOnboardingPersistenceResult {
  ok: boolean;
  onboardingMode: "initial" | "edit";
  preservedProgress: boolean;
  partialErrors: Array<{ section: string; message: string }>;
  sections: {
    profile: OnboardingSectionOutcome;
    treasury: OnboardingSectionOutcome;
    fixed_costs: OnboardingSectionOutcome;
    bosses: OnboardingSectionOutcome;
    skills: OnboardingSectionOutcome;
    quests: OnboardingSectionOutcome;
    wishlist: OnboardingSectionOutcome;
  };
}

export interface ExtendedOnboardingInput extends OnboardingPayload {
  /** Confirmación humana explícita requerida para reemplazar/archivar listas existentes */
  confirm_destructive_replace?: boolean;
  /** Activación del módulo real de Cine y Series (separado del enum SkillDomain) */
  cinema_enabled?: boolean;
  /** Ingresos múltiples/variables declarados por el usuario */
  income_sources?: Array<{
    label: string;
    amount_cop: number;
    pay_day: number;
    is_variable?: boolean;
  }>;
  /** Rutina diaria adaptable (America/Bogota) */
  routine?: {
    wake_time: string;
    sleep_time: string;
    work_start: string;
    work_end: string;
    timezone: string;
  };
}

export const VALID_SKILL_DOMAINS: readonly SkillDomain[] = [
  "rubik",
  "reading",
  "knitting",
  "study",
  "work",
  "gaming",
  "sports",
  "journaling",
  "gardening",
  "drawing",
  "ceramics",
  "hiking",
  "cooking",
  "general",
] as const;

export function sanitizeSkillDomain(raw: string): SkillDomain {
  return (VALID_SKILL_DOMAINS as readonly string[]).includes(raw)
    ? (raw as SkillDomain)
    : "general";
}

export interface TreasuryPatch {
  user_id: string;
  billing_period: string;
  monthly_income_cop: number;
  fixed_costs_budget_cop: number;
  variable_ops_budget_cop: number;
  vault_cap_gp: number;
  debt_strategy: "snowball" | "avalanche";
  // Campos solo presentes en creación inicial (NUNCA sobrescritos si ya existe progreso)
  fixed_costs_spent_cop?: number;
  variable_ops_spent_cop?: number;
  vault_remaining_gp?: number;
  wallet_gp?: number;
  total_penalty_gp?: number;
  player_level?: number;
  current_xp?: number;
  current_streak_days?: number;
  streak_multiplier?: number;
  aegis_shields?: number;
}

/**
 * Construye el payload seguro para player_treasury:
 * - Si NO existe registro previo (cuenta nueva): inicializa nivel 1, XP 0, GP 0.
 * - Si YA existe registro previo (re-ejecución / edición): PRESERVA intactos
 *   wallet_gp, player_level, current_xp, current_streak_days, spent_cop y escudos.
 */
export function buildSafeTreasuryPatch(params: {
  userId: string;
  billingPeriod: string;
  existingTreasury: Record<string, unknown> | null;
  monthlyIncome: number;
  totalFixed: number;
  variableOps: number;
  vaultCap: number;
  debtStrategy: "snowball" | "avalanche";
}): { patch: TreasuryPatch; mode: "initial" | "edit" } {
  const safeVaultCap = Math.max(0, Math.round(params.vaultCap));

  if (params.existingTreasury) {
    const existingCap = Math.max(0, Math.round(Number(params.existingTreasury.vault_cap_gp) || 0));
    const existingRemaining = Math.max(
      0,
      Math.round(Number(params.existingTreasury.vault_remaining_gp) || 0)
    );
    // Nunca sobreescribir vault_cap_gp a 0 cuando ya existe capacidad o saldo en bóveda
    const effectiveVaultCap =
      safeVaultCap > 0 ? safeVaultCap : Math.max(existingCap, existingRemaining);
    return {
      mode: "edit",
      patch: {
        user_id: params.userId,
        billing_period: params.billingPeriod,
        monthly_income_cop: params.monthlyIncome,
        fixed_costs_budget_cop: params.totalFixed,
        variable_ops_budget_cop: params.variableOps,
        vault_cap_gp: effectiveVaultCap,
        debt_strategy: params.debtStrategy,
      },
    };
  }

  return {
    mode: "initial",
    patch: {
      user_id: params.userId,
      billing_period: params.billingPeriod,
      monthly_income_cop: params.monthlyIncome,
      fixed_costs_budget_cop: params.totalFixed,
      fixed_costs_spent_cop: 0,
      variable_ops_budget_cop: params.variableOps,
      variable_ops_spent_cop: 0,
      vault_cap_gp: safeVaultCap,
      vault_remaining_gp: safeVaultCap,
      wallet_gp: 0,
      total_penalty_gp: 0,
      debt_strategy: params.debtStrategy,
      player_level: 1,
      current_xp: 0,
      current_streak_days: 0,
      streak_multiplier: 1.0,
      aegis_shields: 1,
    },
  };
}

/**
 * Calcula un diff aditivo/idempotente por clave normalizada sin borrado masivo ciego.
 * Solo elimina filas ausentes si confirmDestructiveReplace === true.
 */
export function computeIdempotentCollectionDiff<
  TExisting extends { id: string },
  TIncoming
>(params: {
  existing: TExisting[];
  incoming: TIncoming[];
  getExistingKey: (row: TExisting) => string;
  getIncomingKey: (row: TIncoming) => string;
  confirmDestructiveReplace?: boolean;
}): {
  toInsert: TIncoming[];
  toUpdate: Array<{ id: string; incoming: TIncoming }>;
  toDeleteIds: string[];
} {
  const existingByKey = new Map<string, TExisting>();
  for (const row of params.existing) {
    const k = params.getExistingKey(row).trim().toLowerCase();
    if (k && !existingByKey.has(k)) existingByKey.set(k, row);
  }

  const seenIncomingKeys = new Set<string>();
  const toInsert: TIncoming[] = [];
  const toUpdate: Array<{ id: string; incoming: TIncoming }> = [];

  for (const item of params.incoming) {
    const k = params.getIncomingKey(item).trim().toLowerCase();
    if (!k || seenIncomingKeys.has(k)) continue; // Deduplicar entradas repetidas en el payload
    seenIncomingKeys.add(k);

    const match = existingByKey.get(k);
    if (match) {
      toUpdate.push({ id: match.id, incoming: item });
    } else {
      toInsert.push(item);
    }
  }

  const toDeleteIds: string[] = [];
  if (params.confirmDestructiveReplace === true) {
    for (const [k, row] of existingByKey.entries()) {
      if (!seenIncomingKeys.has(k)) {
        toDeleteIds.push(row.id);
      }
    }
  }

  return { toInsert, toUpdate, toDeleteIds };
}

/**
 * Persistencia segura de onboarding en Supabase con aislamiento estricto por user_id
 * (seguro incluso bajo service_role), preservación de progreso y reporte de errores parciales.
 */
export async function persistOnboardingSafely(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  userId: string;
  email: string;
  fallbackCharacterClass: string;
  fallbackAvatarUrl: string | null;
  body: ExtendedOnboardingInput;
  cleanName: string;
  monthlyIncome: number;
  totalFixed: number;
  variableOps: number;
  vaultCap: number;
}): Promise<SafeOnboardingPersistenceResult> {
  const {
    db,
    userId,
    email,
    fallbackCharacterClass,
    fallbackAvatarUrl,
    body,
    cleanName,
    monthlyIncome,
    totalFixed,
    variableOps,
    vaultCap,
  } = params;

  const billingPeriod = new Date().toISOString().slice(0, 7);
  const partialErrors: Array<{ section: string; message: string }> = [];
  const confirmReplace = body.confirm_destructive_replace === true;

  const sections: SafeOnboardingPersistenceResult["sections"] = {
    profile: { ok: false, mode: "skipped" },
    treasury: { ok: false, mode: "skipped" },
    fixed_costs: { ok: true, mode: "skipped" },
    bosses: { ok: true, mode: "skipped" },
    skills: { ok: true, mode: "skipped" },
    quests: { ok: true, mode: "skipped" },
    wishlist: { ok: true, mode: "skipped" },
  };

  // 1. Verificar si ya existe tesorería para distinguir creación inicial vs edición
  let existingTreasury: Record<string, unknown> | null = null;
  try {
    const { data } = await db
      .from("player_treasury")
      .select("user_id,billing_period,wallet_gp,player_level,current_xp,current_streak_days")
      .eq("user_id", userId)
      .eq("billing_period", billingPeriod)
      .maybeSingle();
    existingTreasury = data || null;
  } catch {
    existingTreasury = null;
  }

  const { patch: treasuryPatch, mode: onboardingMode } = buildSafeTreasuryPatch({
    userId,
    billingPeriod,
    existingTreasury,
    monthlyIncome,
    totalFixed,
    variableOps,
    vaultCap,
    debtStrategy: body.debt_strategy === "avalanche" ? "avalanche" : "snowball",
  });

  // 2. Perfil del usuario (upsert por id === userId)
  try {
    const { error: profErr } = await db.from("profiles").upsert(
      {
        id: userId,
        email,
        display_name: cleanName,
        profession: body.profession?.trim() || "Arquitecta de Sistemas y Equilibrio",
        character_class: body.character_class?.trim() || fallbackCharacterClass,
        avatar_url: body.avatar_url ?? fallbackAvatarUrl,
        currency: body.currency || "COP",
        timezone: body.timezone || "America/Bogota",
        pay_frequency: body.pay_frequency || "monthly",
        pay_day: Math.min(31, Math.max(1, Math.round(body.pay_day || 1))),
        savings_goal_monthly: Math.max(0, Math.round(Number(body.savings_goal_monthly) || 0)),
        main_goal: body.main_goal?.trim() || null,
        goal_deadline: body.goal_deadline?.trim() || null,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (profErr) {
      const { error: fallbackErr } = await db.from("profiles").upsert(
        {
          id: userId,
          email,
          display_name: cleanName,
          character_class: body.character_class?.trim() || fallbackCharacterClass,
          avatar_url: body.avatar_url ?? fallbackAvatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (fallbackErr) throw fallbackErr;
    }
    sections.profile = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al guardar perfil";
    sections.profile = { ok: false, mode: "error", error: msg };
    partialErrors.push({ section: "profile", message: msg });
  }

  // 3. Tesorería: UPDATE selectivo si ya existe (preserva GP/XP/Nivel/Racha), INSERT si es nueva
  try {
    if (onboardingMode === "edit") {
      const { error: updErr } = await db
        .from("player_treasury")
        .update({
          monthly_income_cop: treasuryPatch.monthly_income_cop,
          fixed_costs_budget_cop: treasuryPatch.fixed_costs_budget_cop,
          variable_ops_budget_cop: treasuryPatch.variable_ops_budget_cop,
          vault_cap_gp: treasuryPatch.vault_cap_gp,
          debt_strategy: treasuryPatch.debt_strategy,
        })
        .eq("user_id", userId)
        .eq("billing_period", billingPeriod);
      if (updErr) throw updErr;
      sections.treasury = { ok: true, mode: "preserved" };
    } else {
      const { error: insErr } = await db
        .from("player_treasury")
        .upsert(treasuryPatch, { onConflict: "user_id,billing_period" });
      if (insErr) throw insErr;
      sections.treasury = { ok: true, mode: "created" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al guardar tesorería";
    sections.treasury = { ok: false, mode: "error", error: msg };
    partialErrors.push({ section: "treasury", message: msg });
  }

  // 4. Costos fijos (diff no destructivo por nombre)
  const fixedCosts = Array.isArray(body.fixed_costs) ? body.fixed_costs : [];
  if (fixedCosts.length > 0) {
    try {
      const { data: existingRows } = await db
        .from("fixed_costs")
        .select("id,name")
        .eq("user_id", userId);
      const diff = computeIdempotentCollectionDiff({
        existing: Array.isArray(existingRows) ? existingRows : [],
        incoming: fixedCosts,
        getExistingKey: (r: { id: string; name?: string }) => String(r.name || ""),
        getIncomingKey: (r) => r.name || "",
        confirmDestructiveReplace: confirmReplace,
      });

      for (const u of diff.toUpdate) {
        await db
          .from("fixed_costs")
          .update({
            amount: Math.max(0, Math.round(Number(u.incoming.amount) || 0)),
            category: u.incoming.category || "hogar",
          })
          .eq("id", u.id)
          .eq("user_id", userId);
      }
      if (diff.toInsert.length > 0) {
        await db.from("fixed_costs").insert(
          diff.toInsert.map((fc, idx) => ({
            user_id: userId,
            name: fc.name.trim() || `Costo Fijo ${idx + 1}`,
            amount: Math.max(0, Math.round(Number(fc.amount) || 0)),
            category: fc.category || "hogar",
          }))
        );
      }
      if (diff.toDeleteIds.length > 0) {
        await db.from("fixed_costs").delete().eq("user_id", userId).in("id", diff.toDeleteIds);
      }
      sections.fixed_costs = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en costos fijos";
      sections.fixed_costs = { ok: false, mode: "error", error: msg };
      partialErrors.push({ section: "fixed_costs", message: msg });
    }
  }

  // 5. Deudas / Bosses (diff no destructivo por nombre; preserva pagos ya realizados)
  const validBosses = (body.bosses || []).filter((b) => b.name?.trim() && Number(b.total_balance) > 0);
  if (validBosses.length > 0 || confirmReplace) {
    try {
      const { data: existingBosses } = await db
        .from("debt_bosses")
        .select("id,name")
        .eq("user_id", userId);
      const diff = computeIdempotentCollectionDiff({
        existing: Array.isArray(existingBosses) ? existingBosses : [],
        incoming: validBosses,
        getExistingKey: (r: { id: string; name?: string }) => String(r.name || ""),
        getIncomingKey: (r) => r.name || "",
        confirmDestructiveReplace: confirmReplace,
      });

      for (const u of diff.toUpdate) {
        await db
          .from("debt_bosses")
          .update({
            interest_rate_ea: Math.max(0, Number(u.incoming.interest_rate_ea) || 0),
            min_monthly_payment_cop: Math.max(0, Math.round(Number(u.incoming.min_monthly_payment) || 0)),
          })
          .eq("id", u.id)
          .eq("user_id", userId);
      }
      if (diff.toInsert.length > 0) {
        await db.from("debt_bosses").insert(
          diff.toInsert.map((b, idx) => {
            const bal = Math.round(Number(b.total_balance));
            return {
              user_id: userId,
              name: b.name.trim(),
              max_hp: bal,
              current_hp: bal,
              interest_rate_ea: Math.max(0, Number(b.interest_rate_ea) || 0),
              min_monthly_payment_cop: Math.max(0, Math.round(Number(b.min_monthly_payment) || 0)),
              paid_this_month_cop: 0,
              priority_order: idx + 1,
              status: "active",
            };
          })
        );
      }
      if (diff.toDeleteIds.length > 0) {
        await db.from("debt_bosses").delete().eq("user_id", userId).in("id", diff.toDeleteIds);
      }
      sections.bosses = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en deudas";
      sections.bosses = { ok: false, mode: "error", error: msg };
      partialErrors.push({ section: "bosses", message: msg });
    }
  }

  // 6. Habilidades (diff no destructivo por dominio canónico válido; nunca inserta enums inválidos)
  const validSkills = (body.skills || []).map((s) => ({
    ...s,
    domain: sanitizeSkillDomain(String(s.domain)),
  }));
  if (validSkills.length > 0) {
    try {
      const { data: existingSkills } = await db
        .from("user_skills")
        .select("id,domain")
        .eq("user_id", userId);
      const diff = computeIdempotentCollectionDiff({
        existing: Array.isArray(existingSkills) ? existingSkills : [],
        incoming: validSkills,
        getExistingKey: (r: { id: string; domain?: string }) => String(r.domain || ""),
        getIncomingKey: (r) => r.domain,
        confirmDestructiveReplace: confirmReplace,
      });

      for (const u of diff.toUpdate) {
        await db
          .from("user_skills")
          .update({
            label: u.incoming.label,
            weekly_target_minutes: Math.max(15, Math.round(Number(u.incoming.weekly_target_minutes) || 120)),
            preferred_session_time: u.incoming.preferred_session_time || "noche",
            custom_description: u.incoming.custom_description || null,
          })
          .eq("id", u.id)
          .eq("user_id", userId);
      }
      if (diff.toInsert.length > 0) {
        await db.from("user_skills").insert(
          diff.toInsert.map((s) => ({
            user_id: userId,
            domain: s.domain,
            label: s.label,
            weekly_target_minutes: Math.max(15, Math.round(Number(s.weekly_target_minutes) || 120)),
            preferred_session_time: s.preferred_session_time || "noche",
            custom_description: s.custom_description || null,
          }))
        );
      }
      if (diff.toDeleteIds.length > 0) {
        await db.from("user_skills").delete().eq("user_id", userId).in("id", diff.toDeleteIds);
      }
      sections.skills = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en habilidades";
      sections.skills = { ok: false, mode: "error", error: msg };
      partialErrors.push({ section: "skills", message: msg });
    }
  }

  // 7. Misiones (diff no destructivo por code)
  const validQuests = (body.quests || []).filter((q) => q.title?.trim() && Number(q.reward_gp) > 0);
  if (validQuests.length > 0) {
    try {
      const { data: existingQuests } = await db
        .from("quest_catalog")
        .select("id,code")
        .eq("user_id", userId);
      const diff = computeIdempotentCollectionDiff({
        existing: Array.isArray(existingQuests) ? existingQuests : [],
        incoming: validQuests,
        getExistingKey: (r: { id: string; code?: string }) => String(r.code || ""),
        getIncomingKey: (r) => r.code || r.title,
        confirmDestructiveReplace: confirmReplace,
      });

      if (diff.toInsert.length > 0) {
        await db.from("quest_catalog").insert(
          diff.toInsert.map((q, idx) => ({
            user_id: userId,
            code: (q.code || `QUEST_${idx + 1}`).slice(0, 50),
            title: q.title.trim().slice(0, 150),
            domain: ["rubik", "reading", "knitting", "study", "work", "general"].includes(q.domain)
              ? q.domain
              : "general",
            difficulty: q.difficulty || "medium",
            reward_gp: Math.max(1, Math.round(Number(q.reward_gp))),
            reward_xp: Math.max(10, Math.round(Number(q.reward_xp) || 85)),
            daily_limit: 1,
            is_active: true,
          }))
        );
      }
      sections.quests = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en misiones";
      sections.quests = { ok: false, mode: "error", error: msg };
      partialErrors.push({ section: "quests", message: msg });
    }
  }

  // 8. Wishlist (diff no destructivo por nombre; nunca borra recompensas ya canjeadas)
  const validWishes = (body.wishlist || []).filter((w) => w.name?.trim() && Number(w.cost_gp) > 0);
  if (validWishes.length > 0) {
    try {
      const { data: existingWishes } = await db
        .from("wishlist_items")
        .select("id,name")
        .eq("user_id", userId);
      const diff = computeIdempotentCollectionDiff({
        existing: Array.isArray(existingWishes) ? existingWishes : [],
        incoming: validWishes,
        getExistingKey: (r: { id: string; name?: string }) => String(r.name || ""),
        getIncomingKey: (r) => r.name || "",
        confirmDestructiveReplace: confirmReplace,
      });

      if (diff.toInsert.length > 0) {
        await db.from("wishlist_items").insert(
          diff.toInsert.map((w, idx) => ({
            user_id: userId,
            name: w.name.trim(),
            cost_gp: Math.max(1, Math.round(Number(w.cost_gp))),
            priority: Math.min(5, Math.max(1, Math.round(Number(w.priority) || idx + 1))),
            is_redeemed: false,
          }))
        );
      }
      sections.wishlist = { ok: true, mode: onboardingMode === "edit" ? "updated" : "created" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error en wishlist";
      sections.wishlist = { ok: false, mode: "error", error: msg };
      partialErrors.push({ section: "wishlist", message: msg });
    }
  }

  return {
    ok: partialErrors.length === 0,
    onboardingMode,
    preservedProgress: onboardingMode === "edit",
    partialErrors,
    sections,
  };
}
