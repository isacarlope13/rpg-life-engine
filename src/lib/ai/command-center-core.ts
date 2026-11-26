/**
 * ============================================================================
 * OAKHAVEN — AI COMMAND CENTER CORE (FASE 4)
 * ============================================================================
 * Reutiliza `ALL_RUNTIME_SKILLS` sin duplicar especialistas:
 * - Registro central de especialistas, catálogo de capacidades y estado.
 * - Enrutamiento determinista prioritario (0 costo de tokens por defecto).
 * - Contexto compartido con permisos estrictos (aislamiento financiero COP).
 * - Cola de tareas, aprobaciones humanas, cancelación, registro de decisiones,
 *   manejo de errores y presupuesto diario de tokens.
 */

import { ALL_RUNTIME_SKILLS, type RuntimeBuildingSkill } from "./building-skills-registry.ts";

export interface AgentCapabilityDescriptor {
  skillId: string;
  residentId: string;
  name: string;
  role: string;
  buildingId: string;
  allowedTools: string[];
  autonomyLevel: number;
  canMutateRealMoneyOrGp: false;
}

export type CommandTaskStatus =
  | "queued"
  | "pending_approval"
  | "completed"
  | "rejected"
  | "cancelled"
  | "failed";

export interface CommandExecutionTask {
  id: string;
  createdAt: string;
  targetResidentId: string;
  targetAgentName: string;
  prompt: string;
  requiresApproval: boolean;
  status: CommandTaskStatus;
  deterministic: boolean;
  estimatedTokens: number;
  dataScopeUsed: string[];
  resultSummary?: string;
  errorMessage?: string;
}

export interface CommandDecisionRecord {
  at: string;
  taskId: string;
  agentName: string;
  decision: "approved" | "rejected" | "cancelled";
  note?: string;
}

export interface CommandCenterState {
  tokenBudgetDaily: number;
  tokensUsedToday: number;
  tasks: CommandExecutionTask[];
  decisionLog: CommandDecisionRecord[];
  errorLog: Array<{ at: string; taskId: string; message: string }>;
}

export interface RawSharedPersonalContext {
  activeProjectsCount: number;
  pendingTasksCount: number;
  streakDays: number;
  availableRealMoneyCop?: number;
}

export interface ControlledSharedContext {
  residentId: string;
  activeProjectsCount: number;
  pendingTasksCount: number;
  streakDays: number;
  financialDataVisible: boolean;
  availableRealMoneyCop?: number;
}

/**
 * Construye contexto compartido con mínimo privilegio:
 * ÚNICAMENTE Silas (Banco) puede recibir cifras en dinero real COP.
 */
export function buildControlledSharedContext(
  residentId: string,
  raw: RawSharedPersonalContext
): ControlledSharedContext {
  const isSilas = residentId === "silas";
  return {
    residentId,
    activeProjectsCount: raw.activeProjectsCount,
    pendingTasksCount: raw.pendingTasksCount,
    streakDays: raw.streakDays,
    financialDataVisible: isSilas && raw.availableRealMoneyCop !== undefined,
    ...(isSilas && raw.availableRealMoneyCop !== undefined
      ? { availableRealMoneyCop: raw.availableRealMoneyCop }
      : {}),
  };
}

export function getRegisteredAgentCatalog(
  skills: RuntimeBuildingSkill[] = ALL_RUNTIME_SKILLS
): AgentCapabilityDescriptor[] {
  return skills.map((s) => ({
    skillId: s.skillId,
    residentId: s.residentId,
    name: s.name,
    role: s.role,
    buildingId: s.buildingId,
    allowedTools: [...s.allowedTools],
    autonomyLevel: s.autonomyLevel,
    canMutateRealMoneyOrGp: false,
  }));
}

export function routePersonalCommandRequest(
  prompt: string,
  catalog: AgentCapabilityDescriptor[] = getRegisteredAgentCatalog()
): { agent: AgentCapabilityDescriptor; reason: string; requiresApproval: boolean; dataScope: string[] } {
  const q = (prompt || "").toLowerCase();
  const findById = (id: string) => catalog.find((c) => c.residentId === id) || catalog[0];

  const requiresApproval =
    /(modificar|borrar|eliminar|enviar|reprogramar|guardar nota|crear proyecto|actualizar)/i.test(q);

  if (/(crochet|filet|tejido|vuelta|hilo|patr[oó]n|alfabeto|priscilla)/i.test(q)) {
    return {
      agent: findById("clara"),
      reason: "Consulta de tejido / Filet Crochet -> Clara (Atelier).",
      requiresApproval,
      dataScope: ["knitting_projects", "filet_workspace"],
    };
  }
  if (/(presupuesto|dinero|cop|deuda|ahorro|gasto|banco|finanz)/i.test(q)) {
    return {
      agent: findById("silas"),
      reason: "Consulta financiera aislada en COP -> Silas (Banco).",
      requiresApproval: true,
      dataScope: ["owner_finance_cop_only"],
    };
  }
  if (/(estudi|repas|examen|flashcard|apunte)/i.test(q)) {
    return {
      agent: findById("lyra"),
      reason: "Consulta de estudio -> Lyra (Sala de Estudio).",
      requiresApproval,
      dataScope: ["study_sessions", "spaced_cards"],
    };
  }
  if (/(trabajo|sprint|oficina|entregable|proyecto laboral)/i.test(q)) {
    return {
      agent: findById("aura"),
      reason: "Consulta de trabajo -> Aura (Oficina).",
      requiresApproval,
      dataScope: ["work_projects"],
    };
  }
  if (/(libro|lectura|p[aá]gina|cita)/i.test(q)) {
    return {
      agent: findById("eldrin"),
      reason: "Consulta de lectura -> Eldrin (Biblioteca).",
      requiresApproval,
      dataScope: ["reading_books"],
    };
  }
  if (/(gym|entrenamiento|ejercicio|fuerza)/i.test(q)) {
    return {
      agent: findById("bruno"),
      reason: "Consulta de entrenamiento -> Bruno (Gimnasio).",
      requiresApproval,
      dataScope: ["gym_workout_sets"],
    };
  }
  if (/(cubo|rubik|scramble|pb|ao5)/i.test(q)) {
    return {
      agent: findById("milo"),
      reason: "Consulta de speedcubing -> Milo (Taller).",
      requiresApproval,
      dataScope: ["rubik_solves"],
    };
  }
  if (/(pel[ií]cula|serie|cine|watchlist)/i.test(q)) {
    return {
      agent: findById("nora"),
      reason: "Consulta de cine/descanso -> Nora (Cine).",
      requiresApproval,
      dataScope: ["cinema_entries"],
    };
  }
  return {
    agent: findById("rowan"),
    reason: "Coordinación general / decisión diaria -> Rowan (Ayuntamiento).",
    requiresApproval,
    dataScope: ["quests", "energy_capacity"],
  };
}

