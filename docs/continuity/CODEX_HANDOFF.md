# CODEX HANDOFF — OAKHAVEN AI FASES 1 Y 2 COMPLETADAS (2026-11-19)

- **Estado**: **OakHaven AI Fase 1** desplegada en `main` (`962b5ba`) y **Fase 2** implementada localmente y lista para verificación/despliegue.
- **Implementado en Fase 2**:
  - `src/lib/ai/specialist-engine.ts`: Motor de los 8 especialistas por edificio con aislamiento estricto de herramientas por dominio, propuestas Nivel 2 con `requiresConfirmation: true`, bloqueo Nivel 3 e interruptor individual por skill.
  - `src/app/api/ai/specialist/chat/route.ts`: Endpoint autenticado `POST /api/ai/specialist/chat` con rate limiting y validación.
  - `src/app/api/resources/route.ts`: Endpoint autenticado `GET/POST/DELETE /api/resources` con validación estricta de `RESOURCE_CONTRACT_BY_BUILDING` (propietario, categoría, MIME, tamaño) sobre `building_resources`.
  - `src/components/sanctuary/building-specialist-panel.tsx` integrado en `src/components/sanctuary/living-interior-room.tsx`: los 8 edificios definitivos (`Banco`, `Estudio`, `Trabajo`, `Gym`, `Cubos`, `Lectura`, `Cine`, `Crochet`) tienen acceso directo a su especialista con propuestas Nivel 2 confirmables e interruptor individual.
  - `tests/oakhaven-ai-phase2.test.ts`: Suite de pruebas Fase 2.
- **Pendiente del usuario en Supabase Dashboard**:
  - Ejecutar `supabase/migrations/20261119_oakhaven_ai_phase1_sync.sql` en SQL Editor para activar persistencia en la nube de `cinema_entries` y `building_resources`.
