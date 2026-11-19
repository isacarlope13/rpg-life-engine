# OAKHAVEN AI FASE 6 — Arquitectura de Nora (Cine) y Silas (Banco)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase6-nora-silas` (creada desde `main` @ `5334800`, con Release 2.5 ya publicado)

## 1. Cierre de los 8 Especialistas Activos sobre un Único Motor

Con la Fase 6, los **8 edificios definitivos** de OakHaven (`atelier`, `biblioteca`, `oficina`, `libreria`, `gimnasio`, `club_puzzles`, `cine` y `banco_oakhaven`) quedan integrados sobre el mismo motor compartido (`src/lib/ai/specialist-engine.ts`) y el planificador determinista `selectAuthorizedToolsForIntent()` (máx. 4 herramientas por solicitud decididas en el servidor).

## 2. Matriz de Fuentes (Hito 1)

| Dominio | Fuente Real Confirmada | Fuente Local / Sesión | Datos de Ejemplo Excluidos |
|---|---|---|---|
| **Cine (`cine`)** | `public.cinema_entries` (Supabase con RLS) + `building_resources` | `oakhaven_cinema_catalog_v1_<owner>` vía `local_snapshot` | Ninguno |
| **Banco (`banco_oakhaven`)** | `financial_transactions`, `fixed_costs`, `debt_bosses`, `wishlist_items` (Supabase con RLS) | `ctx.store.financialMovements` (solo no-seed) | `INITIAL_FINANCIAL_MOVEMENTS` (`mts5z6dfjzde`, etc.), `CASE_STUDY_ACCOUNTS` (`acc_nu_39`, `acc_nequi_39`), `demo-*` |

## 3. Regla Diferencial de Privacidad en `specialist-engine.ts`

- **Nora (`cine`):** consulta `getCinemaCollection`, `recommendFromWatchlist`, `proposeMovieNight`, `readCinemaReview` y puede usar pulido opcional de Gemini sobre contexto cultural no sensible.
- **Silas (`banco_oakhaven`):** ejecuta cálculos deterministas con enteros en COP y **omite `trySpecialistGeminiPolish` por defecto (`skill.buildingId !== "banco_oakhaven"`)**, garantizando que **0 bytes de información financiera personal salgan hacia Gemini sin consentimiento explícito**.
