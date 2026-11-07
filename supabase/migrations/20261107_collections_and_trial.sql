-- ============================================================================
-- MIGRACIÓN DE PRODUCCIÓN: COLECCIONES PERSISTENTES (LIBROS, FRASES, CUBOS),
-- BITÁCORA DEL PERIODO DE PRUEBA Y ESCUDO DE CACHÉ GLOBAL IA CON RLS ACTIVO
-- ============================================================================

-- 1. Agregar columna JSONB collections_state a public.profiles para sincronizar
--    Galería de Libros (portadas, costos, fechas de compra y frases capturadas),
--    Arsenal de Cubos (costos, fechas de compra) y Bitácora del Piloto (trial_checkpoints).
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS collections_state JSONB DEFAULT '{}'::jsonb;

-- 2. Agregar columnas de costo y fecha de compra a rubik_cubes y reading_books
ALTER TABLE IF EXISTS public.rubik_cubes
  ADD COLUMN IF NOT EXISTS price_paid NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchase_date TEXT,
  ADD COLUMN IF NOT EXISTS store_or_source TEXT;

ALTER TABLE IF EXISTS public.reading_books
  ADD COLUMN IF NOT EXISTS specs_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Tabla de catálogo caché de profesiones generadas por Gemini (Paso 1 Onboarding)
CREATE TABLE IF NOT EXISTS public.profession_class_catalog (
  normalized_key TEXT PRIMARY KEY,
  profession_label TEXT NOT NULL,
  classes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blindaje RLS en profession_class_catalog (Solo lectura para usuarios autenticados; escritura exclusiva del servidor con service_role)
ALTER TABLE public.profession_class_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profession_catalog_read_authenticated" ON public.profession_class_catalog;
CREATE POLICY "profession_catalog_read_authenticated"
  ON public.profession_class_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Tabla de Caché Global IA para Libros y Cubos (Costo $0 en consultas repetidas entre miles de usuarios)
CREATE TABLE IF NOT EXISTS public.catalog_ai_cache (
  cache_key TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  raw_query TEXT NOT NULL,
  specs_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blindaje RLS en catalog_ai_cache (Solo lectura para usuarios autenticados; escritura exclusiva del servidor con service_role)
ALTER TABLE public.catalog_ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_ai_cache_read_authenticated" ON public.catalog_ai_cache;
CREATE POLICY "catalog_ai_cache_read_authenticated"
  ON public.catalog_ai_cache
  FOR SELECT
  TO authenticated
  USING (true);
