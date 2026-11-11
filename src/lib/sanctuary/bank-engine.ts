/**
 * MOTOR FINANCIERO & BANCO DE OAKHAVEN — OAKHAVEN 3.8
 *
 * Gestiona cuentas financieras, libro contable en COP, transferencias neutras
 * (sin doble conteo en ingresos/gastos), análisis de gastos hormiga y deudas (Debt Bosses).
 *
 * INVARIANTES MATEMÁTICAS & DE SEGURIDAD:
 * 1. Todos los importes en COP son enteros exactos (evita errores IEEE 754 de punto flotante).
 * 2. Las transferencias entre cuentas propias NO suman a totalIngresos ni a totalGastos.
 * 3. Cero conversiones automáticas entre COP y GP (economía real y lúdica estrictamente aisladas).
 */

import type { FinancialMovementRecord, BossDoTSummary, DebtStrategy } from "../../types/rpg.ts";
import { INITIAL_FINANCIAL_MOVEMENTS } from "../initial-financial-movements.ts";
import { SmartExpenseEngine } from "../agents/smart-expense.ts";

export interface BankAccountRecord {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "credit";
  balanceCop: number;
  color: string;
  icon: string;
  accountNumberMask?: string;
  institution: string;
}

export interface BankTransferPayload {
  fromAccountId: string;
  toAccountId: string;
  amountCop: number;
  description: string;
  date?: string;
}

export interface BankFinancialSummary {
  totalIncomeCop: number;
  totalExpenseCop: number;
  netSavingsCop: number;
  savingsRatePercent: number;
  movementsCount: number;
  transfersCount: number;
}

export interface DebtBossUI {
  id: string;
  name: string;
  currentHpCop: number;
  maxHpCop: number;
  minMonthlyPaymentCop: number;
  interestRateEa: number;
  cutoffDay: number;
  status: "active" | "defeated";
  estimatedMonthsToKill: number;
}

// Cuentas financieras predeterminadas del usuario
export const DEFAULT_BANK_ACCOUNTS: BankAccountRecord[] = [
  {
    id: "acc_bancolombia",
    name: "Bancolombia Principal",
    type: "checking",
    balanceCop: 1458062,
    color: "#FDDA24",
    icon: "🏦",
    accountNumberMask: "*4491",
    institution: "Bancolombia",
  },
  {
    id: "acc_nu",
    name: "Cuenta Nu (Cajita de Ahorro)",
    type: "savings",
    balanceCop: 850000,
    color: "#820AD1",
    icon: "💜",
    accountNumberMask: "*7820",
    institution: "Nu Colombia",
  },
  {
    id: "acc_efectivo",
    name: "Billetera Física (Efectivo)",
    type: "cash",
    balanceCop: 137000,
    color: "#2A9D8F",
    icon: "💵",
    institution: "Efectivo en Mano",
  },
];

// Deudas iniciales representadas como Jefes de Mazmorra (Debt Bosses)
export const DEFAULT_DEBT_BOSSES: DebtBossUI[] = [
  {
    id: "boss_tarjeta_credito",
    name: "Leviatán de la Tarjeta Visa",
    currentHpCop: 1850000,
    maxHpCop: 2500000,
    minMonthlyPaymentCop: 120000,
    interestRateEa: 24.5,
    cutoffDay: 17,
    status: "active",
    estimatedMonthsToKill: 16,
  },
  {
    id: "boss_credito_universidad",
    name: "Gólem del Préstamo Académico",
    currentHpCop: 3200000,
    maxHpCop: 5000000,
    minMonthlyPaymentCop: 180000,
    interestRateEa: 14.0,
    cutoffDay: 5,
    status: "active",
    estimatedMonthsToKill: 19,
  },
];

/**
 * Calcula el resumen financiero neto a partir de los movimientos.
 * EXCLUYE estrictamente las transferencias de los totales de ingreso y gasto.
 */
export function calculateFinancialSummary(
  movements: FinancialMovementRecord[]
): BankFinancialSummary {
  let totalIncomeCop = 0;
  let totalExpenseCop = 0;
  let transfersCount = 0;

  for (const m of movements) {
    const rawType = (m.tipo || "").trim().toLowerCase();
    const amount = Math.round(Math.abs(m.monto || 0));

    if (rawType === "transferencia" || m.categoria?.toLowerCase() === "transferencia") {
      transfersCount++;
      // No suma ni a ingresos ni a gastos: es un movimiento neutral entre cuentas
      continue;
    }

    if (rawType === "ingreso") {
      totalIncomeCop += amount;
    } else if (rawType === "gasto") {
      totalExpenseCop += amount;
    }
  }

  const netSavingsCop = totalIncomeCop - totalExpenseCop;
  const savingsRatePercent =
    totalIncomeCop > 0
      ? Math.round((netSavingsCop / totalIncomeCop) * 1000) / 10
      : 0;

  return {
    totalIncomeCop,
    totalExpenseCop,
    netSavingsCop,
    savingsRatePercent,
    movementsCount: movements.length,
    transfersCount,
  };
}

