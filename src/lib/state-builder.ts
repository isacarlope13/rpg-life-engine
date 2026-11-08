import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DemoBoss,
  DemoLogEntry,
  DemoQuest,
  DemoWishlistItem,
  RPGEngineMemoryStore,
  createStarterUserMemoryStore,
  generateRubikScramble,
} from "./demo-store.ts";
import { ensureSupabaseUserProvisioned } from "./auth.ts";
import { resolvePlayerTreasury } from "./supabase.ts";
import type {
  BookComplexity,
  BookFormat,
  BookQuoteEntry,
  CurrencyCode,
  DebtStrategy,
  FixedCostItem,
  KnittingProject,
  PayFrequency,
  PreferredSessionTime,
  ReadingBook,
  RubikCubeCatalogItem,
  RubikCubeType,
  RubikPenalty,
  RubikSolveEntry,
  SkillDomain,
  SkillSessionRecord,
  SpecComplianceCheckItem,
  UserSkillConfig,
} from "../types/rpg.ts";
import {
  extractBookSpecsDeterministic,
  extractCubeSpecsDeterministic,
} from "./gemini.ts";
import {
  applyPersistedCollectionsToStore,
  type PersistedCollectionsPayload,
} from "./persistence-sync.ts";
import { INITIAL_FINANCIAL_MOVEMENTS } from "./initial-financial-movements.ts";

/**
 * Construye el estado del dashboard EXCLUSIVAMENTE a partir de los datos del usuario
 * indicado (userId verificado por sesión/token). Nunca parte de los datos de demo ni del
 * store compartido: el espejo base es un store inicial propio del usuario.
 */
export function buildLocalFallbackState(
  userStore: RPGEngineMemoryStore,
  fallbackReason?: string
) {
  userStore.updateBossesDoTAndEnrageStatus();
  return {
    mode: "local_engine" as const,
    ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
    onboarding_completed: userStore.onboarding_completed,
    currency: userStore.currency,
    timezone: userStore.timezone,
    pay_frequency: userStore.pay_frequency,
    pay_day: userStore.pay_day,
    savings_goal_monthly: userStore.savings_goal_monthly,
    main_goal: userStore.main_goal,
    goal_deadline: userStore.goal_deadline,
    fixed_costs: userStore.fixedCosts,
    user_skills: userStore.userSkills,
    daily_schedule: userStore.dailySchedule,
    billing_period: userStore.billing_period,
    monthly_income_cop: userStore.monthly_income_cop,
    fixed_costs_budget_cop: userStore.fixed_costs_budget_cop,
    fixed_costs_spent_cop: userStore.fixed_costs_spent_cop,
    variable_ops_budget_cop: userStore.variable_ops_budget_cop,
    variable_ops_spent_cop: userStore.variable_ops_spent_cop,
    vault_cap_gp: userStore.vault_cap_gp,
    vault_remaining_gp: userStore.vault_remaining_gp,
    wallet_gp: userStore.wallet_gp,
    total_penalty_gp: userStore.total_penalty_gp,
    debt_strategy: userStore.debt_strategy,
    debt_strategy_comparison: userStore.getDebtStrategyComparison(),
    player_level: userStore.player_level,
    current_xp: userStore.current_xp,
    current_streak_days: userStore.current_streak_days,
    streak_multiplier: userStore.streak_multiplier,
    aegis_shields: userStore.aegis_shields,
    bosses: userStore.bosses,
    ttk_projections: userStore.getBossTTKProjections(),
    quests: userStore.quests,
    skill_summaries: userStore.getSkillDomainSummaries(),
    rubik_stats: userStore.getRubikStats("3x3"),
    rubik_stats_by_cube: userStore.getAllRubikStats(),
    rubik_cubes: userStore.rubikCubes,
    next_rubik_scramble: generateRubikScramble(),
    reading_books: userStore.readingBooks,
    knitting_projects: userStore.knittingProjects,
    work_projects: userStore.workProjects,
    skill_sessions: userStore.skillSessions,
    wishlist: userStore.getDecoratedWishlist(),
    logs: userStore.logs,
    trial_checkpoints: userStore.trialCheckpoints,
    spaced_cards: userStore.spacedCards,
    unlocked_perks: userStore.unlockedPerks,
    talent_perks: userStore.getTalentPerks(),
    financial_movements: INITIAL_FINANCIAL_MOVEMENTS,
  };
}

