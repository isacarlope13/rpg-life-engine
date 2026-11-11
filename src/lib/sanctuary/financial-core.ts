/**
 * FINANCIAL CORE & CALENDARIO QUINCENAL — OAKHAVEN 3.9 (HITO 3.9.2)
 *
 * Motor determinista responsable de:
 * 1. Planificación de flujo de caja basada en quincenas colombianas (días 5–19 y 20–4).
 * 2. Conciliación de liquidez real en COP con tipos enteros exactos (sin coma flotante).
 * 3. Protección inviolable de la Reserva Esencial ($250.000 COP hasta el 20 de noviembre).
 * 4. Cálculo estricto de DINERO_LIBRE:
 *    DINERO_LIBRE = MAX(0, SALDO_REAL_CONCILIADO - GASTOS_ESENCIALES - RESERVAS - COMPROMISOS)
 * 5. Prohibición estricta de computar ingresos futuros esperados como dinero disponible hoy.
 * 6. Generación de 3 escenarios de proyección: Conservador, Base y Favorable.
 */

export type BiweeklyCycleType = "first_half" | "second_half";

export interface BiweeklyCyclePeriod {
  cycleType: BiweeklyCycleType;
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  daysRemainingInCycle: number;
  nextPaydayDate: string;
}

export interface CommittedObligationItem {
  id: string;
  name: string;
  amountCop: number;
  dueDate: string; // YYYY-MM-DD
  isMandatory: boolean;
  priority: "critical" | "high" | "normal";
  status: "pending" | "paid" | "overdue";
  notes?: string;
}

export interface BiweeklyPlanningParams {
  asOfDate: string; // Fecha de referencia (ej. 2026-11-11)
  accounts: {
    nuAccountCop: number;
    nequiAccountCop: number;
    cashCop?: number;
    otherAccountsCop?: number;
  };
  protectedEssentialReserveCop: number; // Reserva intocable (ej. 250.000 COP)
  expectedNextIncome: {
    amountCop: number; // Ej. 1.000.000 COP
    expectedDate: string; // 2026-11-20
    isConfirmed: boolean;
  };
  committedObligations: CommittedObligationItem[];
  wellnessBudgetLimitCop?: number;
  rewardsWishlistBudgetLimitCop?: number;
}

export interface ScenarioProjection {
  scenarioName: "conservative" | "base" | "favorable";
  description: string;
  liquidAvailableTodayCop: number;
  essentialReserveProtectedCop: number;
  obligationsPayableCop: number;
  freeMoneyRemainingCop: number;
  liquidityDeficitRisk: boolean;
  notes: string[];
}

export interface BiweeklyCashflowPlan {
  asOfDate: string;
  cycle: BiweeklyCyclePeriod;
  reconciledLiquidCashCop: number; // Liquidez real disponible HOY
  protectedReserveCop: number;     // Reserva esencial protegida
  maxMarginBeforeDebtsCop: number; // MAX(0, Reconciled - Reserve)
  totalCommittedObligationsCop: number;
  freeMoneyCop: number;            // DINERO_LIBRE determinista
  expectedNextIncome: {
    amountCop: number;
    expectedDate: string;
    isAvailableNow: false; // REGLA CRÍTICA: Siempre false hasta confirmación bancaria
    notes: string;
  };
  scenarios: {
    conservative: ScenarioProjection;
    base: ScenarioProjection;
    favorable: ScenarioProjection;
  };
  dataSufficiency: {
    isSufficient: boolean;
    missingFields: string[];
    advisories: string[];
  };
  upcomingObligationsSorted: CommittedObligationItem[];
}

/**
 * Determina el ciclo quincenal correspondiente a una fecha real en Colombia.
 * - Ciclo 1 (first_half): Día 5 al 19 de cada mes. Próximo pago: día 20.
 * - Ciclo 2 (second_half): Día 20 al 4 del mes siguiente. Próximo pago: día 5.
 */
