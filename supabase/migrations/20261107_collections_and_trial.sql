-- ============================================================================
-- MIGRACIÓN DE PRODUCCIÓN: COLECCIONES PERSISTENTES (LIBROS, FRASES, CUBOS)
-- Y BITÁCORA DEL PERIODO DE PRUEBA (PILOTO 30 DÍAS)
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
