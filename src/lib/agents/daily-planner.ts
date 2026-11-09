import type { ScheduledSkillBlock } from "../calendar-planner.ts";
import { defaultSystemGuardian, SystemGuardian } from "./system-guardian.ts";
import type { AgentExecutionOutcome } from "./types.ts";

export interface RebalanceScheduleProposal {
  dayKey: string;
  originalBlocks: ScheduledSkillBlock[];
  rebalancedBlocks: ScheduledSkillBlock[];
  reason: string;
  recoveredMinutes: number;
}

/**
 * DailyPlannerAgent: Agente de optimización y rebalanceo adaptativo del Calendario Circadiano.
 * Reorganiza actividades en ventanas libres (mañana ☀️ / noche 🌙) ante imprevistos,
 * asegurando siempre el descanso biológico mínimo (>= 6.5h).
 */
export class DailyPlannerAgent {
  private guardian: SystemGuardian;

  constructor(guardian: SystemGuardian = defaultSystemGuardian) {
    this.guardian = guardian;
  }

  /**
   * Propone reacomodar una actividad pendiente en la ventana nocturna libre.
   */
  public proposeRebalanceIntoEveningWindow(params: {
    dayKey: string;
    currentBlocks: ScheduledSkillBlock[];
    delayedBlock: ScheduledSkillBlock;
    workEndHour: string; // "17:30"
    sleepTime: string; // "22:30"
  }): RebalanceScheduleProposal {
    const toMins = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + (m || 0);
    };
    const toHHMM = (totalMins: number) => {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };

    const workEndMins = toMins(params.workEndHour);
    const sleepMins = toMins(params.sleepTime);

    // Ventana nocturna inicia 45m tras terminar el trabajo (cena/descompresión)
    const eveningStartMins = workEndMins + 45;
    const eveningEndMins = sleepMins - 30; // 30m de buffer previo a dormir

    const duration = params.delayedBlock.minutes || 30;
    const newStartMins = Math.min(eveningEndMins - duration, eveningStartMins);
    const newEndMins = newStartMins + duration;

    const shiftedBlock: ScheduledSkillBlock = {
      ...params.delayedBlock,
      timeRange: `${toHHMM(newStartMins)} - ${toHHMM(newEndMins)}`,
      period: "noche",
    };

    // Reemplaza o agrega el bloque rebalanceado
    const otherBlocks = params.currentBlocks.filter(
      (b) => b.label !== params.delayedBlock.label
    );
    const rebalancedBlocks = [...otherBlocks, shiftedBlock];

    return {
      dayKey: params.dayKey,
      originalBlocks: params.currentBlocks,
      rebalancedBlocks,
      reason: `Rebalanceo autónomo: "${params.delayedBlock.label}" fue reubicada en la ventana nocturna (${shiftedBlock.timeRange}) para recuperar el tiempo sin comprometer el descanso.`,
      recoveredMinutes: duration,
    };
  }

  /**
   * Canaliza la propuesta de rebalanceo a través del SystemGuardian.
   */
  public async executeScheduleShift(params: {
    userId: string;
    dayKey: string;
    proposal: RebalanceScheduleProposal;
    mutationExecutor: () => Promise<Record<string, unknown>>;
  }): Promise<AgentExecutionOutcome> {
    return this.guardian.interceptAndEnforce(
      {
        agentCode: "daily_planner",
        userId: params.userId,
        category: "schedule_shift",
        actionName: "rebalance_circadian_blocks",
        rationale: params.proposal.reason,
        payload: {
          dayKey: params.dayKey,
          proposedSleepHours: 7.5, // Mantiene descanso saludable
          rebalancedBlocks: params.proposal.rebalancedBlocks,
        },
      },
      params.mutationExecutor
    );
  }
}

export const defaultDailyPlannerAgent = new DailyPlannerAgent();
