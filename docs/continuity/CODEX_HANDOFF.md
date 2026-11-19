# CODEX HANDOFF — OAKHAVEN RELEASE 3.1 (GO / NO-GO LISTO) (2026-11-19)

- **Estado**: **`RELEASE 3.1 — LISTO PARA DECISIÓN HUMANA DE MIGRACIÓN Y DESPLIEGUE`** en rama `feat/oakhaven-phase8-data-continuity` (base `main` @ `8220155`, Release 3.0). Sin SQL ejecutado en producción, sin `push`, sin `merge`, sin despliegue.
- **Documento GO/NO-GO y Checklist completo**: `docs/data/RELEASE_3_1_MIGRATION_AUDIT.md`.
- **Archivo SQL final**: `supabase/drafts/20261119_phase8_data_continuity_sync.sql`.
- **Riesgos cerrados en este paquete GO/NO-GO**:
  1. **Concurrencia optimista atómica (CAS):** `POST /api/sync` (`src/app/api/sync/route.ts`) y `src/lib/sync/local-sync-memory.ts` ejecutan `UPDATE ... WHERE user_id = ? AND client_id = ? AND version = expectedVersion` con incremento atómico `version + 1` y manejo de colisión `23505` en inserciones. Probado con carrera simultánea de 2 dispositivos (`tests/oakhaven-phase8-data-continuity.test.ts`) y en PostgreSQL real (`tests/phase8-migration-sql.test.ts`).
  2. **Mínimos privilegios SQL:** `REVOKE ALL FROM PUBLIC, anon`, `REVOKE DELETE FROM authenticated`, `GRANT SELECT, INSERT, UPDATE TO authenticated`, archivado lógico vía `deleted_at` (sin políticas `FOR DELETE`). Verificado en PGlite con rechazo explícito de `DELETE` para `authenticated`.
  3. **Kill-switch de sincronización:** `OAKHAVEN_SYNC_ENABLED=false` pausa `GET/POST /api/sync` devolviendo `PENDIENTE_DE_SINCRONIZAR` sin pérdida de datos locales.
  4. **Checklist completo de migración y despliegue en 10 pasos:** consultas de solo lectura previas y posteriores, backup verificable, condiciones de parada y rollback sin pérdida.
- **Resultados QA**: `npx tsc --noEmit` (0 errores), `npm test` (**328/328 aprobadas**), `npm run build` (exit code 0).
- **Bloqueadores residuales**: ejecución manual del SQL en Supabase con aprobación humana + E2E real en 2 navegadores tras aplicar SQL.
