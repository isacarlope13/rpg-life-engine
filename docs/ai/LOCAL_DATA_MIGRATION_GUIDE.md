# LOCAL DATA MIGRATION GUIDE — MIGRACIÓN SEGURA DESDE LOCALSTORAGE

## 1. Qué datos viven actualmente en `localStorage`
1. **Cine (`cinema-store.ts`)**: `oakhaven_cinema_catalog_v1_<ownerId>` (películas, series y musicales). Ya sincroniza con `/api/cinema` en cuanto ejecutes la migración SQL.
2. **Patrones e imágenes de Crochet (`atelier-patterns-store.ts`)**: `oakhaven_atelier_patterns_v1_<ownerId>`.
3. **Borradores de biblioteca por edificio (`building-library-panel.tsx`)**: `oakhaven_private_library_v2_<ownerId>_<buildingId>`.

## 2. Cómo funciona el motor `src/lib/ai/local-migration-engine.ts`
1. **Valida propietario:** rechaza importar datos si `localOwnerId !== authenticatedUserId` (nunca mezcla cuentas).
2. **Genera respaldo exportable:** `buildCinemaMigrationPlan` y `buildCrochetPatternsBackupJson` generan un JSON descargable antes de modificar nada.
3. **Compara local vs remoto por huella (`kind:title` / `id`):** clasifica cada registro en `toImport`, `alreadySynced` o `conflicts`.
4. **Cero sobrescritura silenciosa:** si el servidor responde vacío, los registros locales **se conservan intactos**. Si un episodio o nota difiere entre dispositivos, se marca como `CONFLICTO` para tu decisión.
5. **No borra `localStorage` automáticamente:** el origen local permanece intacto hasta que confirmes manualmente la limpieza.

## 3. Pasos manuales en Supabase Dashboard (cuando autorices)
1. Abrir **Supabase Dashboard → SQL Editor**.
2. Ejecutar primero `supabase/migrations/20261119_oakhaven_ai_phase1_sync.sql` (si no se ha ejecutado aún).
3. Ejecutar después `supabase/drafts/20261119_phase2_private_storage_and_resources.sql` para añadir las columnas extendidas de `building_resources` y el bucket privado `oakhaven-private-resources` con sus políticas RLS.
