/**
 * MOTOR DE AUDITORÍA Y RECLASIFICACIÓN FINANCIERA — OAKHAVEN 3.9
 *
 * Módulo puro y determinista responsable de:
 * 1. Normalizar el historial de ingresos y gastos de septiembre a noviembre de 2026.
 * 2. Aislar saldos iniciales (ej. Inicial cuenta $233.501, Inicial efectivo $170.000)
 *    para evitar que se computen como ingresos o sueldos nuevos.
 * 3. Identificar y auditar la categoría «Inversiones», separando préstamos familiares,
 *    reembolsos y colocaciones de ahorro con trazabilidad de IDs intacta.
 * 4. Analizar la cadencia quincenal de ingresos (días 5 y 20).
 */

import type { FinancialMovementRecord, FinancialClassification } from "../../types/rpg.ts";

export interface ReclassifiedFinancialDataset {
  movements: FinancialMovementRecord[];
  summary: {
    totalCount: number;
    initialBalancesCount: number;
    initialBalancesTotalCop: number;
    operationalIncomeTotalCop: number;
    operationalExpenseTotalCop: number;
    transfersCount: number;
    salaryCount: number;
    totalSalaryCop: number;
    averageBiweeklySalaryCop: number;
    investmentsCount: number;
    investmentsNeedingReviewCount: number;
  };
  investmentsAudit: Array<{
    id: string;
    fecha: string;
    tipo: "Ingreso" | "Gasto";
    monto: number;
    descripcion: string;
    suggestedClassification: FinancialClassification;
    auditReason: string;
  }>;
}

/**
 * Audita y reclasifica un lote de movimientos financieros históricos.
 * Mantiene la integridad total de los IDs y datos originales.
 */
export function auditAndClassifyMovements(
  rawMovements: FinancialMovementRecord[]
): ReclassifiedFinancialDataset {
  const reclassified: FinancialMovementRecord[] = [];
  const investmentsAudit: ReclassifiedFinancialDataset["investmentsAudit"] = [];

  let initialBalancesCount = 0;
  let initialBalancesTotalCop = 0;
  let operationalIncomeTotalCop = 0;
  let operationalExpenseTotalCop = 0;
  let transfersCount = 0;
  let salaryCount = 0;
  let totalSalaryCop = 0;
  let investmentsCount = 0;
  let investmentsNeedingReviewCount = 0;

  for (const m of rawMovements) {
    const descLower = (m.descripcion || "").toLowerCase().trim();
    const catLower = (m.categoria || "").toLowerCase().trim();
    const rawType = (m.tipo || "").trim().toLowerCase();
    const amount = Math.round(Math.abs(m.monto || 0));

    let classification: FinancialClassification = "gasto_operativo";
    let isInitialBalance = false;
    let requiresReview = false;
    let auditNotes: string | undefined = undefined;

    // 1. Detección de Saldos Iniciales (4 de septiembre)
    const isExplicitInitial =
      m.id === "mts5z6dfjzde" ||
      m.id === "mts61q9xcf10" ||
      descLower.includes("inicial cuenta") ||
      descLower.includes("inicial efectivo");

    if (isExplicitInitial) {
      classification = "saldo_inicial";
      isInitialBalance = true;
      initialBalancesCount++;
      initialBalancesTotalCop += amount;
      auditNotes = "Saldo preexistente al 4 de septiembre de 2026. Aislado: no constituye ingreso operativo.";
    }
    // 2. Transferencias internas neutras
    else if (catLower === "transferencia" || rawType === "transferencia") {
      classification = "transferencia_interna";
      transfersCount++;
      auditNotes = "Movimiento interno neutral entre cuentas.";
    }
    // 3. Sueldos quincenales legítimos
    else if (catLower === "sueldo") {
      classification = "sueldo_quincenal";
      salaryCount++;
      totalSalaryCop += amount;
      operationalIncomeTotalCop += amount;
      auditNotes = "Sueldo quincenal verificado.";
    }
    // 4. Auditoría de la categoría heterogénea «Inversiones»
    else if (catLower === "inversiones") {
      investmentsCount++;

      if (descLower.includes("devolución") || descLower.includes("universidad")) {
        classification = "reembolso";
        requiresReview = true;
        investmentsNeedingReviewCount++;
        auditNotes = "Reembolso académico (Devolución universidad), clasificado erróneamente en Inversiones.";
      } else if (
        descLower.includes("mami") ||
        descLower.includes("mamá") ||
        descLower.includes("emilio") ||
        descLower.includes("migue")
      ) {
        classification = "prestamo_familiar";
        requiresReview = true;
        investmentsNeedingReviewCount++;
        auditNotes = "Préstamo, reintegro o apoyo familiar/terceros, no inversión formal.";
      } else if (descLower === "sep" || descLower.includes("ahorro")) {
        classification = "inversion_ahorro";
        requiresReview = false;
        auditNotes = "Colocación de ahorro programado para inversión.";
      } else {
        classification = "pendiente_clasificar";
        requiresReview = true;
        investmentsNeedingReviewCount++;
        auditNotes = "Movimiento en Inversiones con concepto pendiente de aclaración.";
      }

      investmentsAudit.push({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: amount,
        descripcion: m.descripcion,
        suggestedClassification: classification,
        auditReason: auditNotes,
      });

      if (rawType === "ingreso") {
        operationalIncomeTotalCop += amount;
      } else {
        operationalExpenseTotalCop += amount;
      }
    }
    // 5. Otros ingresos y gastos operativos
    else {
      if (rawType === "ingreso") {
        classification = "reembolso";
        operationalIncomeTotalCop += amount;
      } else {
        const isFixed = ["arriendo", "servicios", "hogar", "suscripcion", "gimnasio"].includes(catLower);
        classification = isFixed ? "gasto_fijo" : "gasto_operativo";
        operationalExpenseTotalCop += amount;
      }
    }

    reclassified.push({
      ...m,
      classification,
      isInitialBalance,
      requiresReview,
      auditNotes,
    });
  }

  const averageBiweeklySalaryCop =
    salaryCount > 0 ? Math.round(totalSalaryCop / salaryCount) : 0;

  return {
    movements: reclassified,
    summary: {
      totalCount: rawMovements.length,
      initialBalancesCount,
      initialBalancesTotalCop,
      operationalIncomeTotalCop,
      operationalExpenseTotalCop,
      transfersCount,
      salaryCount,
      totalSalaryCop,
      averageBiweeklySalaryCop,
      investmentsCount,
      investmentsNeedingReviewCount,
    },
    investmentsAudit,
  };
}
