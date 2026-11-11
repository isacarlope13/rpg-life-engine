/**
 * MOTOR DE DEUDAS REALES Y SIMULADOR DE AMORTIZACIÓN — OAKHAVEN 3.9 (HITO 3.9.3)
 *
 * Módulo determinista y seguro para:
 * 1. Modelar las deudas reales del caso de estudio colombiano (ADDI, Nequi, Bancolombia/Contento BPS).
 * 2. Simular pagos completos, parciales y posteriores a quincena sin suponer normalizaciones automáticas.
 * 3. Proteger la Reserva Esencial ($250.000 COP) frente a desembolsos de deuda precipitados.
 * 4. Auditar ofertas de cobro prejudicial (Contento BPS) exigiendo paz y salvo vinculante y cesión escrita.
 * 5. Advertir contra el endeudamiento para pagar descuentos (evitar espiral de sobreendeudamiento).
 */

import type { BiweeklyCashflowPlan } from "./financial-core.ts";

export type DebtObligationStatus =
  | "al_dia"
  | "proxima_a_vencer"
  | "vencida"
  | "en_negociacion"
  | "bajo_acuerdo"
  | "saldada"
  | "pendiente_verificacion";

export interface SettlementOfferInfo {
  discountedAmountCop: number;     // 2.348.000 COP
  originalAmountCop: number;       // 3.000.000 COP
  savingsCop: number;              // 652.000 COP
  expirationDate: string;          // 2026-11-13
  verificationStatus: "unverified" | "verified_written" | "expired";
  collectionAgency: string;        // "Contento BPS"
  originalCreditor: string;        // "Bancolombia"
  requiresWrittenPazYSalvo: boolean;
  legalRequirementsChecklist: Array<{
    code: string;
    label: string;
    fulfilled: boolean;
    mandatoryForPayment: boolean;
    advisory: string;
  }>;
}

export interface RealDebtObligation {
  id: string;
  creditor: string;
  collectionManager?: string;
  totalBalanceCop: number;
  overdueBalanceCop: number;       // Saldo en mora atrasado
  currentInstallmentCop: number;   // Valor de la cuota periódica
  installmentProgress?: {
    paidInstallments: number;
    totalInstallments: number;
  };
  dueDate: string;                 // Próximo vencimiento (YYYY-MM-DD)
  interestRateEa?: number;         // Tasa E.A.
  status: DebtObligationStatus;
  settlementOffer?: SettlementOfferInfo;
  advisories: string[];
}

/**
 * Catálogo real de obligaciones del caso de estudio a 11 de noviembre de 2026.
 */
