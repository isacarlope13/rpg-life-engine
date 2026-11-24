# Plan de Preparación para Producción (Fase 6D) — Filet Crochet Studio v1.0

> **Estado:** PLAN DOCUMENTADO SIN EJECUCIÓN.
> Requiere autorización humana explícita e independiente antes de crear proyectos externos, aplicar migraciones SQL en Supabase real, fusionar a `main` o desplegar en Railway.

---

## 1. Entorno Supabase aislado previo a producción
- Antes de tocar el proyecto Supabase de producción de OakHaven, validar en un proyecto Supabase de pruebas aislado (o rama/instancia staging sin datos personales reales ni credenciales productivas):
  1. Aplicar `supabase/schema.sql` base + los 3 borradores de Filet Studio en orden estricto.
  2. Ejecutar flujos autenticados reales con GoTrue/Auth y PostgREST reales (`/api/filet/workspace`, `/api/filet/progress`, `/api/shortcuts/skill-session` y `/api/resources`).
  3. Confirmar que el rol `authenticated` no puede invocar directamente ninguna de las RPC reservadas a `service_role` y que RLS restringe el acceso estrictamente a `auth.uid() = user_id`.
  4. Retirar el entorno aislado al concluir la validación.

---

## 2. Inventario de migraciones, orden de aplicación y dependencias

Las migraciones necesarias se encuentran actualmente en `supabase/drafts/` y deben promoverse a `supabase/migrations/` y aplicarse **únicamente bajo autorización explícita en este orden exacto**:

| Orden | Archivo borrador | Objetos creados / modificados | Dependencias previas |
| :---: | :--- | :--- | :--- |
| **1** | `supabase/drafts/20261124_filet_guided_progress_atomic.sql` | Columnas opcionales `linked_pattern_id`, `linked_pattern_version_id`, `linked_pattern_snapshot` en `public.knitting_projects`; tablas `public.filet_guided_progress` y `public.filet_guided_operation_receipts`; trigger de protección contra mutación manual/desvinculación; RPCs `confirm_filet_row_atomic_v1` y `undo_filet_row_atomic_v1`. | Requiere `auth.users` y `public.knitting_projects` (`supabase/schema.sql`). |
| **2** | `supabase/drafts/20261124_filet_workspace_sync.sql` | Tablas `public.filet_studio_workspaces` y `public.filet_studio_workspace_receipts`; políticas RLS de lectura por propietario; RPC `upsert_filet_workspace_atomic_v1` (SHA-256 + revisión monotónica). | Requiere `auth.users`. Independiente de tesorería. |
| **3** | `supabase/drafts/20261112_atomic_skill_session.sql` | Tablas `public.skill_session_operation_receipts` y `public.filet_session_operation_aliases` (FK diferida); RPC `record_skill_session_atomic_v1` con identidad canónica `ses_univ_<owner>_<sessionId>` y validación de versión vinculada sobre `knitting_projects`. | **Depende de la Migración #1** (lee `linked_pattern_version_id` de `public.knitting_projects`) y de `profiles`, `player_treasury`, `activity_logs` y trigger `fn_process_activity_reward()`. |

---

## 3. Validación de RLS y permisos post-migración
Ejecutar en consola SQL de solo lectura inmediatamente después de aplicar las 3 migraciones:
```sql
-- 1. Confirmar RLS activo en las 6 tablas nuevas
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN (
     'filet_guided_progress',
     'filet_guided_operation_receipts',
     'filet_studio_workspaces',
     'filet_studio_workspace_receipts',
     'skill_session_operation_receipts',
     'filet_session_operation_aliases'
   );

-- 2. Confirmar que anon y authenticated NO tienen EXECUTE sobre las RPCs de escritura
SELECT
  has_function_privilege('anon', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS anon_confirm,
  has_function_privilege('authenticated', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS auth_confirm,
  has_function_privilege('service_role', 'public.confirm_filet_row_atomic_v1(uuid,uuid,text,int,text,int,text,int,int)', 'EXECUTE') AS svc_confirm,
  has_function_privilege('authenticated', 'public.upsert_filet_workspace_atomic_v1(uuid,text,int,text,jsonb,text)', 'EXECUTE') AS auth_ws,
  has_function_privilege('authenticated', 'public.record_skill_session_atomic_v1(uuid,text,uuid,uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)', 'EXECUTE') AS auth_sess;
```
Resultado esperado: `true` para `rowsecurity` en las 6 tablas; `false` para todos los privilegios `anon_*` y `auth_*`; `true` para `svc_confirm`.

---

