# OAKHAVEN — RELEASE 3.1: AUDITORÍA DE MIGRACIÓN SQL Y DECISIÓN GO / NO-GO

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase8-data-continuity` (base `main` @ `8220155`, Release 3.0)  
**Archivo SQL final:** `supabase/drafts/20261119_phase8_data_continuity_sync.sql`  
**Estado:** **`RELEASE 3.1 — LISTO PARA DECISIÓN HUMANA DE MIGRACIÓN Y DESPLIEGUE`** *(sin ejecutar SQL en producción, sin `push`, sin `merge`, sin despliegue)*

---

## 1. Cierre de Riesgos Residuales (GO / NO-GO)

### 1.1 Concurrencia Optimista Atómica (Compare-And-Swap en `/api/sync`)
- **Implementación:** `src/app/api/sync/route.ts` y `src/lib/sync/local-sync-memory.ts` reemplazaron la lectura+upsert previa por un **Compare-And-Swap (CAS) atómico**:
  - **Actualizaciones:** `UPDATE ... SET ..., version = expectedVersion + 1 WHERE user_id = $userId AND client_id = $clientId AND version = $expectedVersion` (o `sync_version` en `rubik_cubes`). Si la sentencia afecta `0` filas, se consulta la versión remota actual y se devuelve `CONFLICTO_REQUIERE_REVISION` con `conflicts[]` sin pérdida silenciosa.
  - **Inserciones nuevas:** `INSERT` con `version = 1`; si dos dispositivos insertan el mismo `(user_id, client_id)` simultáneamente, el error `23505` (violación de `UNIQUE`) se captura y se reporta como conflicto explícito.
- **Pruebas:**
  - `tests/oakhaven-phase8-data-continuity.test.ts`: dos dispositivos enviando simultáneamente `expectedVersion = 1` → Dispositivo A avanza a `v2`, Dispositivo B recibe `CONFLICTO_REQUIERE_REVISION` con `remoteVersion: 2`.
  - `tests/phase8-migration-sql.test.ts`: prueba CAS SQL real en PostgreSQL (PGlite) verificando que el segundo `UPDATE ... WHERE version = 1` afecta `0` filas.

### 1.2 Mínimos Privilegios SQL (`GRANT` / `REVOKE` + RLS)
- **Política aplicada en `supabase/drafts/20261119_phase8_data_continuity_sync.sql`:**
  - `REVOKE ALL ON TABLE ... FROM PUBLIC, anon;`
  - `REVOKE DELETE ON TABLE ... FROM authenticated;`
  - `GRANT SELECT, INSERT, UPDATE ON TABLE ... TO authenticated;`
  - Eliminadas las políticas RLS `FOR DELETE` en `gym_workout_sets`, `work_projects` y `work_project_tasks`; todo archivado/borrado por usuario es **lógico** mediante `deleted_at`.
  - `service_role`: todas las consultas en `src/app/api/sync/route.ts` filtran obligatoriamente por `.eq("user_id", userId)` con `userId` autenticado en servidor (`requireShortcutUser`).
- **Prueba en PGlite (`tests/phase8-migration-sql.test.ts`):**
  - `anon` rechazado por `REVOKE ALL`.
  - `authenticated` (`USER_A`) **bloqueado al intentar `DELETE` físico** en `gym_workout_sets` y `work_projects` (`permission denied`).
  - `USER_B` ve `0` filas de `USER_A` y es rechazado por RLS al intentar insertar o actualizar filas ajenas.

### 1.3 Kill-Switch de Sincronización (`OAKHAVEN_SYNC_ENABLED`)
- En `GET /api/sync` y `POST /api/sync`, si `process.env.OAKHAVEN_SYNC_ENABLED === "false"`:
  - La sincronización en nube queda pausada inmediatamente sin necesidad de rollback de código.
  - Responde `syncDisabled: true` y `status: "PENDIENTE_DE_SINCRONIZAR"`.
  - Todos los datos locales en IndexedDB / `localStorage` permanecen intactos y en cola hasta reactivar `OAKHAVEN_SYNC_ENABLED=true`.

### 1.4 Compatibilidad de Esquema y Exclusión Financiera
- `getRegisteredCubes()` (`src/lib/ai/bruno-milo-tools.ts`) alineado con columnas reales de `public.rubik_cubes` (`model`, `is_favorite`) + columnas aditivas `tension_notes`, `lube_notes`, `maintenance_needs`, `custom_notes`, `algorithms_to_master`, `sync_version`, `updated_at`.
- **Exclusión financiera absoluta:** Cero sentencias sobre `financial_transactions`, `player_treasury`, `fixed_costs`, `debt_bosses` ni `rubik_solves`.

---

## 2. Checklist de Preparación de Migración (Solo Lectura, Respaldo, Ejecución y Validación)

### Paso A — Verificación de solo lectura del esquema actual en producción (antes de migrar)
```sql
-- 1. Confirmar estructura real de public.rubik_cubes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'rubik_cubes'
ORDER BY ordinal_position;

-- 2. Confirmar que las nuevas tablas no colisionan con definiciones inesperadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('gym_workout_sets', 'work_projects', 'work_project_tasks', 'rubik_cubes', 'rubik_solves', 'financial_transactions');

-- 3. Conteo de línea base de tablas sensibles (debe permanecer idéntico tras migrar)
SELECT
  (SELECT count(*) FROM public.rubik_cubes) AS rubik_cubes_count,
  (SELECT count(*) FROM public.rubik_solves) AS rubik_solves_count,
  (SELECT count(*) FROM public.financial_transactions) AS financial_transactions_count;
