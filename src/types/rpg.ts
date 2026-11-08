export type ExpenseCategory =
  | "fixed_mandatory"
  | "variable_operational"
  | "debt_attack"
  | "discretionary_wishlist"
  | "discretionary_unbudgeted";

export type BossName = string;

export type CurrencyCode = "COP" | "USD" | "EUR" | "MXN";

export type PayFrequency = "monthly" | "biweekly" | "weekly";

export type PreferredSessionTime = "manana" | "tarde" | "noche";

export type SkillDomain =
  | "rubik"
  | "reading"
  | "knitting"
  | "study"
  | "work"
  | "gaming"
  | "sports"
  | "general";

export type DebtStrategy = "snowball" | "avalanche";

export type RubikCubeType = "3x3" | "2x2" | "4x4" | "Pyraminx" | "Megaminx";

export type RubikPenalty = "NONE" | "+2" | "DNF";

export type BookComplexity = "ligero" | "intermedio" | "denso_tecnico";

export interface SpecComplianceCheckItem {
  code: string;
  label: string;
  requirement: string;
  fulfilled: boolean;
}

export type BookFormat = "fisico" | "kindle_digital" | "audiolibro";

export interface ExtractedCubeSpecsAI {
  cube_type: RubikCubeType;
  brand: string;
  model_name: string;
  magnetic_system: string;
  surface_finish: string;
  size_mm: number;
  weight_grams: number;
  wca_legal: boolean;
  recommended_setup: string;
  target_sub_seconds: number;
  recommended_alg_set: string;
  reward_gp_per_solve: number;
  pb_bonus_gp: number;
  specs_compliance_checklist: SpecComplianceCheckItem[];
  // Información adicional generada por IA para compra y rendimiento
  estimated_market_price_cop?: number;
  recommended_store?: string;
  release_tier?: string;
  turning_feel_and_cutting?: string;
  pro_cuber_notes?: string;
  maintenance_guide?: string;
  price_paid?: number;
  purchase_date?: string;
  store_or_source?: string;
}

export interface RubikCubeCatalogItem extends ExtractedCubeSpecsAI {
  id: string;
  status: "active_main" | "secondary" | "retired";
  price_paid?: number;
  purchase_date?: string;
  store_or_source?: string;
  custom_notes?: string;
  maintenance_needs?: string;
  created_at?: string;
}

export interface ExtractedBookSpecsAI {
  title: string;
  author: string;
  isbn: string;
  language: string;
  total_pages: number;
  total_chapters: number;
  category: string;
  complexity: BookComplexity;
  estimated_hours: number;
  recommended_daily_pages: number;
  gp_per_page: number;
  completion_bonus_gp: number;
  xp_per_session: number;
  key_learning_goal: string;
  reading_specs_checklist: SpecComplianceCheckItem[];
  // Información adicional generada por IA para Galería, Citas y Compra
  cover_url?: string;
  cover_color?: string;
  synopsis?: string;
  author_bio_short?: string;
  famous_quote?: string;
  practical_takeaways?: string[];
  estimated_market_price_cop?: number;
  recommended_store?: string;
  format?: BookFormat;
  price_paid?: number;
  purchase_date?: string;
  store_or_source?: string;
}

export interface RubikSolveEntry {
  id: string;
  cube_type: RubikCubeType;
  cube_id?: string;
  cube_model?: string;
  time_seconds: number;
  penalty?: RubikPenalty;
  scramble: string;
  is_pb: boolean;
  ao5_after: number | null;
  ao12_after: number | null;
  algorithm_practiced?: string;
  timestamp: string;
}

export interface BookQuoteEntry {
  id: string;
  text: string;
  page?: number;
  created_at: string;
}

