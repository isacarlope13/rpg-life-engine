/**
 * ============================================================================
 * OAKHAVEN — AUTOMATION CORE PERSONAL (FASE 5)
 * ============================================================================
 * Motor determinista de 10 automatizaciones personales en modo simulación/propuesta:
 * - Registro de eventos, condiciones, acciones, programación e historial.
 * - Cola persistente serializable, idempotencia y reintentos controlados.
 * - Prevención de ciclos infinitos (`maxChainDepth`), límite de ejecuciones
 *   por ciclo (`maxExecutionsPerCycle`) e interruptor de emergencia global.
 * - Cero acciones externas, pagos o mutaciones sensibles sin aprobación humana.
 */

export type AutomationEventType =
  | "daily_check"
  | "weekly_check"
  | "project_idle_check"
  | "budget_check"
  | "energy_overload"
  | "goal_review";

export interface AutomationContextSnapshot {
  dateBucket: string; // YYYY-MM-DD
  abandonedProjects: Array<{ id: string; name: string; daysSinceUpdate: number }>;
  pendingCreativeProjects: Array<{ id: string; name: string }>;
  overdueTasks?: Array<{ id: string; title: string; daysOverdue: number }>;
  personalGoals?: Array<{ id: string; title: string; progressPct: number }>;
  plannedMinutesToday: number;
  capacityMinutesToday: number;
  studyMinutesToday: number;
  budgetSpentRatioPct: number;
  consecutiveWorkDays?: number;
  isWeeklyReviewDay?: boolean;
}

export interface AutomationRule {
  id: string;
  name: string;
  event: AutomationEventType;
  scheduleLabel: string;
  enabled: boolean;
  requiresApproval: boolean;
  maxRetries: number;
  evaluate: (ctx: AutomationContextSnapshot) => { matched: boolean; proposal: string };
}

export interface AutomationExecutionRecord {
  id: string;
  ruleId: string;
  ruleName: string;
  idempotencyKey: string;
  simulated: boolean;
  status:
    | "simulated"
    | "pending_approval"
    | "executed"
    | "skipped_duplicate"
    | "blocked_emergency"
    | "blocked_loop_guard"
    | "blocked_rate_limit";
  attempts: number;
  proposal: string;
  timestamp: string;
}

export interface AutomationCoreState {
  schemaVersion: 1;
  emergencyStop: boolean;
  executedKeys: string[];
  history: AutomationExecutionRecord[];
}