export async function buildSupabaseEngineState(params: {
  userId: string;
  email?: string;
  displayName?: string;
  characterClass?: string;
  db: SupabaseClient;
  userStore: RPGEngineMemoryStore;
}) {
  const { userId, db, userStore } = params;

  let treasury = await resolvePlayerTreasury(userId, db);
  if (!treasury) {
    // Primer ingreso: aprovisiona los datos iniciales PROPIOS de este usuario (idempotente).
    await ensureSupabaseUserProvisioned({
      userId,
      email: params.email,
      displayName: params.displayName,
      characterClass: params.characterClass,
    });
    treasury = await resolvePlayerTreasury(userId, db);
  }
  if (!treasury) return null;
    const [
      bossesRes,
      questsRes,
      booksRes,
      knittingRes,
      solvesRes,
      wishlistRes,
      activitiesRes,
      transactionsRes,
    ] = await Promise.all([
      db
        .from("debt_bosses")
        .select("*")
        .eq("user_id", userId)
        .order("priority_order", { ascending: true }),
      db
        .from("quest_catalog")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      db
        .from("reading_books")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      db
        .from("knitting_projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
      db
        .from("rubik_solves")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60),
      db
        .from("wishlist_items")
        .select("*")
        .eq("user_id", userId)
        .order("priority", { ascending: true }),
      db
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(40),
      db
        .from("financial_transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const queryErr =
      bossesRes.error ||
      questsRes.error ||
      booksRes.error ||
      knittingRes.error ||
      solvesRes.error ||
      wishlistRes.error ||
      activitiesRes.error ||
      transactionsRes.error;

    if (queryErr) {
      throw new Error(queryErr.message);
    }

    const engineMirror = createStarterUserMemoryStore({ userId });
    engineMirror.onboarding_completed = userStore.onboarding_completed;
    engineMirror.currency = userStore.currency;
    engineMirror.timezone = userStore.timezone;
    engineMirror.pay_frequency = userStore.pay_frequency;
    engineMirror.pay_day = userStore.pay_day;
    engineMirror.savings_goal_monthly = userStore.savings_goal_monthly;
    engineMirror.main_goal = userStore.main_goal;
    engineMirror.goal_deadline = userStore.goal_deadline;
    engineMirror.fixedCosts = userStore.fixedCosts;
    engineMirror.userSkills = userStore.userSkills;

    try {
      const { data: prof } = await db
        .from("profiles")
        .select(
          "currency, timezone, pay_frequency, pay_day, savings_goal_monthly, main_goal, goal_deadline, onboarding_completed, collections_state"
        )
        .eq("id", userId)
        .maybeSingle();
      if (prof) {
        if (prof.currency) engineMirror.currency = prof.currency as CurrencyCode;
        if (prof.timezone) engineMirror.timezone = String(prof.timezone);
        if (prof.pay_frequency)
          engineMirror.pay_frequency = prof.pay_frequency as PayFrequency;
        if (prof.pay_day) engineMirror.pay_day = Number(prof.pay_day);
        if (prof.savings_goal_monthly !== undefined && prof.savings_goal_monthly !== null)
          engineMirror.savings_goal_monthly = Number(prof.savings_goal_monthly);
        if (prof.main_goal !== undefined)
          engineMirror.main_goal = prof.main_goal ? String(prof.main_goal) : null;
        if (prof.goal_deadline !== undefined)
          engineMirror.goal_deadline = prof.goal_deadline
            ? String(prof.goal_deadline)
            : null;
        if (typeof prof.onboarding_completed === "boolean")
          engineMirror.onboarding_completed = prof.onboarding_completed;
        if (prof.collections_state && typeof prof.collections_state === "object") {
          applyPersistedCollectionsToStore(
            userStore,
            prof.collections_state as Partial<PersistedCollectionsPayload>
          );
          applyPersistedCollectionsToStore(
            engineMirror,
            prof.collections_state as Partial<PersistedCollectionsPayload>
          );
        }
      }
    } catch {
      // Si las columnas extendidas de profiles aún no existen, conserva userStore
    }

    try {
      const { data: fcRows } = await db
        .from("fixed_costs")
        .select("id, name, amount, category")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });
      if (fcRows && fcRows.length > 0) {
        engineMirror.fixedCosts = fcRows.map(
          (fc): FixedCostItem => ({
            id: String(fc.id),
            name: String(fc.name),
            amount: Number(fc.amount),
            category: String(fc.category || "hogar"),
          })
        );
      }
    } catch {
      // Si fixed_costs aún no existe, conserva userStore.fixedCosts
    }

    try {
      const { data: skillRows } = await db
        .from("user_skills")
        .select("domain, label, weekly_target_minutes, preferred_session_time")
        .eq("user_id", userId);
      if (skillRows && skillRows.length > 0) {
        engineMirror.userSkills = skillRows.map(
          (sr): UserSkillConfig => ({
            domain: sr.domain as SkillDomain,
            label: String(sr.label),
            weekly_target_minutes: Number(sr.weekly_target_minutes || 120),
            preferred_session_time: (sr.preferred_session_time ||
              "noche") as PreferredSessionTime,
          })
        );
      }
    } catch {
      // Si user_skills aún no existe, conserva userStore.userSkills
    }

    engineMirror.billing_period = String(treasury.billing_period);
    engineMirror.monthly_income_cop = Number(treasury.monthly_income_cop);
    engineMirror.fixed_costs_budget_cop = Number(
      treasury.fixed_costs_budget_cop
    );
    engineMirror.fixed_costs_spent_cop = Number(treasury.fixed_costs_spent_cop);
    engineMirror.variable_ops_budget_cop = Number(
      treasury.variable_ops_budget_cop
    );
    engineMirror.variable_ops_spent_cop = Number(
      treasury.variable_ops_spent_cop
    );
    engineMirror.vault_cap_gp = Number(treasury.vault_cap_gp);
    engineMirror.vault_remaining_gp = Number(treasury.vault_remaining_gp);
    engineMirror.wallet_gp = Number(treasury.wallet_gp);
    engineMirror.total_penalty_gp = Number(treasury.total_penalty_gp);
    engineMirror.debt_strategy = (treasury.debt_strategy ||
      "snowball") as DebtStrategy;
    engineMirror.player_level = Number(treasury.player_level);
    engineMirror.current_xp = Number(treasury.current_xp);
    engineMirror.current_streak_days = Number(treasury.current_streak_days);
    engineMirror.streak_multiplier = Number(treasury.streak_multiplier);
    engineMirror.aegis_shields = Number(treasury.aegis_shields);

    if (Array.isArray(bossesRes.data)) {
      engineMirror.bosses = bossesRes.data.map(
        (b): DemoBoss => ({
          id: String(b.id),
          name: String(b.name),
          max_hp: Number(b.max_hp),
          current_hp: Number(b.current_hp),
          interest_rate_ea: Number(b.interest_rate_ea),
          min_monthly_payment_cop: Number(b.min_monthly_payment_cop),
          paid_this_month_cop: Number(b.paid_this_month_cop),
          priority_order: Number(b.priority_order),
          status: b.status as DemoBoss["status"],
        })
      );
    }

    if (questsRes.data && questsRes.data.length > 0) {
      engineMirror.quests = questsRes.data.map(
        (q): DemoQuest => ({
          code: String(q.code),
          title: String(q.title),
          domain: (q.domain || "general") as SkillDomain,
          difficulty: (q.difficulty === "trivial"
            ? "easy"
            : q.difficulty === "epic"
            ? "hard"
            : q.difficulty) as DemoQuest["difficulty"],
          reward_gp: Number(q.reward_gp),
          reward_xp: Number(q.reward_xp),
        })
      );
    }

    if (booksRes.data && booksRes.data.length > 0) {
      engineMirror.readingBooks = booksRes.data.map((b): ReadingBook => {
        const localMatch = userStore.readingBooks.find(
          (lb) =>
            lb.id === String(b.id) ||
            lb.title.toLowerCase() === String(b.title).toLowerCase()
        );
        const baseSpecs =
          localMatch ||
          extractBookSpecsDeterministic(
            `${String(b.title)} - ${String(b.author || "")}`
          );
        const meta = (b.specs_metadata || {}) as Record<string, unknown>;
        return {
          ...baseSpecs,
          id: String(b.id),
          title: String(b.title),
          author: String(b.author),
          total_pages: Number(b.total_pages),
          pages_read: Number(b.pages_read),
          status: (b.status === "completed"
            ? "completed"
            : "reading") as ReadingBook["status"],
          category: String(b.category || baseSpecs.category),
          isbn: meta.isbn ? String(meta.isbn) : baseSpecs.isbn,
          language: meta.language ? String(meta.language) : baseSpecs.language,
          total_chapters: meta.total_chapters
            ? Number(meta.total_chapters)
            : baseSpecs.total_chapters,
          complexity: (meta.complexity ||
            baseSpecs.complexity) as BookComplexity,
          estimated_hours: meta.estimated_hours
            ? Number(meta.estimated_hours)
            : baseSpecs.estimated_hours,
          recommended_daily_pages: meta.recommended_daily_pages
            ? Number(meta.recommended_daily_pages)
            : baseSpecs.recommended_daily_pages,
          gp_per_page: meta.gp_per_page
            ? Number(meta.gp_per_page)
            : baseSpecs.gp_per_page,
          completion_bonus_gp: meta.completion_bonus_gp
            ? Number(meta.completion_bonus_gp)
            : baseSpecs.completion_bonus_gp,
          xp_per_session: meta.xp_per_session
            ? Number(meta.xp_per_session)
            : baseSpecs.xp_per_session,
          key_learning_goal: meta.key_learning_goal
            ? String(meta.key_learning_goal)
            : baseSpecs.key_learning_goal,
          reading_specs_checklist: Array.isArray(meta.reading_specs_checklist)
            ? (meta.reading_specs_checklist as SpecComplianceCheckItem[])
            : baseSpecs.reading_specs_checklist,
          price_paid:
            meta.price_paid !== undefined
              ? Number(meta.price_paid)
              : localMatch?.price_paid,
          purchase_date: meta.purchase_date
            ? String(meta.purchase_date)
            : localMatch?.purchase_date,
          store_or_source: meta.store_or_source
            ? String(meta.store_or_source)
            : localMatch?.store_or_source,
          cover_url: meta.cover_url
            ? String(meta.cover_url)
            : localMatch?.cover_url,
          cover_color: meta.cover_color
            ? String(meta.cover_color)
            : localMatch?.cover_color,
          synopsis: meta.synopsis
            ? String(meta.synopsis)
            : localMatch?.synopsis,
          format: (meta.format ||
            localMatch?.format ||
            "fisico") as BookFormat,
          rating:
            meta.rating !== undefined
              ? Number(meta.rating)
              : localMatch?.rating,
          personal_review: meta.personal_review
            ? String(meta.personal_review)
            : localMatch?.personal_review,
          quotes: Array.isArray(meta.quotes)
            ? (meta.quotes as BookQuoteEntry[])
            : localMatch?.quotes || [],
        };
      });
    } else {
      engineMirror.readingBooks = userStore.readingBooks;
    }

    try {
      const { data: cubesData, error: cubesErr } = await db
        .from("rubik_cubes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!cubesErr && cubesData && cubesData.length > 0) {
        engineMirror.rubikCubes = cubesData.map(
          (c): RubikCubeCatalogItem => {
            const localCube = userStore.rubikCubes.find(
              (lc) =>
                lc.id === String(c.id) ||
                lc.model_name.toLowerCase() ===
                  String(c.model_name).toLowerCase()
            );
            const base = extractCubeSpecsDeterministic(String(c.model_name));
            return {
              id: String(c.id),
              cube_type: (c.cube_type || base.cube_type) as RubikCubeType,
              brand: String(c.brand || base.brand),
              model_name: String(c.model_name),
              magnetic_system: String(
                c.magnetic_system || base.magnetic_system
              ),
              surface_finish: String(c.surface_finish || base.surface_finish),
              size_mm: Number(c.size_mm || base.size_mm),
              weight_grams: Number(c.weight_grams || base.weight_grams),
              wca_legal:
                c.wca_legal !== null && c.wca_legal !== undefined
                  ? Boolean(c.wca_legal)
                  : base.wca_legal,
              recommended_setup: String(
                c.recommended_setup || base.recommended_setup
              ),
              target_sub_seconds: Number(
                c.target_sub_seconds || base.target_sub_seconds
              ),
              recommended_alg_set: String(
                c.recommended_alg_set || base.recommended_alg_set
              ),
              reward_gp_per_solve: Number(
                c.reward_gp_per_solve || base.reward_gp_per_solve
              ),
              pb_bonus_gp: Number(c.pb_bonus_gp || base.pb_bonus_gp),
              specs_compliance_checklist: Array.isArray(
                c.specs_compliance_checklist
              ) && c.specs_compliance_checklist.length > 0
                ? (c.specs_compliance_checklist as SpecComplianceCheckItem[])
                : base.specs_compliance_checklist,
              status: (c.status || "active_main") as
                | "active_main"
                | "secondary"
                | "retired",
              created_at: String(c.created_at),
              price_paid:
                c.price_paid !== undefined && c.price_paid !== null
                  ? Number(c.price_paid)
                  : localCube?.price_paid,
              purchase_date: c.purchase_date
                ? String(c.purchase_date)
                : localCube?.purchase_date,
              store_or_source: c.store_or_source
                ? String(c.store_or_source)
                : localCube?.store_or_source,
            };
          }
        );
      } else {
        engineMirror.rubikCubes = userStore.rubikCubes;
      }
    } catch {
      // Si la tabla rubik_cubes aún no existe en Supabase, conserva el Arsenal en memoria (incluyendo nuevos cubos añadidos)
      engineMirror.rubikCubes = userStore.rubikCubes;
    }

    if (knittingRes.data && knittingRes.data.length > 0) {
      engineMirror.knittingProjects = knittingRes.data.map(
        (k): KnittingProject => ({
          id: String(k.id),
          name: String(k.name),
          technique: (k.technique || "Crochet") as KnittingProject["technique"],
          total_rows_target: Number(k.total_rows_target),
          completed_rows: Number(k.completed_rows),
          yarn_details: String(k.yarn_details || ""),
          status: (k.status === "completed"
            ? "completed"
            : "in_progress") as KnittingProject["status"],
        })
      );
    }

    if (solvesRes.data && solvesRes.data.length > 0) {
      engineMirror.rubikSolves = solvesRes.data.map((s): RubikSolveEntry => {
        const localSolve = userStore.rubikSolves.find(
          (ls) =>
            ls.scramble === String(s.scramble) &&
            ls.time_seconds === Number(s.time_seconds)
        );
        return {
          id: String(s.id),
          cube_type: (s.cube_type || "3x3") as RubikCubeType,
          cube_id: localSolve?.cube_id,
          cube_model: s.cube_model
            ? String(s.cube_model)
            : localSolve?.cube_model,
          time_seconds: Number(s.time_seconds),
          penalty: (s.penalty || "NONE") as RubikPenalty,
          scramble: String(s.scramble),
          is_pb: Boolean(s.is_pb),
          ao5_after:
            s.ao5_after !== null && s.ao5_after !== undefined
              ? Number(s.ao5_after)
              : null,
          ao12_after:
            s.ao12_after !== null && s.ao12_after !== undefined
              ? Number(s.ao12_after)
              : null,
          algorithm_practiced: s.algorithm_practiced
            ? String(s.algorithm_practiced)
            : undefined,
          timestamp: String(s.created_at),
        };
      });
    }

    if (wishlistRes.data && wishlistRes.data.length > 0) {
      engineMirror.wishlist = wishlistRes.data.map(
        (w): DemoWishlistItem => ({
          id: String(w.id),
          name: String(w.name),
          cost_gp: Number(w.cost_gp),
          priority: Number(w.priority),
          is_redeemed: Boolean(w.is_redeemed),
        })
      );
    }

    if (activitiesRes.data && activitiesRes.data.length > 0) {
      engineMirror.skillSessions = activitiesRes.data.map(
        (a): SkillSessionRecord => ({
          id: String(a.id),
          domain: (a.domain || "general") as SkillDomain,
          title: String(a.activity_name),
          duration_minutes: Number(a.duration_minutes || 25),
          gp_earned: Number(a.transferred_gp),
          xp_earned: Number(a.earned_xp),
          details: String(
            a.notes ||
              `Multiplicador ${Number(a.streak_multiplier_applied)}x • +${Number(
                a.earned_xp
              )} XP`
          ),
          metadata: (a.session_metadata || {}) as SkillSessionRecord["metadata"],
          timestamp: String(a.completed_at),
        })
      );
    }

    const activityLogs: DemoLogEntry[] = (activitiesRes.data || []).map((a) => ({
      id: String(a.id),
      type: "activity",
      domain: (a.domain || "general") as SkillDomain,
      title: String(a.activity_name),
      subtitle: `Buff ${Number(a.streak_multiplier_applied)}x • +${Number(
        a.earned_xp
      )} XP${a.shield_earned ? " • 🛡️ +1 Escudo Aegis!" : ""}`,
      gp_delta: Number(a.transferred_gp),
      timestamp: String(a.completed_at),
    }));

    const txLogs: DemoLogEntry[] = (transactionsRes.data || []).map((t) => ({
      id: String(t.id),
      type: "expense",
      title: String(t.merchant_or_concept),
      subtitle:
        t.category === "discretionary_unbudgeted"
          ? t.aegis_shield_used
            ? `🛡️ Escudo Aegis activado (Pagaste 1.0x: ${Number(
                t.wallet_gp_deducted
              ).toLocaleString("es-CO")} GP)`
            : `🔥 Castigo 1.2x (Multa: ${Number(
                t.penalty_gp_applied
              ).toLocaleString("es-CO")} GP)`
          : `Categoría: ${String(t.category)} ($${Number(
              t.amount_cop
            ).toLocaleString("es-CO")})`,
      gp_delta: Number(t.wallet_gp_deducted) > 0 ? -Number(t.wallet_gp_deducted) : 0,
      timestamp: String(t.created_at),
    }));

    engineMirror.logs = [...activityLogs, ...txLogs].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    engineMirror.updateBossesDoTAndEnrageStatus();

    // Sincronizar espejo userStore en memoria para que todos los endpoints (/api/shortcuts/*) operen sobre el estado real de Supabase
    userStore.bosses = [...engineMirror.bosses];
    userStore.wallet_gp = engineMirror.wallet_gp;
    userStore.vault_remaining_gp = engineMirror.vault_remaining_gp;
    userStore.vault_cap_gp = engineMirror.vault_cap_gp;
    userStore.current_xp = engineMirror.current_xp;
    userStore.player_level = engineMirror.player_level;
    userStore.current_streak_days = engineMirror.current_streak_days;
    userStore.streak_multiplier = engineMirror.streak_multiplier;
    userStore.aegis_shields = engineMirror.aegis_shields;
    userStore.debt_strategy = engineMirror.debt_strategy;
    userStore.quests = [...engineMirror.quests];
    userStore.readingBooks = [...engineMirror.readingBooks];
    userStore.knittingProjects = [...engineMirror.knittingProjects];
    userStore.rubikCubes = [...engineMirror.rubikCubes];
    userStore.wishlist = [...engineMirror.wishlist];
    userStore.fixedCosts = [...engineMirror.fixedCosts];
    userStore.userSkills = [...engineMirror.userSkills];

    return {
      mode: "supabase" as const,
      onboarding_completed: engineMirror.onboarding_completed,
      currency: engineMirror.currency,
      timezone: engineMirror.timezone,
      pay_frequency: engineMirror.pay_frequency,
      pay_day: engineMirror.pay_day,
      savings_goal_monthly: engineMirror.savings_goal_monthly,
      main_goal: engineMirror.main_goal,
      goal_deadline: engineMirror.goal_deadline,
      fixed_costs: engineMirror.fixedCosts,
      user_skills: engineMirror.userSkills,
      daily_schedule: userStore.dailySchedule,
      billing_period: engineMirror.billing_period,
      monthly_income_cop: engineMirror.monthly_income_cop,
      fixed_costs_budget_cop: engineMirror.fixed_costs_budget_cop,
      fixed_costs_spent_cop: engineMirror.fixed_costs_spent_cop,
      variable_ops_budget_cop: engineMirror.variable_ops_budget_cop,
      variable_ops_spent_cop: engineMirror.variable_ops_spent_cop,
      vault_cap_gp: engineMirror.vault_cap_gp,
      vault_remaining_gp: engineMirror.vault_remaining_gp,
      wallet_gp: engineMirror.wallet_gp,
      total_penalty_gp: engineMirror.total_penalty_gp,
      debt_strategy: engineMirror.debt_strategy,
      debt_strategy_comparison: engineMirror.getDebtStrategyComparison(),
      player_level: engineMirror.player_level,
      current_xp: engineMirror.current_xp,
      current_streak_days: engineMirror.current_streak_days,
      streak_multiplier: engineMirror.streak_multiplier,
      aegis_shields: engineMirror.aegis_shields,
      bosses: engineMirror.bosses,
      ttk_projections: engineMirror.getBossTTKProjections(),
      quests: engineMirror.quests,
      skill_summaries: engineMirror.getSkillDomainSummaries(),
      rubik_stats: engineMirror.getRubikStats("3x3"),
      rubik_stats_by_cube: engineMirror.getAllRubikStats(),
      rubik_cubes: engineMirror.rubikCubes,
      next_rubik_scramble: generateRubikScramble(),
      reading_books: engineMirror.readingBooks,
      knitting_projects: engineMirror.knittingProjects,
      work_projects: userStore.workProjects,
      skill_sessions: engineMirror.skillSessions,
      wishlist: engineMirror.getDecoratedWishlist(),
      logs: engineMirror.logs,
      trial_checkpoints: userStore.trialCheckpoints,
      spaced_cards: userStore.spacedCards,
      unlocked_perks: userStore.unlockedPerks,
      talent_perks: userStore.getTalentPerks(),
      financial_movements: INITIAL_FINANCIAL_MOVEMENTS,
    };
}
