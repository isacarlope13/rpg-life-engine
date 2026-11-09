import { AutomationEventBus, defaultEventBus } from "../automation/event-bus.ts";
import { AutomationTaskQueue, defaultTaskQueue } from "../automation/task-queue.ts";
import type { SystemEvent, SystemEventType } from "../automation/types.ts";
import { defaultSystemGuardian, SystemGuardian } from "./system-guardian.ts";
import type {
  AgentExecutionOutcome,
  AgentExecutionProposal,
  AgentRoleCode,
  AgentState,
} from "./types.ts";

/**
 * AutonomousLifeManager: Agente Meta-Coordinador del RPG Life-Engine.
 * Orquesta la comunicación entre los agentes especializados, despacha tareas a la cola
 * y canaliza toda acción a través del SystemGuardian para asegurar que ninguna mutación
 * ocurra sin validación estricta de invariantes.
 */
export class AutonomousLifeManager {
  private eventBus: AutomationEventBus;
  private taskQueue: AutomationTaskQueue;
  private guardian: SystemGuardian;

  private allAgentCodes: AgentRoleCode[] = [
    "autonomous_life_manager",
    "system_guardian",
    "life_capture",
    "life_analyst",
    "daily_planner",
    "goal_predictor",
    "dynamic_quest_generator",
    "smart_expense",
    "economic_intelligence",
    "skill_evolution",
    "reward_optimizer",
  ];

  constructor(
    eventBus: AutomationEventBus = defaultEventBus,
    taskQueue: AutomationTaskQueue = defaultTaskQueue,
    guardian: SystemGuardian = defaultSystemGuardian
  ) {
    this.eventBus = eventBus;
    this.taskQueue = taskQueue;
    this.guardian = guardian;

    this.registerEventRouting();
  }

  /**
   * Suscribe el orquestador a los eventos del sistema para encolar tareas a agentes especialistas.
   */
  private registerEventRouting(): void {
    const routingMap: Record<SystemEventType, AgentRoleCode[]> = {
      EXPENSE_RECORDED: ["smart_expense", "life_analyst"],
      SKILL_SESSION_COMPLETED: ["skill_evolution", "reward_optimizer"],
      CIRCADIAN_PHASE_CHANGED: ["daily_planner"],
      STREAK_AT_RISK: ["daily_planner"],
      BOSS_ENRAGE_WARNING: ["economic_intelligence"],
      LIFE_EVENT_CAPTURED: ["life_analyst"],
      SCHEDULE_REBALANCE_PROPOSED: ["daily_planner"],
      QUEST_GENERATED: ["reward_optimizer"],
      APPROVAL_REQUESTED: ["system_guardian"],
      APPROVAL_RESOLVED: ["autonomous_life_manager"],
      ACTION_EXECUTED: ["life_analyst"],
    };

    for (const [eventType, targetAgents] of Object.entries(routingMap)) {
      this.eventBus.on(eventType as SystemEventType, async (event) => {
        for (const agent of targetAgents) {
          const idempotencyKey = `idem_${event.id}_${agent}`;
          this.taskQueue.enqueue({
            userId: event.userId,
            idempotencyKey,
            event,
            targetAgent: agent,
          });
        }
      });
    }
  }

  /**
   * Propone una acción a través del SystemGuardian.
   * La IA NUNCA puede mutar el estado directamente: toda intención debe ser auditada.
   */
  public async proposeAction(
    proposal: AgentExecutionProposal,
    mutationExecutor: () => Promise<Record<string, unknown>>
  ): Promise<AgentExecutionOutcome> {
    return this.guardian.interceptAndEnforce(proposal, mutationExecutor);
  }

  /**
   * Obtiene el estado actual de los 11 agentes especializados para el AI Command Center.
   */
  public getCouncilStatus(userId?: string): {
    agents: AgentState[];
    totalAgents: number;
    activeTasksCount: number;
    systemHealth: "optimal" | "degraded" | "alert";
  } {
    const agents = this.allAgentCodes.map((code) => this.guardian.getAgentState(code));
    const tasks = this.taskQueue.getAllTasks(userId);
    const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "processing");

    return {
      agents,
      totalAgents: agents.length,
      activeTasksCount: activeTasks.length,
      systemHealth: "optimal",
    };
  }
}

export const defaultAutonomousLifeManager = new AutonomousLifeManager();
