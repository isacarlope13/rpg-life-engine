import {
  AutomationRuleEngine,
  defaultApprovalGateway,
  defaultAuditLogger,
  HumanApprovalGateway,
  SystemAuditLogger,
} from "../automation/rule-engine.ts";
import type {
  ApprovalRequest,
  InvariantValidationResult,
} from "../automation/types.ts";
import type {
  AgentExecutionOutcome,
  AgentExecutionProposal,
  AgentRoleCode,
  AgentState,
} from "./types.ts";

/**
 * SystemGuardian: Firewall ético, financiero y regulatorio del RPG Life-Engine.
 * Controla la matriz de permisos de todos los agentes, valida invariantes críticas
 * e intercepta cualquier mutación antes de que toque la base de datos o el store.
 */
export class SystemGuardian {
  private approvalGateway: HumanApprovalGateway;
  private auditLogger: SystemAuditLogger;

  // Matriz de Principio de Mínimo Privilegio por Agente
  private readonly permissionMatrix: Record<
    AgentRoleCode,
    {
      canMutate: boolean;
      allowedCategories: string[];
      maxFinancialCop: number;
    }
  > = {
    system_guardian: {
      canMutate: true,
      allowedCategories: ["financial_rebalance", "schedule_shift", "quest_override", "debt_amortization"],
      maxFinancialCop: 0,
    },
    autonomous_life_manager: {
      canMutate: false, // Solo propone a través del Guardian
      allowedCategories: ["schedule_shift", "quest_override"],
      maxFinancialCop: 0,
    },
    life_capture: {
      canMutate: false,
      allowedCategories: [],
      maxFinancialCop: 0,
    },
    life_analyst: {
      canMutate: false,
      allowedCategories: [],
      maxFinancialCop: 0,
    },
    daily_planner: {
      canMutate: true,
      allowedCategories: ["schedule_shift"],
      maxFinancialCop: 0,
    },
    goal_predictor: {
      canMutate: false,
      allowedCategories: [],
      maxFinancialCop: 0,
    },
    dynamic_quest_generator: {
      canMutate: true,
      allowedCategories: ["quest_override"],
      maxFinancialCop: 0,
    },
    smart_expense: {
      canMutate: true,
      allowedCategories: ["financial_rebalance"],
      maxFinancialCop: 20000,
    },
    economic_intelligence: {
      canMutate: false, // Toda propuesta económica requiere HITL
      allowedCategories: ["financial_rebalance", "debt_amortization"],
      maxFinancialCop: 0,
    },
    skill_evolution: {
      canMutate: false,
      allowedCategories: [],
      maxFinancialCop: 0,
    },
    reward_optimizer: {
      canMutate: true,
      allowedCategories: ["quest_override"],
      maxFinancialCop: 0,
    },
  };

  constructor(
    approvalGateway: HumanApprovalGateway = defaultApprovalGateway,
    auditLogger: SystemAuditLogger = defaultAuditLogger
  ) {
    this.approvalGateway = approvalGateway;
    this.auditLogger = auditLogger;
  }

  /**
   * Obtiene el estado y permisos declarados para un agente dado.
   */
  public getAgentState(code: AgentRoleCode): AgentState {
    const perm = this.permissionMatrix[code];
    return {
      code,
      name: this.formatAgentName(code),
      role: this.formatAgentRole(code),
      status: "idle",
      lastHeartbeat: new Date().toISOString(),
      confidenceScore: 0.98,
      workingMemory: {},
      permissions: {
        canMutateState: perm.canMutate,
        allowedCategories: perm.allowedCategories as any,
        maxAutonomousFinancialLimitCop: perm.maxFinancialCop,
      },
    };
  }

