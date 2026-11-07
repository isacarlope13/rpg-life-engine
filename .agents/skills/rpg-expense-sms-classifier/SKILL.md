---
name: rpg-expense-sms-classifier
description: Skill especializada para clasificar notificaciones SMS bancarias (Bancolombia, Nequi, ADDI, Apple Pay) y dictados de voz en las 5 cubetas del RPG Life-Engine sin errores numéricos ni falsos positivos.
---

# Skill 1: Clasificador Bancario SMS & Voz (`rpg-expense-sms-classifier`)

## 1. Propósito y Endpoint
Se activa cada vez que el usuario o un Atajo de iOS envía un SMS bancario o un dictado de voz a:
- `POST /api/shortcuts/expense`
- `POST /api/shortcuts/omni`
- Función asociada: `parseExpenseWithGemini` y `sanitizeParsedExpense` en `src/lib/gemini.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Error en Parseo de Montos (COP)
1. **Eliminación previa de ruido numérico:**
   - Ignorar fechas (`07/11/2026`, `2026-11-07`), horas (`14:35`) y últimos dígitos de tarjeta (`*4491`, `T.Cred *9812`).
   - Eliminar centavos explícitos (`.00` o `,00` al final del número, ej. `"$1,224,561.00"` -> `1224561`) antes de limpiar separadores de miles.
2. **Abreviaturas coloquiales en voz:**
   - `"45 mil"` o `"45k"` -> `45000`.
   - `"1.2 millones"` -> `1200000`.

## 3. Taxonomía Estricta de las 5 Categorías
- `fixed_mandatory`: Arriendo, administración, servicios públicos, internet/plan celular (Claro, Tigo, Movistar), gimnasio (SmartFit), seguros, natillera.
- `variable_operational`: Mercado básico (Éxito, D1, Ara, Carulla), transporte (Metro/Cívica, Uber, DiDi, gasolina), salud/EPS/farmacia, apoyo familiar.
- `debt_attack`: Pago o abono a deuda activa. Debe identificar `boss_target` (`"Nequi"`, `"ADDI"`, `"Bancolombia"`).
- `discretionary_wishlist`: Compra redimida explícitamente de la Tienda de Recompensas.
- `discretionary_unbudgeted`: Comida rápida, Rappi, restaurantes no planeados, bares, licor, snacks o compras impulsivas (aplica multa `1.2x` o consume 1 Escudo Aegis).
