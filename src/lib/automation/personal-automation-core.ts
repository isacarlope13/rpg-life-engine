/**
 * ============================================================================
 * OAKHAVEN — AUTOMATION CORE PERSONAL (P2)
 * ============================================================================
 * Motor determinista de reglas personales basado en Eventos -> Condiciones ->
 * Acciones con:
 * - Programaciones, idempotencia, reintentos y registro histórico.
 * - Modo simulación (dry-run) sin efectos secundarios.
 * - Aprobación humana obligatoria para acciones sensibles o externas.
 * - Interruptor de emergencia (kill-switch) global.
 */

export type AutomationEventType =
  | "daily_check"
  | "project_idle_check"
  | "budget_check"
  | "energy_overload";

export interface AutomationContextSnapshot {
  dateBucket: string; // YYYY-MM-DD
  abandonedProjects: Array<{ id: string; name: string; daysSinceUpdate: number }>;
  pendingCreativeProjects: Array<{ id: string; name: string }>;
  plannedMinutesToday: number;
  capacityMinutesToday: number;
  studyMinutesToday: number;
  budgetSpentRatioPct: number;
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
  status: "simulated" | "pending_approval" | "executed" | "skipped_duplicate" | "blocked_emergency";
  attempts: number;
  proposal: string;
  timestamp: string;
}

export interface AutomationCoreState {
  emergencyStop: boolean;
  executedKeys: string[];
  history: AutomationExecutionRecord[];
}

export const DEFAULT_PERSONAL_AUTOMATION_RULES: AutomationRule[] = [
  {
    id: "rule_abandoned_projects",
    name: "Detectar proyectos abandonados",
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
            proposal: `Detecté ${stale.length} proyecto(s) sin avance hace >=14 días (${stale.map((p) => p.name).join(", ")}). ¿Deseas pausarlos sin culpa o retomar 15 min?`,
          }
        : { matched: false, proposal: "" };
    },
  },
  {
    id: "rule_task_reorg",
    name: "Proponer reorganización de tareas",
    event: "energy_overload",
    scheduleLabel: "Diaria (08:30)",
    enabled: true,
    requiresApproval: true,
    maxRetries: 2,
    evaluate: (ctx) =>
      ctx.plannedMinutesToday > ctx.capacityMinutesToday
        ? {
            matched: true,
            proposal: `Sobreplanificación detectada (${ctx.plannedMinutesToday} min vs. ${ctx.capacityMinutesToday} min). Propongo mover tareas de baja prioridad a mañana (requiere tu aprobación).`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_daily_summary",
    name: "Generar resumen diario",
    event: "daily_check",
    scheduleLabel: "Diaria (20:30)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) => ({
      matched: true,
      proposal: `Resumen ${ctx.dateBucket}: carga ${ctx.plannedMinutesToday}/${ctx.capacityMinutesToday} min, estudio ${ctx.studyMinutesToday} min, proyectos creativos pendientes ${ctx.pendingCreativeProjects.length}.`,
    }),
  },
  {
    id: "rule_learning_session",
    name: "Recomendar sesión de aprendizaje",
    event: "daily_check",
    scheduleLabel: "Diaria (17:30)",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.studyMinutesToday === 0
        ? {
            matched: true,
            proposal: "Aún no registras aprendizaje hoy. Te sugiero un bloque breve de 15–25 min con Lyra.",
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_budget_drift",
    name: "Detectar desviaciones presupuestarias (COP)",
    event: "budget_check",
    scheduleLabel: "Cada 3 días",
    enabled: true,
    requiresApproval: true,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.budgetSpentRatioPct >= 85
        ? {
            matched: true,
            proposal: `Alerta presupuestaria: llevas ${ctx.budgetSpentRatioPct}% del presupuesto operativo ejecutado en COP. Revisa con Silas antes de nuevos gastos (cero pagos automáticos).`,
          }
        : { matched: false, proposal: "" },
  },
  {
    id: "rule_creative_reminder",
    name: "Recordar proyectos creativos pendientes",
    event: "daily_check",
    scheduleLabel: "Mar/Jue/Sáb",
    enabled: true,
    requiresApproval: false,
    maxRetries: 1,
    evaluate: (ctx) =>
      ctx.pendingCreativeProjects.length > 0
        ? {
            matched: true,
            proposal: `Tienes ${ctx.pendingCreativeProjects.length} proyecto(s) creativo(s) esperando (${ctx.pendingCreativeProjects.map((p) => p.name).slice(0, 2).join(", ")}). Un bloque de 15 min en el Atelier te dará un respiro.`,
          }
        : { matched: false, proposal: "" },
  },
];

export function createInitialAutomationState(): AutomationCoreState {
  return {
    emergencyStop: false,
    executedKeys: [],
    history: [],
  };
}

export function runAutomationCycle(
  state: AutomationCoreState,
  ctx: AutomationContextSnapshot,
  options?: { simulate?: boolean; rules?: AutomationRule[] }
): { nextState: AutomationCoreState; records: AutomationExecutionRecord[] } {
  const simulate = Boolean(options?.simulate);
  const rules = options?.rules ?? DEFAULT_PERSONAL_AUTOMATION_RULES;
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

  const nextKeys = new Set(state.executedKeys);
  const records: AutomationExecutionRecord[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const evalRes = rule.evaluate(ctx);
    if (!evalRes.matched) continue;

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