  /**
   * Intercepta y valida una propuesta de acción emitida por cualquier agente.
   * Si es válida y segura, ejecuta la mutación. Si requiere aprobación o viola
   * una regla, la detiene y genera la solicitud HITL o el registro de rechazo.
   */
  public async interceptAndEnforce(
    proposal: AgentExecutionProposal,
    executeMutationFn: () => Promise<Record<string, unknown>>
  ): Promise<AgentExecutionOutcome> {
    const perm = this.permissionMatrix[proposal.agentCode];

    // 1. Verificación de permisos de la matriz de privilegios
    if (!perm.allowedCategories.includes(proposal.category)) {
      this.auditLogger.logAction({
        userId: proposal.userId,
        actorType: "agent",
        actorId: proposal.agentCode,
        actionName: `REJECTED_UNAUTHORIZED_CATEGORY:${proposal.actionName}`,
        resourceAffected: proposal.category,
        previousState: null,
        newState: null,
      });

      return {
        executed: false,
        requiresApproval: false,
        violationCode: "UNAUTHORIZED_AGENT_CATEGORY",
        reason: `El agente "${proposal.agentCode}" no tiene autorización para operar en la categoría "${proposal.category}".`,
      };
    }

    // 2. Validación determinista de invariantes mediante RuleEngine
    const validation: InvariantValidationResult =
      AutomationRuleEngine.validateProposedAction({
        category: proposal.category,
        actionName: proposal.actionName,
        payload: proposal.payload,
      });

    // 3. Si viola un invariante duro (ej. saldo inventado o sueño < 6.5h), RECHAZO TOTAL
    if (!validation.isValid) {
      this.auditLogger.logAction({
        userId: proposal.userId,
        actorType: "agent",
        actorId: proposal.agentCode,
        actionName: `REJECTED_INVARIANT_VIOLATION:${proposal.actionName}`,
        resourceAffected: proposal.category,
        previousState: null,
        newState: { reason: validation.reason, violationCode: validation.violationCode },
      });

      return {
        executed: false,
        requiresApproval: false,
        violationCode: validation.violationCode,
        reason: validation.reason,
      };
    }

    // 4. Si requiere aprobación humana (HITL), crea la solicitud en la bandeja de entrada
    if (validation.requiresApproval) {
      const approvalReq = this.approvalGateway.createRequest({
        userId: proposal.userId,
        agentSource: proposal.agentCode,
        actionCategory: proposal.category,
        title: `Propuesta de ${this.formatAgentName(proposal.agentCode)}: ${proposal.actionName}`,
        summaryRationale: proposal.rationale || validation.reason || "Acción sensible requiere confirmación.",
        diffPayload: {
          current: (proposal.payload.current as Record<string, unknown>) || {},
          proposed: proposal.payload,
        },
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h
      });

      this.auditLogger.logAction({
        userId: proposal.userId,
        actorType: "agent",
        actorId: proposal.agentCode,
        actionName: `HITL_APPROVAL_REQUESTED:${proposal.actionName}`,
        resourceAffected: proposal.category,
        previousState: null,
        newState: { approvalRequestId: approvalReq.id, reason: validation.reason },
      });

      return {
        executed: false,
        requiresApproval: true,
        approvalRequest: approvalReq,
        reason: validation.reason,
      };
    }

    // 5. Acción aprobada y autónomamente segura: se ejecuta con registro de auditoría
    try {
      const result = await executeMutationFn();

      this.auditLogger.logAction({
        userId: proposal.userId,
        actorType: "agent",
        actorId: proposal.agentCode,
        actionName: `EXECUTED_AUTONOMOUS:${proposal.actionName}`,
        resourceAffected: proposal.category,
        previousState: null,
        newState: result,
      });

      return {
        executed: true,
        requiresApproval: false,
        result,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.auditLogger.logAction({
        userId: proposal.userId,
        actorType: "agent",
        actorId: proposal.agentCode,
        actionName: `EXECUTION_FAILED:${proposal.actionName}`,
        resourceAffected: proposal.category,
        previousState: null,
        newState: { error: errMsg },
      });

      throw err;
    }
  }

  private formatAgentName(code: AgentRoleCode): string {
    const map: Record<AgentRoleCode, string> = {
      system_guardian: "System Guardian",
      autonomous_life_manager: "Autonomous Life Manager",
      life_capture: "Life Capture Agent",
      life_analyst: "Life Analyst",
      daily_planner: "Daily Planner",
      goal_predictor: "Goal Predictor",
      dynamic_quest_generator: "Dynamic Quest Generator",
      smart_expense: "Smart Expense Engine",
      economic_intelligence: "Economic Intelligence",
      skill_evolution: "Skill Evolution Agent",
      reward_optimizer: "Reward Optimizer",
    };
    return map[code] || code;
  }

  private formatAgentRole(code: AgentRoleCode): string {
    const map: Record<AgentRoleCode, string> = {
      system_guardian: "Firewall ético, seguridad y control financiero",
      autonomous_life_manager: "Orquestador central y síntesis de ciclo de vida",
      life_capture: "Ingesta omnicanal y normalización en lenguaje natural",
      life_analyst: "Analítica predictiva y patrones de productividad/bienestar",
      daily_planner: "Rebalanceo adaptativo del calendario circadiano",
      goal_predictor: "Simulación de Time-To-Kill para deudas y metas",
      dynamic_quest_generator: "Generador de misiones adaptativas personalizadas",
      smart_expense: "Categorización y auditoría de transacciones",
      economic_intelligence: "Optimización de superávit y estrategias de amortización",
      skill_evolution: "Métricas de progresión en 16 dominios de habilidad",
      reward_optimizer: "Calibración dinámica de economía de XP y GP",
    };
    return map[code] || "Agente especializado";
  }
}

export const defaultSystemGuardian = new SystemGuardian();
