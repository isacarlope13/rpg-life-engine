# CONTRATO DE SINCRONIZACIÓN UNIVERSAL (FASE 8)

- **Módulo:** `src/lib/sync/universal-sync-engine.ts`
- **Endpoint autenticado:** `GET /api/sync?domain=...` y `POST /api/sync` (`src/app/api/sync/route.ts`)
- **Componente Cozy UI:** `src/components/sanctuary/sync-status-badge.tsx`

## 1. Envoltorio Común (`SyncRecordEnvelope<T>`)
Cada registro sincronizable porta:
- `clientId`: identificador estable generado en cliente (`UNIQUE (user_id, client_id)` en PostgreSQL para evitar duplicados por recarga o reintento).
- `ownerId`: validado contra el `authenticatedUserId` del servidor (impide mezclar cuentas en un mismo navegador).
- `version`: entero incremental para detección optimista de conflictos.
- `updatedAt` / `deletedAt`: marcas de tiempo y archivado lógico reversible.
- `isDemo` / `dataOrigin`: los registros `demo_template` o `demo-*` se excluyen automáticamente.

## 2. Estados de UI (Cozy)
1. `SINCRONIZADO`: confirmación real recibida de Supabase.
2. `PENDIENTE_DE_SINCRONIZAR`: guardado localmente en cola idempotente (o migración SQL pendiente).
3. `SIN_CONEXION`: sin red; respaldo local activo sin pérdida de datos.
4. `CONFLICTO_REQUIERE_REVISION`: edición concurrente detectada; opciones guiadas `keep_local`, `keep_remote` o `keep_both`.
5. `ERROR_RECUPERABLE`: fallo transitorio con reintento exponencial (`computeBackoffMs`, 1s → 30s) conservando los datos locales intactos.

## 3. Exclusiones de Seguridad
`isForbiddenFinancialOrSecretKey()` bloquea tokens, credenciales, claves API y extractos bancarios. El endpoint `POST /api/sync` aplica lista blanca de columnas (anti mass-assignment) y límite máximo de `256 KB` por solicitud.
