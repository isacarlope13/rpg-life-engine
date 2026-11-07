-- ============================================================================
-- ⚔️ RPG PRODUCTIVITY & PERSONAL FINANCE LIFE-ENGINE v3.0
-- SCRIPT AUTO-REPARABLE DE ESQUEMA + DATOS SEMILLA (supabase/seed.sql)
-- ============================================================================
-- INSTRUCCIONES:
-- 1. Puedes ejecutar este script directamente en el SQL Editor de Supabase:
--    - Si tu base de datos viene de la Fase 1/2, este script aplicará primero
--      una AUTO-MIGRACIÓN IDEMPOTENTE (creando nuevos ENUMs, tablas v3.0 y
--      agregando con `ADD COLUMN IF NOT EXISTS` todas las columnas nuevas de
--      v2.0/v3.0 como `fixed_costs_spent_cop`, `variable_ops_spent_cop`,
--      `debt_strategy`, `current_streak_days`, `streak_multiplier`, `aegis_shields`, etc.).
--    - Si ya creaste un usuario en Authentication -> Users, lo detectará automáticamente.
--    - Si `auth.users` está vacío (proyecto recién creado), creará un usuario jugador
--      por defecto para que ninguna llave foránea (FK) falle.
--    - Es 100% IDEMPOTENTE: puedes ejecutarlo múltiples veces sin errores ni duplicados.
-- 2. Al terminar, copia el valor de `default_player_user_id` que aparece en la tabla
--    de resultados inferior y pégalo en `DEFAULT_PLAYER_USER_ID` dentro de `.env.local`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 0. AUTO-MIGRACIÓN IDEMPOTENTE DE ESQUEMA (FASE 1/2 -> v3.0)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE expense_category AS ENUM (
        'fixed_mandatory',
        'variable_operational',
        'debt_attack',
        'discretionary_wishlist',
        'discretionary_unbudgeted'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'fixed_mandatory';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'variable_operational';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'debt_attack';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'discretionary_wishlist';
ALTER TYPE expense_category ADD VALUE IF NOT EXISTS 'discretionary_unbudgeted';

DO $$ BEGIN
    CREATE TYPE boss_status AS ENUM ('active', 'defeated', 'enraged');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE boss_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE boss_status ADD VALUE IF NOT EXISTS 'defeated';
ALTER TYPE boss_status ADD VALUE IF NOT EXISTS 'enraged';

DO $$ BEGIN
    CREATE TYPE quest_difficulty AS ENUM ('trivial', 'easy', 'medium', 'hard', 'epic');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE quest_difficulty ADD VALUE IF NOT EXISTS 'trivial';
ALTER TYPE quest_difficulty ADD VALUE IF NOT EXISTS 'easy';
ALTER TYPE quest_difficulty ADD VALUE IF NOT EXISTS 'medium';
ALTER TYPE quest_difficulty ADD VALUE IF NOT EXISTS 'hard';
ALTER TYPE quest_difficulty ADD VALUE IF NOT EXISTS 'epic';

DO $$ BEGIN
    CREATE TYPE skill_domain AS ENUM ('rubik', 'reading', 'knitting', 'study', 'work', 'general');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'rubik';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'knitting';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'study';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'work';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'general';

DO $$ BEGIN
    CREATE TYPE debt_strategy_type AS ENUM ('snowball', 'avalanche');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE debt_strategy_type ADD VALUE IF NOT EXISTS 'snowball';
ALTER TYPE debt_strategy_type ADD VALUE IF NOT EXISTS 'avalanche';

-- 0.1 Tabla player_treasury + columnas v2.0/v3.0
CREATE TABLE IF NOT EXISTS public.player_treasury (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL,
    monthly_income_cop NUMERIC(12, 2) NOT NULL DEFAULT 2300000.00,
    fixed_costs_budget_cop NUMERIC(12, 2) NOT NULL DEFAULT 848000.00,
    fixed_costs_spent_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    variable_ops_budget_cop NUMERIC(12, 2) NOT NULL DEFAULT 540000.00,
    variable_ops_spent_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    vault_cap_gp BIGINT NOT NULL DEFAULT 400000,
    vault_remaining_gp BIGINT NOT NULL DEFAULT 400000,
    wallet_gp BIGINT NOT NULL DEFAULT 0,
    total_penalty_gp BIGINT NOT NULL DEFAULT 0,
    debt_strategy debt_strategy_type NOT NULL DEFAULT 'snowball',
    player_level INT NOT NULL DEFAULT 1,
    current_xp BIGINT NOT NULL DEFAULT 0,
    current_streak_days INT NOT NULL DEFAULT 0,
    streak_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    aegis_shields INT NOT NULL DEFAULT 1,
    last_activity_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, billing_period),
    CONSTRAINT chk_vault_non_negative CHECK (vault_remaining_gp >= 0),
    CONSTRAINT chk_shields_non_negative CHECK (aegis_shields >= 0)
);

ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS billing_period VARCHAR(7) NOT NULL DEFAULT '2026-11';
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS monthly_income_cop NUMERIC(12, 2) NOT NULL DEFAULT 2300000.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS fixed_costs_budget_cop NUMERIC(12, 2) NOT NULL DEFAULT 848000.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS fixed_costs_spent_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS variable_ops_budget_cop NUMERIC(12, 2) NOT NULL DEFAULT 540000.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS variable_ops_spent_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS vault_cap_gp BIGINT NOT NULL DEFAULT 400000;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS vault_remaining_gp BIGINT NOT NULL DEFAULT 400000;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS wallet_gp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS total_penalty_gp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS debt_strategy debt_strategy_type NOT NULL DEFAULT 'snowball';
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS player_level INT NOT NULL DEFAULT 1;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS current_xp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS current_streak_days INT NOT NULL DEFAULT 0;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS streak_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS aegis_shields INT NOT NULL DEFAULT 1;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.player_treasury ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_treasury_user_period ON public.player_treasury(user_id, billing_period);

