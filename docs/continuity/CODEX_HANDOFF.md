# CODEX HANDOFF — OAKHAVEN AI FASE 1 (2026-11-19)

- **Estado**: **OAKHAVEN AI — FASE 1 COMPLETADA** localmente (sin push, sin merge, sin despliegue ni migraciones ejecutadas en producción).
- **Código implementado**:
  - `src/lib/ai/building-skills-registry.ts`: Registro de 9 skills en runtime (Presidente Rowan + 8 especialistas: Silas, Lyra, Aura, Bruno, Milo, Eldrin, Nora, Clara) y contrato estricto de recursos por edificio (`RESOURCE_CONTRACT_BY_BUILDING`, `validateBuildingResourceUpload`).
  - `src/lib/ai/mayor-readonly-tools.ts`: 9 herramientas de solo lectura autenticadas en servidor con lista blanca (`executeMayorReadOnlyTool`), fechas reales, origen explícito y avisos de datos solo locales.
  - `src/lib/ai/mayor-rowan-engine.ts`: Planificador de máx. 3 herramientas, defensa contra prompt injection / Nivel 3, redactor de logs, respuesta determinista grounded y pulido opcional con Gemini 2.5 Flash (timeout 7s + fallback determinista).
  - `src/app/api/ai/mayor/chat/route.ts`: Endpoint autenticado `POST /api/ai/mayor/chat` con rate limiting, validación de longitud/historial e interruptor global `OAKHAVEN_AI_ENABLED`.
  - `src/components/sanctuary/mayors-ledger-modal.tsx` y `src/components/sanctuary/cozy-village-map.tsx`: Ayuntamiento evolucionado con chat Cozy de Presidente Rowan, preguntas sugeridas, badges de fecha/origen y botones directos para abrir cada edificio.
  - `supabase/drafts/20261119_oakhaven_ai_phase1_sync.sql`: Borrador aditivo con RLS para `cinema_entries` y `building_resources` (NO aplicado en producción).
  - `tests/oakhaven-ai-phase1.test.ts`: Suite dedicada de seguridad, precisión temporal, contrato de recursos y control de costos.
- **Documentación creada**:
  - `docs/ai/OAKHAVEN_AI_ARCHITECTURE.md`
  - `docs/ai/MAYOR_CAPABILITIES.md`
  - `docs/ai/BUILDING_SKILLS_REGISTRY.md`
  - `docs/ai/RESOURCE_TYPES_BY_BUILDING.md`
  - `docs/ai/AI_SECURITY_AND_COST.md`
- **Próximo paso recomendado (Fase 2, tras revisión del usuario)**:
  - Revisar y probar el chat de Rowan en local, decidir si aprobar la migración aditiva `20261119_oakhaven_ai_phase1_sync.sql` para sincronizar Cine y Recursos en Supabase, y luego habilitar las interfaces de especialistas por edificio (Nivel 1 y propuestas Nivel 2 con confirmación).
