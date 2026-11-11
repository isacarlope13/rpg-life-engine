/**
 * MOTOR DE WISHLIST DUAL Y CANJES CON DOBLE CANDADO — OAKHAVEN 3.9 (HITO 3.9.6)
 *
 * Implementa la separación estricta entre moneda del juego (GP) y dinero real (COP):
 *
 * REGLA GENERAL DE DOBLE CANDADO:
 * CANJE_MAXIMO = MIN(VALOR_EQUIVALENTE_GP_CANJEABLES, PRESUPUESTO_REAL_RESERVADO)
 *
 * GARANTÍAS:
 * 1. Cero conversión entre GP y dinero bancario (no se puede "comprar dinero con GP" ni "comprar GP con dinero").
 * 2. Cero compras discrecionales autorizadas contra ingresos futuros esperados.
 * 3. Alerta y advertencia si existen deudas en mora (ej. ADDI con atraso activo),
 *    recomendando posponer compras no esenciales sin castigar gastos médicos o de subsistencia.
 * 4. Idempotencia y control de concurrencia: prevención estricta de doble canje simultáneo.
 * 5. Reversión segura de canjes cancelados con restitución íntegra de GP y fondos en COP.
 */

export interface DualWishlistItem {
  id: string;
  name: string;
  costGp: number;
  priceCop: number;
  priority: number; // 1: Alta, 2: Media, 3: Normal
  isRedeemed: boolean;
  minStreakRequired?: number;
  redeemedAt?: string;
  reservedCashCop?: number;
}

export interface DualRedemptionRequest {
  itemId: string;
  userWalletGp: number;
  availableReservedCashCop: number;
  currentStreakDays: number;
  hasOverdueDebts: boolean;
  idempotencyKey?: string;
  userExplicitOverrideConfirmed?: boolean;
}

export interface DualRedemptionOutcome {
  success: boolean;
  itemId: string;
  itemName: string;
  deductedGp: number;
  deductedCashCop: number;
  remainingWalletGp: number;
  remainingReservedCashCop: number;
  rejectionReason?: string;
  advisories: string[];
  idempotencyKey?: string;
  isIdempotentReplay?: boolean;
}

export class WishlistDualEngine {
  private processedTransactions = new Map<string, DualRedemptionOutcome>();
  private activeItemsCatalog: DualWishlistItem[] = [
    {
      id: "wish_cubo_gan",
      name: "Cubo Magnético Flagship GAN 12 MagLev",
      costGp: 85000,
      priceCop: 140000,
      priority: 1,
      isRedeemed: false,
      minStreakRequired: 1,
    },
    {
      id: "wish_libro_finanzas",
      name: "Libro Físico: Psicología del Dinero",
      costGp: 30000,
      priceCop: 52000,
      priority: 2,
      isRedeemed: false,
      minStreakRequired: 3,
    },
    {
      id: "wish_set_agujas_crochet",
      name: "Set Profesional de Agujas de Crochet Ergonómicas",
      costGp: 45000,
      priceCop: 68000,
      priority: 2,
      isRedeemed: false,
      minStreakRequired: 3,
    },
    {
      id: "wish_audifonos_foco",
      name: "Auriculares con Cancelación de Ruido para Foco Profundo",
      costGp: 250000,
      priceCop: 380000,
      priority: 3,
      isRedeemed: false,
      minStreakRequired: 7,
    },
  ];

  public getItems(): DualWishlistItem[] {
    return this.activeItemsCatalog.map((i) => ({ ...i }));
  }

  public getItemById(id: string): DualWishlistItem | undefined {
    return this.activeItemsCatalog.find((i) => i.id === id);
  }

