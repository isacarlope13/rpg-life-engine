-- ============================================================================
-- DRAFT MIGRACIÓN ADITIVA FASE 2 (NO EJECUTADA EN PRODUCCIÓN — REQUIERE APROBACIÓN)
-- Extiende public.building_resources + crea bucket privado en Supabase Storage con RLS
-- ============================================================================

ALTER TABLE public.building_resources
    ADD COLUMN IF NOT EXISTS resource_type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS activity_id UUID,
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) NOT NULL DEFAULT 'ready',
    ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(30) NOT NULL DEFAULT 'not_applicable',
    ADD COLUMN IF NOT EXISTS extraction_error TEXT,
    ADD COLUMN IF NOT EXISTS extracted_text TEXT,
    ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_sensitive_financial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_building_resources_dedup_hash
    ON public.building_resources(user_id, building_id, content_hash)
    WHERE content_hash IS NOT NULL AND deleted_at IS NULL;

-- Bucket privado para archivos de los 8 edificios (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('oakhaven-private-resources', 'oakhaven-private-resources', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS estrictas por carpeta raíz = auth.uid()
DROP POLICY IF EXISTS "Users read own private resources" ON storage.objects;
CREATE POLICY "Users read own private resources" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'oakhaven-private-resources'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users upload own private resources" ON storage.objects;
CREATE POLICY "Users upload own private resources" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'oakhaven-private-resources'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users delete own private resources" ON storage.objects;
CREATE POLICY "Users delete own private resources" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'oakhaven-private-resources'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