```

### Paso B — Respaldo verificable y recuperación
1. Crear un **snapshot / backup lógico** desde el panel de Supabase (Database → Backups) o `pg_dump --schema=public` y verificar que el archivo de respaldo no esté vacío.
2. Exportar respaldo JSON local desde las bibliotecas del usuario como doble red de seguridad.
3. **Procedimiento de recuperación:** Si ocurre una anomalía inesperada antes de tráfico de escritura, restaurar desde el snapshot de Supabase; si ya hubo tráfico, **NO** ejecutar `DROP TABLE` ni `DROP COLUMN` (la migración es 100% aditiva y backward-compatible con Release 3.0).

### Paso C — Ejecución SQL exacta
- Archivo único: `supabase/drafts/20261119_phase8_data_continuity_sync.sql`
- Orden interno del script:
  1. `fn_phase8_set_updated_at()`
  2. `public.gym_workout_sets` + índice parcial + RLS + `REVOKE/GRANT` + trigger
  3. `public.work_projects` + índice parcial + RLS + `REVOKE/GRANT` + trigger
  4. `public.work_project_tasks` + FK a `work_projects` + índice parcial + RLS + `REVOKE/GRANT` + trigger
  5. `ALTER TABLE public.rubik_cubes ADD COLUMN IF NOT EXISTS ...` + trigger

### Paso D — Validación posterior (solo lectura)
```sql
-- 1. Verificar tablas, RLS habilitado y políticas exactas (3 por tabla: SELECT/INSERT/UPDATE)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('gym_workout_sets', 'work_projects', 'work_project_tasks', 'rubik_cubes');

SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('gym_workout_sets', 'work_projects', 'work_project_tasks')
ORDER BY tablename, cmd;

-- 2. Verificar privilegios mínimos (0 DELETE para authenticated, 0 privilegios para anon/PUBLIC)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('gym_workout_sets', 'work_projects', 'work_project_tasks')
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 3. Confirmar conteo intacto de tablas sensibles
SELECT
  (SELECT count(*) FROM public.rubik_cubes) AS rubik_cubes_count,
  (SELECT count(*) FROM public.rubik_solves) AS rubik_solves_count,
  (SELECT count(*) FROM public.financial_transactions) AS financial_transactions_count;
```

### Paso E — Condiciones de Parada (STOP / NO-GO inmediato)
Detener el proceso de inmediato y **NO desplegar código** si:
1. `public.rubik_cubes` no existe o tiene columnas incompatibles en producción.
2. Alguna sentencia del SQL falla o devuelve advertencia de tipo/restricción.
3. La validación posterior muestra privilegios de `anon`, `DELETE` para `authenticated`, o `rowsecurity = false`.
4. Cambia el conteo de `rubik_solves` o `financial_transactions`.

---

## 3. Orden Exacto de Despliegue (10 Pasos)

1. Ejecutar Paso A (consultas de solo lectura en Supabase).
2. Generar y verificar backup de Supabase (Paso B).
3. Configurar temporalmente `OAKHAVEN_SYNC_ENABLED=false` en Railway si se desea activar la sincronización de forma gradual.
4. Ejecutar `supabase/drafts/20261119_phase8_data_continuity_sync.sql` en el SQL Editor de Supabase.
5. Ejecutar Paso D (validación posterior de tablas, RLS, privilegios e índices).
6. Confirmar que producción actual (Release 3.0 @ `8220155`) sigue operando sin errores (compatibilidad hacia atrás garantizada).
7. Con autorización humana explícita, integrar y desplegar código:
   ```powershell
   git checkout main
   git merge --no-ff feat/oakhaven-phase8-data-continuity -m "release: OakHaven 3.1 (Data Continuity & Multi-Device Sync)"
   git push origin main
   ```
8. Verificar build verde en Railway y healthcheck en producción.
9. Habilitar `OAKHAVEN_SYNC_ENABLED=true` (o eliminar la variable, ya que su valor por defecto es activo).
10. Ejecutar validación E2E real con cuenta de prueba en 2 navegadores (Gym + Trabajo + Cubos, modo offline → reconexión, conflicto CAS). Si aparece cualquier fallo, fijar `OAKHAVEN_SYNC_ENABLED=false` inmediatamente (preserva datos locales) o revertir el merge en `main` sin tocar la base de datos.

---

## 4. Evidencia QA Automatizada

| Nivel | Comando / Entorno | Resultado |
|---|---|---|
| **TypeScript estricto** | `npx tsc --noEmit` | **APROBADO** (`0` errores) |
| **Pruebas unitarias, integración, CAS y SQL PGlite** | `npm test` | **328 / 328 pruebas aprobadas** (`15` suites, incluye CAS 2 dispositivos y denegación de `DELETE` en PGlite) |
| **Build de producción Next.js** | `npm run build` | **APROBADO (exit code `0`)** (`35/35` rutas + `.next/standalone`) |
| **E2E multidispositivo (2 navegadores reales en producción)** | Pendiente de aplicación manual del SQL | **PENDIENTE (NO SIMULADO)** |

---

## 5. Bloqueadores Residuales para Producción
1. **Aplicación manual del SQL** en Supabase tras aprobación humana y respaldo verificado.
2. **Prueba E2E real en 2 navegadores** contra Supabase producción con cuenta de prueba después de aplicar el SQL y desplegar.