-- 0.2 Tabla debt_bosses + columnas v2.0/v3.0
CREATE TABLE IF NOT EXISTS public.debt_bosses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_hp NUMERIC(12, 2) NOT NULL,
    current_hp NUMERIC(12, 2) NOT NULL,
    interest_rate_ea NUMERIC(5, 2) NOT NULL DEFAULT 24.00,
    min_monthly_payment_cop NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    paid_this_month_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    priority_order INT NOT NULL DEFAULT 1,
    status boss_status NOT NULL DEFAULT 'active',
    defeated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_boss_hp CHECK (current_hp >= 0)
);

ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS name VARCHAR(100) NOT NULL DEFAULT 'Debt Boss';
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS max_hp NUMERIC(12, 2) NOT NULL DEFAULT 100000.00;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS current_hp NUMERIC(12, 2) NOT NULL DEFAULT 100000.00;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS interest_rate_ea NUMERIC(5, 2) NOT NULL DEFAULT 24.00;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS min_monthly_payment_cop NUMERIC(12, 2) NOT NULL DEFAULT 50000.00;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS paid_this_month_cop NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS priority_order INT NOT NULL DEFAULT 1;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS status boss_status NOT NULL DEFAULT 'active';
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS defeated_at TIMESTAMPTZ;
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.debt_bosses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 0.3 Tabla quest_catalog + columnas v2.0/v3.0
CREATE TABLE IF NOT EXISTS public.quest_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    domain skill_domain NOT NULL DEFAULT 'general',
    difficulty quest_difficulty NOT NULL DEFAULT 'medium',
    reward_gp BIGINT NOT NULL,
    reward_xp INT NOT NULL DEFAULT 50,
    daily_limit INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, code)
);

ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS code VARCHAR(50) NOT NULL DEFAULT 'QUEST';
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS title VARCHAR(150) NOT NULL DEFAULT 'Misión';
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS domain skill_domain NOT NULL DEFAULT 'general';
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS difficulty quest_difficulty NOT NULL DEFAULT 'medium';
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS reward_gp BIGINT NOT NULL DEFAULT 4000;
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS reward_xp INT NOT NULL DEFAULT 50;
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS daily_limit INT NOT NULL DEFAULT 1;
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.quest_catalog ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_quest_catalog_user_code ON public.quest_catalog(user_id, code);

-- 0.4 Tabla activity_logs + columnas v2.0/v3.0
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treasury_id UUID NOT NULL REFERENCES public.player_treasury(id) ON DELETE CASCADE,
    quest_id UUID REFERENCES public.quest_catalog(id) ON DELETE SET NULL,
    domain skill_domain NOT NULL DEFAULT 'general',
    activity_name VARCHAR(150) NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 0,
    requested_gp BIGINT NOT NULL,
    streak_multiplier_applied NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    transferred_gp BIGINT NOT NULL DEFAULT 0,
    earned_xp INT NOT NULL DEFAULT 0,
    shield_earned BOOLEAN NOT NULL DEFAULT FALSE,
    session_metadata JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(50) NOT NULL DEFAULT 'ios_shortcut',
    notes TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS treasury_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS quest_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS domain skill_domain NOT NULL DEFAULT 'general';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS activity_name VARCHAR(150) NOT NULL DEFAULT 'Sesión';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 0;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS requested_gp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS streak_multiplier_applied NUMERIC(4, 2) NOT NULL DEFAULT 1.00;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS transferred_gp BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS earned_xp INT NOT NULL DEFAULT 0;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS shield_earned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'ios_shortcut';
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_logs_idempotency_key ON public.activity_logs(idempotency_key);

-- 0.5 Tablas especializadas v3.0: rubik_solves, reading_books, knitting_projects
CREATE TABLE IF NOT EXISTS public.rubik_solves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
    cube_model VARCHAR(150),
    time_seconds NUMERIC(6, 2) NOT NULL CHECK (time_seconds > 0),
    penalty VARCHAR(10) NOT NULL DEFAULT 'NONE' CHECK (penalty IN ('NONE', '+2', 'DNF')),
    scramble TEXT NOT NULL,
    is_pb BOOLEAN NOT NULL DEFAULT FALSE,
    ao5_after NUMERIC(6, 2),
    ao12_after NUMERIC(6, 2),
    algorithm_practiced VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS cube_type VARCHAR(20) NOT NULL DEFAULT '3x3';
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS cube_model VARCHAR(150);
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS time_seconds NUMERIC(6, 2) NOT NULL DEFAULT 20.00;
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS penalty VARCHAR(10) NOT NULL DEFAULT 'NONE';
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS scramble TEXT NOT NULL DEFAULT '';
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS is_pb BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS ao5_after NUMERIC(6, 2);
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS ao12_after NUMERIC(6, 2);
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS algorithm_practiced VARCHAR(120);
ALTER TABLE public.rubik_solves ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.rubik_cubes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
    brand VARCHAR(80) NOT NULL DEFAULT 'GAN',
    model_name VARCHAR(150) NOT NULL,
    magnetic_system VARCHAR(120) NOT NULL DEFAULT 'Ball-Core + MagLev',
    surface_finish VARCHAR(80) NOT NULL DEFAULT 'UV Coated',
    size_mm NUMERIC(5, 2) NOT NULL DEFAULT 56.00,
    weight_grams NUMERIC(6, 2) NOT NULL DEFAULT 70.00,
    wca_legal BOOLEAN NOT NULL DEFAULT TRUE,
    recommended_setup VARCHAR(220) NOT NULL DEFAULT 'Tensión Nivel 3/6 • Lube Rápido',
    target_sub_seconds NUMERIC(6, 2) NOT NULL DEFAULT 18.00,
    recommended_alg_set VARCHAR(150) NOT NULL DEFAULT 'CFOP Full OLL/PLL',
    reward_gp_per_solve BIGINT NOT NULL DEFAULT 4500,
    pb_bonus_gp BIGINT NOT NULL DEFAULT 2000,
    specs_compliance_checklist JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active_main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS cube_type VARCHAR(20) NOT NULL DEFAULT '3x3';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS brand VARCHAR(80) NOT NULL DEFAULT 'GAN';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS model_name VARCHAR(150) NOT NULL DEFAULT 'Speedcube 3x3';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS magnetic_system VARCHAR(120) NOT NULL DEFAULT 'Ball-Core + MagLev';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS surface_finish VARCHAR(80) NOT NULL DEFAULT 'UV Coated';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS size_mm NUMERIC(5, 2) NOT NULL DEFAULT 56.00;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(6, 2) NOT NULL DEFAULT 70.00;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS wca_legal BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS recommended_setup VARCHAR(220) NOT NULL DEFAULT 'Tensión Nivel 3/6 • Lube Rápido';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS target_sub_seconds NUMERIC(6, 2) NOT NULL DEFAULT 18.00;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS recommended_alg_set VARCHAR(150) NOT NULL DEFAULT 'CFOP Full OLL/PLL';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS reward_gp_per_solve BIGINT NOT NULL DEFAULT 4500;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS pb_bonus_gp BIGINT NOT NULL DEFAULT 2000;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS specs_compliance_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active_main';
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.reading_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(180) NOT NULL,
    author VARCHAR(120) NOT NULL,
    total_pages INT NOT NULL CHECK (total_pages > 0),
    pages_read INT NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
    category VARCHAR(80) NOT NULL DEFAULT 'Desarrollo & Finanzas',
    status VARCHAR(20) NOT NULL DEFAULT 'reading',
    specs_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS title VARCHAR(180) NOT NULL DEFAULT '';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS author VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS total_pages INT NOT NULL DEFAULT 100;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS pages_read INT NOT NULL DEFAULT 0;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS category VARCHAR(80) NOT NULL DEFAULT 'Desarrollo & Finanzas';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'reading';
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS specs_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.knitting_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(180) NOT NULL,
    technique VARCHAR(50) NOT NULL DEFAULT 'Crochet',
    total_rows_target INT NOT NULL CHECK (total_rows_target > 0),
    completed_rows INT NOT NULL DEFAULT 0 CHECK (completed_rows >= 0),
    yarn_details VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS name VARCHAR(180) NOT NULL DEFAULT '';
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS technique VARCHAR(50) NOT NULL DEFAULT 'Crochet';
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS total_rows_target INT NOT NULL DEFAULT 50;
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS completed_rows INT NOT NULL DEFAULT 0;
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS yarn_details VARCHAR(150);
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'in_progress';
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.knitting_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 0.6 Tabla wishlist_items
CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    cost_gp BIGINT NOT NULL,
    priority INT NOT NULL DEFAULT 3,
    url TEXT,
    is_redeemed BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_wishlist_cost CHECK (cost_gp > 0)
);

ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS name VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS cost_gp BIGINT NOT NULL DEFAULT 10000;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 3;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS is_redeemed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS redeemed_at TIMESTAMPTZ;
ALTER TABLE public.wishlist_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 0.7 Tabla financial_transactions + columnas v2.0/v3.0
CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    treasury_id UUID NOT NULL REFERENCES public.player_treasury(id) ON DELETE CASCADE,
    amount_cop NUMERIC(12, 2) NOT NULL CHECK (amount_cop > 0),
    category expense_category NOT NULL,
    merchant_or_concept VARCHAR(150) NOT NULL,
    boss_id UUID REFERENCES public.debt_bosses(id) ON DELETE SET NULL,
    wishlist_item_id UUID REFERENCES public.wishlist_items(id) ON DELETE SET NULL,
    wallet_gp_deducted BIGINT NOT NULL DEFAULT 0,
    penalty_gp_applied BIGINT NOT NULL DEFAULT 0,
    aegis_shield_used BOOLEAN NOT NULL DEFAULT FALSE,
    overflow_damage_cop NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ai_parsed_metadata JSONB,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS treasury_id UUID;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS amount_cop NUMERIC(12, 2) NOT NULL DEFAULT 1000.00;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS category expense_category NOT NULL DEFAULT 'variable_operational';
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS merchant_or_concept VARCHAR(150) NOT NULL DEFAULT 'Gasto';
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS boss_id UUID;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS wishlist_item_id UUID;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS wallet_gp_deducted BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS penalty_gp_applied BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS aegis_shield_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS overflow_damage_cop NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS ai_parsed_metadata JSONB;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_tx_idempotency_key ON public.financial_transactions(idempotency_key);