/**
 * Ejecuta una transferencia neutra entre dos cuentas.
 * Genera dos registros espejados o un registro unificado de transferencia,
 * asegurando que el patrimonio total no cambie.
 */
export function executeAccountTransfer(
  accounts: BankAccountRecord[],
  payload: BankTransferPayload
): {
  updatedAccounts: BankAccountRecord[];
  transferMovement: FinancialMovementRecord;
} {
  const amount = Math.round(Math.abs(payload.amountCop));
  if (amount <= 0) {
    throw new Error("El monto de transferencia debe ser mayor a $0 COP.");
  }

  const sourceAcc = accounts.find((a) => a.id === payload.fromAccountId);
  const targetAcc = accounts.find((a) => a.id === payload.toAccountId);

  if (!sourceAcc || !targetAcc) {
    throw new Error("Una o ambas cuentas de transferencia no existen.");
  }

  if (sourceAcc.id === targetAcc.id) {
    throw new Error("La cuenta de origen y destino no pueden ser la misma.");
  }

  // Actualizar saldos de forma exacta
  const updatedAccounts = accounts.map((acc) => {
    if (acc.id === sourceAcc.id) {
      return { ...acc, balanceCop: Math.round(acc.balanceCop - amount) };
    }
    if (acc.id === targetAcc.id) {
      return { ...acc, balanceCop: Math.round(acc.balanceCop + amount) };
    }
    return acc;
  });

  const nowStr = payload.date || new Date().toISOString().replace("T", " ").slice(0, 16);
  const transferMovement: FinancialMovementRecord = {
    id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    fecha: nowStr,
    tipo: "Gasto", // Se almacena con categoría Transferencia para interoperabilidad
    categoria: "Transferencia",
    monto: amount,
    descripcion: payload.description || `Transferencia: ${sourceAcc.name} ➜ ${targetAcc.name}`,
    metodo_pago: sourceAcc.institution,
    detalle: `De: ${sourceAcc.name} | A: ${targetAcc.name}`,
    created_at: new Date().toISOString(),
  };

  return { updatedAccounts, transferMovement };
}

/**
 * Análisis inteligente de gastos mediante SmartExpenseEngine.
 * Detecta fugas hormiga (< $15.000 COP), gastos recurrentes y alertas.
 */
export function getSmartBankInsights(movements: FinancialMovementRecord[]) {
  const engine = new SmartExpenseEngine();
  const audit = engine.auditTransactions(movements);

  // Detección de pagos recurrentes fijos (ej. Celular, Internet, Gimnasio, Arriendo)
  const recurringKeywords = ["celular", "internet", "gimnasio", "arriendo", "subscripcion", "spotify", "netflix"];
  const recurringPayments = movements.filter((m) => {
    if (m.tipo !== "Gasto") return false;
    const desc = `${m.descripcion} ${m.categoria}`.toLowerCase();
    return recurringKeywords.some((kw) => desc.includes(kw));
  });

  return {
    audit,
    recurringCount: recurringPayments.length,
    recurringTotalCop: recurringPayments.reduce((acc, m) => acc + Math.abs(m.monto), 0),
    topRecurringConcepts: Array.from(new Set(recurringPayments.map((p) => p.descripcion))).slice(0, 5),
  };
}

/**
 * Calcula proyección de la estrategia de pago de deudas: Snowball vs Avalanche
 */
export function calculateDebtStrategyMetrics(
  bosses: DebtBossUI[],
  strategy: DebtStrategy = "snowball"
) {
  const activeBosses = bosses.filter((b) => b.status === "active" && b.currentHpCop > 0);
  const totalDebtCop = activeBosses.reduce((acc, b) => acc + b.currentHpCop, 0);
  const totalMinMonthlyPaymentCop = activeBosses.reduce((acc, b) => acc + b.minMonthlyPaymentCop, 0);

  // Ordenar según estrategia
  const sorted = [...activeBosses].sort((a, b) => {
    if (strategy === "snowball") {
      // Bola de nieve: menor saldo primero para victorias psicológicas rápidas
      return a.currentHpCop - b.currentHpCop;
    } else {
      // Avalancha: mayor tasa de interés primero para minimizar el interés pagado
      return b.interestRateEa - a.interestRateEa;
    }
  });

  return {
    totalDebtCop,
    totalMinMonthlyPaymentCop,
    activeBossesCount: activeBosses.length,
    targetBoss: sorted[0] || null,
    strategy,
  };
}
