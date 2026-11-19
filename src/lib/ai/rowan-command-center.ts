/**
 * ============================================================================
 * OAKHAVEN AI FASE 7 — ROWAN 2.0: ORQUESTACIÓN, MEMORIA CONTEXTUAL Y PLANES
 * ============================================================================
 * - Coordina los 8 especialistas sin duplicar motores ni ampliar privilegios.
 * - NUNCA consulta Banco (`banco_oakhaven`) para planes recreativos, estudio o día libre.
 * - Clasifica explícitamente cada ítem de memoria:
 *   `recorded_fact` | `derived_summary` | `local_unverified` | `ai_suggestion`.
 * - Cero castigos por inactividad y cero efectos secundarios sobre GP/XP/COP.
 */

import type { MayorToolContext } from "./mayor-readonly-tools.ts";
import { getActiveWorkProjects, getReadingBooks } from "./aura-eldrin-tools.ts";
import { getActiveCrochetProjects, getActiveStudySubjects } from "./clara-lyra-tools.ts";
import { getCinemaCollection } from "./nora-silas-tools.ts";
import { getCubeSolveHistory, getLastRealWorkout } from "./bruno-milo-tools.ts";

export type ProposalLifecycleStatus =
  | "pending"
  | "confirmed"
  | "applied"
  | "rejected"
  | "failed";

export type MemoryFactKind =
  | "recorded_fact"
  | "derived_summary"
  | "local_unverified"
  | "ai_suggestion";

export interface ContextualMemoryItem {
  buildingId: string;
  specialistName: string;
  kind: MemoryFactKind;
  summary: string;
  source: string;
  date?: string | null;
}

export type DailyPlanMode =
  | "mi_dia"
  | "que_retomar"
  | "mi_semana"
  | "siguientes_pasos"
  | "mi_descanso";

export function detectDailyPlanIntent(question: string): DailyPlanMode | null {
  const q = (question || "").toLowerCase();
  if (/(hora libre|qu[eé] hago hoy|mi d[ií]a|plan de hoy|aprovechar.*hora)/i.test(q)) {
    return "mi_dia";
  }
  if (/(retomar|abandon[eé]|hace m[aá]s tiempo|llevo tiempo sin)/i.test(q)) {
    return "que_retomar";
  }
  if (/(qu[eé] hice ayer|mi semana|[uú]ltimamente|qu[eé] aprend[ií] esta semana|resumen semanal)/i.test(q)) {
    return "mi_semana";
  }
  if (/(siguiente paso|siguientes pasos|qu[eé] tengo pendiente)/i.test(q)) {
    return "siguientes_pasos";
  }
  if (/(descanso|relajarme|ocio|tiempo libre sin presi[oó]n)/i.test(q)) {
    return "mi_descanso";
  }
  return null;
}

/**
 * Construye una memoria contextual resumida a partir de registros verificados
 * de edificios NO financieros (Trabajo, Estudio, Lectura, Crochet, Gym, Cubos, Cine).
 */
