import type { FinancialMovementRecord } from "../../types/rpg.ts";
import { defaultSystemGuardian, SystemGuardian } from "./system-guardian.ts";
import type { AgentExecutionOutcome } from "./types.ts";

export interface ExpenseAuditResult {
  totalSpentCop: number;
  variableOpsSpentCop: number;
  fixedCostsSpentCop: number;
  microExpensesCount: number; // Gastos hormiga (< $15.000 COP repetitivos)
  microExpensesTotalCop: number;
  anomalyAlerts: string[];
  rebalanceRecommendation?: {
    suggestedAmountCop: number;
    fromBucket: string;
    toBucket: string;
    rationale: string;
  };
}

/**
 * SmartExpenseEngine: Agente especializado en auditoría y control de gastos.
 * Analiza transacciones, detecta fugas presupuestarias ("gastos hormiga")
 * y formula propuestas de rebalanceo presupuestal auditadas por el SystemGuardian.
 */
export class SmartExpenseEngine {
  private guardian: SystemGuardian;
  public static readonly MICRO_EXPENSE_CEILING_COP = 15000;

  constructor(guardian: SystemGuardian = defaultSystemGuardian) {
    this.guardian = guardian;
  }

  /**
   * Audita una lista de transacciones del periodo y detecta anomalías y gastos hormiga.
   */
  public auditTransactions(transactions: FinancialMovementRecord[]): ExpenseAuditResult {
    let total = 0;
    let varOps = 0;
    let fixed = 0;
    let microCount = 0;
    let microTotal = 0;
    const anomalyAlerts: string[] = [];

    const categoryFrequency: Record<string, number> = {};

    for (const tx of transactions) {
      if (tx.tipo === "Ingreso") continue; // Solo audita egresos
      const amount = Math.abs(tx.monto);
      total += amount;

      const catLower = (tx.categoria || "").toLowerCase();
      if (catLower === "hogar" || catLower === "servicios" || catLower === "arriendo" || catLower === "deuda") {
        fixed += amount;
      } else {
        varOps += amount;
      }

      // Conteo de gastos hormiga
      if (amount <= SmartExpenseEngine.MICRO_EXPENSE_CEILING_COP) {
        microCount++;
        microTotal += amount;
      }

      categoryFrequency[catLower] = (categoryFrequency[catLower] || 0) + 1;
    }

    // Detección de fugas hormiga (más de 4 gastos hormiga en la semana o más de $50.000 COP acumulados)
    if (microCount >= 4 || microTotal >= 50000) {
      anomalyAlerts.push(
        `Fuga hormiga detectada: ${microCount} compras menores acumulando $${microTotal.toLocaleString(
          "es-CO"
        )} COP. Considera consolidar compras diarias.`
      );
    }

    // Detección de concentración excesiva en ocio o delivery
    if ((categoryFrequency["ocio"] || 0) >= 5) {
      anomalyAlerts.push(
        "Alerta de frecuencia: Se detectaron más de 5 transacciones de ocio en el periodo analizado."
      );
    }

    let rebalanceRecommendation;
    if (microTotal >= 40000) {
      rebalanceRecommendation = {
        suggestedAmountCop: 25000,
        fromBucket: "variable_ops",
        toBucket: "vault_savings",
        rationale: `Rebalanceo sugerido: Transferir $25.000 COP de gastos operativos variables a la Bóveda para mitigar la fuga hormiga acumulada de $${microTotal.toLocaleString(
          "es-CO"
        )} COP.`,
      };
    }

    return {
      totalSpentCop: total,
      variableOpsSpentCop: varOps,
      fixedCostsSpentCop: fixed,
      microExpensesCount: microCount,
      microExpensesTotalCop: microTotal,
      anomalyAlerts,
      rebalanceRecommendation,
    };
  }

  /**
   * Propone formalmente un rebalanceo presupuestario a través del SystemGuardian.
   */
  public async proposeRebalance(params: {
    userId: string;
    amountCop: number;
    fromBucket: string;
    toBucket: string;
    rationale: string;
    mutationExecutor: () => Promise<Record<string, unknown>>;
  }): Promise<AgentExecutionOutcome> {
    return this.guardian.interceptAndEnforce(
      {
        agentCode: "smart_expense",
        userId: params.userId,
        category: "financial_rebalance",
        actionName: "rebalance_budget_bucket",
        rationale: params.rationale,
        payload: {
          amountCop: params.amountCop,
          fromBucket: params.fromBucket,
          toBucket: params.toBucket,
        },
      },
      params.mutationExecutor
    );
  }
}

export const defaultSmartExpenseEngine = new SmartExpenseEngine();
