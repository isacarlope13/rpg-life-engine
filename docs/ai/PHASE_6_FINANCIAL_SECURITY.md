# OAKHAVEN AI FASE 6 — Seguridad y Privacidad Financiera

1. **Cero envío por defecto a Gemini:** En `src/lib/ai/specialist-engine.ts`, `canUseGeminiForBuilding` excluye explícitamente `banco_oakhaven`, devolviendo respuestas deterministas locales (`mode: "deterministic_grounded"`).
2. **Selector de documentos excluido en Banco:** `BuildingSpecialistPanel` no adjunta extractos bancarios de `banco_oakhaven` al contexto conversacional de la IA.
3. **Bloqueo de documentos bancarios en `resource-query-tools.ts`:** Todo recurso con `is_sensitive_financial: true` o perteneciente a `banco_oakhaven` queda bloqueado para lectura automática por otros agentes (Nora, Clara, Lyra, etc.) y por Rowan.
4. **Enmascaramiento de identificadores:** `maskFinancialIdentifiers()` reemplaza secuencias numéricas largas (6–19 dígitos) por `[CUENTA_OCULTA]` antes de construir salidas o logs.
5. **Bloqueo estricto Nivel 3:** Cualquier solicitud de pago, transferencia, cambio de saldo, modificación de deuda o alteración de GP/XP devuelve `mode: "blocked_safety"`.
6. **Presidente Rowan:** `getRecentExpenses()` excluye `INITIAL_FINANCIAL_MOVEMENTS` y solo expone resúmenes agregados autorizados cuando el usuario los solicita, nunca extractos completos.