export interface ReadingBook {
  id: string;
  title: string;
  author: string;
  total_pages: number;
  pages_read: number;
  status: "reading" | "completed" | "wishlist";
  category: string;
  isbn?: string;
  language?: string;
  total_chapters?: number;
  complexity?: BookComplexity;
  estimated_hours?: number;
  recommended_daily_pages?: number;
  gp_per_page?: number;
  completion_bonus_gp?: number;
  xp_per_session?: number;
  key_learning_goal?: string;
  reading_specs_checklist?: SpecComplianceCheckItem[];
  // Campos de Compra y Galería de Libros
  price_paid?: number;
  purchase_date?: string;
  store_or_source?: string;
  cover_url?: string;
  cover_color?: string;
  synopsis?: string;
  author_bio_short?: string;
  famous_quote?: string;
  practical_takeaways?: string[];
  estimated_market_price_cop?: number;
  recommended_store?: string;
  format?: BookFormat;
  rating?: number;
  personal_review?: string;
  quotes?: BookQuoteEntry[];
}

export interface KnittingProject {
  id: string;
  name: string;
  technique: "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar";
  total_rows_target: number;
  completed_rows: number;
  yarn_details: string;
  status: "in_progress" | "completed";
}

export interface SkillSessionRecord {
  id: string;
  domain: SkillDomain;
  title: string;
  duration_minutes: number;
  gp_earned: number;
  xp_earned: number;
  details: string;
  metadata?: {
    // Rubik
    cube_type?: string;
    cube_id?: string;
    cube_model?: string;
    best_time_seconds?: number;
    penalty?: RubikPenalty;
    solves_count?: number;
    algorithm_learned?: string;
    // Reading
    book_id?: string;
    book_title?: string;
    pages_read?: number;
    // Knitting
    project_id?: string;
    project_name?: string;
    rows_completed?: number;
    stitches_notes?: string;
    // Study
    subject?: string;
    study_method?: "Pomodoro 25/5" | "Deep Study 50/10" | "Active Recall" | "Práctica";
    // Work
    deliverable?: string;
    impact_level?: "standard" | "high_impact" | "milestone";
  };
  timestamp: string;
}

export interface SkillDomainSummary {
  domain: SkillDomain;
  label: string;
  level: number;
  total_xp: number;
  total_gp_earned: number;
  sessions_count: number;
  total_minutes: number;
}

export interface QuickExpenseShortcutRequest {
  idempotency_key: string;
  input_mode: "natural_language" | "bank_sms" | "manual";
  raw_text?: string;
  use_aegis_shield?: boolean;
  manual_override?: {
    amount_cop: number;
    category: ExpenseCategory;
    merchant_or_concept: string;
    boss_name?: BossName | null;
    wishlist_item_id?: string | null;
  } | null;
  timestamp?: string;
}

export interface HabitLogShortcutRequest {
  idempotency_key: string;
  quest_code?: string | null;
  session_domain?: SkillDomain;
  custom_activity?: {
    title: string;
    requested_gp: number;
    earned_xp: number;
  } | null;
  session_payload?: {
    duration_minutes?: number;
    // Rubik
    cube_type?: RubikCubeType;
    solve_time_seconds?: number;
    penalty?: RubikPenalty;
    scramble?: string;
    solves_count?: number;
    algorithm_learned?: string;
    // Reading
    book_id?: string;
    pages_read?: number;
    // Knitting
    project_id?: string;
    rows_completed?: number;
    stitches_notes?: string;
    // Study
    subject?: string;
    study_method?: "Pomodoro 25/5" | "Deep Study 50/10" | "Active Recall" | "Práctica";
    // Work
    deliverable?: string;
    impact_level?: "standard" | "high_impact" | "milestone";
  } | null;
  notes?: string;
  timestamp?: string;
}

export interface ReceiptScanShortcutRequest {
  idempotency_key: string;
  receipt_text?: string;
  image_base64?: string;
  mime_type?: string;
  use_aegis_shield?: boolean;
}

export interface ParsedExpenseAI {
  amount_cop: number;
  category: ExpenseCategory;
  merchant_or_concept: string;
  boss_target: BossName;
  detected_source?: "bank_sms" | "voice_dictation";
}

export interface ParsedReceiptSplitAI {
  merchant_name: string;
  total_cop: number;
  operational_essential_cop: number;
  discretionary_unbudgeted_cop: number;
  essential_items_summary: string;
  unbudgeted_items_summary: string;
}