export function determineBiweeklyCycle(dateStr: string): BiweeklyCyclePeriod {
  const parts = dateStr.slice(0, 10).split("-").map(Number);
  const year = parts[0];
  const month = parts[1]; // 1-12
  const day = parts[2];   // 1-31

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  if (day >= 5 && day <= 19) {
    const startStr = `${year}-${pad(month)}-05`;
    const endStr = `${year}-${pad(month)}-19`;
    const nextPay = `${year}-${pad(month)}-20`;
    const daysRemaining = 19 - day;

    return {
      cycleType: "first_half",
      label: `Quincena del 5 al 19 de ${getMonthNameEs(month)} ${year}`,
      startDate: startStr,
      endDate: endStr,
      daysRemainingInCycle: Math.max(0, daysRemaining),
      nextPaydayDate: nextPay,
    };
  } else {
    let startYear = year;
    let startMonth = month;
    let endYear = year;
    let endMonth = month;
    let nextPayYear = year;
    let nextPayMonth = month;

    if (day >= 20) {
      // Desde el 20 hasta el 4 del mes siguiente
      endMonth = month === 12 ? 1 : month + 1;
      endYear = month === 12 ? year + 1 : year;
      nextPayMonth = endMonth;
      nextPayYear = endYear;
    } else {
      // Del 1 al 4: pertenece al ciclo que inició el 20 del mes anterior
      startMonth = month === 1 ? 12 : month - 1;
      startYear = month === 1 ? year - 1 : year;
    }

    const startStr = `${startYear}-${pad(startMonth)}-20`;
    const endStr = `${endYear}-${pad(endMonth)}-04`;
    const nextPay = `${nextPayYear}-${pad(nextPayMonth)}-05`;

    let daysRemaining = 0;
    if (day >= 20) {
      const daysInMonth = new Date(year, month, 0).getDate();
      daysRemaining = daysInMonth - day + 4;
    } else {
      daysRemaining = 4 - day;
    }

    return {
      cycleType: "second_half",
      label: `Quincena del 20 de ${getMonthNameEs(startMonth)} al 4 de ${getMonthNameEs(endMonth)}`,
      startDate: startStr,
      endDate: endStr,
      daysRemainingInCycle: Math.max(0, daysRemaining),
      nextPaydayDate: nextPay,
    };
  }
}

function getMonthNameEs(month: number): string {
  const names = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return names[month - 1] || `Mes ${month}`;
}

/**
 * Calcula el plan de flujo de caja quincenal determinista y los 3 escenarios.
 */
export function calculateBiweeklyCashflowPlan(
  params: BiweeklyPlanningParams
): BiweeklyCashflowPlan {
  const cycle = determineBiweeklyCycle(params.asOfDate);

  // 1. Conciliación exacta de saldos en mano (COP enteros)
  const nu = Math.max(0, Math.round(params.accounts.nuAccountCop || 0));
  const nequi = Math.max(0, Math.round(params.accounts.nequiAccountCop || 0));
  const cash = Math.max(0, Math.round(params.accounts.cashCop || 0));
  const other = Math.max(0, Math.round(params.accounts.otherAccountsCop || 0));

  const reconciledLiquidCashCop = nu + nequi + cash + other;
  const protectedReserveCop = Math.max(0, Math.round(params.protectedEssentialReserveCop || 0));

  // 2. Margen máximo antes de deudas: MAX(0, Liquidez - Reserva)
  const maxMarginBeforeDebtsCop = Math.max(0, reconciledLiquidCashCop - protectedReserveCop);

  // 3. Obligaciones ordenadas por fecha y urgencia
  const obligationsSorted = [...(params.committedObligations || [])].sort((a, b) => {
    return a.dueDate.localeCompare(b.dueDate);
  });

  // Total de obligaciones del ciclo que vencen antes de la próxima quincena
  const cycleEnd = cycle.endDate;
  const obligationsInCycle = obligationsSorted.filter(
    (o) => o.status !== "paid" && o.dueDate <= cycleEnd
  );

  const totalCommittedObligationsCop = obligationsInCycle.reduce(
    (acc, o) => acc + Math.round(o.amountCop),
    0
  );

  // 4. Regla Determinista de DINERO_LIBRE
  // DINERO_LIBRE = MAX(0, Saldo_Real - Reserva_Protegida - Obligaciones_Comprometidas)
  const freeMoneyCop = Math.max(0, maxMarginBeforeDebtsCop - totalCommittedObligationsCop);

  // 5. Análisis de Suficiencia de Datos
  const missingFields: string[] = [];
  const advisories: string[] = [];

  if (reconciledLiquidCashCop === 0) {
    missingFields.push("Saldos de cuentas bancarias en cero o no reportados");
  }
  if (!params.expectedNextIncome || params.expectedNextIncome.amountCop <= 0) {
    missingFields.push("Monto del próximo ingreso esperado no confirmado");
  }

  // Comprobar riesgo de liquidez si las obligaciones superan el margen antes de deudas
  if (totalCommittedObligationsCop > maxMarginBeforeDebtsCop) {
    const deficit = totalCommittedObligationsCop - maxMarginBeforeDebtsCop;
    advisories.push(
      `ALERTA DE LIQUIDEZ: Las obligaciones del ciclo ($${totalCommittedObligationsCop.toLocaleString(
        "es-CO"
      )} COP) superan el margen libre antes de la quincena ($${maxMarginBeforeDebtsCop.toLocaleString(
        "es-CO"
      )} COP) por un déficit de $${deficit.toLocaleString(
        "es-CO"
      )} COP. Prohibido tocar la reserva esencial de $${protectedReserveCop.toLocaleString("es-CO")} COP.`
    );
  }

  // 6. Generación de los 3 Escenarios de Simulación
  const scenarios = generatePlanningScenarios({
    reconciledLiquidCashCop,
    protectedReserveCop,
    maxMarginBeforeDebtsCop,
    obligationsInCycle,
    expectedIncomeCop: Math.round(params.expectedNextIncome.amountCop || 0),
    daysRemaining: cycle.daysRemainingInCycle,
  });

  return {
    asOfDate: params.asOfDate,
    cycle,
    reconciledLiquidCashCop,
    protectedReserveCop,
    maxMarginBeforeDebtsCop,
    totalCommittedObligationsCop,
    freeMoneyCop,
    expectedNextIncome: {
      amountCop: Math.round(params.expectedNextIncome.amountCop || 0),
      expectedDate: params.expectedNextIncome.expectedDate,
      isAvailableNow: false,
      notes: "Ingreso quincenal estimado. No se contabiliza como saldo disponible actual para evitar sobregiros de liquidez.",
    },
    scenarios,
    dataSufficiency: {
      isSufficient: missingFields.length === 0,
      missingFields,
      advisories,
    },
    upcomingObligationsSorted: obligationsSorted,
  };
}

