import type {
  PreferredSessionTime,
  SkillDomain,
  UserSkillConfig,
} from "../types/rpg";

export interface DailyScheduleConfig {
  wake_up_time: string; // ej. "06:00"
  sleep_time: string; // ej. "22:30"
  weekend_wake_up_time: string; // ej. "08:00"
  weekend_sleep_time: string; // ej. "23:30"
  work_days_pattern: "lun_vie" | "lun_sab" | "flexible";
  work_start_hour: string; // ej. "08:00"
  work_end_hour: string; // ej. "17:30"
  commute_and_meals_minutes: number; // ej. 45
  free_slot_preference: "after_work" | "before_work" | "mixed";
  weekday_free_minutes: number; // ej. 55
  weekend_free_minutes: number; // ej. 90
}

export const DEFAULT_DAILY_SCHEDULE_CONFIG: DailyScheduleConfig = {
  wake_up_time: "06:00",
  sleep_time: "22:30",
  weekend_wake_up_time: "08:00",
  weekend_sleep_time: "23:30",
  work_days_pattern: "lun_vie",
  work_start_hour: "08:00",
  work_end_hour: "17:30",
  commute_and_meals_minutes: 45,
  free_slot_preference: "mixed",
  weekday_free_minutes: 55,
  weekend_free_minutes: 90,
};

export interface ScheduledSkillBlock {
  domain: SkillDomain;
  label: string;
  minutes: number;
  timeRange: string;
  period: "manana" | "tarde" | "noche";
}

export interface TimelineSlot {
  icon: string;
  timeRange: string;
  title: string;
  kind: "wake" | "work" | "skill" | "rest" | "sleep";
  domain?: SkillDomain;
  minutes?: number;
}

export interface BioCalendarDayPlan {
  key: string;
  label: string;
  isWeekend: boolean;
  isWorkDay: boolean;
  wakeUpTime: string;
  sleepTime: string;
  sleepHours: number;
  awakeHours: number;
  morningAvailableMins: number;
  eveningAvailableMins: number;
  immovableBlock: string;
  freeWindowLabel: string;
  scheduled: ScheduledSkillBlock[];
  timeline: TimelineSlot[];
  totalDayMins: number;
  gpUnlocked: number;
}

export interface BioCalendarPlanResult {
  days: BioCalendarDayPlan[];
  weeklyMinutesByDomain: Record<string, number>;
  preferredTimeByDomain: Record<string, PreferredSessionTime>;
  weeklyGpTarget: number;
  sleepHoursWeekday: number;
  sleepHoursWeekend: number;
  awakeHoursWeekday: number;
  morningWindowMinsWeekday: number;
  eveningWindowMinsWeekday: number;
  sleepHealthStatus: {
    level: "optimal" | "warning" | "critical";
    label: string;
    recommendation: string;
  };
}