-- 0.8 Actualizar Funciones y Triggers a v3.0
SET check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.fn_process_activity_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_treasury RECORD;
    v_new_streak INT;
    v_new_multiplier NUMERIC(4, 2);
    v_boosted_gp BIGINT;
    v_actual_transfer BIGINT;
    v_award_shield INT := 0;
BEGIN
    SELECT *
      INTO v_treasury
      FROM public.player_treasury
     WHERE id = NEW.treasury_id AND user_id = NEW.user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Treasury record not found for treasury_id %', NEW.treasury_id;
    END IF;

    v_new_streak := v_treasury.current_streak_days + 1;

    IF v_new_streak >= 7 THEN
        v_new_multiplier := 1.25;
    ELSIF v_new_streak >= 3 THEN
        v_new_multiplier := 1.10;
    ELSE
        v_new_multiplier := 1.00;
    END IF;

    IF (v_new_streak % 7) = 0 THEN
        v_award_shield := 1;
        NEW.shield_earned := TRUE;
    END IF;

    v_boosted_gp := ROUND(NEW.requested_gp * v_new_multiplier)::BIGINT;
    v_actual_transfer := LEAST(v_boosted_gp, v_treasury.vault_remaining_gp);

    NEW.streak_multiplier_applied := v_new_multiplier;
    NEW.transferred_gp := v_actual_transfer;

    UPDATE public.player_treasury
       SET vault_remaining_gp  = vault_remaining_gp - v_actual_transfer,
           wallet_gp           = wallet_gp + v_actual_transfer,
           current_xp          = current_xp + NEW.earned_xp,
           player_level        = GREATEST(1, FLOOR(SQRT((current_xp + NEW.earned_xp) / 100.0))::INT + 1),
           current_streak_days = v_new_streak,
           streak_multiplier   = v_new_multiplier,
           aegis_shields       = aegis_shields + v_award_shield,
           last_activity_date  = CURRENT_DATE,
           updated_at          = NOW()
     WHERE id = NEW.treasury_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_insert_activity_log ON public.activity_logs;
CREATE TRIGGER trg_before_insert_activity_log
BEFORE INSERT ON public.activity_logs
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_activity_reward();

CREATE OR REPLACE FUNCTION public.fn_process_financial_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_treasury RECORD;
    v_base_gp BIGINT;
    v_total_deduction_gp BIGINT;
    v_penalty_gp BIGINT := 0;
    v_new_streak INT;
    v_new_multiplier NUMERIC(4, 2);
    v_remaining_damage NUMERIC(12, 2);
    v_boss RECORD;
    v_damage_on_boss NUMERIC(12, 2);
    v_boss_idx INT := 0;
    v_overflow NUMERIC(12, 2) := 0;
