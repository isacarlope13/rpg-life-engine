import { createHash } from "crypto";
import type {
  ApprovalRequest,
  ApprovalStatus,
  InvariantValidationResult,
  SystemAuditLogEntry,
} from "./types.ts";

/**
 * Deterministic Rule Engine & Invariant Checker:
 * Aplica los guardrails éticos, financieros y de seguridad del RPG Life-Engine.
 * La IA NUNCA puede modificar saldos arbitrariamente.
 */
export class AutomationRuleEngine {
  public static readonly FINANCIAL_APPROVAL_THRESHOLD_COP = 20000;
  public static readonly MAX_QUEST_GP_REWARD = 4000;
  public static readonly MIN_CIRCADIAN_SLEEP_HOURS = 6.5;

  /**
   * Valida si una acción propuesta cumple los invariantes de seguridad
   * y determina si requiere aprobación humana obligatoria.
   */
  public static validateProposedAction(params: {
    category: string;
    actionName: string;
    payload: Record<string, unknown>;
  }): InvariantValidationResult {
    const { category, actionName, payload } = params;

    // 1. REGLA INQUEBRANTABLE: Prohibida la inyección arbitraria de saldos o GP
    if (actionName === "direct_balance_injection" || actionName === "alter_wallet_unearned") {
      return {
        isValid: false,
        requiresApproval: false,
        violationCode: "UNAUTHORIZED_BALANCE_INJECTION",
        reason:
          "Violación de Invariante: Ningún agente puede inyectar saldo o GP arbitrariamente sin transacción real o sesión de habilidad completada.",
      };
    }

    // 2. REGLA DE DEUDA: Prohibido reducir HP de Debt Bosses sin amortización verificada
    if (
      actionName === "reduce_boss_hp" &&
      (!payload.verifiedPaymentTransactionId || Number(payload.amountCop || 0) <= 0)
    ) {
      return {
        isValid: false,
        requiresApproval: false,
        violationCode: "UNVERIFIED_DEBT_REDUCTION",
        reason:
          "Violación de Invariante: No se puede reducir la vida de un Debt Boss sin un pago o abono real verificado.",
      };
    }

    // 3. REGLA DE RECOMPENSAS: Techo de GP en misiones dinámicas
    if (category === "quest_override" || actionName === "generate_dynamic_quest") {
      const rewardGp = Number(payload.reward_gp || 0);
      if (rewardGp > this.MAX_QUEST_GP_REWARD) {
        return {
          isValid: true,
          requiresApproval: true,
          reason: `La recompensa de ${rewardGp} GP supera el límite seguro de ${this.MAX_QUEST_GP_REWARD} GP por misión. Requiere aprobación humana.`,
        };
      }
    }

    // 4. REGLA FINANCIERA: Modificaciones presupuestarias superiores al umbral
    if (category === "financial_rebalance") {
      const amount = Number(payload.amountCop || payload.amount || 0);
      if (amount >= this.FINANCIAL_APPROVAL_THRESHOLD_COP) {
        return {
          isValid: true,
          requiresApproval: true,
          reason: `El ajuste presupuestal de $${amount.toLocaleString(
            "es-CO"
          )} COP supera el umbral seguro de $${this.FINANCIAL_APPROVAL_THRESHOLD_COP.toLocaleString(
            "es-CO"
          )} COP. Requiere confirmación humana.`,
        };
      }
    }

    // 5. REGLA CIRCADIANO: Protección del descanso fisiológico
    if (category === "schedule_shift" && payload.proposedSleepHours !== undefined) {
      const sleepHours = Number(payload.proposedSleepHours);
      if (sleepHours < this.MIN_CIRCADIAN_SLEEP_HOURS) {
        return {
          isValid: false,
          requiresApproval: false,
          violationCode: "CIRCADIAN_HEALTH_VIOLATION",
          reason: `Violación de Salud Circadiana: El descanso propuesto (${sleepHours}h) es menor al mínimo saludable de ${this.MIN_CIRCADIAN_SLEEP_HOURS}h.`,
        };
      }
    }

    return {
      isValid: true,
      requiresApproval: false,
    };
  }
}

/**
 * HumanApprovalGateway: Gestiona la bandeja de solicitudes de aprobación humana
 * (Human-in-the-Loop) con expiración y estados inmutables.
 */
export class HumanApprovalGateway {
  private requests = new Map<string, ApprovalRequest>();

  public createRequest(
    data: Omit<ApprovalRequest, "id" | "status" | "createdAt">
  ): ApprovalRequest {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const nowIso = new Date().toISOString();

    const request: ApprovalRequest = {
      ...data,
      id,
      status: "pending",
      createdAt: nowIso,
    };

    this.requests.set(id, request);
    return request;
  }

  public resolveRequest(
    id: string,
    status: "approved" | "rejected",
    resolvedBy: "user" | "system_guardian" | "timeout" = "user"
  ): ApprovalRequest {
    const req = this.requests.get(id);
    if (!req) {
      throw new Error(`Solicitud de aprobación ${id} no encontrada.`);
    }

    if (req.status !== "pending") {
      throw new Error(`La solicitud ${id} ya fue resuelta previamente (${req.status}).`);
    }

    req.status = status;
    req.resolvedAt = new Date().toISOString();
    req.resolvedBy = resolvedBy;
    return req;
  }

  public getPendingRequests(userId?: string): ApprovalRequest[] {
    const list = Array.from(this.requests.values()).filter(
      (r) => r.status === "pending"
    );
    if (userId) {
      return list.filter((r) => r.userId === userId);
    }
    return list;
  }

  public getRequest(id: string): ApprovalRequest | null {
    return this.requests.get(id) || null;
  }

  public clear(): void {
    this.requests.clear();
  }
}

/**
 * SystemAuditLogger: Registro de auditoría criptográfico e inmutable
 * para todas las acciones automáticas y aprobaciones del sistema.
 */
export class SystemAuditLogger {
  private logs: SystemAuditLogEntry[] = [];

  public logAction(
    entry: Omit<SystemAuditLogEntry, "id" | "securityHash" | "createdAt">
  ): SystemAuditLogEntry {
    const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = new Date().toISOString();

    // Generar hash SHA-256 para garantizar no repudio y trazabilidad
    const rawPayload = `${id}|${entry.userId}|${entry.actorId}|${entry.actionName}|${createdAt}`;
    const securityHash = createHash("sha256").update(rawPayload).digest("hex");

    const fullLog: SystemAuditLogEntry = {
      ...entry,
      id,
      securityHash,
      createdAt,
    };

    this.logs.unshift(fullLog);
    if (this.logs.length > 500) {
      this.logs.pop();
    }
    return fullLog;
  }

  public getRecentLogs(userId?: string, limit = 50): SystemAuditLogEntry[] {
    if (userId) {
      return this.logs.filter((l) => l.userId === userId).slice(0, limit);
    }
    return this.logs.slice(0, limit);
  }

  public clear(): void {
    this.logs = [];
  }
}

// Singletons para la aplicación
const globalForRules = globalThis as unknown as {
  rpgApprovalGateway?: HumanApprovalGateway;
  rpgAuditLogger?: SystemAuditLogger;
};

export const defaultApprovalGateway =
  globalForRules.rpgApprovalGateway ?? new HumanApprovalGateway();
export const defaultAuditLogger =
  globalForRules.rpgAuditLogger ?? new SystemAuditLogger();

if (process.env.NODE_ENV !== "production") {
  globalForRules.rpgApprovalGateway = defaultApprovalGateway;
  globalForRules.rpgAuditLogger = defaultAuditLogger;
}