export function parseTimeToMinutes(hhmm: string, fallback = 360): number {
  const m = (hhmm || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mins = Math.min(59, Math.max(0, Number(m[2])));
  return h * 60 + mins;
}

export function formatMinutesToHHMM(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function computeBioCalendarPlan(params: {
  config: DailyScheduleConfig;
  skills: UserSkillConfig[];
  customSkillName?: string;
  vaultCap: number;
}): BioCalendarPlanResult {
  const config = {
    ...DEFAULT_DAILY_SCHEDULE_CONFIG,
    ...(params?.config || {}),
  };
  const skills = Array.isArray(params?.skills) ? params.skills.filter(Boolean) : [];
  const customSkillName = params?.customSkillName || "";
  const vaultCap = Math.max(100, Number(params?.vaultCap) || 400000);

  const wakeMin = parseTimeToMinutes(config.wake_up_time, 6 * 60);
  const sleepMinRaw = parseTimeToMinutes(config.sleep_time, 22 * 60 + 30);
  // Si se acuesta después de medianoche (ej. 00:30), ajustar respecto al despertar
  const sleepMin = sleepMinRaw <= wakeMin ? sleepMinRaw + 1440 : sleepMinRaw;

  const wkndWakeMin = parseTimeToMinutes(config.weekend_wake_up_time, 8 * 60);
  const wkndSleepRaw = parseTimeToMinutes(config.weekend_sleep_time, 23 * 60 + 30);
  const wkndSleepMin =
    wkndSleepRaw <= wkndWakeMin ? wkndSleepRaw + 1440 : wkndSleepRaw;

  const workStartMin = parseTimeToMinutes(config.work_start_hour, 8 * 60);
  const workEndMin = Math.max(
    workStartMin + 60,
    parseTimeToMinutes(config.work_end_hour, 17 * 60 + 30)
  );
  const commuteMins = Math.max(15, Number(config.commute_and_meals_minutes) || 45);

  const awakeMinsWeekday = Math.max(60, sleepMin - wakeMin);
  const sleepMinsWeekday = Math.max(0, 1440 - awakeMinsWeekday);
  const sleepHoursWeekday = Number((sleepMinsWeekday / 60).toFixed(1));
  const awakeHoursWeekday = Number((awakeMinsWeekday / 60).toFixed(1));

  const awakeMinsWeekend = Math.max(60, wkndSleepMin - wkndWakeMin);
  const sleepHoursWeekend = Number(((1440 - awakeMinsWeekend) / 60).toFixed(1));

  // Ventana matutina real: desde (Levantarse + 30m de aseo/desayuno) hasta (Inicio Trabajo - 15m)
  const morningStartMin = wakeMin + 30;
  const morningEndMin = workStartMin - 15;
  const morningWindowMinsWeekday = Math.max(0, morningEndMin - morningStartMin);

  // Ventana vespertina/nocturna real: desde (Fin Trabajo + traslado/cena) hasta (Acostarse - 30m de desconexión)
  const eveningStartMin = workEndMin + commuteMins;
  const eveningEndMin = sleepMin - 30;
  const eveningWindowMinsWeekday = Math.max(0, eveningEndMin - eveningStartMin);

  const sleepHealthStatus: BioCalendarPlanResult["sleepHealthStatus"] =
    sleepHoursWeekday >= 7 && sleepHoursWeekday <= 9
      ? {
          level: "optimal",
          label: `🟢 Sueño Reparador Óptimo (${sleepHoursWeekday}h/noche)`,
          recommendation:
            "Tu ventana biológica entre despertar y dormir protege tu energía cognitiva y evita el burnout.",
        }
      : sleepHoursWeekday >= 6
      ? {
          level: "warning",
          label: `🟡 Sueño Ajustado (${sleepHoursWeekday}h/noche)`,
          recommendation:
            "Considera adelantar tu hora de acostarte 30 minutos para mejorar retención en estudio y speedcubing.",
        }
      : {
          level: "critical",
          label: `🔴 Déficit de Sueño (${sleepHoursWeekday}h/noche)`,
          recommendation:
            "Estás durmiendo menos de 6 horas. El planificador redujo la carga nocturna para proteger tu descanso.",
        };

  const dayNames = [
    { key: "Lun", label: "Lunes", isWeekend: false },
    { key: "Mar", label: "Martes", isWeekend: false },
    { key: "Mié", label: "Miércoles", isWeekend: false },
    { key: "Jue", label: "Jueves", isWeekend: false },
    { key: "Vie", label: "Viernes", isWeekend: false },
    { key: "Sáb", label: "Sábado", isWeekend: true },
    { key: "Dom", label: "Domingo", isWeekend: true },
  ];

  const nonWorkSkills = skills.filter((s) => s.domain !== "work");
  const allRotatable: Array<{ domain: SkillDomain; label: string }> = [
    ...(nonWorkSkills.length > 0 ? nonWorkSkills : skills).map((s) => ({
      domain: s.domain,
      label: s.label,
    })),
    ...(customSkillName.trim()
      ? [
          {
            domain: "general" as SkillDomain,
            label: customSkillName.trim(),
          },
        ]
      : []),
  ];

  if (allRotatable.length === 0) {
    allRotatable.push({ domain: "rubik", label: "Cubos de Rubik" });
  }

  const weeklyGpTarget = Math.max(100, Math.round(vaultCap / 4));
  const gpPerDay = Math.max(25, Math.round(weeklyGpTarget / 7));

  const weeklyMinutesByDomain: Record<string, number> = {};
  const preferredTimeByDomain: Record<string, PreferredSessionTime> = {};

  const workDaysCount =
    config.work_days_pattern === "lun_sab"
      ? 6
      : config.work_days_pattern === "flexible"
      ? 4
      : 5;
  weeklyMinutesByDomain["work"] = workDaysCount * 60;
  preferredTimeByDomain["work"] = "manana";

  let cursor = 0;
  const days: BioCalendarDayPlan[] = dayNames.map((d, idx) => {
    const isWorkDay =
      config.work_days_pattern === "flexible"
        ? idx < 4
        : config.work_days_pattern === "lun_sab"
        ? idx < 6
        : !d.isWeekend;

    const dayWakeMin = d.isWeekend ? wkndWakeMin : wakeMin;
    const daySleepMin = d.isWeekend ? wkndSleepMin : sleepMin;
    const dayWakeStr = formatMinutesToHHMM(dayWakeMin);
    const daySleepStr = formatMinutesToHHMM(daySleepMin);

    const totalDayMins = isWorkDay
      ? Math.max(20, config.weekday_free_minutes)
      : Math.max(30, config.weekend_free_minutes);

    const firstSkill = allRotatable[cursor % allRotatable.length];
    cursor++;
    const secondSkill =
      allRotatable.length > 1
        ? allRotatable[cursor % allRotatable.length]
        : null;
    if (secondSkill && (!isWorkDay || totalDayMins >= 40)) {
      cursor++;
    }

    const canUseMorning =
      isWorkDay &&
      morningWindowMinsWeekday >= 25 &&
      (config.free_slot_preference === "before_work" ||
        config.free_slot_preference === "mixed");

    const scheduled: ScheduledSkillBlock[] = [];
    const timeline: TimelineSlot[] = [];

    // 1. Bloque Despertar
    timeline.push({
      icon: "☀️",
      timeRange: `${dayWakeStr} – ${formatMinutesToHHMM(dayWakeMin + 30)}`,
      title: "Levantarse, hidratación y desayuno",
      kind: "wake",
    });

    if (isWorkDay) {
      if (config.free_slot_preference === "before_work" && canUseMorning) {
        if (secondSkill && totalDayMins >= 40) {
          const m1 = Math.min(
            Math.round(totalDayMins * 0.55),
            Math.max(15, Math.floor(morningWindowMinsWeekday * 0.55))
          );
          const m2 = Math.min(
            Math.max(15, totalDayMins - m1),
            Math.max(15, morningWindowMinsWeekday - m1)
          );
          const s1Start = morningStartMin;
          const s1End = s1Start + m1;
          const s2Start = s1End + 5;
          const s2End = s2Start + m2;
          scheduled.push(
            {
              ...firstSkill,
              minutes: m1,
              timeRange: `${formatMinutesToHHMM(s1Start)} – ${formatMinutesToHHMM(s1End)}`,
              period: "manana",
            },
            {
              ...secondSkill,
              minutes: m2,
              timeRange: `${formatMinutesToHHMM(s2Start)} – ${formatMinutesToHHMM(s2End)}`,
              period: "manana",
            }
          );
        } else {
          const m1 = Math.min(totalDayMins, morningWindowMinsWeekday);
          scheduled.push({
            ...firstSkill,
            minutes: m1,
            timeRange: `${formatMinutesToHHMM(morningStartMin)} – ${formatMinutesToHHMM(
              morningStartMin + m1
            )}`,
            period: "manana",
          });
        }
      } else if (
        config.free_slot_preference === "mixed" &&
        canUseMorning &&
        secondSkill
      ) {
        const mMorning = Math.min(
          Math.round(totalDayMins * 0.45),
          morningWindowMinsWeekday
        );
        const mEvening = Math.max(15, totalDayMins - mMorning);
        scheduled.push(
          {
            ...firstSkill,
            minutes: mMorning,
            timeRange: `${formatMinutesToHHMM(morningStartMin)} – ${formatMinutesToHHMM(
              morningStartMin + mMorning
            )}`,
            period: "manana",
          },
          {
            ...secondSkill,
            minutes: mEvening,
            timeRange: `${formatMinutesToHHMM(eveningStartMin)} – ${formatMinutesToHHMM(
              eveningStartMin + mEvening
            )}`,
            period: "noche",
          }
        );
      } else {
        // Después del trabajo (Noche)
        if (secondSkill && totalDayMins >= 40) {
          const m1 = Math.round(totalDayMins * 0.55);
          const m2 = Math.max(15, totalDayMins - m1);
          const s1Start = eveningStartMin;
          const s1End = s1Start + m1;
          const s2Start = s1End + 10;
          const s2End = s2Start + m2;
          scheduled.push(
            {
              ...firstSkill,
              minutes: m1,
              timeRange: `${formatMinutesToHHMM(s1Start)} – ${formatMinutesToHHMM(s1End)}`,
              period: "noche",
            },
            {
              ...secondSkill,
              minutes: m2,
              timeRange: `${formatMinutesToHHMM(s2Start)} – ${formatMinutesToHHMM(s2End)}`,
              period: "noche",
            }
          );
        } else {
          scheduled.push({
            ...firstSkill,
            minutes: totalDayMins,
            timeRange: `${formatMinutesToHHMM(eveningStartMin)} – ${formatMinutesToHHMM(
              eveningStartMin + totalDayMins
            )}`,
            period: "noche",
          });
        }
      }

      // Poblar timeline en orden cronológico para día laboral
      for (const sb of scheduled.filter((s) => s.period === "manana")) {
        timeline.push({
          icon: "🌅",
          timeRange: sb.timeRange,
          title: `${sb.label} (${sb.minutes}m)`,
          kind: "skill",
          domain: sb.domain,
          minutes: sb.minutes,
        });
      }

      timeline.push({
        icon: "🔒",
        timeRange: `${config.work_start_hour} – ${config.work_end_hour}`,
        title: "Trabajo / Universidad (Bloque Inamovible)",
        kind: "work",
      });

      timeline.push({
        icon: "🍽️",
        timeRange: `${config.work_end_hour} – ${formatMinutesToHHMM(eveningStartMin)}`,
        title: "Traslado, cena y pausa activa",
        kind: "rest",
      });

      for (const sb of scheduled.filter((s) => s.period !== "manana")) {
        timeline.push({
          icon: "⚡",
          timeRange: sb.timeRange,
          title: `${sb.label} (${sb.minutes}m)`,
          kind: "skill",
          domain: sb.domain,
          minutes: sb.minutes,
        });
      }
    } else {
      // Día libre / Fin de semana (basado en weekend_wake_up_time)
      const wkndMorningSlot = dayWakeMin + 60; // 1h después de levantarse
      const wkndAfternoonSlot = Math.max(dayWakeMin + 360, 16 * 60); // Tarde ~16:00
      if (secondSkill) {
        const m1 = Math.round(totalDayMins * 0.55);
        const m2 = Math.max(20, totalDayMins - m1);
        scheduled.push(
          {
            ...firstSkill,
            minutes: m1,
            timeRange: `${formatMinutesToHHMM(wkndMorningSlot)} – ${formatMinutesToHHMM(
              wkndMorningSlot + m1
            )}`,
            period: "manana",
          },
          {
            ...secondSkill,
            minutes: m2,
            timeRange: `${formatMinutesToHHMM(wkndAfternoonSlot)} – ${formatMinutesToHHMM(
              wkndAfternoonSlot + m2
            )}`,
            period: "tarde",
          }
        );
      } else {
        scheduled.push({
          ...firstSkill,
          minutes: totalDayMins,
          timeRange: `${formatMinutesToHHMM(wkndMorningSlot)} – ${formatMinutesToHHMM(
            wkndMorningSlot + totalDayMins
          )}`,
          period: "manana",
        });
      }

      for (const sb of scheduled) {
        timeline.push({
          icon: sb.period === "manana" ? "🌅" : "⚡",
          timeRange: sb.timeRange,
          title: `${sb.label} (${sb.minutes}m)`,
          kind: "skill",
          domain: sb.domain,
          minutes: sb.minutes,
        });
      }
    }

    // Bloque Dormir
    timeline.push({
      icon: "🌙",
      timeRange: `${formatMinutesToHHMM(daySleepMin - 30)} – ${daySleepStr}`,
      title: `Desconexión y dormir (${
        d.isWeekend ? sleepHoursWeekend : sleepHoursWeekday
      }h de sueño)`,
      kind: "sleep",
    });

    for (const item of scheduled) {
      weeklyMinutesByDomain[item.domain] =
        (weeklyMinutesByDomain[item.domain] || 0) + item.minutes;
      preferredTimeByDomain[item.domain] = item.period;
    }

    const freeWindowLabel = isWorkDay
      ? scheduled.some((s) => s.period === "manana") &&
        scheduled.some((s) => s.period !== "manana")
        ? `Mixto: Mañana (${formatMinutesToHHMM(morningStartMin)}) + Noche (${formatMinutesToHHMM(
            eveningStartMin
          )})`
        : scheduled.every((s) => s.period === "manana")
        ? `Mañana antes de trabajar (${formatMinutesToHHMM(morningStartMin)} – ${config.work_start_hour})`
        : `Noche antes de dormir (${formatMinutesToHHMM(eveningStartMin)} – ${formatMinutesToHHMM(
            eveningEndMin
          )})`
      : `Día Libre (${dayWakeStr} a ${daySleepStr})`;

    return {
      key: d.key,
      label: d.label,
      isWeekend: d.isWeekend,
      isWorkDay,
      wakeUpTime: dayWakeStr,
      sleepTime: daySleepStr,
      sleepHours: d.isWeekend ? sleepHoursWeekend : sleepHoursWeekday,
      awakeHours: d.isWeekend
        ? Number((awakeMinsWeekend / 60).toFixed(1))
        : awakeHoursWeekday,
      morningAvailableMins: isWorkDay ? morningWindowMinsWeekday : 180,
      eveningAvailableMins: isWorkDay ? eveningWindowMinsWeekday : 240,
      immovableBlock: isWorkDay
        ? `🔒 ${config.work_start_hour} – ${config.work_end_hour} · Trabajo / Estudio`
        : "🌿 Fin de Semana / Sin bloque laboral fijo",
      freeWindowLabel,
      scheduled,
      timeline,
      totalDayMins,
      gpUnlocked: gpPerDay,
    };
  });

  return {
    days,
    weeklyMinutesByDomain,
    preferredTimeByDomain,
    weeklyGpTarget,
    sleepHoursWeekday,
    sleepHoursWeekend,
    awakeHoursWeekday,
    morningWindowMinsWeekday,
    eveningWindowMinsWeekday,
    sleepHealthStatus,
  };
}