export function createInitialCommandCenterState(tokenBudgetDaily = 20000): CommandCenterState {
  return {
    tokenBudgetDaily: Math.max(1000, Math.round(tokenBudgetDaily)),
    tokensUsedToday: 0,
    tasks: [],
    decisionLog: [],
    errorLog: [],
  };
}

export function enqueueCommandTask(
  state: CommandCenterState,
  params: { prompt: string; deterministic?: boolean; estimatedTokens?: number }
): { nextState: CommandCenterState; task: CommandExecutionTask } {
  const deterministic = params.deterministic ?? true;
  const estimatedTokens = deterministic ? 0 : Math.max(0, Math.round(params.estimatedTokens ?? 500));
  const routed = routePersonalCommandRequest(params.prompt);
  const now = new Date().toISOString();
  const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  if (!deterministic && state.tokensUsedToday + estimatedTokens > state.tokenBudgetDaily) {
    const failedTask: CommandExecutionTask = {
      id,
      createdAt: now,
      targetResidentId: routed.agent.residentId,
      targetAgentName: routed.agent.name,
      prompt: params.prompt.trim().slice(0, 240),
      requiresApproval: routed.requiresApproval,
      status: "failed",
      deterministic,
      estimatedTokens,
      dataScopeUsed: routed.dataScope,
      errorMessage: "Presupuesto diario de tokens agotado; utiliza ejecución determinista o amplía el presupuesto.",
    };
    return {
      task: failedTask,
      nextState: {
        ...state,
        tasks: [failedTask, ...state.tasks],
        errorLog: [{ at: now, taskId: id, message: failedTask.errorMessage! }, ...state.errorLog],
      },
    };
  }

  const task: CommandExecutionTask = {
    id,
    createdAt: now,
    targetResidentId: routed.agent.residentId,
    targetAgentName: routed.agent.name,
    prompt: params.prompt.trim().slice(0, 240),
    requiresApproval: routed.requiresApproval,
    status: routed.requiresApproval ? "pending_approval" : "completed",
    deterministic,
    estimatedTokens,
    dataScopeUsed: routed.dataScope,
    resultSummary: routed.requiresApproval
      ? `En espera de aprobación humana: ${routed.reason}`
      : `Ejecutado deterministamente: ${routed.reason}`,
  };

  return {
    task,
    nextState: {
      ...state,
      tokensUsedToday: state.tokensUsedToday + estimatedTokens,
      tasks: [task, ...state.tasks],
    },
  };
}

export function resolveCommandApproval(
  state: CommandCenterState,
  taskId: string,
  decision: "approve" | "reject"
): CommandCenterState {
  const target = state.tasks.find((t) => t.id === taskId && t.status === "pending_approval");
  if (!target) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    decisionLog: [
      {
        at: now,
        taskId,
        agentName: target.targetAgentName,
        decision: decision === "approve" ? "approved" : "rejected",
      },
      ...state.decisionLog,
    ],
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: decision === "approve" ? "completed" : "rejected",
            resultSummary:
              decision === "approve"
                ? `Aprobado por el propietario (${t.targetAgentName}).`
                : `Rechazado por el propietario; no se ejecutó ninguna acción.`,
          }
        : t
    ),
  };
}

export function cancelCommandTask(
  state: CommandCenterState,
  taskId: string
): CommandCenterState {
  const target = state.tasks.find(
    (t) => t.id === taskId && (t.status === "queued" || t.status === "pending_approval")
  );
  if (!target) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    decisionLog: [
      { at: now, taskId, agentName: target.targetAgentName, decision: "cancelled" },
      ...state.decisionLog,
    ],
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: "cancelled",
            resultSummary: "Ejecución cancelada manualmente por el propietario.",
          }
        : t
    ),
  };
}