  /**
   * Ejecuta el canje de un artículo de la Wishlist aplicando la regla del Doble Candado.
   */
  public executeDualRedemption(
    item: DualWishlistItem,
    request: DualRedemptionRequest
  ): DualRedemptionOutcome {
    // 1. Control de Idempotencia
    if (request.idempotencyKey && this.processedTransactions.has(request.idempotencyKey)) {
      const cached = this.processedTransactions.get(request.idempotencyKey)!;
      return {
        ...cached,
        isIdempotentReplay: true,
      };
    }

    const advisories: string[] = [];

    // 2. Validación de Estado del Artículo
    if (item.isRedeemed) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason: `El artículo '${item.name}' ya ha sido canjeado previamente.`,
        advisories: ["Artículo ya canjeado."],
      };
    }

    // 3. Validación de Racha de Hábitos
    const requiredStreak = item.minStreakRequired || (item.priority === 1 ? 1 : item.priority === 2 ? 3 : 7);
    if (request.currentStreakDays < requiredStreak) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason: `Bloqueo de Racha: Requiere al menos ${requiredStreak} días continuos de hábitos (tu racha actual es de ${request.currentStreakDays}d).`,
        advisories: ["Mantén tu racha activa completando actividades en Oakhaven."],
      };
    }

    // 4. DOBLE CANDADO: Verificación de Moneda Lúdica (GP)
    const hasEnoughGp = request.userWalletGp >= item.costGp;

    // 5. DOBLE CANDADO: Verificación de Presupuesto Real en Dinero (COP)
    const hasEnoughCash = request.availableReservedCashCop >= item.priceCop;

    if (!hasEnoughGp && !hasEnoughCash) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason: `Falta de recursos dobles: Te faltan ${(item.costGp - request.userWalletGp).toLocaleString(
          "es-CO"
        )} GP lúdicos y $${(item.priceCop - request.availableReservedCashCop).toLocaleString(
          "es-CO"
        )} COP en dinero real reservado.`,
        advisories: ["El canje exige simultáneamente disciplina lúdica y solvencia monetaria real."],
      };
    }

    if (!hasEnoughGp) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason: `Insuficiencia de GP: Cuentas con el dinero, pero necesitas forjar ${(item.costGp - request.userWalletGp).toLocaleString(
          "es-CO"
        )} GP adicionales mediante hábitos en el Santuario.`,
        advisories: ["El dinero solo no compra recompensas en Oakhaven: se requiere maestría personal."],
      };
    }

    if (!hasEnoughCash) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason: `Insuficiencia de Presupuesto Real: Tienes los ${item.costGp.toLocaleString(
          "es-CO"
        )} GP forjados, pero tu Dinero Libre en COP ($${request.availableReservedCashCop.toLocaleString(
          "es-CO"
        )}) no cubre los $${item.priceCop.toLocaleString(
          "es-CO"
        )} COP sin poner en riesgo tu reserva de subsistencia.`,
        advisories: ["Prohibido endeudarse o consumir la reserva esencial para compras recreativas."],
      };
    }

    // 6. Alerta de Deudas en Mora (ADDI / Obligaciones atrasadas)
    if (request.hasOverdueDebts && !request.userExplicitOverrideConfirmed) {
      return {
        success: false,
        itemId: item.id,
        itemName: item.name,
        deductedGp: 0,
        deductedCashCop: 0,
        remainingWalletGp: request.userWalletGp,
        remainingReservedCashCop: request.availableReservedCashCop,
        rejectionReason:
          "Recomendación Prudente de Oakhaven: Tienes obligaciones en mora activas (ADDI). Se aconseja posponer compras discrecionales hasta estar al día, a menos que confirmes expresamente que este gasto no compromete tu subsistencia.",
        advisories: [
          "Mora activa detectada.",
          "Para forzar el canje manteniendo el control de tus decisiones, confirma explícitamente la excepción.",
        ],
      };
    }

    // 7. Ejecución Exitosa del Canje
    const remainingWalletGp = request.userWalletGp - item.costGp;
    const remainingReservedCashCop = request.availableReservedCashCop - item.priceCop;

    item.isRedeemed = true;
    item.redeemedAt = new Date().toISOString();
    item.reservedCashCop = item.priceCop;

    advisories.push(
      `¡Canje exitoso de '${item.name}'! Se dedujeron ${item.costGp.toLocaleString(
        "es-CO"
      )} GP de tu Billetera y $${item.priceCop.toLocaleString(
        "es-CO"
      )} COP de tu presupuesto de bienestar reservado.`
    );

    const outcome: DualRedemptionOutcome = {
      success: true,
      itemId: item.id,
      itemName: item.name,
      deductedGp: item.costGp,
      deductedCashCop: item.priceCop,
      remainingWalletGp,
      remainingReservedCashCop,
      advisories,
      idempotencyKey: request.idempotencyKey,
      isIdempotentReplay: false,
    };

    if (request.idempotencyKey) {
      this.processedTransactions.set(request.idempotencyKey, outcome);
    }

    return outcome;
  }

  /**
   * Revierte de forma segura y completa un canje previamente ejecutado.
   */
  public revertRedemption(
    itemId: string,
    state: { currentWalletGp: number; currentReservedCashCop: number }
  ): {
    reverted: boolean;
    restoredWalletGp: number;
    restoredReservedCashCop: number;
    notes: string;
  } {
    const item = this.activeItemsCatalog.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(`El artículo '${itemId}' no existe.`);
    }

    if (!item.isRedeemed) {
      return {
        reverted: false,
        restoredWalletGp: state.currentWalletGp,
        restoredReservedCashCop: state.currentReservedCashCop,
        notes: `El artículo '${item.name}' no estaba canjeado; no requiere reversión.`,
      };
    }

    const restoredWalletGp = state.currentWalletGp + item.costGp;
    const restoredReservedCashCop = state.currentReservedCashCop + item.priceCop;

    item.isRedeemed = false;
    item.redeemedAt = undefined;
    item.reservedCashCop = undefined;

    return {
      reverted: true,
      restoredWalletGp,
      restoredReservedCashCop,
      notes: `Reversión exitosa: Se reintegraron ${item.costGp.toLocaleString(
        "es-CO"
      )} GP a la billetera y $${item.priceCop.toLocaleString(
        "es-CO"
      )} COP al presupuesto libre de bienestar.`,
    };
  }
}

export const defaultWishlistDualEngine = new WishlistDualEngine();
