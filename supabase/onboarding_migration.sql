-- ============================================================================
-- MIGRACIÓN ONBOARDING & PERSONALIZACIÓN DE USUARIO NUEVO (v3.2)
-- Incluye:
-- 1. Unicidad de display_name (nombre de aventurero único) + profesión en profiles
-- 2. Tabla de caché/búsqueda de clases por profesión (profession_class_catalog)
-- 3. Nuevos dominios en ENUM skill_domain ('gaming', 'sports')
-- 4. Tabla de buzón de nuevas habilidades propuestas por usuarios (skill_suggestions)
-- ============================================================================

-- Nuevos valores para el ENUM skill_domain (si existe en la BD)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skill_domain') THEN
    ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'gaming';
    ALTER TYPE skill_domain ADD VALUE IF NOT EXISTS 'sports';
  END IF;
END $$;

-- 1. Tabla de Perfiles de Usuario y columnas extendidas
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
  savings_goal_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  main_goal TEXT,
  goal_deadline DATE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profession TEXT NOT NULL DEFAULT 'Estudiante / Explorador';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'COP';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Bogota';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_frequency TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_day SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS savings_goal_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS main_goal TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_deadline DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice único case-insensitive para garantizar que el nombre del aventurero sea único
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_display_name_unique
  ON public.profiles (LOWER(TRIM(display_name)));

-- 2. Tabla de búsqueda / caché de Clases de Personaje por Profesión
CREATE TABLE IF NOT EXISTS public.profession_class_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_key TEXT NOT NULL UNIQUE,
  profession_label TEXT NOT NULL,
  classes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'preset', -- 'preset' | 'gemini'
  usage_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Desglose de Costos Fijos
CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  category TEXT NOT NULL DEFAULT 'hogar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Habilidades / Hábitos seleccionados por el usuario
CREATE TABLE IF NOT EXISTS public.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  label TEXT NOT NULL,
  weekly_target_minutes INT NOT NULL DEFAULT 120,
  preferred_session_time TEXT NOT NULL DEFAULT 'noche',
  custom_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, domain)
);

ALTER TABLE public.user_skills ADD COLUMN IF NOT EXISTS custom_description TEXT;

-- 5. Registro de habilidades propuestas por usuarios (para desarrollar nuevas versiones)
CREATE TABLE IF NOT EXISTS public.skill_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  skill_name TEXT NOT NULL,
  tracking_idea TEXT NOT NULL DEFAULT '',
  weekly_target_minutes INT NOT NULL DEFAULT 120,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Políticas RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profession_class_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone authenticated reads profession catalog" ON public.profession_class_catalog;
CREATE POLICY "Anyone authenticated reads profession catalog" ON public.profession_class_catalog
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users insert profession catalog" ON public.profession_class_catalog;
CREATE POLICY "Authenticated users insert profession catalog" ON public.profession_class_catalog
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users manage own fixed_costs" ON public.fixed_costs;
CREATE POLICY "Users manage own fixed_costs" ON public.fixed_costs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own user_skills" ON public.user_skills;
CREATE POLICY "Users manage own user_skills" ON public.user_skills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own skill_suggestions" ON public.skill_suggestions;
CREATE POLICY "Users manage own skill_suggestions" ON public.skill_suggestions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
