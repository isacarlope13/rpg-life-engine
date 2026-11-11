/**
 * PUENTE FINANCIERO DE SESIONES Y HABILIDADES — OAKHAVEN 3.9 (HITO 3.9.5)
 *
 * Módulo determinista que conecta las sesiones de habilidades en los edificios
 * con su impacto financiero real sin duplicar gastos ni inventar ingresos ficticios:
 *
 * 1. GIMNASIO (sports):
 *    - Amortización de membresía mensual fija ($80.000 COP).
 *    - A mayor frecuencia de entrenamiento, menor es el costo unitario por sesión.
 *    - REGLA: Entrenar NO descuenta dinero bancario (la membresía se paga 1 vez al mes).
 *
 * 2. ATELIER (knitting):
 *    - Compra de lana registrada en la adquisición de ovillos.
 *    - Cada vuelta/proyecto consume inventario de material sin debitar dinero bancario.
 *
 * 3. OFICINA (work):
 *    - Horas de empleo asalariado NO generan saldos bancarios sesión a sesión (el sueldo es quincenal).
 *    - Clases particulares y freelance solo generan ingresos al cobrar efectivamente la factura.
 *
 * 4. LIBRERÍA (reading):
 *    - El costo del libro ocurre en la compra; la lectura extrae el valor del activo sin costo monetario adicional.
 */

export interface GymMembershipMetrics {
  monthlyFeeCop: number;
  sessionsCompletedCount: number;
  amortizedCostPerSessionCop: number;
  efficiencyLevel: "optima" | "media" | "subutilizada";
  encouragementMessage: string;
}

export interface AtelierYarnInventory {
  skeinsInStock: number;          // Ovillos en inventario
  averageCostPerSkeinCop: number; // Costo promedio por ovillo (ej. $12.000 COP)
  totalInventoryValueCop: number;
  skeinsConsumedTotal: number;
}

export interface YarnConsumptionResult {
  updatedInventory: AtelierYarnInventory;
  skeinsConsumed: number;
  materialValueConsumedCop: number;
  inventoryDepleted: boolean;
  notes: string;
}

export interface WorkSessionFinancialOutcome {
  workType: "salaried_employment" | "freelance_project" | "private_tutoring";
  hoursWorked: number;
  affectsImmediateBankBalance: boolean;
  receivableGeneratedCop: number;
  accountingNote: string;
}

export interface BookFinancialExtraction {
  purchasePriceCop: number;
  totalPages: number;
  pagesRead: number;
  amortizedCostPerPageCop: number;
  intellectualValueExtractedCop: number;
  readingCompletionPercentage: number;
}

/**
 * Calcula el costo amortizado por sesión de gimnasio a partir de la membresía mensual.
 * Invariante: Cero duplicación de transacciones en el libro mayor bancario.
 */
export function calculateGymAmortization(
  monthlyFeeCop: number,
  sessionsCompletedCount: number
): GymMembershipMetrics {
  const fee = Math.max(0, Math.round(monthlyFeeCop));
  const sessions = Math.max(0, Math.round(sessionsCompletedCount));

  if (sessions === 0) {
    return {
      monthlyFeeCop: fee,
      sessionsCompletedCount: 0,
      amortizedCostPerSessionCop: fee,
      efficiencyLevel: "subutilizada",
      encouragementMessage:
        "Membresía activa sin entrenamientos registrados este mes. ¡Cada sesión que realices reduce el costo de tu inversión en salud!",
    };
  }

  const amortized = Math.round(fee / sessions);
  let efficiencyLevel: GymMembershipMetrics["efficiencyLevel"] = "subutilizada";
  let msg = "";

  if (sessions >= 12) {
    efficiencyLevel = "optima";
    msg = `¡Excelente aprovechamiento! Has entrenado ${sessions} veces este mes, logrando un costo extraordinario de solo $${amortized.toLocaleString(
      "es-CO"
    )} COP por entrenamiento.`;
  } else if (sessions >= 6) {
    efficiencyLevel = "media";
    msg = `Buen ritmo: ${sessions} sesiones acumuladas ($${amortized.toLocaleString(
      "es-CO"
    )} COP/sesión). Con 3 sesiones más alcanzarás el nivel de aprovechamiento óptimo.`;
  } else {
    efficiencyLevel = "subutilizada";
    msg = `Llevas ${sessions} sesiones ($${amortized.toLocaleString(
      "es-CO"
    )} COP/sesión). Aumentar tu frecuencia maximiza el retorno de tu membresía.`;
  }

  return {
    monthlyFeeCop: fee,
    sessionsCompletedCount: sessions,
    amortizedCostPerSessionCop: amortized,
    efficiencyLevel,
    encouragementMessage: msg,
  };
}

/**
 * Calcula el consumo de material de lana en el Atelier.
 * Invariante: Tejer consume inventario físico previamente adquirido; no genera nuevos débitos bancarios.
 */