## 4. Compatibilidad entre versión anterior y nueva + Activación gradual
1. **Aplicar primero las 3 migraciones SQL antes del despliegue de Railway:**
   - Todas las columnas añadidas a `public.knitting_projects` permiten `NULL`, y las tablas/RPC nuevas no interceptan ni alteran las consultas de Release 3.3 en ejecución.
   - De este modo, Release 3.3 sigue operando con cero interrupciones mientras se verifican RLS y permisos.
2. **Si la aplicación nueva llegara a desplegarse antes de las RPCs:**
   - El cliente conserva automáticamente sus operaciones en cola local (`localStorage` aislado por propietario) y el servidor responde `503` recuperable (`FILET_SESSION_PENDING` / pendiente de migración) sin perder trabajo ni corromper contadores.
3. **Activación gradual:**
   - Paso A: habilitar y validar primero edición local, compositor, digitalizador y exportaciones (100 % deterministas en cliente).
   - Paso B: validar sincronización de workspace (`/api/filet/workspace`) y respaldo manual (`/api/resources`).
   - Paso C: crear un proyecto Filet de prueba y verificar confirmación de vuelta (`/api/filet/progress`) y cierre de sesión atómica (`/api/shortcuts/skill-session`).

---

## 5. Respaldo previo y Plan de Rollback No Destructivo
- **Respaldo obligatorio previo:** generar respaldo lógico (`pg_dump` / snapshot de Supabase) de `public.profiles`, `public.player_treasury`, `public.activity_logs`, `public.knitting_projects` y `public.building_resources` antes de ejecutar la Migración #1.
- **Rollback no destructivo (regla absoluta: jamás borrar datos creados por la usuaria):**
  1. **Rollback de aplicación:** revertir el despliegue en Railway al commit anterior de `main`; los proyectos tradicionales siguen funcionando y los datos Filet permanecen íntegros en Supabase y en el almacenamiento local del navegador.
  2. **Contención de escritura remota sin pérdida de datos:** si se detecta un incidente en sincronización o RPCs, revocar temporalmente `EXECUTE` a `service_role` sobre la RPC afectada o pausar sincronización (`OAKHAVEN_SYNC_ENABLED=false`), **conservando intactas todas las filas de `knitting_projects`, `filet_studio_workspaces`, `filet_guided_progress`, `activity_logs`, recibos y alias** para reconciliación posterior. Nunca ejecutar `DROP TABLE` ni `DROP COLUMN` en una base con datos reales.

---

## 6. Smoke tests en producción y validación de proyectos tradicionales
1. `GET /api/health` y `GET /api/state` (sesión anónima → `401`; propietaria autenticada → `200`).
2. **Proyectos tradicionales:** abrir un `knitting_projects` existente sin `linked_filet_pattern`, registrar `+1` vuelta y finalizar una sesión corta verificando incremento normal de `completed_rows`, XP y GP.
3. **Filet Crochet Studio:**
   - Componer patrón de prueba, guardar versión `v1`, exportar PDF/SVG/PNG/JSON.
   - Crear proyecto vinculado desde `v1`, completar segmentos de Vuelta 1, confirmar Vuelta 1 (`completed_rows = 1`), recargar página y verificar persistencia.
   - Finalizar sesión guiada y verificar que acredita exactamente 1 actividad (`completed_rows` permanece en `1`, sin doble conteo).

---

## 7. Posibles interacciones con la PR financiera #2 (`feat/oakhaven-financial-owner-ledger`)
- **Base de datos y finanzas:** cero solapamiento de tablas SQL (`owner_finance_ledger.sql` opera sobre el libro mayor financiero privado en COP; Filet Studio no toca `financial_transactions`, `debt_bosses` ni tablas financieras).
- **Código compartido al fusionar ramas en `main`:** existen 4 archivos con intersección controlada que deben resolverse de forma aditiva (conservando ambos bloques):
  1. `package.json`: concatenar en el script `"test"` las suites `tests/owner-finance*.test.ts` de PR #2 junto con las suites `tests/filet-crochet-*.test.ts` de PR #3.
  2. `src/app/api/shortcuts/skill-session/route.ts`: conservar las validaciones financieras de PR #2 y la rama `finalizeFiletSession` / `linked_filet_pattern` de PR #3.
  3. `src/lib/demo-store.ts`: conservar métodos financieros y el soporte `linked_filet_pattern` / `guided_time_only` en `knittingProjects`.
  4. `src/lib/state-builder.ts`: conservar tanto los campos del ledger financiero como la hidratación de `linked_filet_pattern` en `knittingProjects`.
- **Workflows CI:** nombres de archivo independientes (`.github/workflows/owner-finance-validation.yml` vs `.github/workflows/filet-crochet-validation.yml`), sin conflicto.