export const REAL_DEBTS_CASE_STUDY: RealDebtObligation[] = [
  // 1. NEQUI (Préstamo Propulsor / Salvavidas)
  {
    id: "debt_nequi_propulsor",
    creditor: "Nequi (Bancolombia S.A.)",
    totalBalanceCop: 166210, // 166.209,65 COP redondeado a entero exacto
    overdueBalanceCop: 0,
    currentInstallmentCop: 56431,
    installmentProgress: {
      paidInstallments: 21,
      totalInstallments: 24,
    },
    dueDate: "2026-11-15",
    status: "proxima_a_vencer",
    advisories: [
      "Crédito en etapa final: 21 de 24 cuotas pagadas cumplidamente.",
      "Próximo vencimiento: 15 de noviembre. Cuota: $56.431 COP.",
      "Intereses de mora actuales: $0 COP. Prioridad alta para no manchar historial a 3 cuotas de terminar.",
    ],
  },

  // 2. ADDI (Crédito de Consumo en Mora)
  {
    id: "debt_addi_consumo",
    creditor: "ADDI",
    totalBalanceCop: 1041301,
    overdueBalanceCop: 213374,       // Pago atrasado exigible de inmediato
    currentInstallmentCop: 122711,   // Cuota ordinaria del 17-nov ($336.085 - $213.374 = $122.711)
    dueDate: "2026-11-17",
    status: "vencida",
    advisories: [
      "Obligación con atraso activo de $213.374 COP.",
      "Pago recomendado por ADDI para normalizar: $336.085 COP (atraso + vencimiento del 17 de noviembre).",
      "El saldo puede incluir recargos de cobranza e intereses de mora.",
      "ADVERTENCIA: Un abono parcial reduce el saldo pero NO normaliza automáticamente la mora ante centrales de riesgo.",
    ],
  },

  // 3. BANCOLOMBIA / CONTENTO BPS (Cobro Prejudicial con Oferta Temporal)
  {
    id: "debt_bancolombia_contento",
    creditor: "Bancolombia",
    collectionManager: "Contento BPS (Agencia de Cobranza)",
    totalBalanceCop: 3000000,
    overdueBalanceCop: 3000000,
    currentInstallmentCop: 0,
    dueDate: "2026-11-13", // Fecha límite de la oferta comunicada
    status: "en_negociacion",
    settlementOffer: {
      discountedAmountCop: 2348000,
      originalAmountCop: 3000000,
      savingsCop: 652000,
      expirationDate: "2026-11-13",
      verificationStatus: "unverified",
      collectionAgency: "Contento BPS",
      originalCreditor: "Bancolombia",
      requiresWrittenPazYSalvo: true,
      legalRequirementsChecklist: [
        {
          code: "cesion_cartera_escrita",
          label: "Verificación de Cesión de Crédito o Poder de Cobro",
          fulfilled: false,
          mandatoryForPayment: true,
          advisory: "Debe solicitarse constancia formal de Bancolombia que certifique que Contento BPS está facultado para recaudar y otorgar quitas.",
        },
        {
          code: "acuerdo_escrito_paz_salvo",
          label: "Compromiso Escrito de Paz y Salvo Total",
          fulfilled: false,
          mandatoryForPayment: true,
          advisory: "El acuerdo debe estipular por escrito que el pago de $2.348.000 extingue el 100% de la obligación y no deja remanentes por cobrar.",
        },
        {
          code: "no_reendeudamiento",
          label: "Capacidad de Pago Propia (Sin Nuevas Deudas)",
          fulfilled: false,
          mandatoryForPayment: true,
          advisory: "PROHIBIDO endeudarse con terceros o agotar la reserva alimentaria para pagar este descuento.",
        },
      ],
    },
    advisories: [
      "Oferta comunicada por Contento BPS por $2.348.000 COP con fecha límite 13 de noviembre.",
      "La cesión de la deuda NO está confirmada formalmente.",
      "No asumir que la oferta se mantiene vigente tras el 13 de noviembre ni pagar sin confirmación escrita del banco.",
      "No se recomienda adquirir nueva deuda para financiar esta oferta.",
    ],
  },
];

export interface DebtPaymentSimulationResult {
  debtId: string;
  creditor: string;
  paymentAttemptCop: number;
  isAllowedByLiquidity: boolean;
  encroachesEssentialReserve: boolean;
  essentialReserveRemainingCop: number;
  liquidCashRemainingCop: number;
  remainingDebtBalanceCop: number;
  remainingOverdueCop: number;
  isFullyNormalized: boolean;
  isFullySettled: boolean;
  impactOnNextQuincena: {
    scheduledForNextPayday: boolean;
    postPaydayRemainingCop: number;
  };
  safetyAdvisories: string[];
}

/**
 * Simula el impacto financiero y legal de un pago propuesto sobre una deuda.
 */