BEGIN
    SELECT *
      INTO v_treasury
      FROM public.player_treasury
     WHERE id = NEW.treasury_id AND user_id = NEW.user_id
       FOR UPDATE;

    v_base_gp := ROUND(NEW.amount_cop)::BIGINT;

    IF NEW.category = 'discretionary_unbudgeted' THEN
        IF v_treasury.aegis_shields > 0 AND COALESCE(NEW.aegis_shield_used, TRUE) THEN
            v_total_deduction_gp := v_base_gp;
            v_penalty_gp := 0;
            NEW.aegis_shield_used := TRUE;
            NEW.wallet_gp_deducted := v_total_deduction_gp;
            NEW.penalty_gp_applied := 0;

            UPDATE public.player_treasury
               SET wallet_gp     = wallet_gp - v_total_deduction_gp,
                   aegis_shields = aegis_shields - 1,
                   updated_at    = NOW()
             WHERE id = NEW.treasury_id;
        ELSE
            v_total_deduction_gp := ROUND(NEW.amount_cop * 1.20)::BIGINT;
            v_penalty_gp := v_total_deduction_gp - v_base_gp;
            v_new_streak := GREATEST(0, v_treasury.current_streak_days - 1);

            IF v_new_streak >= 7 THEN
                v_new_multiplier := 1.25;
            ELSIF v_new_streak >= 3 THEN
                v_new_multiplier := 1.10;
            ELSE
                v_new_multiplier := 1.00;
            END IF;

            NEW.aegis_shield_used := FALSE;
            NEW.wallet_gp_deducted := v_total_deduction_gp;
            NEW.penalty_gp_applied := v_penalty_gp;

            UPDATE public.player_treasury
               SET wallet_gp           = wallet_gp - v_total_deduction_gp,
                   vault_remaining_gp  = GREATEST(0, vault_remaining_gp - v_penalty_gp),
                   total_penalty_gp    = total_penalty_gp + v_penalty_gp,
                   current_streak_days = v_new_streak,
                   streak_multiplier   = v_new_multiplier,
                   updated_at          = NOW()
             WHERE id = NEW.treasury_id;
        END IF;

    ELSIF NEW.category = 'discretionary_wishlist' THEN
        NEW.wallet_gp_deducted := v_base_gp;
        NEW.penalty_gp_applied := 0;
        NEW.aegis_shield_used := FALSE;

        UPDATE public.player_treasury
           SET wallet_gp  = wallet_gp - v_base_gp,
               updated_at = NOW()
         WHERE id = NEW.treasury_id;

        IF NEW.wishlist_item_id IS NOT NULL THEN
            UPDATE public.wishlist_items
               SET is_redeemed = TRUE,
                   redeemed_at = NOW()
             WHERE id = NEW.wishlist_item_id AND user_id = NEW.user_id;
        END IF;

    ELSIF NEW.category = 'fixed_mandatory' THEN
        NEW.aegis_shield_used := FALSE;
        UPDATE public.player_treasury
           SET fixed_costs_spent_cop = fixed_costs_spent_cop + NEW.amount_cop,
               updated_at            = NOW()
         WHERE id = NEW.treasury_id;

    ELSIF NEW.category = 'variable_operational' THEN
        NEW.aegis_shield_used := FALSE;
        UPDATE public.player_treasury
           SET variable_ops_spent_cop = variable_ops_spent_cop + NEW.amount_cop,
               updated_at             = NOW()
         WHERE id = NEW.treasury_id;

    ELSIF NEW.category = 'debt_attack' THEN
        NEW.aegis_shield_used := FALSE;
        v_remaining_damage := NEW.amount_cop;

        FOR v_boss IN
            SELECT *
              FROM public.debt_bosses
             WHERE user_id = NEW.user_id
               AND current_hp > 0
             ORDER BY
               CASE WHEN id = NEW.boss_id THEN 0 ELSE 1 END,
               CASE WHEN v_treasury.debt_strategy = 'avalanche' THEN -interest_rate_ea ELSE priority_order END ASC
             FOR UPDATE
        LOOP
            EXIT WHEN v_remaining_damage <= 0;

            v_damage_on_boss := LEAST(v_boss.current_hp, v_remaining_damage);
            v_remaining_damage := v_remaining_damage - v_damage_on_boss;
            IF v_boss_idx > 0 THEN
                v_overflow := v_overflow + v_damage_on_boss;
            END IF;
            v_boss_idx := v_boss_idx + 1;

            UPDATE public.debt_bosses
               SET current_hp          = current_hp - v_damage_on_boss,
                   paid_this_month_cop = paid_this_month_cop + v_damage_on_boss,
                   status              = CASE
                                           WHEN (current_hp - v_damage_on_boss) <= 0 THEN 'defeated'::boss_status
                                           WHEN status::text = 'enraged' AND (paid_this_month_cop + v_damage_on_boss) < min_monthly_payment_cop THEN status
                                           ELSE 'active'::boss_status
                                         END,
                   defeated_at         = CASE WHEN (current_hp - v_damage_on_boss) <= 0 THEN NOW() ELSE defeated_at END,
                   updated_at          = NOW()
             WHERE id = v_boss.id;
        END LOOP;

        NEW.overflow_damage_cop := v_overflow;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_before_insert_financial_tx ON public.financial_transactions;
CREATE TRIGGER trg_before_insert_financial_tx
BEFORE INSERT ON public.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION public.fn_process_financial_transaction();

CREATE OR REPLACE FUNCTION public.fn_boss_monthly_counterattack(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_boss RECORD;
    v_monthly_rate NUMERIC;
    v_interest_heal NUMERIC(12, 2);
    v_total_healed NUMERIC(12, 2) := 0;
    v_enraged_count INT := 0;
BEGIN
    FOR v_boss IN
        SELECT * FROM public.debt_bosses
         WHERE user_id = p_user_id AND current_hp > 0
           FOR UPDATE
    LOOP
        v_monthly_rate := POWER(1 + (v_boss.interest_rate_ea / 100.0), 1.0 / 12.0) - 1;
        v_interest_heal := ROUND(v_boss.current_hp * v_monthly_rate, 2);
        v_total_healed := v_total_healed + v_interest_heal;

        IF v_boss.paid_this_month_cop < v_boss.min_monthly_payment_cop THEN
            v_enraged_count := v_enraged_count + 1;
            UPDATE public.debt_bosses
               SET current_hp          = current_hp + v_interest_heal,
                   max_hp              = GREATEST(max_hp, current_hp + v_interest_heal),
                   status              = 'enraged',
                   paid_this_month_cop = 0,
                   updated_at          = NOW()
             WHERE id = v_boss.id;
        ELSE
            UPDATE public.debt_bosses
               SET current_hp          = current_hp + v_interest_heal,
                   max_hp              = GREATEST(max_hp, current_hp + v_interest_heal),
                   paid_this_month_cop = 0,
                   updated_at          = NOW()
             WHERE id = v_boss.id;
        END IF;
    END LOOP;

    IF v_enraged_count > 0 THEN
        UPDATE public.player_treasury
           SET vault_remaining_gp = GREATEST(0, vault_remaining_gp - (40000 * v_enraged_count)),
               updated_at = NOW()
         WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
        'total_interest_healed_cop', v_total_healed,
        'enraged_bosses_count', v_enraged_count,
        'vault_gp_locked_by_enrage', 40000 * v_enraged_count
    );
