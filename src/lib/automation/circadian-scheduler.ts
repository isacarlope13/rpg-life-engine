import { AutomationEventBus, defaultEventBus } from "./event-bus.ts";
import type { SystemEvent } from "./types.ts";

export interface SchedulerCheckContext {
  userId: string;
  now: Date;
  currentTimeStr?: string; // Opcional: "21:00" para forzar hora en pruebas deterministas
  wakeUpTime: string; // "06:00"
  sleepTime: string; // "22:30"
  workStartHour: string; // "08:00"
  workEndHour: string; // "17:30"
  streakDays: number;
  habitsCompletedToday: boolean;
  bossesEnrageDueDates?: Array<{ bossId: string; bossName: string; dueDate: string }>;
}

export type CircadianPhase = "morning_window" | "work_window" | "evening_sanctuary" | "sleep_prep";

/**
 * CircadianScheduler: Monitor y planificador circadiano que evalúa las ventanas
 * biológicas del usuario y emite eventos en el EventBus cuando detecta transiciones,
 * riesgos de racha o jefes de deuda a punto de enfurecerse.
 */
export class CircadianScheduler {
  private eventBus: AutomationEventBus;

  constructor(bus: AutomationEventBus = defaultEventBus) {
    this.eventBus = bus;
  }

  /**
   * Determina la fase circadiana actual a partir de la hora actual y la configuración biológica.
   */
  public getCircadianPhase(
    timeStr: string,
    wakeUpTime = "06:00",
    workStart = "08:00",
    workEnd = "17:30",
    sleepTime = "22:30"
  ): CircadianPhase {
    const toMins = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + (m || 0);
    };

    const currentMins = toMins(timeStr);
    const wakeMins = toMins(wakeUpTime);
    const workStartMins = toMins(workStart);
    const workEndMins = toMins(workEnd);
    const sleepMins = toMins(sleepTime);

    if (currentMins >= wakeMins && currentMins < workStartMins) {
      return "morning_window";
    }
    if (currentMins >= workStartMins && currentMins < workEndMins) {
      return "work_window";
    }
    if (currentMins >= workEndMins && currentMins < sleepMins - 45) {
      return "evening_sanctuary";
    }
    return "sleep_prep";
  }

  /**
   * Ejecuta una evaluación de ciclo circadiano y emite eventos de advertencia o cambio de fase.
   */
  public async evaluateCircadianCycle(
    ctx: SchedulerCheckContext
  ): Promise<SystemEvent[]> {
    const emittedEvents: SystemEvent[] = [];
    const timeStr = ctx.currentTimeStr || ctx.now.toTimeString().slice(0, 5); // "HH:MM"
    const nowIso = ctx.now.toISOString();

    const currentPhase = this.getCircadianPhase(
      timeStr,
      ctx.wakeUpTime,
      ctx.workStartHour,
      ctx.workEndHour,
      ctx.sleepTime
    );

    // 1. Evento de cambio / confirmación de fase circadiana
    const phaseEvent: SystemEvent = {
      id: `evt_phase_${Date.now()}`,
      type: "CIRCADIAN_PHASE_CHANGED",
      userId: ctx.userId,
      timestamp: nowIso,
      source: "scheduler",
      payload: {
        phase: currentPhase,
        time: timeStr,
        wakeUpTime: ctx.wakeUpTime,
        sleepTime: ctx.sleepTime,
      },
    };
    await this.eventBus.emit(phaseEvent);
    emittedEvents.push(phaseEvent);

    // 2. Alerta de Racha en Riesgo (Si son más de las 20:00 y no ha registrado actividades)
    const [currH] = timeStr.split(":").map(Number);
    if (currH >= 20 && !ctx.habitsCompletedToday && ctx.streakDays > 0) {
      const streakEvent: SystemEvent = {
        id: `evt_streak_${Date.now()}`,
        type: "STREAK_AT_RISK",
        userId: ctx.userId,
        timestamp: nowIso,
        source: "scheduler",
        payload: {
          streakDays: ctx.streakDays,
          hoursUntilMidnight: 24 - currH,
          urgency: currH >= 22 ? "critical" : "medium",
        },
      };
      await this.eventBus.emit(streakEvent);
      emittedEvents.push(streakEvent);
    }

    // 3. Alerta de Enrage de Debt Bosses (Vencimiento en las próximas 48 horas)
    if (ctx.bossesEnrageDueDates && ctx.bossesEnrageDueDates.length > 0) {
      for (const boss of ctx.bossesEnrageDueDates) {
        const dueDate = new Date(boss.dueDate);
        const diffHours = (dueDate.getTime() - ctx.now.getTime()) / (1000 * 60 * 60);

        if (diffHours >= 0 && diffHours <= 48) {
          const enrageEvent: SystemEvent = {
            id: `evt_enrage_${boss.bossId}_${Date.now()}`,
            type: "BOSS_ENRAGE_WARNING",
            userId: ctx.userId,
            timestamp: nowIso,
            source: "scheduler",
            payload: {
              bossId: boss.bossId,
              bossName: boss.bossName,
              dueDate: boss.dueDate,
              hoursRemaining: Math.round(diffHours),
            },
          };
          await this.eventBus.emit(enrageEvent);
          emittedEvents.push(enrageEvent);
        }
      }
    }

    return emittedEvents;
  }
}

export const defaultCircadianScheduler = new CircadianScheduler();
