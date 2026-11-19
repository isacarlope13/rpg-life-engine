# OBSERVABILIDAD ZERO-PII Y CONTROL DE COSTOS (FASE 7)

- **Módulo:** `src/lib/ai/ai-observability.ts`
- **Endpoint autenticado:** `GET /api/ai/observability` (requiere `requireShortcutUser`, solo lectura)

## Qué se mide
- Solicitudes totales por agente y edificio (`rowan`, `clara`, `lyra`, `aura`, `eldrin`, `bruno`, `milo`, `nora`, `silas`).
- Desglose: `deterministicRequests`, `geminiRequests`, `blockedRequests`, `errors`, `timeouts`, `cacheHits`.
- Latencia media y última latencia (`avgLatencyMs`, `lastLatencyMs`).
- Tokens de entrada/salida (`reportedInputTokens`, `reportedOutputTokens`) únicamente cuando el SDK de Gemini entrega `usageMetadata`.

## Qué NUNCA se registra (Garantía Zero-PII)
- Ni preguntas del usuario, ni respuestas, ni contenido de documentos, ni cifras financieras, ni secretos.
- No se inventan costos en dinero sin tarifas verificadas en runtime (`costEstimateNote` lo declara explícitamente).
- No se disparan llamadas a Gemini al abrir un edificio ni por animaciones de interfaz.