export function simulateDebtPaymentImpact(
  debtId: string,
  paymentAmountCop: number,
  plan: BiweeklyCashflowPlan
): DebtPaymentSimulationResult {
  const debt = REAL_DEBTS_CASE_STUDY.find((d) => d.id === debtId);
  if (!debt) {
    throw new Error(`La obligación financiera '${debtId}' no existe en el catálogo.`);
  }

  const payment = Math.max(0, Math.round(paymentAmountCop));
  const liquidCash = plan.reconciledLiquidCashCop; // $410.000 COP
  const reserve = plan.protectedReserveCop;         // $250.000 COP
  const maxMargin = plan.maxMarginBeforeDebtsCop;   // $160.000 COP

  const safetyAdvisories: string[] = [];

  // 1. Evaluación de liquidez y reserva esencial
  const isAllowedByLiquidity = payment <= maxMargin;
  const encroachesEssentialReserve = payment > maxMargin;

  let liquidCashRemaining = liquidCash - payment;
  let essentialReserveRemaining = reserve;

  if (encroachesEssentialReserve) {
    essentialReserveRemaining = Math.max(0, liquidCashRemaining);
    safetyAdvisories.push(
      `ALERTA CRÍTICA: El pago de $${payment.toLocaleString(
        "es-CO"
      )} COP supera tu margen disponible ($${maxMargin.toLocaleString(
        "es-CO"
      )} COP) y DEVORA tu Reserva Esencial. Te quedarías con solo $${essentialReserveRemaining.toLocaleString(
        "es-CO"
      )} COP para subsistir hasta el 20 de noviembre.`
    );
  }

  // 2. Evaluación de saldos remanentes
  const remainingDebtBalance = Math.max(0, debt.totalBalanceCop - payment);
  const remainingOverdue = Math.max(0, debt.overdueBalanceCop - payment);
  const isFullySettled = remainingDebtBalance === 0;

  // 3. Regla de Oro: Normalización vs Abono Parcial
  let isFullyNormalized = false;
  if (debt.id === "debt_addi_consumo") {
    // Para normalizar ADDI se requiere cubrir atraso ($213.374) + cuota ($122.711) = $336.085 COP
    const fullNormalizedTarget = debt.overdueBalanceCop + debt.currentInstallmentCop;
    if (payment >= fullNormalizedTarget) {
      isFullyNormalized = true;
      safetyAdvisories.push(
        "El pago cubre la totalidad del atraso y la cuota del 17-nov. ADDI quedará al día."
      );
    } else if (payment > 0 && payment < fullNormalizedTarget) {
      isFullyNormalized = false;
      safetyAdvisories.push(
        `AVISO DE ABONO PARCIAL: Un abono de $${payment.toLocaleString(
          "es-CO"
        )} COP amortiza capital pero NO normaliza tu estado de mora ante centrales ni detiene gestiones de cobro.`
      );
    }
  } else if (debt.id === "debt_nequi_propulsor") {
    isFullyNormalized = payment >= debt.currentInstallmentCop;
  } else if (debt.id === "debt_bancolombia_contento") {
    isFullyNormalized = isFullySettled;
  }

  // 4. Impacto sobre la próxima quincena (20 de noviembre)
  const scheduledForNextPayday = payment > maxMargin;
  const postPaydayRemaining = Math.max(
    0,
    plan.expectedNextIncome.amountCop - (debt.overdueBalanceCop + debt.currentInstallmentCop)
  );

  return {
    debtId: debt.id,
    creditor: debt.creditor,
    paymentAttemptCop: payment,
    isAllowedByLiquidity,
    encroachesEssentialReserve,
    essentialReserveRemainingCop: essentialReserveRemaining,
    liquidCashRemainingCop: liquidCashRemaining,
    remainingDebtBalanceCop: remainingDebtBalance,
    remainingOverdueCop: remainingOverdue,
    isFullyNormalized,
    isFullySettled,
    impactOnNextQuincena: {
      scheduledForNextPayday,
      postPaydayRemainingCop: postPaydayRemaining,
    },
    safetyAdvisories,
  };
}

export interface SettlementAuditOutcome {
  isValidAndExecutableToday: boolean;
  isExpired: boolean;
  canAffordWithoutNewDebt: boolean;
  requiredPreconditions: string[];
  recommendation: string;
}

/**
 * Audita de forma exhaustiva una oferta de acuerdo de cobro prejudicial.
 */
export function auditSettlementOffer(
  offer: SettlementOfferInfo,
  asOfDate: string,
  liquidMarginCop: number
): SettlementAuditOutcome {
  const isExpired = asOfDate > offer.expirationDate;
  const canAffordWithoutNewDebt = liquidMarginCop >= offer.discountedAmountCop;

  const requiredPreconditions: string[] = [];

  for (const check of offer.legalRequirementsChecklist) {
    if (!check.fulfilled && check.mandatoryForPayment) {
      requiredPreconditions.push(`${check.label}: ${check.advisory}`);
    }
  }

  let recommendation = "";

  if (isExpired) {
    recommendation = `OFERTA EXPIRADA: La fecha límite era ${offer.expirationDate}. No transferir fondos sin una nueva propuesta reconfirmada por escrito por Bancolombia.`;
  } else if (!canAffordWithoutNewDebt) {
    recommendation = `RECHAZO POR CAPACIDAD FINANCIERA: La oferta de $${offer.discountedAmountCop.toLocaleString(
      "es-CO"
    )} COP supera con creces tu margen disponible actual ($${liquidMarginCop.toLocaleString(
      "es-CO"
    )} COP). Se prohíbe tajantemente recurrir a créditos 'gota a gota', préstamos usureros o nueva deuda para pagarla. Prioriza tu subsistencia y solicita un plan de pagos diferido.`;
  } else if (requiredPreconditions.length > 0) {
    recommendation =
      "CONDICIONAL: Tienes fondos, pero NO debes pagar hasta que Contento BPS entregue la certificación de cesión de crédito de Bancolombia y el compromiso de Paz y Salvo por escrito.";
  } else {
    recommendation = "OFERTA APTA: Verificada por escrito y con capacidad de pago demostrada.";
  }

  return {
    isValidAndExecutableToday: !isExpired && canAffordWithoutNewDebt && requiredPreconditions.length === 0,
    isExpired,
    canAffordWithoutNewDebt,
    requiredPreconditions,
    recommendation,
  };
}
