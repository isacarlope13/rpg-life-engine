# MAYOR CAPABILITIES — PRESIDENTE ROWAN (FASE 1)

## 1. Herramientas de Solo Lectura Implementadas (`src/lib/ai/mayor-readonly-tools.ts`)

| Herramienta | Edificio | Qué responde (distinción temporal real) | Fuente |
|---|---|---|---|
| `getLastReadBook` | Lectura (`libreria`) | Último libro creado (`created_at`), último actualizado (`updated_at`), último completado (`status='completed'`) y última sesión (`activity_logs`). | Supabase / Store |
| `getLastKnittingActivity` | Crochet (`atelier`) | Último proyecto creado, último modificado (con vueltas `completed_rows/total_rows_target`), último completado y última sesión de tejido. | Supabase / Store + conteo local de patrones |
| `getLastWatchedMedia` | Cine (`cine`) | Qué serie/obra estás viendo ahora, última película marcada como vista (`watchedAt`), última obra registrada. | `local_device_snapshot` (`localStorage`) |
| `getRecentExpenses` | Banco (`banco_oakhaven`) | Suma determinista de gastos en ventana (7 o 30 días) en COP + último gasto registrado con comercio y fecha. | Supabase / Store |
| `getLastWorkout` | Gym (`gimnasio`) | Última sesión de entrenamiento (`domain='sports'`) con duración y fecha real. | Supabase / Store |
| `getRecentCubeSolves` | Cubos (`club_puzzles`) | Último solve registrado y último récord/mejor tiempo reciente (`is_pb` / mínimo `time_seconds`). | Supabase / Store |
| `getPendingWorkProjects` | Trabajo (`oficina`) | Proyectos con `status !== 'completed'`, tareas pendientes y última sesión de trabajo. | Store / `activity_logs` |
| `getStudyProgress` | Estudio (`biblioteca`) | Minutos recientes estudiados, última sesión de estudio y cantidad de tarjetas SM-2. | Supabase / Store |
| `getVillageSummary` | Ayuntamiento | Resumen consolidado de nivel, GP billetera/bóveda, gastos semanales COP y último entrenamiento. | Agregado solo lectura |

## 2. Preguntas que Rowan YA puede responder hoy
- ¿Cuál fue mi último libro registrado? / ¿Qué libro terminé más recientemente?
- ¿En qué proyecto de crochet trabajé por última vez? / ¿Cuántas vueltas llevaba?
- ¿Cuál fue la última película que marqué como vista? / ¿Qué serie estoy viendo? *(desde el mismo dispositivo)*
- ¿Cuánto gasté esta semana? / ¿Cuál fue mi último gasto registrado?
- ¿Cuándo entrené por última vez?
- ¿Cuál fue mi último récord de cubos?
- ¿Qué proyecto de trabajo dejé pendiente?

## 3. Preguntas que TODAVÍA NO puede responder completamente (y por qué)
- **Cine registrado en otro dispositivo:** Hoy `cinema-store.ts` guarda en `localStorage`; falta aprobar y aplicar la migración `cinema_entries` en Supabase.
- **Contenido interno de imágenes/PDFs de patrones de Crochet:** Los archivos binarios viven en `localStorage` y aún no hay OCR ni indexación en Supabase Storage.
- **Historial detallado serie-por-serie de Gym en la nube:** Las series detalladas viven hoy en `localStorage` (`oakhaven_gym_sets_v1`); en `activity_logs` solo se guarda el resumen de sesión.
- **Consultas sobre acciones de Nivel 2/3 (crear, editar, pagar):** Bloqueadas intencionalmente en Fase 1 (Rowan es estrictamente Nivel 1 — Solo Lectura).
