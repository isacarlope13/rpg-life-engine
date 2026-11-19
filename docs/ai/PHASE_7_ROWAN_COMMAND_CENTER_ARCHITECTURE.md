# OAKHAVEN AI FASE 7 — Arquitectura de Presidente Rowan 2.0 (AI Command Center)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-ai-phase7-rowan-command-center` (base `main` @ `684d822`, con los 8 especialistas ya integrados)

## 1. Visión de Coordinador Central (Sin Motor Duplicado)

Rowan 2.0 evoluciona sobre `src/lib/ai/mayor-rowan-engine.ts` y compone las herramientas de solo lectura de los 8 especialistas existentes sin crear nuevos modelos ni ampliar privilegios:

```text
Pregunta del jugador al Ayuntamiento (Presidente Rowan 2.0)
   ↓
POST /api/ai/mayor/chat (autenticación + rate limit)
   ↓
askMayorRowan()
   ├─ 1. Defensa Nivel 3 (bloquea pagos, COP, GP, XP, prompt injection)
   ├─ 2. Planificador determinista (máx. 3 herramientas por turno) + detección de intención financiera explícita
   ├─ 3. Memoria contextual y Planificación cotidiana (mi_dia / que_retomar / mi_semana / siguientes_pasos / mi_descanso)
   │      -> NUNCA consulta Banco (`banco_oakhaven`) para decisiones recreativas o de estudio
   ├─ 4. Cortafuegos P0 Financiero: si hay contexto financiero -> 0 llamadas a Gemini (modo deterministic_grounded)
   │      Si es no financiero -> depura turnos financieros previos del historial y borra `weeklySpentCop`
   └─ 5. Telemetría Zero-PII -> recordAiTelemetryEvent() -> GET /api/ai/observability
```

## 2. Módulos Nuevos y Reutilizados
- **Nuevos:** `src/lib/ai/rowan-command-center.ts` (memoria contextual clasificada y planificación cotidiana), `src/lib/ai/ai-observability.ts` (métricas Zero-PII) y `src/app/api/ai/observability/route.ts` (endpoint autenticado).
- **Reutilizados:** `mayor-rowan-engine.ts`, `mayor-readonly-tools.ts`, `specialist-engine.ts`, `clara-lyra-tools.ts`, `aura-eldrin-tools.ts`, `bruno-milo-tools.ts`, `nora-silas-tools.ts` y los componentes Cozy del Ayuntamiento.