export async function buildOakHavenContextualMemory(ctx: MayorToolContext): Promise<{
  items: ContextualMemoryItem[];
  buildingIds: string[];
}> {
  const items: ContextualMemoryItem[] = [];
  const buildingIds = new Set<string>();

  const [work, study, reading, crochet, cinema, workout, cubes] = await Promise.all([
    getActiveWorkProjects(ctx),
    getActiveStudySubjects(ctx),
    getReadingBooks(ctx),
    getActiveCrochetProjects(ctx),
    getCinemaCollection(ctx),
    getLastRealWorkout(ctx),
    getCubeSolveHistory(ctx, "3x3"),
  ]);

  if (work.projects.length > 0) {
    const p = work.projects[0];
    buildingIds.add("oficina");
    items.push({
      buildingId: "oficina",
      specialistName: "Aura",
      kind: "recorded_fact",
      summary: `Proyecto real en Trabajo: "${p.name}" (${p.pendingTasks} tarea(s) pendiente(s)).`,
      source: work.source,
      date: p.createdAt,
    });
  }

  if (study.dueCardsCount > 0 || study.subjects.length > 0) {
    buildingIds.add("biblioteca");
    items.push({
      buildingId: "biblioteca",
      specialistName: "Lyra",
      kind: "recorded_fact",
      summary: `Estudio: ${study.dueCardsCount} tarjeta(s) SM-2 para repasar${study.subjects.length > 0 ? ` • Materias: ${study.subjects.slice(0, 2).join(", ")}` : ""}.`,
      source: study.source,
    });
  }

  if (reading.currentlyReading.length > 0) {
    const b = reading.currentlyReading[0];
    buildingIds.add("libreria");
    items.push({
      buildingId: "libreria",
      specialistName: "Eldrin",
      kind: "recorded_fact",
      summary: `Lectura en curso: "${b.title}" (${b.pages_read}/${b.total_pages} págs.).`,
      source: reading.source,
    });
  } else if (reading.wishlistBooks.length > 0) {
    buildingIds.add("libreria");
    items.push({
      buildingId: "libreria",
      specialistName: "Eldrin",
      kind: "recorded_fact",
      summary: `Libro pendiente en tu wishlist: "${reading.wishlistBooks[0].title}".`,
      source: reading.source,
    });
  }

  if (crochet.projects.length > 0) {
    const k = crochet.projects[0] as { name?: string; completed_rows?: number; total_rows_target?: number };
    buildingIds.add("atelier");
    items.push({
      buildingId: "atelier",
      specialistName: "Clara",
      kind: "recorded_fact",
      summary: `Crochet activo: "${k.name || "Proyecto"}" (${k.completed_rows || 0}/${k.total_rows_target || "?"} vueltas).`,
      source: crochet.source,
    });
  }

  if (cinema.watching.length > 0 || cinema.watchlist.length > 0) {
    buildingIds.add("cine");
    const c = cinema.watching[0] || cinema.watchlist[0];
    items.push({
      buildingId: "cine",
      specialistName: "Nora",
      kind: cinema.source === "local_device_snapshot" ? "local_unverified" : "recorded_fact",
      summary:
        cinema.watching.length > 0
          ? `Cine (viendo): "${c.title}"`
          : `Cine (watchlist pendiente): "${c.title}"`,
      source: cinema.source,
      date: c.updatedAt,
    });
  }

  if (workout.lastWorkout) {
    buildingIds.add("gimnasio");
    items.push({
      buildingId: "gimnasio",
      specialistName: "Bruno",
      kind: "recorded_fact",
      summary: `Último entrenamiento: "${workout.lastWorkout.title}" (${workout.lastWorkout.duration_minutes} min).`,
      source: workout.source,
      date: String(workout.lastWorkout.completed_at || ""),
    });
  }

  if (cubes.stats.totalSolves > 0) {
    buildingIds.add("club_puzzles");
    items.push({
      buildingId: "club_puzzles",
      specialistName: "Milo",
      kind: "recorded_fact",
      summary: `Cubos 3x3: ${cubes.stats.totalSolves} solves reales (PB: ${cubes.stats.pbSeconds}s).`,
      source: cubes.source,
    });
  }

  return {
    items,
    buildingIds: Array.from(buildingIds),
  };
}

export async function buildRowanDailyPlan(
  ctx: MayorToolContext,
  mode: DailyPlanMode
): Promise<{
  answer: string;
  buildingIds: string[];
  itemsCount: number;
}> {
  const memory = await buildOakHavenContextualMemory(ctx);
  const titles: Record<DailyPlanMode, string> = {
    mi_dia: "🏛️ **MI DÍA — Opciones basadas en tus registros reales**",
    que_retomar: "🌱 **QUÉ RETOMAR (sin presión ni castigos por pausas)**",
    mi_semana: "📅 **RESUMEN RECIENTE DEL PUEBLO (sin datos financieros)**",
    siguientes_pasos: "🧭 **TUS SIGUIENTES PASOS DISPONIBLES**",
    mi_descanso: "☕ **MI DESCANSO — Opciones tranquilas de ocio**",
  };

  let selected = memory.items;
  if (mode === "mi_descanso") {
    selected = memory.items.filter((i) => ["libreria", "atelier", "cine", "club_puzzles"].includes(i.buildingId));
  }

  if (selected.length === 0) {
    return {
      answer:
        `${titles[mode]}\n` +
        "Todavía no hay registros activos suficientes en tus edificios para armar recomendaciones personalizadas. " +
        "*(Sugerencia opcional: entra a cualquier edificio y registra un libro, proyecto o sesión cuando quieras).* ",
      buildingIds: ["oficina", "biblioteca", "libreria"],
      itemsCount: 0,
    };
  }

  const lines = selected.slice(0, 5).map(
    (item) =>
      `• **[${item.specialistName} • ${item.kind === "local_unverified" ? "Navegador local" : "Hecho registrado"}]** ${item.summary}`
  );
  lines.push(
    "\n💡 *Sugerencia de IA (opcional):* Elige solo lo que te apetezca hoy; OakHaven no penaliza pausas y no creará sesiones ni alterará GP/XP automáticamente."
  );

  return {
    answer: `${titles[mode]}\n${lines.join("\n")}`,
    buildingIds: Array.from(new Set(selected.map((s) => s.buildingId))),
    itemsCount: selected.length,
  };
}
