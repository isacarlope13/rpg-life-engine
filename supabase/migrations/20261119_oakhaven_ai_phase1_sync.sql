-- ============================================================================
-- MIGRACIÓN ADITIVA APROBADA: OAKHAVEN AI FASE 1 — CINE Y RECURSOS CON RLS
-- Ejecutar en Supabase Dashboard -> SQL Editor (100% idempotente y aditiva)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cinema_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('movie', 'series', 'musical')),
    status VARCHAR(20) NOT NULL DEFAULT 'watchlist' CHECK (status IN ('watching', 'watchlist', 'watched', 'favorite')),
    rating INT CHECK (rating BETWEEN 1 AND 5),
    season INT,
    episode INT,
    favorite_song_or_scene TEXT,
    notes TEXT NOT NULL DEFAULT '',
    watched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.cinema_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cinema_entries" ON public.cinema_entries;
CREATE POLICY "Users manage own cinema_entries" ON public.cinema_entries
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cinema_entries_user_updated
    ON public.cinema_entries(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.building_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    building_id VARCHAR(40) NOT NULL,
    resource_category VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_path TEXT,
    external_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.building_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own building_resources" ON public.building_resources;
CREATE POLICY "Users manage own building_resources" ON public.building_resources
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_building_resources_user_building
    ON public.building_resources(user_id, building_id, updated_at DESC);
