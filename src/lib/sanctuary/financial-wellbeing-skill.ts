/**
 * FINANCIAL WELLBEING SKILL & SILAS TREASURY ADVISOR — OAKHAVEN 3.9 (HITO 3.9.4)
 *
 * Skill de inteligencia financiera personal, explicable y empática que:
 * 1. Interpreta datos deterministas de FinancialCore y DebtEngine sin tecnicismos oscuros.
 * 2. Diagnostica riesgos de liquidez y orienta prioridades (Nequi vs ADDI vs Contento BPS).
 * 3. Redacta solicitudes y cartas de negociación formales con fundamento normativo colombiano.
 * 4. Recomienda presupuestos de bienestar no punitivos (alimentación, salud, descanso, recreación).
 * 5. Explica cómo financiar metas de Wishlist mediante el Doble Candado (GP + COP).
 *
 * GARANTÍA DE SEGURIDAD (HITL NIVEL 3):
 * La IA NUNCA ejecuta transferencias, pagos, mutaciones de saldos ni acuerdos por su cuenta.
 */

import type { BiweeklyCashflowPlan } from "./financial-core.ts";
import type { RealDebtObligation, SettlementOfferInfo } from "./debt-engine.ts";

export interface FinancialDiagnosisReport {
  timestamp: string;
  headline: string;
  liquiditySummary: {
    liquidInHandCop: number;
    protectedReserveCop: number;
    maxMarginBeforeDebtsCop: number;
    nextPaydayDate: string;
    expectedSalaryCop: number;
  };
  trafficLightStatus: {
    nequi: "green" | "yellow" | "red";
    addi: "green" | "yellow" | "red";
    bancolombiaContento: "green" | "yellow" | "red";
  };
  keyInsights: string[];
  immediateActionPlan: Array<{
    step: number;
    title: string;
    description: string;
    amountCop: number;
    dueDate: string;
    priority: "critical" | "high" | "postponed";
  }>;
  nonPunitiveWellnessNotes: string;
}

export interface NegotiationDraftRequest {
  creditorType: "addi" | "contento_bancolombia";
  userFullName?: string;
  documentIdMasked?: string;
  debtTotalCop: number;
  proposedPaymentCop?: number;
  proposedDate?: string;
}

export interface NegotiationDocumentDraft {
  subject: string;
  recipient: string;
  formalBodyMarkdown: string;
  legalContextAdvisory: string;
  nextStepsForUser: string[];
}

export interface WellnessBudgetPlan {
  totalAllocatedCop: number;
  categories: Array<{
    category: "alimentacion_fresca" | "transporte_auxiliar" | "salud_bienestar" | "ocio_consciente";
    label: string;
    allocatedCop: number;
    percentage: number;
    purpose: string;
  }>;
  guidanceMessage: string;
}

export interface WishlistFundingAdvisory {
  itemName: string;
  costGp: number;
  priceCop: number;
  canRedeemNow: boolean;
  blockReason?: string;
  gpFulfillment: {
    userGp: number;
    requiredGp: number;
    hasEnoughGp: boolean;
  };
  cashFulfillment: {
    freeMoneyCop: number;
    requiredCop: number;
    hasEnoughCash: boolean;
  };
  recommendedSavingsPlan: string;
}