export function consumeAtelierYarn(
  inventory: AtelierYarnInventory,
  rowsCompleted: number,
  rowsPerSkein = 100 // Estimación de filas promedio por ovillo
): YarnConsumptionResult {
  const rows = Math.max(0, Math.round(rowsCompleted));
  const skeinsNeeded = Math.round((rows / rowsPerSkein) * 10) / 10;
  const actualSkeinsConsumed = Math.min(inventory.skeinsInStock, skeinsNeeded);

  const updatedStock = Math.max(0, inventory.skeinsInStock - actualSkeinsConsumed);
  const materialValue = Math.round(actualSkeinsConsumed * inventory.averageCostPerSkeinCop);
  const updatedTotalValue = Math.round(updatedStock * inventory.averageCostPerSkeinCop);

  const isDepleted = updatedStock === 0 && skeinsNeeded > actualSkeinsConsumed;

  return {
    updatedInventory: {
      skeinsInStock: updatedStock,
      averageCostPerSkeinCop: inventory.averageCostPerSkeinCop,
      totalInventoryValueCop: updatedTotalValue,
      skeinsConsumedTotal: inventory.skeinsConsumedTotal + actualSkeinsConsumed,
    },
    skeinsConsumed: actualSkeinsConsumed,
    materialValueConsumedCop: materialValue,
    inventoryDepleted: isDepleted,
    notes: isDepleted
      ? "Alerta de Atelier: Inventario de lana agotado. Necesitas adquirir nuevo material para continuar este proyecto."
      : `Consumo registrado: ${actualSkeinsConsumed} ovillos ($${materialValue.toLocaleString(
          "es-CO"
        )} COP en insumos propios). Quedan ${updatedStock} ovillos en reserva.`,
  };
}

/**
 * Procesa el impacto financiero de una sesión de trabajo en la Oficina.
 * Invariante: Las horas de trabajo asalariado NO generan dinero bancario instantáneo.
 */
export function processWorkSessionFinancialImpact(params: {
  workType: "salaried_employment" | "freelance_project" | "private_tutoring";
  hoursWorked: number;
  billedAmountCop?: number;
}): WorkSessionFinancialOutcome {
  const hours = Math.max(0, params.hoursWorked);

  if (params.workType === "salaried_employment") {
    return {
      workType: "salaried_employment",
      hoursWorked: hours,
      affectsImmediateBankBalance: false,
      receivableGeneratedCop: 0,
      accountingNote:
        "Horas de empleo formal asalariado registradas. Este esfuerzo contribuye a la consolidación de tu nómina quincenal, pero NO suma saldo bancario inmediato en el libro mayor.",
    };
  }

  const billed = Math.max(0, Math.round(params.billedAmountCop || 0));

  if (params.workType === "private_tutoring") {
    return {
      workType: "private_tutoring",
      hoursWorked: hours,
      affectsImmediateBankBalance: billed > 0,
      receivableGeneratedCop: billed,
      accountingNote:
        billed > 0
          ? `Clases particulares dictadas: Ingreso real de $${billed.toLocaleString(
              "es-CO"
            )} COP generado y listo para registrar en tesorería al ser cobrado.`
          : "Sesión de tutoría registrada sin cobro inmediato especificado.",
    };
  }

  // Freelance
  return {
    workType: "freelance_project",
    hoursWorked: hours,
    affectsImmediateBankBalance: false,
    receivableGeneratedCop: billed,
    accountingNote:
      billed > 0
        ? `Proyecto freelance avanzado: Se genera una cuenta por cobrar por $${billed.toLocaleString(
            "es-CO"
          )} COP. Se acreditará en banco una vez el cliente realice el pago.`
        : "Horas freelance dedicadas a desarrollo de proyecto.",
  };
}

/**
 * Calcula la extracción de valor intelectual de un libro adquirido en la Librería.
 * Invariante: La lectura genera sabiduría (XP/GP) sin gastos bancarios adicionales.
 */
export function calculateReadingValueExtraction(params: {
  purchasePriceCop: number;
  totalPages: number;
  pagesRead: number;
}): BookFinancialExtraction {
  const price = Math.max(0, Math.round(params.purchasePriceCop));
  const total = Math.max(1, Math.round(params.totalPages));
  const read = Math.min(total, Math.max(0, Math.round(params.pagesRead)));

  const costPerPage = Math.round((price / total) * 100) / 100;
  const valueExtracted = Math.round((read / total) * price);
  const percentage = Math.round((read / total) * 1000) / 10;

  return {
    purchasePriceCop: price,
    totalPages: total,
    pagesRead: read,
    amortizedCostPerPageCop: costPerPage,
    intellectualValueExtractedCop: valueExtracted,
    readingCompletionPercentage: percentage,
  };
}