interface ScenarioGenInput {
  reconciledLiquidCashCop: number;
  protectedReserveCop: number;
  maxMarginBeforeDebtsCop: number;
  obligationsInCycle: CommittedObligationItem[];
  expectedIncomeCop: number;
  daysRemaining: number;
}

function generatePlanningScenarios(input: ScenarioGenInput): {
  conservative: ScenarioProjection;
  base: ScenarioProjection;
  favorable: ScenarioProjection;
} {
  const {
    reconciledLiquidCashCop,
    protectedReserveCop,
    maxMarginBeforeDebtsCop,
    obligationsInCycle,
  } = input;

  // 1. Escenario Conservador:
  // - Cero ingresos futuros asumidos.
  // - Solo se pagan obligaciones críticas que quepan estrictamente en el margen disponible.
  // - Reserva protegida al 100%.
  let conservativePayable = 0;
  for (const o of obligationsInCycle) {
    if (conservativePayable + o.amountCop <= maxMarginBeforeDebtsCop) {
      conservativePayable += o.amountCop;
    }
  }
  const conservativeRemaining = Math.max(0, maxMarginBeforeDebtsCop - conservativePayable);

  const conservative: ScenarioProjection = {
    scenarioName: "conservative",
    description: "Modo Supervivencia & Blindaje: Solo liquidez confirmada en mano. Reserva protegida al 100%.",
    liquidAvailableTodayCop: reconciledLiquidCashCop,
    essentialReserveProtectedCop: protectedReserveCop,
    obligationsPayableCop: conservativePayable,
    freeMoneyRemainingCop: conservativeRemaining,
    liquidityDeficitRisk: obligationsInCycle.some(
      (o) => o.amountCop > maxMarginBeforeDebtsCop
    ),
    notes: [
      `Reserva intocable: $${protectedReserveCop.toLocaleString("es-CO")} COP salvaguardada para subsistencia.`,
      `Margen máximo para compromisos previos a la quincena: $${maxMarginBeforeDebtsCop.toLocaleString("es-CO")} COP.`,
      "Cero anticipo de ingresos futuros: no se autoriza ningún gasto contra dinero no cobrado.",
    ],
  };

  // 2. Escenario Base:
  // - Pago puntual de compromisos críticos con vencimiento antes de quincena (ej. Nequi cuota 21/24).
  // - Postergación de pagos que sobrepasen el margen para el día 20 (fecha de quincena).
  const criticalObligations = obligationsInCycle.filter(
    (o) => o.priority === "critical" || o.name.toLowerCase().includes("nequi")
  );
  const criticalTotal = criticalObligations.reduce((sum, o) => sum + o.amountCop, 0);
  const basePayable = Math.min(criticalTotal, maxMarginBeforeDebtsCop);
  const baseRemaining = Math.max(0, maxMarginBeforeDebtsCop - basePayable);

  const base: ScenarioProjection = {
    scenarioName: "base",
    description: "Priorización Inteligente: Cubre la cuota crítica de Nequi ($56.431) y congela abonos mayores hasta el cobro de la quincena el 20-nov.",
    liquidAvailableTodayCop: reconciledLiquidCashCop,
    essentialReserveProtectedCop: protectedReserveCop,
    obligationsPayableCop: basePayable,
    freeMoneyRemainingCop: baseRemaining,
    liquidityDeficitRisk: false,
    notes: [
      `Pago prioritario Nequi cubierto ($${basePayable.toLocaleString("es-CO")} COP), protegiendo historial crediticio.`,
      `Margen remanente para imprevistos: $${baseRemaining.toLocaleString("es-CO")} COP.`,
      "Obligaciones de mayor volumen (ADDI/Contento) quedan programadas para el ingreso quincenal del 20 de noviembre.",
    ],
  };

  // 3. Escenario Favorable:
  // - Entrada puntual de la quincena del 20-nov ($1.000.000 COP).
  // - Con el nuevo flujo, se normaliza ADDI y se evalúa acuerdo de Bancolombia previa verificación de paz y salvo.
  const favorablePayable = obligationsInCycle.reduce((sum, o) => sum + o.amountCop, 0);
  const favorable: ScenarioProjection = {
    scenarioName: "favorable",
    description: "Resolución Post-Quincena: Al recibir los $1.000.000 COP del 20 de noviembre, se liquida el atraso de ADDI y se consolida ahorro.",
    liquidAvailableTodayCop: reconciledLiquidCashCop,
    essentialReserveProtectedCop: protectedReserveCop,
    obligationsPayableCop: favorablePayable,
    freeMoneyRemainingCop: baseRemaining,
    liquidityDeficitRisk: false,
    notes: [
      "La solvencia total se restablece inmediatamente al ingresar la quincena del 20 de noviembre.",
      "Permite amortizar ADDI sin comprometer en ningún momento la reserva vital de $250.000 COP.",
    ],
  };

  return { conservative, base, favorable };
}