export class FinancialWellbeingSkill {
  /**
   * Genera un diagnóstico financiero contextual, explicable y priorizado.
   */
  public generateFinancialDiagnosis(
    plan: BiweeklyCashflowPlan,
    debts: RealDebtObligation[]
  ): FinancialDiagnosisReport {
    const nequi = debts.find((d) => d.id === "debt_nequi_propulsor");
    const addi = debts.find((d) => d.id === "debt_addi_consumo");
    const banco = debts.find((d) => d.id === "debt_bancolombia_contento");

    const nequiCuota = nequi ? nequi.currentInstallmentCop : 56431;
    const addiRecomendado = addi ? addi.overdueBalanceCop + addi.currentInstallmentCop : 336085;

    const insights: string[] = [
      `Liquidez real en mano: $${plan.reconciledLiquidCashCop.toLocaleString("es-CO")} COP (Nu + Nequi).`,
      `Reserva Esencial de Subsistencia protegida: $${plan.protectedReserveCop.toLocaleString("es-CO")} COP intocables para comida y transporte hasta el 20 de noviembre.`,
      `Margen libre antes de deudas: $${plan.maxMarginBeforeDebtsCop.toLocaleString("es-CO")} COP.`,
    ];

    if (plan.maxMarginBeforeDebtsCop >= nequiCuota) {
      insights.push(
        `Nequi ($${nequiCuota.toLocaleString("es-CO")} COP el 15-nov): VIABLE y PRIORITARIO. Estás en la cuota 21 de 24; pagarla protege tu historial crediticio sin arriesgar tu comida.`
      );
    }

    if (addiRecomendado > plan.maxMarginBeforeDebtsCop) {
      insights.push(
        `ADDI ($${addiRecomendado.toLocaleString("es-CO")} COP): NO PAGAR antes del 20-nov. Si intentas pagarlo el 17-nov, devorarías tu reserva de subsistencia y te quedarías con solo $73.915 COP. Se reprograma para el día de quincena.`
      );
    }

    insights.push(
      "Oferta Contento BPS ($2.348.000 COP al 13-nov): NO ACEPTAR en este ciclo. No tienes liquidez para cubrirla y se prohíbe terminantemente endeudarse con terceros para pagarla."
    );

    const actionPlan: FinancialDiagnosisReport["immediateActionPlan"] = [
      {
        step: 1,
        title: "Blindar Reserva Esencial de Subsistencia",
        description: "Mantener $250.000 COP intactos en Nu y Nequi para cubrir alimentación y transporte hasta el 20 de noviembre.",
        amountCop: plan.protectedReserveCop,
        dueDate: "Inmediato (Permanente)",
        priority: "critical",
      },
      {
        step: 2,
        title: "Pagar Cuota 21/24 Crédito Nequi",
        description: "Asegurar el pago de la cuota ordinaria para avanzar hacia la cancelación total del crédito a 3 cuotas del final.",
        amountCop: nequiCuota,
        dueDate: "2026-11-15",
        priority: "critical",
      },
      {
        step: 3,
        title: "Notificar a ADDI pago con Quincena",
        description: "Remitir aviso de pago programado para el 20 de noviembre, fecha en que ingresan los $1.000.000 COP de salario.",
        amountCop: addiRecomendado,
        dueDate: "2026-11-20 (Post-Quincena)",
        priority: "high",
      },
      {
        step: 4,
        title: "Solicitar Cesión Escrita y Paz y Salvo a Contento BPS",
        description: "Exigir certificación oficial de Bancolombia antes de considerar cualquier oferta o acuerdo de pago con la agencia de cobranza.",
        amountCop: 0,
        dueDate: "2026-11-13 (Vencimiento de Oferta)",
        priority: "postponed",
      },
    ];

    return {
      timestamp: new Date().toISOString(),
      headline:
        "Estrategia de Paz Financiera: Blindaje de Reserva, cumplimiento de Nequi y postergación programada de ADDI al día de quincena.",
      liquiditySummary: {
        liquidInHandCop: plan.reconciledLiquidCashCop,
        protectedReserveCop: plan.protectedReserveCop,
        maxMarginBeforeDebtsCop: plan.maxMarginBeforeDebtsCop,
        nextPaydayDate: plan.cycle.nextPaydayDate,
        expectedSalaryCop: plan.expectedNextIncome.amountCop,
      },
      trafficLightStatus: {
        nequi: "green",
        addi: "yellow",
        bancolombiaContento: "red",
      },
      keyInsights: insights,
      immediateActionPlan: actionPlan,
      nonPunitiveWellnessNotes:
        "Tus gastos de descanso y recreación consciente no son errores. El objetivo del sistema no es la privación extrema, sino la serenidad y la soberanía sobre tus decisiones.",
    };
  }

