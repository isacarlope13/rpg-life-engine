export interface AdaptiveRoutineConfig {
  wakeTime: string; // "07:00"
  sleepTime: string; // "23:00"
  workStart: string; // "08:00"
  workEnd: string; // "17:00"
  timezone: string; // "America/Bogota"
  lunchStart?: string; // "12:30"
  lunchEnd?: string; // "13:30"
}

export interface ScheduleBlock {
  id: string;
  start: string;
  end: string;
  durationMinutes: number;
  kind: "work_mandatory" | "protected_meal" | "protected_rest" | "flexible_free";
  status: "confirmed" | "estimated";
  label: string;
}

export interface MicroActivitySuggestion {
  areaId: string;
  specialist: string;
  title: string;
  estimatedMinutes: number;
  reason: string;
  requiresConfirmation: true;
  autoStarted: false;
}

export interface AdaptiveDayPlan {
  timezone: string;
  generatedAt: string;
  availabilityNotice: string;
  blocks: ScheduleBlock[];
  totalProtectedRestMinutes: number;
  totalFlexibleMinutes: number;
  rescheduledNotice?: string;
}

function toMinutes(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  return Math.min(24 * 60, Math.max(0, Number(m[1]) * 60 + Number(m[2])));
}

function toHHMM(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * HITO 5: Construye un plan diario adaptable que:
 * 1. Protege sueño, comidas y pausas activas.
 * 2. Distingue trabajo obligatorio de tiempo flexible.
 * 3. Diferencia bloques confirmados de estimaciones.
 * 4. Nunca afirma conocer disponibilidad en tiempo real sin confirmación del usuario.
 */
export function buildAdaptiveDayPlan(
  routine: AdaptiveRoutineConfig,
  options?: {
    confirmedBusyBlocks?: Array<{ start: string; end: string; label: string }>;
    unfinishedTasksCount?: number;
  }
): AdaptiveDayPlan {
  const wake = toMinutes(routine.wakeTime, 7 * 60);
  const workStart = toMinutes(routine.workStart, 8 * 60);
  const lunchStart = toMinutes(routine.lunchStart || "12:30", 12 * 60 + 30);
  const lunchEnd = toMinutes(routine.lunchEnd || "13:30", 13 * 60 + 30);
  const workEnd = toMinutes(routine.workEnd, 17 * 60);
  const sleep = toMinutes(routine.sleepTime, 23 * 60);

  const blocks: ScheduleBlock[] = [];

  if (workStart > wake) {
    blocks.push({
      id: "morning-prep",
      start: toHHMM(wake),
      end: toHHMM(workStart),
      durationMinutes: workStart - wake,
      kind: "protected_rest",
      status: "estimated",
      label: "Despertar, desayuno y arranque tranquilo",
    });
  }

  if (lunchStart > workStart) {
    blocks.push({
      id: "work-am",
      start: toHHMM(workStart),
      end: toHHMM(lunchStart),
      durationMinutes: lunchStart - workStart,
      kind: "work_mandatory",
      status: "confirmed",
      label: "Jornada laboral (mañana — espacios libres opcionales)",
    });
  }

  if (lunchEnd > lunchStart) {
    blocks.push({
      id: "lunch-protected",
      start: toHHMM(lunchStart),
      end: toHHMM(lunchEnd),
      durationMinutes: lunchEnd - lunchStart,
      kind: "protected_meal",
      status: "confirmed",
      label: "Almuerzo y descanso protegido",
    });
  }

  if (workEnd > lunchEnd) {
    blocks.push({
      id: "work-pm",
      start: toHHMM(lunchEnd),
      end: toHHMM(workEnd),
      durationMinutes: workEnd - lunchEnd,
      kind: "work_mandatory",
      status: "confirmed",
      label: "Jornada laboral (tarde — espacios libres opcionales)",
    });
  }

  const eveningBufferEnd = Math.min(sleep, workEnd + 30);
  if (eveningBufferEnd > workEnd) {
    blocks.push({
      id: "post-work-rest",
      start: toHHMM(workEnd),
      end: toHHMM(eveningBufferEnd),
      durationMinutes: eveningBufferEnd - workEnd,
      kind: "protected_rest",
      status: "estimated",
      label: "Transición y descanso post-trabajo",
    });
  }

  const windDownStart = Math.max(eveningBufferEnd, sleep - 60);
  if (windDownStart > eveningBufferEnd) {
    blocks.push({
      id: "evening-flexible",
      start: toHHMM(eveningBufferEnd),
      end: toHHMM(windDownStart),
      durationMinutes: windDownStart - eveningBufferEnd,
      kind: "flexible_free",
      status: "estimated",
      label: "Bloque flexible personal (Gym, Estudio, Lectura, Crochet, Cine)",
    });
  }

  if (sleep > windDownStart) {
    blocks.push({
      id: "night-winddown",
      start: toHHMM(windDownStart),
      end: toHHMM(sleep),
      durationMinutes: sleep - windDownStart,
      kind: "protected_rest",
      status: "estimated",
      label: "Cierre sereno, Journaling y descanso nocturno",
    });
  }

  const totalProtectedRestMinutes = blocks
    .filter((b) => b.kind === "protected_meal" || b.kind === "protected_rest")
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  const totalFlexibleMinutes = blocks
    .filter((b) => b.kind === "flexible_free")
    .reduce((sum, b) => sum + b.durationMinutes, 0);

  const unfinished = options?.unfinishedTasksCount || 0;
  return {
    timezone: routine.timezone || "America/Bogota",
    generatedAt: new Date().toISOString(),
    availabilityNotice:
      "Plan estimado a partir de tu rutina declarada; OakHaven no asume tu disponibilidad en tiempo real sin tu confirmación.",
    blocks,
    totalProtectedRestMinutes,
    totalFlexibleMinutes,
    rescheduledNotice:
      unfinished > 0
        ? `${unfinished} ${unfinished === 1 ? "actividad pendiente puede" : "actividades pendientes pueden"} reprogramarse suavemente sin sobrecargar tu jornada.`
        : undefined,
  };
}

/**
 * Recomienda micro-actividades realistas para un espacio libre (ej. 20 o 30 minutos).
 * Nunca inicia actividades automáticamente; siempre requiere confirmación del usuario.
 */
export function recommendFreeSlotActivities(params: {
  availableMinutes: number;
  enabledAreaIds: string[];
  preferLowEnergy?: boolean;
}): MicroActivitySuggestion[] {
  const mins = Math.max(5, Math.min(180, Math.round(params.availableMinutes)));
  const enabled = new Set(params.enabledAreaIds);
  const suggestions: MicroActivitySuggestion[] = [];

  if (mins <= 25) {
    if (enabled.has("rubik")) {
      suggestions.push({
        areaId: "rubik",
        specialist: "Milo",
        title: `Práctica breve de Cubos (${Math.min(mins, 15)} min / Ao5)`,
        estimatedMinutes: Math.min(mins, 15),
        reason: "Encaja perfecto en una pausa corta y despeja la mente sin fatiga.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
    if (enabled.has("reading")) {
      suggestions.push({
        areaId: "reading",
        specialist: "Eldrin",
        title: `Lectura enfocada (${Math.min(mins, 20)} min)`,
        estimatedMinutes: Math.min(mins, 20),
        reason: "Avanza páginas reales sin necesidad de abrir un bloque largo.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
    if (enabled.has("crochet")) {
      suggestions.push({
        areaId: "crochet",
        specialist: "Clara",
        title: `Pausa creativa de Crochet (${Math.min(mins, 20)} min)`,
        estimatedMinutes: Math.min(mins, 20),
        reason: "Descanso activo de baja carga cognitiva durante la jornada.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
  } else {
    if (!params.preferLowEnergy && enabled.has("study")) {
      suggestions.push({
        areaId: "study",
        specialist: "Lyra",
        title: `Bloque Pomodoro de Estudio (${Math.min(mins, 25)} min)`,
        estimatedMinutes: Math.min(mins, 25),
        reason: "Aprovecha el bloque libre para avanzar un tema prioritario con repaso activo.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
    if (enabled.has("reading")) {
      suggestions.push({
        areaId: "reading",
        specialist: "Eldrin",
        title: `Sesión de Lectura (${Math.min(mins, 30)} min)`,
        estimatedMinutes: Math.min(mins, 30),
        reason: "Avance constante y sereno en tu libro activo.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
    if (enabled.has("journaling")) {
      suggestions.push({
        areaId: "journaling",
        specialist: "Rowan",
        title: `Nota breve de Journaling (${Math.min(mins, 15)} min)`,
        estimatedMinutes: Math.min(mins, 15),
        reason: "Ordena prioridades y protege tu energía antes de retomar tareas.",
        requiresConfirmation: true,
        autoStarted: false,
      });
    }
  }

  return suggestions.slice(0, 3);
}