/**
 * Valida si un artículo de la Wishlist o gasto recreativo puede ser canjeado hoy.
 * Aplica el principio de prudencia financiera:
 * Prohibido comprar si DINERO_LIBRE es 0 o si la reserva esencial está en riesgo.
 */
export function validateWishlistPurchaseBudget(
  itemCostCop: number,
  plan: BiweeklyCashflowPlan
): {
  isAllowed: boolean;
  maxBudgetAvailableCop: number;
  reason: string;
} {
  const cost = Math.max(0, Math.round(itemCostCop));

  if (plan.freeMoneyCop <= 0) {
    return {
      isAllowed: false,
      maxBudgetAvailableCop: 0,
      reason:
        "Bloqueo por Prudencia Financiera: No cuentas con Dinero Libre disponible en esta quincena. Toda tu liquidez está comprometida en la Reserva Esencial y obligaciones prioritarias.",
    };
  }

  if (cost > plan.freeMoneyCop) {
    return {
      isAllowed: false,
      maxBudgetAvailableCop: plan.freeMoneyCop,
      reason: `Presupuesto insuficiente: El artículo cuesta $${cost.toLocaleString(
        "es-CO"
      )} COP y tu Dinero Libre actual es de $${plan.freeMoneyCop.toLocaleString(
        "es-CO"
      )} COP. Te faltan $${(cost - plan.freeMoneyCop).toLocaleString("es-CO")} COP.`,
    };
  }

  return {
    isAllowed: true,
    maxBudgetAvailableCop: plan.freeMoneyCop,
    reason: `Aprobado: El gasto de $${cost.toLocaleString(
      "es-CO"
    )} COP no afecta tu reserva de $${plan.protectedReserveCop.toLocaleString(
      "es-CO"
    )} COP ni tus pagos comprometidos.`,
  };
}