END;
$$;

SET check_function_bodies = on;

-- 0.9 Asegurar RLS e Índices en todas las tablas (incluyendo nuevas tablas v3.0)
ALTER TABLE public.player_treasury ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_bosses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quest_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubik_solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubik_cubes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knitting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own treasury" ON public.player_treasury;
CREATE POLICY "Users manage own treasury" ON public.player_treasury
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own debt_bosses" ON public.debt_bosses;
CREATE POLICY "Users manage own debt_bosses" ON public.debt_bosses
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own quest_catalog" ON public.quest_catalog;
CREATE POLICY "Users manage own quest_catalog" ON public.quest_catalog
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own activity_logs" ON public.activity_logs;
CREATE POLICY "Users manage own activity_logs" ON public.activity_logs
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own rubik_solves" ON public.rubik_solves;
CREATE POLICY "Users manage own rubik_solves" ON public.rubik_solves
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own rubik_cubes" ON public.rubik_cubes;
CREATE POLICY "Users manage own rubik_cubes" ON public.rubik_cubes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own reading_books" ON public.reading_books;
CREATE POLICY "Users manage own reading_books" ON public.reading_books
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own knitting_projects" ON public.knitting_projects;
CREATE POLICY "Users manage own knitting_projects" ON public.knitting_projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own wishlist_items" ON public.wishlist_items;
CREATE POLICY "Users manage own wishlist_items" ON public.wishlist_items
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own financial_transactions" ON public.financial_transactions;
CREATE POLICY "Users manage own financial_transactions" ON public.financial_transactions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_domain ON public.activity_logs(user_id, domain, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_tx_user_cat ON public.financial_transactions(user_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rubik_solves_user_time ON public.rubik_solves(user_id, cube_type, created_at DESC);

-- ============================================================================
-- BLOQUE DE INSERCIÓN DE DATOS SEMILLA (100% IDEMPOTENTE)
-- ============================================================================
DO $$
DECLARE
    -- Opcional: si deseas fijar un UUID específico manualmente, reemplaza NULL por tu UUID
    -- (ej: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid). Si lo dejas en NULL, el script
    -- detectará automáticamente el primer usuario de auth.users o creará uno por defecto.
    v_user_id UUID := NULL;
    v_manual_user_id UUID := NULL;

    v_billing_period VARCHAR(7) := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
    v_treasury_id UUID;
BEGIN
    -- ========================================================================
    -- 1. RESOLVER O CREAR USUARIO EN auth.users (Evita errores de Foreign Key)
    -- ========================================================================
    v_user_id := COALESCE(v_user_id, v_manual_user_id);

    IF v_user_id IS NULL THEN
        SELECT id
          INTO v_user_id
          FROM auth.users
         ORDER BY created_at ASC
         LIMIT 1;
    END IF;

    IF v_user_id IS NULL THEN
        v_user_id := '11111111-1111-4111-8111-111111111111'::uuid;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            'player-' || SUBSTRING(v_user_id::text FROM 1 FOR 8) || '@rpg-life-engine.local',
            crypt('RpgLifeEngine2026!', gen_salt('bf')),
            NOW(),
            '',
            '',
            '',
            '',
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"full_name":"Player One - RPG Life Engine"}'::jsonb,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Usuario creado en auth.users con ID: %', v_user_id;
    ELSE
        RAISE NOTICE 'Usuario existente detectado en auth.users con ID: %', v_user_id;
    END IF;

    -- ========================================================================
    -- 2. TESORERÍA INICIAL DEL JUGADOR (public.player_treasury)
    --    Ingreso: $2,300,000 COP | Fijos: $848,000 | Variables: $540,000
    --    Bóveda: 400,000 GP | Billetera: 0 GP | Racha: 2d | Escudos Aegis: 1
    -- ========================================================================
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
        aegis_shields,
        last_activity_date
    ) VALUES (
        v_user_id,
        v_billing_period,
        2300000.00,
        848000.00,
        848000.00,
        540000.00,
        185000.00,
        400000,
        400000,
        0,
        0,
        'snowball',
        1,
        0,
        2,
        1.00,
        1,
        CURRENT_DATE
    )
    ON CONFLICT (user_id, billing_period) DO UPDATE
       SET monthly_income_cop      = EXCLUDED.monthly_income_cop,
           fixed_costs_budget_cop  = EXCLUDED.fixed_costs_budget_cop,
           fixed_costs_spent_cop   = CASE WHEN public.player_treasury.fixed_costs_spent_cop = 0 THEN EXCLUDED.fixed_costs_spent_cop ELSE public.player_treasury.fixed_costs_spent_cop END,
           variable_ops_budget_cop = EXCLUDED.variable_ops_budget_cop,
           variable_ops_spent_cop  = CASE WHEN public.player_treasury.variable_ops_spent_cop = 0 THEN EXCLUDED.variable_ops_spent_cop ELSE public.player_treasury.variable_ops_spent_cop END,
           vault_cap_gp            = EXCLUDED.vault_cap_gp,
           current_streak_days     = GREATEST(public.player_treasury.current_streak_days, EXCLUDED.current_streak_days),
           aegis_shields           = GREATEST(public.player_treasury.aegis_shields, EXCLUDED.aegis_shields),
           last_activity_date      = COALESCE(public.player_treasury.last_activity_date, EXCLUDED.last_activity_date),
           updated_at              = NOW()
    RETURNING id INTO v_treasury_id;

    -- Asegurar también el periodo '2026-11' en caso de que el reloj del servidor sea distinto
    IF v_billing_period <> '2026-11' THEN
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
            aegis_shields,
            last_activity_date
        ) VALUES (
            v_user_id,
            '2026-11',
            2300000.00,
            848000.00,
            848000.00,
            540000.00,
            185000.00,
            400000,
            400000,
            0,
            0,
            'snowball',
            1,
            0,
            2,
            1.00,
            1,
            CURRENT_DATE
        )
        ON CONFLICT (user_id, billing_period) DO UPDATE
           SET monthly_income_cop      = EXCLUDED.monthly_income_cop,
               fixed_costs_budget_cop  = EXCLUDED.fixed_costs_budget_cop,
               fixed_costs_spent_cop   = CASE WHEN public.player_treasury.fixed_costs_spent_cop = 0 THEN EXCLUDED.fixed_costs_spent_cop ELSE public.player_treasury.fixed_costs_spent_cop END,
               variable_ops_budget_cop = EXCLUDED.variable_ops_budget_cop,
               variable_ops_spent_cop  = CASE WHEN public.player_treasury.variable_ops_spent_cop = 0 THEN EXCLUDED.variable_ops_spent_cop ELSE public.player_treasury.variable_ops_spent_cop END,
               vault_cap_gp            = EXCLUDED.vault_cap_gp,
               current_streak_days     = GREATEST(public.player_treasury.current_streak_days, EXCLUDED.current_streak_days),
               aegis_shields           = GREATEST(public.player_treasury.aegis_shields, EXCLUDED.aegis_shields),
               last_activity_date      = COALESCE(public.player_treasury.last_activity_date, EXCLUDED.last_activity_date),
               updated_at              = NOW();
    END IF;

    -- ========================================================================
    -- 3. DEBT BOSSES (Nequi $165,442 | ADDI $1,137,647 | Bancolombia $3,000,000)
    -- ========================================================================
    -- Si existen filas previas de Fase 1/2 creadas con gen_random_uuid(), evita duplicados
    UPDATE public.financial_transactions ft
       SET boss_id = NULL
      FROM public.debt_bosses db
     WHERE ft.boss_id = db.id
       AND db.user_id = v_user_id
       AND db.name IN ('Nequi', 'ADDI', 'Bancolombia')
       AND db.id <> md5(v_user_id::text || ':boss:' || db.name)::uuid;

    DELETE FROM public.debt_bosses db
     WHERE db.user_id = v_user_id
       AND db.name IN ('Nequi', 'ADDI', 'Bancolombia')
       AND db.id <> md5(v_user_id::text || ':boss:' || db.name)::uuid;

    INSERT INTO public.debt_bosses (
        id,
        user_id,
        name,
        max_hp,
        current_hp,
        interest_rate_ea,
        min_monthly_payment_cop,
        paid_this_month_cop,
        priority_order,
        status
    ) VALUES
        (
            md5(v_user_id::text || ':boss:Nequi')::uuid,
            v_user_id,
            'Nequi',
            165442.00,
            165442.00,
            26.50,
            45000.00,
            0.00,
            1,
            'active'
        ),
        (
            md5(v_user_id::text || ':boss:ADDI')::uuid,
            v_user_id,
            'ADDI',
            1137647.00,
            1137647.00,
            28.90,
            120000.00,
            0.00,
            2,
            'active'
        ),
        (
            md5(v_user_id::text || ':boss:Bancolombia')::uuid,
            v_user_id,
            'Bancolombia',
            3000000.00,
            3000000.00,
            24.00,
            180000.00,
            0.00,
            3,
            'active'
        )
    ON CONFLICT (id) DO UPDATE
       SET name                    = EXCLUDED.name,
           max_hp                  = EXCLUDED.max_hp,
           interest_rate_ea        = EXCLUDED.interest_rate_ea,
           min_monthly_payment_cop = EXCLUDED.min_monthly_payment_cop,
           priority_order          = EXCLUDED.priority_order,
           updated_at              = NOW();

    -- ========================================================================
    -- 4. CATÁLOGO DE MISIONES / HÁBITOS (public.quest_catalog)
    --    Incluye: Rubik, Lectura, Tejido, Estudio, Trabajo y Gym
    -- ========================================================================
    INSERT INTO public.quest_catalog (
        user_id,
        code,
        title,
        domain,
        difficulty,
        reward_gp,
        reward_xp,
        daily_limit,
        is_active
    ) VALUES
        (
            v_user_id,
            'RUBIK_AO12_SESSION',
            'Cubo de Rubik: Sesión Ao12 + Práctica CFOP',
            'rubik',
            'medium',
            4500,
            95,
            3,
            TRUE
        ),
        (
            v_user_id,
            'READING_SESSION_30M',
            'Sesión de Lectura Profunda (20+ páginas)',
            'reading',
            'medium',
            4000,
            85,
            3,
            TRUE
        ),
        (
            v_user_id,
            'KNITTING_CRAFT_SESSION',
            'Sesión de Tejido: Avance de Filas / Crochet',
            'knitting',
            'medium',
            4500,
            90,
            3,
            TRUE
        ),
        (
            v_user_id,
            'STUDY_BLOCK',
            'Sesión de Estudio / Active Recall (50m)',
            'study',
            'hard',
            5000,
            110,
            3,
            TRUE
        ),
        (
            v_user_id,
            'DEEP_WORK_2H',
            'Sesión de Trabajo: Bloque Deep Work (2h)',
            'work',
            'hard',
            6500,
            130,
            2,
            TRUE
        ),
        (
            v_user_id,
            'GYM_WORKOUT',
            'Entrenamiento de Fuerza / Gym',
            'general',
            'hard',
            5000,
            100,
            1,
            TRUE
        )
    ON CONFLICT (user_id, code) DO UPDATE
       SET title       = EXCLUDED.title,
           domain      = EXCLUDED.domain,
           difficulty  = EXCLUDED.difficulty,
           reward_gp   = EXCLUDED.reward_gp,
           reward_xp   = EXCLUDED.reward_xp,
           daily_limit = EXCLUDED.daily_limit,
           is_active   = TRUE;

    -- ========================================================================
    -- 5. BIBLIOTECA DE LECTURA INICIAL (public.reading_books)
    -- ========================================================================
    INSERT INTO public.reading_books (
        id,
        user_id,
        title,
        author,
        total_pages,
        pages_read,
        category,
        status
    ) VALUES
        (
            md5(v_user_id::text || ':book:1')::uuid,
            v_user_id,
            'La Psicología del Dinero',
            'Morgan Housel',
            280,
            165,
            'Finanzas & Mentalidad',
            'reading'
        ),
        (
            md5(v_user_id::text || ':book:2')::uuid,
            v_user_id,
            'Deep Work (Enfócate)',
            'Cal Newport',
            304,
            210,
            'Productividad',
            'reading'
        ),
        (
            md5(v_user_id::text || ':book:3')::uuid,
            v_user_id,
            'Designing Data-Intensive Applications',
            'Martin Kleppmann',
            616,
            190,
            'Ingeniería & Estudio',
            'reading'
        )
    ON CONFLICT (id) DO UPDATE
       SET title       = EXCLUDED.title,
           author      = EXCLUDED.author,
           total_pages = EXCLUDED.total_pages,
           category    = EXCLUDED.category,
           updated_at  = NOW();

    -- ========================================================================
    -- 6. PROYECTOS DE TEJIDO INICIALES (public.knitting_projects)
    -- ========================================================================
    INSERT INTO public.knitting_projects (
        id,
        user_id,
        name,
        technique,
        total_rows_target,
        completed_rows,
        yarn_details,
        status
    ) VALUES
        (
            md5(v_user_id::text || ':knit:1')::uuid,
            v_user_id,
            'Amigurumi Dragón Guardián de la Bóveda',
            'Amigurumi',
            60,
            38,
            'Hilaza algodón mercerizado verde esmeralda • Aguja 2.5mm',
            'in_progress'
        ),
        (
            md5(v_user_id::text || ':knit:2')::uuid,
            v_user_id,
            'Bufanda Texturizada Punto Brioche',
            'Dos Agujas',
            120,
            74,
            'Lana Merino DK azul medianoche • Agujas 4.5mm',
            'in_progress'
        ),
        (
            md5(v_user_id::text || ':knit:3')::uuid,
            v_user_id,
            'Manta Granny Squares Geométrica',
            'Crochet',
            90,
            45,
            'Acrílico suave multicolor • Aguja 3.5mm',
            'in_progress'
        )
    ON CONFLICT (id) DO UPDATE
       SET name              = EXCLUDED.name,
           technique         = EXCLUDED.technique,
           total_rows_target = EXCLUDED.total_rows_target,
           yarn_details      = EXCLUDED.yarn_details,
           updated_at        = NOW();

    -- ========================================================================
    -- 7. HISTORIAL WCA DE CUBOS DE RUBIK (public.rubik_solves)
    --    12 solves 3x3 (PB 17.84s, Ao5 19.42s, Ao12 19.85s) + 2x2 + 4x4
    -- ========================================================================
    INSERT INTO public.rubik_solves (
        id,
        user_id,
        cube_type,
        time_seconds,
        penalty,
        scramble,
        is_pb,
        ao5_after,
        ao12_after,
        algorithm_practiced,
        created_at
    ) VALUES
        (
            md5(v_user_id::text || ':solve:3x3-12')::uuid,
            v_user_id,
            '3x3',
            17.84,
            'NONE',
            'R U R'' U'' R'' F R2 U'' R'' U'' R U R'' F''',
            TRUE,
            19.42,
            19.85,
            'PLL T-Perm & Jb-Perm',
            '2026-11-05T16:30:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-11')::uuid,
            v_user_id,
            '3x3',
            19.15,
            'NONE',
            'F R U'' R'' U'' R U R'' F'' R U R'' U'' R'' F R F''',
            FALSE,
            19.86,
            NULL,
            'F2L Lookahead',
            '2026-11-05T16:25:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-10')::uuid,
            v_user_id,
            '3x3',
            21.60,
            'NONE',
            'U2 L2 D'' B2 D R2 D2 F2 U'' R'' B D2 L'' U F''',
            FALSE,
            20.05,
            NULL,
            NULL,
            '2026-11-05T16:20:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-9')::uuid,
            v_user_id,
            '3x3',
            18.92,
            'NONE',
            'D2 R2 F2 U B2 U2 L2 D'' B2 R'' D'' F U2 L B''',
            FALSE,
            19.91,
            NULL,
            NULL,
            '2026-11-05T16:15:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-8')::uuid,
            v_user_id,
            '3x3',
            20.19,
            'NONE',
            'B2 U'' R2 D L2 U'' F2 U R2 B'' L D'' R'' U2 F''',
            FALSE,
            20.12,
            NULL,
            NULL,
            '2026-11-05T16:10:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-7')::uuid,
            v_user_id,
            '3x3',
            19.45,
            'NONE',
            'L2 U2 F2 D B2 U'' R2 U'' F'' D L'' B2 R U''',
            FALSE,
            20.18,
            NULL,
            'OLL 27 Sune',
            '2026-11-05T16:05:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-6')::uuid,
            v_user_id,
            '3x3',
            20.10,
            'NONE',
            'R2 D'' L2 U F2 D2 B2 U'' L'' F'' D R2 B U2',
            FALSE,
            20.32,
            NULL,
            NULL,
            '2026-11-05T16:00:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-5')::uuid,
            v_user_id,
            '3x3',
            19.80,
            'NONE',
            'F2 U R2 D'' B2 U2 L2 D F'' R U'' B2 L D''',
            FALSE,
            20.39,
            NULL,
            NULL,
            '2026-11-05T15:55:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-4')::uuid,
            v_user_id,
            '3x3',
            20.50,
            'NONE',
            'U'' B2 D L2 D'' R2 U2 F2 L'' D'' B U2 R'' F',
            FALSE,
            NULL,
            NULL,
            NULL,
            '2026-11-05T15:50:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-3')::uuid,
            v_user_id,
            '3x3',
            19.30,
            'NONE',
            'D R2 U'' F2 D2 L2 B2 U R'' B'' L2 D F'' U',
            FALSE,
            NULL,
            NULL,
            NULL,
            '2026-11-05T15:45:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-2')::uuid,
            v_user_id,
            '3x3',
            20.40,
            'NONE',
            'B2 L2 D'' F2 U R2 D2 U'' B L'' D R'' F2 U''',
            FALSE,
            NULL,
            NULL,
            NULL,
            '2026-11-05T15:40:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:3x3-1')::uuid,
            v_user_id,
            '3x3',
            20.69,
            'NONE',
            'L2 F2 U'' R2 D B2 U2 D'' L F'' U'' R B2 D',
            FALSE,
            NULL,
            NULL,
            NULL,
            '2026-11-05T15:35:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:2x2-1')::uuid,
            v_user_id,
            '2x2',
            5.42,
            'NONE',
            'R U2 R'' F2 U'' F R U''',
            TRUE,
            NULL,
            NULL,
            'Ortega PBL',
            '2026-11-05T15:20:00Z'::timestamptz
        ),
        (
            md5(v_user_id::text || ':solve:4x4-1')::uuid,
            v_user_id,
            '4x4',
            68.40,
            'NONE',
            'Rw U2 Rw'' F2 Uw'' R U2 L'' B2 D2',
            TRUE,
            NULL,
            NULL,
            'Método Yau + OLL Parity',
            '2026-11-05T15:10:00Z'::timestamptz
        )
    ON CONFLICT (id) DO UPDATE
       SET cube_type           = EXCLUDED.cube_type,
           time_seconds        = EXCLUDED.time_seconds,
           penalty             = EXCLUDED.penalty,
           scramble            = EXCLUDED.scramble,
           is_pb               = EXCLUDED.is_pb,
           ao5_after           = EXCLUDED.ao5_after,
           ao12_after          = EXCLUDED.ao12_after,
           algorithm_practiced = EXCLUDED.algorithm_practiced;

    -- ========================================================================
    -- 7B. ARSENAL DE CUBOS DE RUBIK Y ESPECIFICACIONES WCA (public.rubik_cubes)
    -- ========================================================================
    INSERT INTO public.rubik_cubes (
        id,
        user_id,
        cube_type,
        brand,
        model_name,
        magnetic_system,
        surface_finish,
        size_mm,
        weight_grams,
        wca_legal,
        recommended_setup,
        target_sub_seconds,
        recommended_alg_set,
        reward_gp_per_solve,
        pb_bonus_gp,
        status
    ) VALUES
        (
            md5(v_user_id::text || ':cube:1')::uuid,
            v_user_id,
            '3x3',
            'GAN',
            'GAN 14 MagLev Pro 3x3 UV',
            'Ball-Core + MagLev + Imanes Esquina-Arista (88+ imanes)',
            'UV Coated (Recubrimiento Brillante Alto Agarre)',
            56.00,
            71.00,
            TRUE,
            'Tensión Nivel 3/6 • Compresión MagLev Media • Lube Rápido en Piezas + Control en Core',
            18.00,
            'CFOP Completo (F2L Lookahead + 57 OLL + 21 PLL)',
            4500,
            2000,
            'active_main'
        ),
        (
            md5(v_user_id::text || ':cube:2')::uuid,
            v_user_id,
            '3x3',
            'MoYu',
            'MoYu WeiLong WRM V10 3x3 Ball-Core UV',
            'Ball-Core + MagLev + Imanes Esquina-Arista (88+ imanes)',
            'UV Coated (Recubrimiento Brillante Alto Agarre)',
            55.50,
            68.00,
            TRUE,
            'Tensión Nivel 3/6 • Compresión MagLev Media • Lube Rápido en Piezas + Control en Core',
            18.00,
            'CFOP Completo (F2L Lookahead + 57 OLL + 21 PLL)',
            4500,
            2000,
            'secondary'
        ),
        (
            md5(v_user_id::text || ':cube:3')::uuid,
            v_user_id,
            '2x2',
            'GAN',
            'GAN 251 M Pro 2x2',
            'Ball-Core Magnético (Núcleo Imantado + Aristas)',
            'Frosted Matte (Mate Antideslizante)',
            51.00,
            56.00,
            TRUE,
            'Tensión Media-Firme para evitar Corner Twist • Lubricante de Silicona Ligero',
            5.00,
            'Método Ortega (PBL) + CLL (42 Algoritmos)',
            4000,
            1800,
            'active_main'
        ),
        (
            md5(v_user_id::text || ':cube:4')::uuid,
            v_user_id,
            '4x4',
            'MoYu',
            'MoYu AoSu V7 4x4 Ball-Core UV',
            'Ball-Core Magnético (Núcleo Imantado + Aristas)',
            'UV Coated (Recubrimiento Brillante Alto Agarre)',
            60.00,
            112.00,
            TRUE,
            'Capas internas con lubricante rápido (baja viscosidad) • Capas externas estables',
            60.00,
            'Método Yau (3-2-3 Edge Pairing) + OLL/PLL Parity',
            5000,
            2500,
            'active_main'
        )
    ON CONFLICT (id) DO UPDATE
       SET cube_type         = EXCLUDED.cube_type,
           brand             = EXCLUDED.brand,
           model_name        = EXCLUDED.model_name,
           magnetic_system   = EXCLUDED.magnetic_system,
           surface_finish    = EXCLUDED.surface_finish,
           size_mm           = EXCLUDED.size_mm,
           weight_grams      = EXCLUDED.weight_grams,
           wca_legal         = EXCLUDED.wca_legal,
           recommended_setup = EXCLUDED.recommended_setup;

    -- ========================================================================
    -- 8. CATÁLOGO DE WISHLIST / LOOT SHOP (public.wishlist_items)
    -- ========================================================================
    INSERT INTO public.wishlist_items (
        id,
        user_id,
        name,
        cost_gp,
        priority,
        is_redeemed
    ) VALUES
        (
            md5(v_user_id::text || ':wish:1')::uuid,
            v_user_id,
            'Cubo Magnético Flagship (GAN / MoYu AoSu)',
            85000,
            1,
            FALSE
        ),
        (
            md5(v_user_id::text || ':wish:2')::uuid,
            v_user_id,
            'Kit Hilazas Merino + Agujas Ergonómicas Tejido',
            60000,
            2,
            FALSE
        ),
        (
            md5(v_user_id::text || ':wish:3')::uuid,
            v_user_id,
            'Cena Especial Fin de Semana / Libro Edición Dura',
            65000,
            3,
            FALSE
        )
    ON CONFLICT (id) DO UPDATE
       SET name     = EXCLUDED.name,
           cost_gp  = EXCLUDED.cost_gp,
           priority = EXCLUDED.priority;

