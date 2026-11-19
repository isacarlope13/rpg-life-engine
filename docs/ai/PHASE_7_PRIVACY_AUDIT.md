# AUDITORÍA DE PRIVACIDAD P0 — PRESIDENTE ROWAN 2.0 (FASE 7)

## Hallazgos P0 Detectados y Corregidos en `src/lib/ai/mayor-rowan-engine.ts`

1. **Activación accidental de Banco por `"semana"` (CORREGIDO):**
   - *Antes:* la expresión regular contenía `semana` y `movimiento`, disparando `getRecentExpenses` en preguntas como *"¿Qué estudié esta semana?"*.
   - *Ahora:* `EXPLICIT_FINANCIAL_INTENT_REGEX` exige intención financiera explícita.
2. **Exposición de `weeklySpentCop` en `getVillageSummary` (CORREGIDO):**
   - *Antes:* el resumen general del pueblo imprimía `Gastos últimos 7 días: $... COP` y lo pasaba al prompt de Gemini.
   - *Ahora:* `getVillageSummary` omite cifras en COP del borrador general y elimina `weeklySpentCop` antes de cualquier llamada a Gemini.
3. **Envío de resultados financieros e historial previo a Gemini (CORREGIDO):**
   - *Ahora:* si `containsFinancialContext` es `true`, `askMayorRowan` **omite `tryGeminiPolish()` por completo** (`0` llamadas a Gemini, probado mediante instrumentación `onGeminiAttemptForTests`). En consultas no financieras, `stripFinancialHistoryForGemini()` depura cualquier turno previo que mencione `COP`, `$`, `Banco`, `saldo`, `deuda` o `extracto`.
4. **Redacción de logs reforzada (`redactSensitiveForLogs`):**
   - Enmascara correos, tarjetas (13–19 dígitos), números de cuenta (6–12 dígitos) y tokens/claves API.
