-- ============================================================================
-- RPG PRODUCTIVITY & PERSONAL FINANCE LIFE-ENGINE v3.0 - SUPABASE DDL, TRIGGERS & RLS
-- Incluye:
-- 1. Auto-Migración Idempotente desde Fase 1/2 (ENUMs, Tablas y Columnas v2.0/v3.0)
-- 2. Economía Bóveda/Billetera + Seguimiento real de Costos Fijos ($848k) y Variables ($540k) + Castigo 1.2x
-- 3. Rachas (Streak Multipliers 1.1x / 1.25x con recálculo al perder racha) + Escudos Aegis
-- 4. Debt Bosses con "Combo Overflow", "Boss Counter-Attack" y Estrategia Snowball vs Avalanche
-- 5. Santuario de Habilidades & Sesiones: Cubos de Rubik (WCA Ao5/Ao12/PB), Lectura, Tejido, Estudio y Trabajo
-- 6. Políticas Row Level Security (RLS) completas e Índices de rendimiento
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Nota: Habilitar pg_cron desde el Dashboard de Supabase (Database -> Extensions)
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- 0. TIPOS ENUMERADOS (IDEMPOTENTES + AUTO-MIGRACIÓN DE VALORES NUEVOS)
-- ============================================================================
DO $$ BEGIN
    CREATE TYPE expense_category AS ENUM (
        'fixed_mandatory',          -- $848,000 COP (Internet, gym, natillera, etc.)
        'variable_operational',     -- $540,000 COP (Transporte, salud, familia, mercado base)
        'debt_attack',              -- Pagos a Nequi, ADDI, Bancolombia
        'discretionary_wishlist',   -- Compras redimidas con GP de la Billetera (1.0x)
        'discretionary_unbudgeted'  -- Gasto impulsivo no presupuestado (Penalización 1.2x o Escudo Aegis)
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

-- ============================================================================
-- 1. TABLA DE ESTADO DEL JUGADOR Y FINANZAS (BÓVEDA, BILLETERA, RACHAS Y ESCUDOS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.player_treasury (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM', ej: '2026-11'
    
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
    
    -- Estadísticas RPG, Rachas y Escudos
    player_level INT NOT NULL DEFAULT 1,
    current_xp BIGINT NOT NULL DEFAULT 0,
    current_streak_days INT NOT NULL DEFAULT 0,
    streak_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00, -- 1.00x base, 1.10x (3+ días), 1.25x (7+ días)
    aegis_shields INT NOT NULL DEFAULT 1,                  -- Escudos que absorben la multa 0.2x
    last_activity_date DATE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, billing_period),
    CONSTRAINT chk_vault_non_negative CHECK (vault_remaining_gp >= 0),
    CONSTRAINT chk_shields_non_negative CHECK (aegis_shields >= 0)
);

-- Migración idempotente de columnas v2.0/v3.0 para bases de datos existentes de Fase 1/2
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

-- ============================================================================
-- 2. TABLA DE DEUDAS (DEBT BOSSES)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.debt_bosses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_hp NUMERIC(12, 2) NOT NULL,
    current_hp NUMERIC(12, 2) NOT NULL,
    interest_rate_ea NUMERIC(5, 2) NOT NULL DEFAULT 24.00, -- Tasa Efectiva Anual para Counter-Attack
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

-- ============================================================================
-- 3. CATÁLOGO DE HÁBITOS / MISIONES (QUEST TEMPLATES)
-- ============================================================================
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

-- ============================================================================
-- 4. REGISTRO DE ACTIVIDADES Y SESIONES DE HABILIDAD (ACTIVITY & SKILL LOGS)
-- ============================================================================
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

-- ============================================================================
-- 5. TABLAS ESPECIALIZADAS: CUBOS DE RUBIK, LECTURA Y TEJIDO
-- ============================================================================
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

-- ============================================================================
-- 6. CATÁLOGO DE WISHLIST (LOOT SHOP)
-- ============================================================================
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

-- ============================================================================
-- 7. TRANSACCIONES FINANCIERAS (EXPENSES, RECEIPT SPLITS & BOSS ATTACKS)
-- ============================================================================
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

-- ============================================================================
-- 8. TRIGGER 1: HÁBITOS / SESIONES + RACHAS (1.1x / 1.25x) + ESCUDO AEGIS CADA 7 RACHAS
-- ============================================================================
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

    -- Cálculo de Racha
    v_new_streak := v_treasury.current_streak_days + 1;

    IF v_new_streak >= 7 THEN
        v_new_multiplier := 1.25;
    ELSIF v_new_streak >= 3 THEN
        v_new_multiplier := 1.10;
    ELSE
        v_new_multiplier := 1.00;
    END IF;

    -- Cada múltiplo de 7 en racha otorga +1 Escudo de Disciplina (Aegis Shield)
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

-- ============================================================================
-- 9. TRIGGER 2: GASTOS (1.2x O ESCUDO AEGIS), CONTROL DE PRESUPUESTOS Y COMBO OVERFLOW
-- ============================================================================
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

    -- CASO A: Gasto Discrecional NO Presupuestado (Verifica si hay Escudo Aegis)
    IF NEW.category = 'discretionary_unbudgeted' THEN
        IF v_treasury.aegis_shields > 0 AND COALESCE(NEW.aegis_shield_used, TRUE) THEN
            -- El Escudo Aegis absorbe la multa 0.2x
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
            -- Sin escudo: Castigo implacable 1.2x, quema de Bóveda y reducción de racha + multiplicador
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

    -- CASO B: Compra Presupuestada de Wishlist (1.0x)
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

    -- CASO C: Costos Fijos Obligatorios ($848,000 COP presupuesto)
    ELSIF NEW.category = 'fixed_mandatory' THEN
        NEW.aegis_shield_used := FALSE;
        UPDATE public.player_treasury
           SET fixed_costs_spent_cop = fixed_costs_spent_cop + NEW.amount_cop,
               updated_at            = NOW()
         WHERE id = NEW.treasury_id;

    -- CASO D: Variables Operativos ($540,000 COP presupuesto)
    ELSIF NEW.category = 'variable_operational' THEN
        NEW.aegis_shield_used := FALSE;
        UPDATE public.player_treasury
           SET variable_ops_spent_cop = variable_ops_spent_cop + NEW.amount_cop,
               updated_at             = NOW()
         WHERE id = NEW.treasury_id;

    -- CASO E: Ataque a Deuda con COMBO OVERFLOW (Soporta Snowball y Avalanche)
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

-- ============================================================================
-- 10. FUNCIÓN DE CIERRE DE MES: BOSS COUNTER-ATTACK (Ejecutable vía pg_cron)
-- ============================================================================
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
        -- Conversión de tasa Efectiva Anual a Efectiva Mensual: (1 + EA)^(1/12) - 1
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

    -- Si hay Bosses Enraged, bloquean 10% de la Bóveda ($40,000 GP) por cada Boss enfurecido
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

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) E ÍNDICES DE RENDIMIENTO
-- ============================================================================
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
