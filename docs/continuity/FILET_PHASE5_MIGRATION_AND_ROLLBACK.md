# Procedimiento de Migración, Verificación y Rollback — Filet Crochet Studio v1.0

> **Estado:** ACTUALIZADO TRAS OPCIÓN A (5 MIGRACIONES DEFINITIVAS, SIN APLICAR EN PRODUCCIÓN).
> Inventario oficial: 4 migraciones pre-deploy en `supabase/migrations/` (`2026112501`–`2026112504`) + 1 migración post-deploy en `supabase/post-deploy/` (`2026112505`).

## 1. Inventario y separación obligatoria (Pre-Deploy vs Post-Deploy)
1. **Pre-deploy (`supabase/migrations/`, 100 % retrocompatibles con `main @ cb06321`):**
   - `2026112501_filet_guided_progress_atomic.sql`
   - `2026112502_filet_workspace_sync.sql`
   - `2026112503_atomic_skill_session.sql`
   - `2026112504_reward_trigger_hardening.sql`
2. **Post-deploy (`supabase/post-deploy/`, FUERA de `supabase/migrations/` para impedir aplicación prematura):**
   - `2026112505_activity_logs_server_only_insert.sql`
   - **NO es retrocompatible con `main @ cb06321` (Release 3.3):** revoca `INSERT` de `authenticated` en `public.activity_logs`, por lo que solo debe aplicarse **después** de que la nueva aplicación (con escritores server-side `service_role` en `habit-log` y `skill-session`) esté desplegada y verificada en Railway.

## 2. Matriz de compatibilidad durante el despliegue
| Combinación | Resultado | Acción operativa |
|---|---|---|
| App anterior (`cb06321`) + 4 migraciones | **Compatible** | Funcionamiento normal de todos los módulos. |
| App nueva + 4 migraciones | **Compatible** | Funcionamiento normal; escritores server-side ya activos. |
| App nueva + 5 migraciones | **Compatible + Bloqueo total** | Funcionamiento normal y bloqueo efectivo (`42501`) de `INSERT`/`UPDATE`/`DELETE` directo de clientes en `activity_logs`. |
| App anterior (`cb06321`) + 5 migraciones | **INCOMPATIBLE** | Los endpoints legacy de `cb06321` (`habit-log` y `skill-session` no Filet) fallarán al insertar en `activity_logs` con `42501`. |

## 3. Estrategia de Rollback Seguro y No Destructivo
- **Antes de aplicar la Migración #5 (ventana con 4 migraciones):**
  - El rollback de aplicación en Railway al despliegue `54407ef8` (`cb06321`) es **100 % compatible y sin pérdida de datos**.
  - Si se requiere contener Filet sin perder datos, revocar `EXECUTE` a `service_role` sobre la RPC afectada (`503` recuperable).
- **Después de aplicar la Migración #5 (`2026112505`):**
  - **NO revertir ciegamente a `cb06321`** porque `cb06321` no usa `service_role` para `activity_logs` y fallaría el registro de hábitos y sesiones tradicionales.
  - **Prioridad de recuperación:** (1) aplicar hotfix hacia adelante sobre la rama nueva conservando la Migración #5 y todos los controles de seguridad, o (2) si una emergencia crítica exige volver temporalmente a `cb06321`, **nunca restaurar `INSERT` inseguro automáticamente**; requerir autorización humana explícita y ventana acotada para cualquier concesión temporal, y jamás ejecutar `DROP TABLE` ni `DROP COLUMN` sobre datos reales.