  /**
   * Redacta una carta formal o solicitud de negociación según la regulación colombiana.
   */
  public draftNegotiationDocument(request: NegotiationDraftRequest): NegotiationDocumentDraft {
    if (request.creditorType === "contento_bancolombia") {
      const discounted = request.proposedPaymentCop || 2348000;
      return {
        subject: "Solicitud de Certificación de Cesión de Crédito y Alcance de Acuerdo de Pago con Quita",
        recipient: "Señores CONTENTO BPS / BANCOLOMBIA S.A.",
        formalBodyMarkdown: `**Ciudad y Fecha**: Bogotá D.C., 11 de noviembre de 2026

**A QUIEN CORRESPONDA**:

Por medio de la presente, en mi calidad de titular de la obligación crediticia identificada con terminación ${
          request.documentIdMasked || "*4491"
        }, me dirijo a ustedes en atención a la comunicación recibida por parte de **Contento BPS**, en la cual se formula una oferta de pago por valor de **$${discounted.toLocaleString(
          "es-CO"
        )} COP**.

Con el fin de proceder con el estudio y eventual pago de una propuesta de normalización, de conformidad con la Circular Básica Jurídica de la Superintendencia Financiera de Colombia y la Ley 1266 de 2008 (Habeas Data), solicito muy respetuosamente se sirvan remitir:

1. **Constancia Escrita de Representación / Cesión de Crédito**: Certificación expedida directamente por **Bancolombia S.A.** donde conste que Contento BPS se encuentra plenamente facultada para recaudar dineros y pactar quitas o condonaciones vinculantes en su nombre.
2. **Compromiso Formal de Paz y Salvo Total**: Manifestación escrita donde se especifique de manera inequívoca que el pago de la suma antes mencionada extinguirá la totalidad de la obligación crediticia a mi cargo, sin que queden saldos insolutos, honorarios de cobranza ni remanentes de capital o intereses.
3. **Actualización ante Centrales de Riesgo**: Compromiso de actualización de la información comercial ante Datacrédito y TransUnion reportando la obligación con estado de pago y paz y salvo definitivo.

Agradezco su atención y quedo a la espera de los soportes solicitados para proceder de conformidad.

Cordialmente,

**${request.userFullName || "Titular del Crédito"}**`,
        legalContextAdvisory:
          "ADVERTENCIA LEGAL: Nunca entregues dinero ni transfieras a cuentas de terceros cobradores sin contar con una certificación escrita expedida o ratificada directamente por la entidad financiera matriz (Bancolombia S.A.).",
        nextStepsForUser: [
          "Descargar o copiar este borrador.",
          "Radicarlo por los canales oficiales de atención al cliente de Bancolombia y Contento BPS.",
          "No realizar pagos hasta recibir la constancia formal de cesión y el compromiso de paz y salvo escrito.",
        ],
      };
    } else {
      // ADDI
      return {
        subject: "Aviso de Pago Programado por Ciclo de Nómina Quincenal",
        recipient: "Señores ADDI (Compañía de Financiamiento)",
        formalBodyMarkdown: `**Ciudad y Fecha**: 11 de noviembre de 2026

**Señores ADDI**:

Por medio de la presente, me comunico respecto a mi crédito de consumo con saldo pendiente por valor de **$${request.debtTotalCop.toLocaleString(
          "es-CO"
        )} COP**.

Me permito manifestar mi total voluntad de pago y compromiso de cumplimiento. Les informo que mi esquema de ingresos laborales es de frecuencia **quincenal**, teniendo programada la dispersión de nómina para el próximo **20 de noviembre de 2026**.

Por tanto, me comprometo formalmente a realizar el pago de la suma atrasada el día **20 de noviembre de 2026**. Solicito amablemente tener en cuenta esta programación dentro de sus registros de gestión y mitigar en lo posible los recargos de cobranza prejudicial durante los días intermedios.

Agradezco su comprensión y colaboración.

Cordialmente,

**${request.userFullName || "Titular del Crédito"}**`,
        legalContextAdvisory:
          "AVISO DE BUENA FE: La manifestación voluntaria de pago formaliza tu intención de cumplir y puede servir de soporte ante gestiones de cobranza prejudicial.",
        nextStepsForUser: [
          "Enviar este mensaje a través de los canales de soporte de la app de ADDI o WhatsApp oficial.",
          "Reservar el valor del abono inmediatamente ingrese la quincena del 20 de noviembre.",
        ],
      };
    }
  }

