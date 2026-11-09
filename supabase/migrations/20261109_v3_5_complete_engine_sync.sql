-- ============================================================================
-- RPG LIFE-ENGINE v3.5 - MASTER MIGRATION & FULL SYNC SCRIPT
-- ============================================================================
-- Este script es 100% IDEMPOTENTE y SEGURO.
-- No borra datos existentes. Crea las tablas faltantes, añade columnas nuevas
-- y actualiza ENUMs para habilitar la máxima captura de datos del sistema.
-- Ejecútalo directamente en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ACTUALIZACIÓN SEGURA DE ENUMS (Habilidades y Estrategias)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_domain') THEN
    CREATE TYPE skill_domain AS ENUM ('rubik', 'reading', 'knitting', 'study', 'work', 'general');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debt_strategy_type') THEN
    CREATE TYPE debt_strategy_type AS ENUM ('snowball', 'avalanche');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quest_difficulty') THEN
    CREATE TYPE quest_difficulty AS ENUM ('easy', 'medium', 'hard', 'epic');
  END IF;
END $$;

-- Nuevos dominios de habilidades del Santuario y Actividades Diarias
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'rubik';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'reading';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'knitting';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'study';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'work';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'general';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'gym';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'meditation';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'journaling';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'gardening';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'drawing';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'ceramics';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'hiking';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'cooking';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'gaming';
ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'sports';

-- 3. TABLA DE PERFILES DE USUARIO (PROFILES) Y METADATOS EXPANDIDOS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT 'Aventurero RPG',
  profession TEXT NOT NULL DEFAULT 'Estudiante / Explorador',
  character_class TEXT NOT NULL DEFAULT 'Paladín Financiero',
  avatar_url TEXT,
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  timezone TEXT NOT NULL DEFAULT 'America/Bogota',
  pay_frequency TEXT NOT NULL DEFAULT 'monthly',
  pay_day SMALLINT NOT NULL DEFAULT 1,
  savings_goal_monthly NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  main_goal TEXT,
  goal_deadline DATE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  data_privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_accepted_at TIMESTAMPTZ,
  privacy_version TEXT DEFAULT 'v1.0-2026',
  daily_schedule JSONB DEFAULT '{}'::jsonb,
  work_projects JSONB DEFAULT '[]'::jsonb,
  spaced_cards JSONB DEFAULT '[]'::jsonb,
  unlocked_perks JSONB DEFAULT '[]'::jsonb,
  collections_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Aventurero RPG';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT NOT NULL DEFAULT 'Estudiante / Explorador';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS character_class TEXT NOT NULL DEFAULT 'Paladín Financiero';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'COP';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_frequency TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_day SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS savings_goal_monthly NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_goal TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_deadline DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS privacy_version TEXT DEFAULT 'v1.0-2026';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_schedule JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_projects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS spaced_cards JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlocked_perks JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS collections_state JSONB DEFAULT '{}'::jsonb;

-- Índice para unicidad de display_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_unique ON public.profiles(LOWER(display_name));

-- 4. TABLA DE TESORERÍA (PLAYER_TREASURY)
CREATE TABLE IF NOT EXISTS public.player_treasury (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_period VARCHAR(7) NOT NULL,
  monthly_income_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  fixed_costs_budget_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  fixed_costs_spent_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  variable_ops_budget_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  variable_ops_spent_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  vault_cap_gp BIGINT NOT NULL DEFAULT 300000,
  vault_remaining_gp BIGINT NOT NULL DEFAULT 300000,
  wallet_gp BIGINT NOT NULL DEFAULT 0,
  total_penalty_gp BIGINT NOT NULL DEFAULT 0,
  debt_strategy debt_strategy_type NOT NULL DEFAULT 'snowball',
  player_level INT NOT NULL DEFAULT 1,
  current_xp BIGINT NOT NULL DEFAULT 0,
  current_streak_days INT NOT NULL DEFAULT 0,
  streak_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  aegis_shields INT NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, billing_period)
);

-- 5. DEBT BOSSES (JEFES DE DEUDA)
CREATE TABLE IF NOT EXISTS public.debt_bosses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  institution VARCHAR(100),
  max_hp NUMERIC(14, 2) NOT NULL,
  current_hp NUMERIC(14, 2) NOT NULL,
  interest_rate_ea NUMERIC(6, 2) NOT NULL,
  minimum_payment_cop NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  enrage_payment_due_date DATE,
  is_enraged BOOLEAN NOT NULL DEFAULT FALSE,
  priority_order INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. CATÁLOGO DE MISIONES (QUEST_CATALOG)
CREATE TABLE IF NOT EXISTS public.quest_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  domain skill_domain NOT NULL DEFAULT 'general',
  difficulty quest_difficulty NOT NULL DEFAULT 'medium',
  reward_gp BIGINT NOT NULL DEFAULT 4000,
  reward_xp INT NOT NULL DEFAULT 50,
  daily_limit INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code)
);

-- 7. BITÁCORA DE ACTIVIDADES & SESIONES (ACTIVITY_LOGS)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain skill_domain NOT NULL DEFAULT 'general',
  activity_name VARCHAR(150) NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  requested_gp BIGINT NOT NULL DEFAULT 0,
  streak_multiplier_applied NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
  transferred_gp BIGINT NOT NULL DEFAULT 0,
  earned_xp INT NOT NULL DEFAULT 0,
  shield_earned BOOLEAN NOT NULL DEFAULT FALSE,
  session_metadata JSONB DEFAULT '{}'::jsonb,
  source VARCHAR(50) NOT NULL DEFAULT 'ios_shortcut',
  notes TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS source VARCHAR(50) NOT NULL DEFAULT 'ios_shortcut';