END $$;

-- ============================================================================
-- 9. RESULTADO DE VERIFICACIÓN: COPIA `default_player_user_id` EN `.env.local`
-- ============================================================================
SELECT
    pt.user_id AS user_id,
    pt.user_id AS default_player_user_id,
    'DEFAULT_PLAYER_USER_ID="' || pt.user_id::text || '"' AS copy_into_env_local,
    pt.billing_period,
    pt.monthly_income_cop,
    pt.fixed_costs_budget_cop,
    pt.fixed_costs_spent_cop,
    pt.variable_ops_budget_cop,
    pt.variable_ops_spent_cop,
    pt.vault_remaining_gp,
    pt.wallet_gp,
    pt.current_streak_days,
    pt.aegis_shields,
    (SELECT COUNT(*) FROM public.debt_bosses db WHERE db.user_id = pt.user_id) AS bosses_count,
    (SELECT COUNT(*) FROM public.quest_catalog qc WHERE qc.user_id = pt.user_id) AS quests_count,
    (SELECT COUNT(*) FROM public.reading_books rb WHERE rb.user_id = pt.user_id) AS books_count,
    (SELECT COUNT(*) FROM public.knitting_projects kp WHERE kp.user_id = pt.user_id) AS knitting_count,
    (SELECT COUNT(*) FROM public.rubik_solves rs WHERE rs.user_id = pt.user_id) AS rubik_solves_count,
    (SELECT COUNT(*) FROM public.wishlist_items wi WHERE wi.user_id = pt.user_id) AS wishlist_count
FROM public.player_treasury pt
ORDER BY pt.updated_at DESC
LIMIT 1;