  /**
   * Recomienda una distribución equilibrada y no punitiva del presupuesto de bienestar.
   */
  public recommendWellnessBudget(freeMoneyCop: number): WellnessBudgetPlan {
    const total = Math.max(0, Math.round(freeMoneyCop));

    if (total <= 0) {
      return {
        totalAllocatedCop: 0,
        categories: [],
        guidanceMessage:
          "En este ciclo no hay excedente para recreación discrecional; todo el margen está blindando tu comida, transporte y pago de Nequi. Esto es temporal hasta el ingreso del 20 de noviembre.",
      };
    }

    // Distribución orientativa: 40% alimentos frescos/nutrición, 35% transporte seguro, 25% ocio consciente
    const food = Math.round(total * 0.4);
    const transport = Math.round(total * 0.35);
    const leisure = total - food - transport;

    return {
      totalAllocatedCop: total,
      categories: [
        {
          category: "alimentacion_fresca",
          label: "Alimentación Fresca & Nutrición",
          allocatedCop: food,
          percentage: 40,
          purpose: "Frutas, verduras y alimentos nutritivos para mantener energía y bienestar físico.",
        },
        {
          category: "transporte_auxiliar",
          label: "Transporte Cómodo & Seguro",
          allocatedCop: transport,
          percentage: 35,
          purpose: "Margen para pasajes o transporte en horas de lluvia o cansancio.",
        },
        {
          category: "ocio_consciente",
          label: "Ocio Consciente & Pausa Serena",
          allocatedCop: leisure,
          percentage: 25,
          purpose: "Un café, un libro o un momento de descanso personal sin culpa.",
        },
      ],
      guidanceMessage:
        "El bienestar integral no es un premio que se gana tras pagar deudas: es el combustible necesario para forjar tu camino con serenidad.",
    };
  }

  /**
   * Evalúa la viabilidad de financiar un deseo de la Wishlist mediante el Doble Candado.
   */
  public evaluateWishlistGoalFunding(
    item: { name: string; costGp: number; priceCop: number },
    plan: BiweeklyCashflowPlan,
    userGp: number
  ): WishlistFundingAdvisory {
    const hasEnoughGp = userGp >= item.costGp;
    const hasEnoughCash = plan.freeMoneyCop >= item.priceCop;
    const canRedeemNow = hasEnoughGp && hasEnoughCash;

    let blockReason: string | undefined = undefined;
    if (!hasEnoughGp && !hasEnoughCash) {
      blockReason = `Faltan tanto GP de disciplina (${(item.costGp - userGp).toLocaleString(
        "es-CO"
      )} GP) como Dinero Libre disponible ($${(item.priceCop - plan.freeMoneyCop).toLocaleString(
        "es-CO"
      )} COP).`;
    } else if (!hasEnoughGp) {
      blockReason = `Tienes el dinero, pero te faltan ${(item.costGp - userGp).toLocaleString(
        "es-CO"
      )} GP lúdicos. Completa hábitos o sesiones de habilidad en Oakhaven para desbloquearlo.`;
    } else if (!hasEnoughCash) {
      blockReason = `Tienes los GP forjados, pero tu Dinero Libre actual ($${plan.freeMoneyCop.toLocaleString(
        "es-CO"
      )} COP) no cubre los $${item.priceCop.toLocaleString(
        "es-CO"
      )} COP requeridos sin poner en riesgo tu reserva o compromisos.`;
    }

    const recommendedPlan = canRedeemNow
      ? "¡Doble candado desbloqueado! Puedes realizar la compra y registrar el canje con total tranquilidad."
      : `Ruta recomendada: Con la quincena del 20 de noviembre ($1.000.000 COP) y continuando tu racha de hábitos en Oakhaven, podrás reservar los $${item.priceCop.toLocaleString(
          "es-CO"
        )} COP sin afectar ninguna obligación básica.`;

    return {
      itemName: item.name,
      costGp: item.costGp,
      priceCop: item.priceCop,
      canRedeemNow,
      blockReason,
      gpFulfillment: {
        userGp,
        requiredGp: item.costGp,
        hasEnoughGp,
      },
      cashFulfillment: {
        freeMoneyCop: plan.freeMoneyCop,
        requiredCop: item.priceCop,
        hasEnoughCash,
      },
      recommendedSavingsPlan: recommendedPlan,
    };
  }

  /**
   * BARRERA DE SEGURIDAD HITL NIVEL 3:
   * Cualquier intento de ejecutar un pago de forma autónoma por parte de la IA es RECHAZADO de inmediato.
   */
  public executeAutonomousPayment(): never {
    throw new Error(
      "Acción bloqueada por política de seguridad HITL Nivel 3: La IA tiene estrictamente prohibido realizar pagos o mutar saldos bancarios de forma autónoma. Toda transacción requiere aprobación humana explícita."
    );
  }
}

export const defaultFinancialWellbeingSkill = new FinancialWellbeingSkill();
