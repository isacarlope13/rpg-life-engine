# OAKHAVEN FASE 8 — Arquitectura de Continuidad de Datos y Sincronización Multidispositivo

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase8-data-continuity` (base `main` @ `8220155`, Release 3.0)

## 1. Inventario Completo de Persistencia (Hito 1)

| Dato | Edificio | Ubicación Actual | Estado de Sincronización | Riesgo de Pérdida / Duplicación | Prioridad Fase 8 |
|---|---|---|---|---|---|
| **Series de Gym (`oakhaven_gym_sets_v1`)** | Gym (`gimnasio`) | Solo `localStorage` | Local (pendiente SQL `gym_workout_sets`) | Alto / Medio (si no se usa `client_id`) | **P0 (Piloto)** |
| **Proyectos y Tareas de Trabajo** | Trabajo (`oficina`) | Memoria / sesión local | Local (pendiente SQL `work_projects`, `work_project_tasks`) | Alto / Medio | **P1** |
| **Catálogo Hardware y Notas de Cubos** | Cubos (`club_puzzles`) | `rubik_cubes` (Supabase) + `rpg_cube_notebook_*` (local) | Parcial (faltan columnas de notas/versión) | Medio / Bajo | **P1** |
| **Solves WCA (`rubik_solves`)** | Cubos (`club_puzzles`) | Supabase con RLS | **Resuelto** | Bajo | Preservado intacto |
| **Libros (`reading_books`)** | Lectura (`libreria`) | Supabase con RLS | **Resuelto** | Bajo | Preservado intacto |
| **Proyectos Crochet (`knitting_projects`)** | Crochet (`atelier`) | Supabase con RLS + patrones en `building_resources` | **Resuelto** | Bajo | Preservado intacto |
| **Cartelera Cine (`cinema_entries`)** | Cine (`cine`) | Supabase con RLS + respaldo `localStorage` | **Resuelto** | Bajo | Preservado intacto |
| **Bibliotecas Privadas (`building_resources`)** | 8 edificios | Supabase DB + Storage privado con RLS | **Resuelto** | Bajo | Preservado intacto |
| **Sesiones Universales (`activity_logs`)** | Todos | Supabase con RLS + recibos idempotentes | **Resuelto** | Bajo | Preservado intacto |
| **Configuración de Skills (`oakhaven_disabled_ai_skills_v1`)** | Ayuntamiento / 8 edificios | `localStorage` por dispositivo | Local (preferencia de UI) | Bajo | P3 (no requiere tabla) |
| **Movimientos / Extractos Financieros** | Banco (`banco_oakhaven`) | `financial_transactions` (Supabase) | **EXCLUIDO de migración automática en Fase 8** | Política de seguridad estricta | Excluido |

## 2. Cómo Funciona la Sincronización Offline-First

```text
Dispositivo A (localStorage respaldo + cola idempotente)
   ↓ POST /api/sync (lista blanca de campos, máx. 256 KB, sin demos)
Supabase PostgreSQL (UNIQUE(user_id, client_id) + RLS auth.uid() = user_id)
   ↓ GET /api/sync?domain=...
Dispositivo B -> reconcileSyncRecords()
   ├─ Si remoto está vacío -> conserva local y marca PENDIENTE_DE_SINCRONIZAR
   ├─ Si ambos editaron la misma versión con distinto hash -> CONFLICTO_REQUIERE_REVISION
   └─ Si coinciden o remoto avanzó sin edición local -> SINCRONIZADO
```

- **Nunca usa Gemini para sincronizar.** Todo el motor (`src/lib/sync/universal-sync-engine.ts`) es 100% determinista.
- **Degradación segura:** si el usuario todavía no ejecuta la migración SQL de Fase 8 en Supabase, `/api/sync` responde `synced: false, migrationPending: true, status: "PENDIENTE_DE_SINCRONIZAR"` sin romper la app ni fingir "guardado en la nube".