export const DEFAULT_PERSONAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule_daily_summary",
    name: "1. Resumen diario",
    event: "daily_check",
    scheduleLabel: "Diaria (20:30)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) => ({
      matched: true,
      proposal: `Resumen ${ctx.dateBucket}: carga ${ctx.plannedMinutesToday}/${ctx.capacityMinutesToday} min, estudio ${ctx.studyMinutesToday} min, proyectos creativos ${ctx.pendingCreativeProjects.length}.`,
    }),
  },
  {
    id: "rule_overdue_tasks",
    name: "2. Detección de tareas vencidas",
    event: "daily_check",
    scheduleLabel: "Diaria (08:15)",
    enabled: true,
    requiresApproval: true,
    maxRetries: 1,
    evaluate: (ctx) => {
      const overdue = ctx.overdueTasks || [];
      return overdue.length > 0
        ? {
            matched: true,
            proposal: `Tienes ${overdue.length} tarea(s) vencida(s) (${overdue.map((t) => t.title).slice(0, 2).join(", ")}). Propongo reprogramarlas para bloques libres (requiere aprobación).`,
          }
        : { matched: false, proposal: "" };
    },
  },
  {
    id: "rule_abandoned_projects",
    name: "3. Detección de proyectos abandonados",
    event: "project_idle_check",
    scheduleLabel: "Semanal (Domingos 18:00)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) => {
      const stale = ctx.abandonedProjects.filter((p) => p.daysSinceUpdate >= 14);
      return stale.length > 0
        ? {
            matched: true,
            proposal: `Detecté ${stale.length} proyecto(s) sin avance >=14 días (${stale.map((p) => p.name).join(", ")}). ¿Pausar sin culpa o retomar 15 min?`,
          }
        : { matched: false, proposal: "" };
    },
  },
  {
    id: "rule_rest_recommendation",
    name: "4. Recomendación de descanso",
    event: "energy_overload",
    scheduleLabel: "Diaria (16:00)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      (ctx.consecutiveWorkDays ?? 0) >= 5 || ctx.plannedMinutesToday > ctx.capacityMinutesToday
        ? {
            matched: true,
            proposal: "Carga acumulada alta: te sugiero proteger al menos 30 min de descanso real sin pantallas hoy.",
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_task_reorg",
    name: "5. Propuesta de reorganización del calendario",
    event: "energy_overload",
    scheduleLabel: "Diaria (08:30)",
    enabled: true,
    requiresApproval: true,
    maxRetries: 2,
    evaluate: (ctx) =>
      ctx.plannedMinutesToday > ctx.capacityMinutesToday
        ? {
            matched: true,
            proposal: `Sobreplanificación (${ctx.plannedMinutesToday} min vs. ${ctx.capacityMinutesToday} min). Propongo mover tareas secundarias a mañana (requiere aprobación).`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_budget_drift",
    name: "6. Detección de desviaciones presupuestarias (COP)",
    event: "budget_check",
    scheduleLabel: "Cada 3 días",
    enabled: true,
    requiresApproval: true,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.budgetSpentRatioPct >= 85
        ? {
            matched: true,
            proposal: `Alerta presupuestaria: ${ctx.budgetSpentRatioPct}% ejecutado en COP. Revisa con Silas antes de nuevos gastos (cero pagos automáticos).`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_learning_session",
    name: "7. Recordatorio de sesiones de aprendizaje",
    event: "daily_check",
    scheduleLabel: "Diaria (17:30)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.studyMinutesToday === 0
        ? {
            matched: true,
            proposal: "Aún no registras aprendizaje hoy. Sugiero un bloque breve de 15–25 min con Lyra.",
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_creative_reminder",
    name: "8. Seguimiento de proyectos de tejido",
    event: "daily_check",
    scheduleLabel: "Mar/Jue/Sáb",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.pendingCreativeProjects.length > 0
        ? {
            matched: true,
            proposal: `Tienes ${ctx.pendingCreativeProjects.length} proyecto(s) de tejido activos (${ctx.pendingCreativeProjects.map((p) => p.name).slice(0, 2).join(", ")}). Un bloque de 15 min en el Atelier te dará un respiro.`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_weekly_summary",
    name: "9. Resumen semanal",
    event: "weekly_check",
    scheduleLabel: "Domingos (19:00)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.isWeeklyReviewDay
        ? {
            matched: true,
            proposal: `Cierre semanal (${ctx.dateBucket}): consolida logros en Atelier, estudio y pendientes sin culpa para planificar la semana entrante.`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_personal_goals",
    name: "10. Revisión de metas personales",
    event: "goal_review",
    scheduleLabel: "Quincenal",
    enabled: true,
    requiresApproval: true,
    maxRetries: 1,
    evaluate: (ctx) => {
      const lagging = (ctx.personalGoals || []).filter((g) => g.progressPct < 40);
      return lagging.length > 0
        ? {
            matched: true,
            proposal: `Meta(s) por debajo del 40% (${lagging.map((g) => g.title).join(", ")}). Propongo dividirlas en hitos semanales más pequeños (requiere aprobación).`,
          }
        : { matched: false, proposal: "" };
    },
  },
];

export function createInitialAutomationState(): AutomationCoreState {
  return {
    schemaVersion: 1,
    emergencyStop: false,
    executedKeys: [],
    history: [],
  };
}

export function serializeAutomationState(state: AutomationCoreState): string {
  return JSON.stringify(state);
}

export function deserializeAutomationState(raw: string): AutomationCoreState {
  try {
    const parsed = JSON.parse(raw) as Partial<AutomationCoreState>;
    if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.executedKeys) && Array.isArray(parsed.history)) {
      return {
        schemaVersion: 1,
        emergencyStop: Boolean(parsed.emergencyStop),
        executedKeys: parsed.executedKeys.map(String).slice(-500),
        history: parsed.history.slice(0, 100),
      };
    }
  } catch {
    // fallback seguro ante JSON corrupto
  }
  return createInitialAutomationState();
}

export function runAutomationCycle(
  state: AutomationCoreState,
  ctx: AutomationContextSnapshot,
  options?: {
    simulate?: boolean;
    rules?: AutomationRule[];
    maxExecutionsPerCycle?: number;
    chainDepth?: number;
    maxChainDepth?: number;
  }
): { nextState: AutomationCoreState; records: AutomationExecutionRecord[] } {
  const simulate = Boolean(options?.simulate);
  const rules = options?.rules ?? DEFAULT_PERSONAL_AUTOMATION_RULES;
  const maxExecutions = Math.max(1, options?.maxExecutionsPerCycle ?? 15);
  const chainDepth = options?.chainDepth ?? 0;
  const maxChainDepth = options?.maxChainDepth ?? 3;
  const now = new Date().toISOString();

  if (state.emergencyStop) {
    const blocked: AutomationExecutionRecord = {
      id: `auto_block_${Date.now()}`,
      ruleId: "emergency_stop",
      ruleName: "Interruptor de emergencia activo",
      idempotencyKey: `emergency:${ctx.dateBucket}`,
      simulated: simulate,
      status: "blocked_emergency",
      attempts: 0,
      proposal: "Todas las automatizaciones están detenidas por el interruptor de emergencia.",
      timestamp: now,
    };
    return {
      records: [blocked],
      nextState: { ...state, history: [blocked, ...state.history] },
    };
  }

  if (chainDepth > maxChainDepth) {
    const loopBlocked: AutomationExecutionRecord = {
      id: `auto_loop_${Date.now()}`,
      ruleId: "loop_guard",
      ruleName: "Protección anti-ciclos infinitos",
      idempotencyKey: `loop:${ctx.dateBucket}:${chainDepth}`,
      simulated: simulate,
      status: "blocked_loop_guard",
      attempts: 0,
      proposal: `Ejecución detenida al superar profundidad máxima de encadenamiento (${maxChainDepth}).`,
      timestamp: now,
    };
    return {
      records: [loopBlocked],
      nextState: { ...state, history: [loopBlocked, ...state.history] },
    };
  }

  const nextKeys = new Set(state.executedKeys);
  const records: AutomationExecutionRecord[] = [];
  let executedCount = 0;

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const evalRes = rule.evaluate(ctx);
    if (!evalRes.matched) continue;

    if (executedCount >= maxExecutions) {
      records.push({
        id: `auto_limit_${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        idempotencyKey: `limit:${rule.id}:${ctx.dateBucket}`,
        simulated: simulate,
        status: "blocked_rate_limit",
        attempts: 0,
        proposal: `Límite máximo de ejecuciones por ciclo alcanzado (${maxExecutions}).`,
        timestamp: now,
      });
      continue;
    }

    const idemKey = `auto:${rule.id}:${ctx.dateBucket}`;
    if (!simulate && nextKeys.has(idemKey)) {
      records.push({
        id: `auto_${rule.id}_${Date.now()}`,
        ruleId: rule.id,
        ruleName: rule.name,
        idempotencyKey: idemKey,
        simulated: false,
        status: "skipped_duplicate",
        attempts: 0,
        proposal: evalRes.proposal,
        timestamp: now,
      });
      continue;
    }

    const status = simulate
      ? "simulated"
      : rule.requiresApproval
      ? "pending_approval"
      : "executed";

    if (!simulate) {
      nextKeys.add(idemKey);
    }
    executedCount += 1;

    records.push({
      id: `auto_${rule.id}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      idempotencyKey: idemKey,
      simulated: simulate,
      status,
      attempts: 1,
      proposal: evalRes.proposal,
      timestamp: now,
    });
  }

  return {
    records,
    nextState: {
      ...state,
      executedKeys: Array.from(nextKeys),
      history: [...records, ...state.history].slice(0, 100),
    },
  };
}
