/**
 * ============================================================================
 * OAKHAVEN — AI COMMAND CENTER CORE (P2)
 * ============================================================================
 * Integra los especialistas existentes (`ALL_RUNTIME_SKILLS`) sin reconstruirlos:
 * - Registro de agentes y catálogo de capacidades.
 * - Enrutamiento 100 % determinista (0 llamadas innecesarias a modelos pagos).
 * - Contexto compartido controlado con aislamiento financiero estricto.
 * - Cola de tareas, aprobaciones humanas, historial de ejecuciones, errores
 *   y presupuesto de tokens / métricas de consumo.
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
  resultSummary?: string;
  errorMessage?: string;
}

export interface CommandCenterState {
  tokenBudgetDaily: number;
  tokensUsedToday: number;
  tasks: CommandExecutionTask[];
  errorLog: Array<{ at: string; taskId: string; message: string }>;
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
): { agent: AgentCapabilityDescriptor; reason: string; requiresApproval: boolean } {
  const q = (prompt || "").toLowerCase();
  const findById = (id: string) => catalog.find((c) => c.residentId === id) || catalog[0];

  const requiresApproval =
    /(modificar|borrar|eliminar|enviar|reprogramar|guardar nota|crear proyecto|actualizar)/i.test(q);

  if (/(crochet|filet|tejido|vuelta|hilo|patr[oó]n|alfabeto|priscilla)/i.test(q)) {
    return { agent: findById("clara"), reason: "Consulta de tejido / Filet Crochet -> Clara (Atelier).", requiresApproval };
  }
  if (/(presupuesto|dinero|cop|deuda|ahorro|gasto|banco|finanz)/i.test(q)) {
    return { agent: findById("silas"), reason: "Consulta financiera aislada en COP -> Silas (Banco).", requiresApproval: true };
  }
  if (/(estudi|repas|examen|flashcard|apunte)/i.test(q)) {
    return { agent: findById("lyra"), reason: "Consulta de estudio -> Lyra (Sala de Estudio).", requiresApproval };
  }
  if (/(trabajo|sprint|oficina|entregable|proyecto laboral)/i.test(q)) {
    return { agent: findById("aura"), reason: "Consulta de trabajo -> Aura (Oficina).", requiresApproval };
  }
  if (/(libro|lectura|p[aá]gina|cita)/i.test(q)) {
    return { agent: findById("eldrin"), reason: "Consulta de lectura -> Eldrin (Biblioteca).", requiresApproval };
  }
  if (/(gym|entrenamiento|ejercicio|fuerza)/i.test(q)) {
    return { agent: findById("bruno"), reason: "Consulta de entrenamiento -> Bruno (Gimnasio).", requiresApproval };
  }
  if (/(cubo|rubik|scramble|pb|ao5)/i.test(q)) {
    return { agent: findById("milo"), reason: "Consulta de speedcubing -> Milo (Taller).", requiresApproval };
  }
  if (/(pel[ií]cula|serie|cine|watchlist)/i.test(q)) {
    return { agent: findById("nora"), reason: "Consulta de cine/descanso -> Nora (Cine).", requiresApproval };
  }
  return { agent: findById("rowan"), reason: "Coordinación general / decisión diaria -> Rowan (Ayuntamiento).", requiresApproval };
}

export function createInitialCommandCenterState(tokenBudgetDaily = 20000): CommandCenterState {
  return {
    tokenBudgetDaily: Math.max(1000, Math.round(tokenBudgetDaily)),
    tokensUsedToday: 0,
    tasks: [],
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
  return {
    ...state,
    tasks: state.tasks.map((t) => {
      if (t.id !== taskId || t.status !== "pending_approval") return t;
      return {
        ...t,
        status: decision === "approve" ? "completed" : "rejected",
        resultSummary:
          decision === "approve"
            ? `Aprobado por el propietario (${t.targetAgentName}).`
            : `Rechazado por el propietario; no se ejecutó ninguna acción.`,
      };
    }),
  };
}
