# SKILL DE AURA — Especialista de Trabajo (`oficina`)

- **Identificador:** `oakhaven.specialist.trabajo.aura`
- **Edificio / Dominio:** `oficina` / `work`
- **Archivo de herramientas:** `src/lib/ai/aura-eldrin-tools.ts`

## 1. Separación estricta de proyectos demostrativos vs reales

En `src/components/sanctuary/office-building.tsx`, los proyectos de ejemplo (`DEFAULT_PROJECTS`) se marcaron explícitamente con `id: "demo-proj-*"` y `dataOrigin: "demo_template"` (con `0%` de progreso ficticio).

La función `getActiveWorkProjects(ctx)` filtra cualquier proyecto cuyo `id` empiece por `demo-` o `template-` o tenga `dataOrigin === "demo_template"`. Así, **Aura nunca presenta plantillas de ejemplo ni porcentajes inventados como si fueran proyectos reales del usuario**.

## 2. Herramientas implementadas

| Herramienta | Nivel | Qué hace |
|---|---|---|
| `getActiveWorkProjects(ctx)` | 1 | Lista proyectos reales activos, distingue alcance `professional` vs `personal` y excluye demos. |
| `getWorkProjectDetails(ctx, projectId)` | 1 | Recupera detalles y tareas pendientes de un proyecto real. |
| `getPendingWorkTasks(ctx, projectId?)` | 1 | Ordena tareas pendientes por prioridad (`critical` → `low`). |
| `getLastWorkSession(ctx)` | 1 | Consulta la última sesión en `activity_logs` (`domain = 'work'`) o sesión local. |
| `getWorkSessionsByPeriod(ctx, start, end)` | 1 | Consolida sesiones y minutos invertidos en un rango de fechas. |
| `listWorkResources(resCtx)` / `readWorkDocument(resCtx, id)` | 1 | Lee únicamente documentos de `oficina` del usuario autenticado (con saneamiento anti *prompt injection*). |
| `analyzeTechnicalDocument(title, text)` | 1 | Extrae secciones, riesgos/inconsistencias (`TODO`, `FIXME`, bloqueos), ítems accionables y citas `[Página N]`. |
| `explainCodeSnippet(title, code)` | 1 | Detecta lenguaje (TypeScript/JS, Python, SQL), funciones, flujos asíncronos y riesgos (`any`, `eval`) sin modificar archivos del repo. |
| `proposeWorkSprint(...)` / `proposeWorkSessionSummary(...)` | 2 | Genera propuestas estructuradas con `requiresConfirmation: true` e `idempotencyKey` que se guardan en `building_resources` solo si el usuario confirma. |

## 3. Persistencia y limitaciones transparentes
- Las sesiones de trabajo se leen de Supabase `activity_logs` cuando está configurado y los planes/cierres confirmados se guardan en `building_resources` (`oficina`).
- La tabla `work_projects` permanece en estado de sesión/local mientras no se requiera una tabla relacional dedicada en Supabase (no se ejecutó SQL nuevo en producción).