export interface BossTTKProjection {
  name: string;
  current_hp: number;
  months_to_kill: number;
  estimated_kill_date: string;
  projected_interest_cop: number;
  status: "active" | "defeated" | "enraged";
  cutoff_day?: number;
  daily_interest_dot_gp?: number;
  days_until_cutoff?: number;
  enrage_timer_active?: boolean;
  is_purified?: boolean;
}

export interface BossDoTSummary {
  boss_id: string;
  name: string;
  daily_dot_gp: number;
  monthly_interest_cop: number;
  cutoff_day: number;
  days_until_cutoff: number;
  enrage_timer_active: boolean;
  is_enraged: boolean;
  is_purified: boolean;
}

export interface DebtStrategyComparison {
  active_strategy: DebtStrategy;
  monthly_snowball_power_cop: number;
  snowball_total_interest_cop: number;
  avalanche_total_interest_cop: number;
  interest_saved_with_avalanche_cop: number;
  snowball_months_total: number;
  avalanche_months_total: number;
}

export interface FixedCostItem {
  id?: string;
  name: string;
  amount: number;
  category: string;
}

export interface UserSkillConfig {
  domain: SkillDomain;
  label: string;
  weekly_target_minutes: number;
  preferred_session_time?: PreferredSessionTime;
  custom_description?: string;
}

export interface ProfessionClassOption {
  name: string;
  badge: string;
  desc: string;
  recommended_skills?: SkillDomain[];
}

export interface OnboardingBossInput {
  name: string;
  total_balance: number;
  interest_rate_ea: number;
  min_monthly_payment: number;
}

export interface OnboardingWishlistInput {
  name: string;
  cost_gp: number;
  priority: number;
}

export interface OnboardingQuestInput {
  code: string;
  title: string;
  domain: SkillDomain;
  difficulty: "easy" | "medium" | "hard";
  reward_gp: number;
  reward_xp: number;
}

export interface SkillSuggestionInput {
  skill_name: string;
  tracking_idea: string;
  weekly_target_minutes: number;
}

export interface DailyScheduleConfig {
  wake_up_time: string;
  sleep_time: string;
  weekend_wake_up_time: string;
  weekend_sleep_time: string;
  work_days_pattern: "lun_vie" | "lun_sab" | "flexible";
  work_start_hour: string;
  work_end_hour: string;
  commute_and_meals_minutes: number;
  free_slot_preference: "after_work" | "before_work" | "mixed";
  weekday_free_minutes: number;
  weekend_free_minutes: number;
}

export interface OnboardingPayload {
  display_name: string;
  profession?: string;
  character_class: string;
  avatar_url?: string | null;
  currency: CurrencyCode;
  timezone: string;
  monthly_income: number;
  pay_frequency: PayFrequency;
  pay_day: number;
  fixed_costs: FixedCostItem[];
  variable_ops_budget: number;
  vault_cap: number;
  savings_goal_monthly?: number;
  debt_strategy: DebtStrategy;
  bosses: OnboardingBossInput[];
  skills: UserSkillConfig[];
  daily_schedule?: DailyScheduleConfig;
  custom_skill_suggestion?: SkillSuggestionInput | null;
  quests?: OnboardingQuestInput[];
  wishlist: OnboardingWishlistInput[];
  main_goal?: string;
  goal_deadline?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  profession?: string;
  character_class: string;
  avatar_url?: string | null;
  currency?: CurrencyCode;
  timezone?: string;
  pay_frequency?: PayFrequency;
  pay_day?: number;
  savings_goal_monthly?: number;
  main_goal?: string | null;
  goal_deadline?: string | null;
  onboarding_completed?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PersonalApiTokenInfo {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AuthSessionInfo {
  authenticated: boolean;
  mode: "supabase" | "local_engine";
  user: UserProfile | null;
}

export interface TrialCheckpointSnapshot {
  id: string;
  label: string;
  created_at: string;
  billing_period: string;
  player_level: number;
  current_xp: number;
  streak_days: number;
  aegis_shields: number;
  total_debt_remaining_cop: number;
  vault_unlocked_gp: number;
  wallet_gp: number;
  total_penalty_gp: number;
  rubik_3x3_pb: number | null;
  rubik_3x3_ao12: number | null;
  total_pages_read: number;
  total_quotes_captured: number;
  total_skill_sessions: number;
  notes?: string;
}