-- 8. CUBOS DE RUBIK & TIEMPOS WCA
CREATE TABLE IF NOT EXISTS public.rubik_cubes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cube_id VARCHAR(50) NOT NULL,
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(100) NOT NULL,
  cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
  is_magnetic BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  price_paid NUMERIC(12, 2) DEFAULT 0,
  purchase_date TEXT,
  store_or_source TEXT,
  specs_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cube_id)
);

ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS price_paid NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS purchase_date TEXT;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS store_or_source TEXT;
ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS specs_metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.rubik_solves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cube_id VARCHAR(50),
  cube_type VARCHAR(20) NOT NULL DEFAULT '3x3',
  time_seconds NUMERIC(8, 2) NOT NULL,
  scramble TEXT NOT NULL,
  penalty VARCHAR(10) NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. BIBLIOTECA DE LECTURA (READING_BOOKS)
CREATE TABLE IF NOT EXISTS public.reading_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id VARCHAR(60) NOT NULL,
  title VARCHAR(200) NOT NULL,
  author VARCHAR(150) NOT NULL,
  total_pages INT NOT NULL,
  current_page INT NOT NULL DEFAULT 0,
  cover_url TEXT,
  format VARCHAR(20) DEFAULT 'physical',
  complexity VARCHAR(20) DEFAULT 'medium',
  price_paid NUMERIC(12, 2) DEFAULT 0,
  purchase_date TEXT,
  store_or_source TEXT,
  specs_metadata JSONB DEFAULT '{}'::jsonb,
  quotes JSONB DEFAULT '[]'::jsonb,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS specs_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS quotes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS price_paid NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS purchase_date TEXT;
ALTER TABLE public.reading_books ADD COLUMN IF NOT EXISTS store_or_source TEXT;

-- 10. PROYECTOS DE TEJIDO / CROCHET
CREATE TABLE IF NOT EXISTS public.knitting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  total_rows INT NOT NULL,
  current_row INT NOT NULL DEFAULT 0,
  yarn_brand VARCHAR(80),
  needle_size VARCHAR(20),
  pattern_notes TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, project_id)
);

-- 11. LISTA DE DESEOS (WISHLIST)
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  cost_cop NUMERIC(14, 2) NOT NULL,
  priority INT NOT NULL DEFAULT 3,
  category VARCHAR(50) DEFAULT 'general',
  is_locked_by_bosses BOOLEAN NOT NULL DEFAULT TRUE,
  is_purchased BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TRANSACCIONES FINANCIERAS
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT,
  merchant VARCHAR(100),
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'expense',
  budget_bucket VARCHAR(30) NOT NULL DEFAULT 'variable_ops',
  invoice_items JSONB DEFAULT '[]'::jsonb,
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. COSTOS FIJOS (FIXED_COSTS)
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  category TEXT NOT NULL DEFAULT 'hogar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. HABILIDADES SELECCIONADAS (USER_SKILLS)
CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  weekly_target_minutes INT NOT NULL DEFAULT 120,
  preferred_session_time TEXT NOT NULL DEFAULT 'noche',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. BUZÓN DE NUEVAS HABILIDADES (SKILL_SUGGESTIONS)
CREATE TABLE IF NOT EXISTS public.skill_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  suggested_name TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. CACHÉ GLOBAL DE PROFESIONES Y ESPECIFICACIONES IA
CREATE TABLE IF NOT EXISTS public.profession_class_catalog (
  normalized_key TEXT PRIMARY KEY,
  profession_label TEXT NOT NULL,
  classes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.catalog_ai_cache (
  cache_key TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  raw_query TEXT NOT NULL,
  specs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 17. BLINDAJE DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- Cada usuario solo puede ver y editar sus propios registros.
-- El Service Role de Railway / Backend tiene acceso total para aprovisionamiento.
-- ============================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'profiles', 'player_treasury', 'debt_bosses', 'quest_catalog',
    'activity_logs', 'rubik_cubes', 'rubik_solves', 'reading_books',
    'knitting_projects', 'wishlist_items', 'financial_transactions',
    'fixed_costs', 'user_skills', 'skill_suggestions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Política de aislamiento de usuario
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_user_isolation', tbl);
    IF tbl = 'profiles' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);', tbl || '_user_isolation', tbl);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);', tbl || '_user_isolation', tbl);
    END IF;
  END LOOP;
END $$;

-- RLS de Tablas Catálogo / Caché (Lectura para autenticados, escritura para service_role)
ALTER TABLE public.profession_class_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profession_catalog_read_authenticated" ON public.profession_class_catalog;
CREATE POLICY "profession_catalog_read_authenticated" ON public.profession_class_catalog FOR SELECT TO authenticated USING (true);

ALTER TABLE public.catalog_ai_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_ai_cache_read_authenticated" ON public.catalog_ai_cache;
CREATE POLICY "catalog_ai_cache_read_authenticated" ON public.catalog_ai_cache FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 18. SUPABASE REALTIME (ACTUALIZACIONES EN TIEMPO REAL ENTRE DISPOSITIVOS)
-- Permite que al registrar un atajo de iOS o una sesión de Spotify, el Dashboard
-- en la web se actualice inmediatamente sin recargar la página.
-- ============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_treasury;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_bosses;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_transactions;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
