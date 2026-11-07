---
name: rpg-financial-engine
description: >-
  Motor Financiero Determinista y Multimodal con Gemini para el RPG Life-Engine.
  Úsalo cuando el usuario pida analizar ingresos, gastos fijos, variables operativos,
  deudas (Debt Bosses), tablas CSV/Excel o descripciones en texto libre para construir
  o auditar su presupuesto mensual, calcular flujo de caja libre (Poder Bola de Nieve),
  calibrar la Bóveda Mensual (GP) y simular estrategias Avalancha vs Bola de Nieve.
---

# Skill: Motor Financiero RPG Life-Engine (`rpg-financial-engine`)

Esta skill define las reglas contables, matemáticas y de estructuración de datos que el agente y el endpoint `/api/onboarding/ai` (`evaluateFinancesWithAI`) deben aplicar al transformar texto libre o archivos CSV/TSV en el estado financiero inicial de un jugador.

---

## 1. Normalización Monetaria, CSV de Historial Transaccional y Frecuencias

1. **Formato de Historial Transaccional (`Fecha,Tipo,Categoría,Monto,Descripción,Método de Pago,Detalle,ID Registro`):**
   - Cuando el CSV contiene múltiples meses de transacciones reales:
     - **Parseo de montos con decimales y comillas (`"$1,224,561.00"`):** eliminar `$` y comillas, separar decimales `.00` y quitar comas de miles (`1224561`). **Nunca** concatenar los dos ceros decimales al entero.
     - **Exclusión de Saldos Iniciales y Pasamanos:** excluir filas cuya descripción sea `"Inicial cuenta"`, `"Inicial efectivo"` o devoluciones únicas del cálculo de ingreso mensual recurrente.
     - **Cálculo de Ingreso Mensual Recurrente:** agrupar `Tipo = Ingreso` en categorías `Sueldo` (2 quincenas/mes) + `Clases` (ingresos académicos/freelance recurrentes).
     - **Extracción de Costos Fijos Reales:** agrupar gastos mensuales repetidos en `Pago internet`, `Pago Celular`, `Gimnasio`, `Natillera` (ahorro comprometido), suscripciones (`Spotify`, `Prime`) y medicamentos permanentes (`Pastillas`).
     - **Extracción de Variables Operativos:** promediar por mes `Comida` rutinaria (desayunos/almuerzos), `Transporte` (Uber sede/casa, parqueaderos universidad) y `Salud` (citas médicas).
     - **Detección de Deudas (`Obligaciones financieras`):** cada entidad distinta pagada bajo `Obligaciones financieras` (ej. `Addi`, `Nequi`) genera un `DebtBoss` cuya cuota mínima es el pago mensual observado.
     - **Detección de Hobbies para Bóveda GP y Wishlist:** compras en `Entretenimiento` / `Varios` / `Bobadas` como `Cubos`/`Cubitos`, `Libros`, `Hilos para tejer`, `LEGO` o salidas sociales calibran el `vault_cap` y crean recompensas personalizadas en la `wishlist`.
2. **Conversión de Sufijos y Formatos en Texto Libre:**
   - `"2.8 millones"`, `"2,8M"`, `"2.800.000"` $\rightarrow$ `2800000`
   - `"540 mil"`, `"540k"`, `"$540.000"` $\rightarrow$ `540000`
3. **Mensualización Automática por Frecuencia:**
   - Si un ingreso o gasto se expresa **semanal**: multiplicar por `4.33`.
   - Si se expresa **quincenal**: multiplicar por `2`.
   - Si se expresa **diario** (ej. transporte o café diario): multiplicar por `22` (días hábiles) o `30` (días calendario).
   - Si se expresa **anual** (ej. SOAT, seguro, matrícula): dividir entre `12`.

---

## 2. Clasificación en las 5 Cubetas del Motor RPG

Cada línea detectada en el texto o tabla CSV debe clasificarse en una de estas 5 cubetas:

| Cubeta | Criterio de Clasificación | Impacto en el Motor |
|---|---|---|
| `monthly_income` | Salario neto, honorarios freelance, mesada, rentas o becas. | Base del flujo mensual ($I$). |
| `fixed_costs` | Obligaciones contractuales inamovibles: arriendo/hipoteca, administración, servicios públicos, internet/móvil, seguros, educación. | Se descuentan primero ($F$). Alimentan el desglose de la dona. |
| `variable_ops_budget` | Supervivencia operativa: mercado/alimentación en casa, transporte/gasolina, salud/farmacia, aseo. | Presupuesto operativo ($V$). Si no se especifica, estimar en $18\% - 22\%$ de $I$. |
| `bosses` (Deudas) | Tarjetas de crédito, BNPL (ADDI, Sistecrédito), créditos de libre inversión (Nequi, bancos), crédito educativo o vehicular. | Crean un `DebtBoss` con `total_balance` (HP), `interest_rate_ea` y `min_monthly_payment`. |
| `vault_cap` (Bóveda GP) | Presupuesto de gustos, restaurantes, salidas, hobbies y recompensas personales. | Permanece **bloqueado** al inicio del mes ($B$) y se libera completando sesiones en el Santuario de Habilidades. |

---

## 3. Reglas de Inferencia para Deudas (`Debt Bosses`)

Cuando el usuario menciona una deuda pero omite la tasa E.A. o la cuota mínima, el motor aplica estos parámetros financieros por defecto:

- **Tarjeta de Crédito / Nu / Bancolombia / RappiCard:** `interest_rate_ea = 28.5%`, `min_monthly_payment = max(45000, round(saldo * 0.06))`
- **BNPL / ADDI / Sistecrédito:** `interest_rate_ea = 29.0%`, `min_monthly_payment = max(50000, round(saldo * 0.12))`
- **Nequi Propulsor / Libre Inversión:** `interest_rate_ea = 24.5%`, `min_monthly_payment = max(40000, round(saldo * 0.08))`
- **Crédito Educativo / ICETEX:** `interest_rate_ea = 12.5%`, `min_monthly_payment = max(60000, round(saldo * 0.03))`

---

## 4. Ecuación de Equilibrio y Poder Bola de Nieve

El motor **nunca** debe devolver un presupuesto deficitario salvo que los costos fijos por sí solos superen el ingreso:

$$\text{Flujo Libre (Poder Bola de Nieve)} = I - F - V - B \ge 0$$

- Si $I - F - V > 0$, calibrar $B$ (`vault_cap`) entre el $30\%$ y el $45\%$ del remanente $(I - F - V)$, dejando el $55\% - 70\%$ restante como **Poder Bola de Nieve** para amortizar deudas o cumplir la `savings_goal_monthly`.
- **Selección de Estrategia:**
  - Si existen $\ge 2$ deudas y la mayor tasa E.A. supera en más de $3\%$ a la menor o es $\ge 24\%$, recomendar `avalanche`.
  - Si existe una deuda pequeña ($\le 20\%$ del total adeudado) que puede liquidarse en $\le 2$ meses, recomendar `snowball`.

---

## 5. Implementación de Referencia en el Proyecto

- Lógica del motor e integración con Gemini (`responseSchema`): [`src/lib/onboarding-ai.ts`](../../src/lib/onboarding-ai.ts)
- Endpoint API del motor: [`src/app/api/onboarding/ai/route.ts`](../../src/app/api/onboarding/ai/route.ts)
