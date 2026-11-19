/**
 * ============================================================================
 * OAKHAVEN AI FASE 5 — HERRAMIENTAS ACTIVAS DE BRUNO (GYM) Y MILO (CUBOS)
 * ============================================================================
 * REGLAS DE SEGURIDAD Y VERACIDAD:
 * 1. Todas las métricas numéricas (tonelaje, RPE, PB, Ao5, Ao12, +2, DNF) se
 *    calculan de forma 100% determinista en servidor (nunca inventadas por LLM).
 * 2. Bruno excluye estrictamente series de ejemplo (`isDemo`, `demo-set-*`).
 *    No diagnostica lesiones ni prescribe cargas extremas ni penaliza descansos.
 * 3. Milo respeta las reglas oficiales WCA (Art. 9f) para Ao5/Ao12 y penalizaciones
 *    (+2 y DNF), separa estrictamente por `cube_type` y nunca aplica algoritmos de
 *    3x3 automáticamente a otros puzzles.
 * 4. Propuestas Nivel 2 llevan `requiresConfirmation: true` e `idempotencyKey`.
 */

import crypto from "node:crypto";
import type { MayorToolContext } from "./mayor-readonly-tools.ts";
import {
  getResourceExtractedText,
  listBuildingResources,
  type ResourceQueryContext,
} from "./resource-query-tools.ts";
import type { SpecialistProposal } from "./specialist-engine.ts";
import type { GymSetRecord } from "../sanctuary/gym-engine.ts";
import type { RubikCubeType, RubikPenalty, RubikSolveEntry } from "../../types/rpg.ts";

function makeIdempotencyKey(prefix: string, parts: string[]): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${prefix}:${parts.join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${hash}`;
}

// ============================================================================
// BRUNO — ENTRENADOR INTELIGENTE DE GYM (`gimnasio` / `sports`)
// ============================================================================

export function isDemoGymSet(set: GymSetRecord): boolean {
  if (set.isDemo === true) return true;
  if (set.dataOrigin === "demo_template") return true;
  const id = String(set.id || "").toLowerCase();
  return id.startsWith("demo-");
}

export function filterRealGymSets(sets: GymSetRecord[] = []): {
  realSets: GymSetRecord[];
  excludedDemoCount: number;
} {
  const realSets = sets.filter((s) => !isDemoGymSet(s));
  return {
    realSets,
    excludedDemoCount: sets.length - realSets.length,
  };
}

export interface GymVolumeSummary {
  completedSetsCount: number;
  totalVolumeKg: number;
  averageRpe: number | null;
  byExercise: Record<
    string,
    {
      sets: number;
      volumeKg: number;
      maxWeightKg: number;
      lastWeightKg: number;
      lastReps: number;
    }
  >;
}

export function calculateTrainingVolume(sets: GymSetRecord[]): GymVolumeSummary {
  const { realSets } = filterRealGymSets(sets);
  const completed = realSets.filter((s) => s.completed);
  let totalVolumeKg = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  const byExercise: GymVolumeSummary["byExercise"] = {};

  for (const s of completed) {
    const reps = Math.max(0, Number(s.reps) || 0);
    const weight = Math.max(0, Number(s.weightKg) || 0);
    const vol = reps * weight;
    totalVolumeKg += vol;
    if (Number.isFinite(s.rpe) && s.rpe > 0) {
      rpeSum += s.rpe;
      rpeCount += 1;
    }
    const name = s.exerciseName || "Ejercicio";
    if (!byExercise[name]) {
      byExercise[name] = {
        sets: 0,
        volumeKg: 0,
        maxWeightKg: 0,
        lastWeightKg: weight,
        lastReps: reps,
      };
    }
    byExercise[name].sets += 1;
    byExercise[name].volumeKg += vol;
    if (weight > byExercise[name].maxWeightKg) byExercise[name].maxWeightKg = weight;
    byExercise[name].lastWeightKg = weight;
    byExercise[name].lastReps = reps;
  }

  return {
    completedSetsCount: completed.length,
    totalVolumeKg: Math.round(totalVolumeKg * 100) / 100,
    averageRpe: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : null,
    byExercise,
  };
}

export function getGymPersonalRecords(sets: GymSetRecord[]) {
  const vol = calculateTrainingVolume(sets);
  return Object.entries(vol.byExercise).map(([exerciseName, stats]) => ({
    exerciseName,
    maxWeightKg: stats.maxWeightKg,
    totalVolumeKg: stats.volumeKg,
    lastWeightKg: stats.lastWeightKg,
    lastReps: stats.lastReps,
  }));
}

export function detectMedicalOrInjuryQuery(question: string): string | null {
  if (
    /(dolor agudo|lesi[oó]n|lesion[eé]|desgarro|fractura|esguince|mareo|dolor en el pecho|diagn[oó]stic|inflamaci[oó]n severa|me duele mucho)/i.test(
      question
    )
  ) {
    return (
      "🩺 **Aviso de seguridad deportiva:** Soy Bruno, tu compañero de entrenamiento, **no un médico ni fisioterapeuta**. " +
      "No puedo diagnosticar lesiones ni interpretar síntomas físicos. Si sientes dolor agudo, mareos o sospechas una lesión, " +
      "detén la carga, descansa sin culpa y consulta con un profesional de la salud antes de retomar el esfuerzo."
    );
  }
  return null;
}

export async function getLastRealWorkout(ctx: MayorToolContext) {
  const localSets = ctx.localSnapshot?.gymSets || [];
  const { realSets, excludedDemoCount } = filterRealGymSets(localSets);
  let volume = calculateTrainingVolume(realSets);
  let setsSource: "supabase" | "local_device_snapshot" | "none" =
    realSets.length > 0 ? "local_device_snapshot" : "none";

  if (ctx.isSupabaseConfigured && ctx.db) {
    const [{ data, error }, { data: dbSets, error: setsErr }] = await Promise.all([
      ctx.db
        .from("activity_logs")
        .select("id, title, duration_minutes, notes, completed_at")
        .eq("user_id", ctx.authenticatedUserId)
        .eq("domain", "sports")
        .order("completed_at", { ascending: false })
        .limit(10),
      ctx.db
        .from("gym_workout_sets")
        .select("id, client_id, exercise_name, set_number, reps, weight_kg, rpe, completed")
        .eq("user_id", ctx.authenticatedUserId)
        .is("deleted_at", null)
        .order("performed_at", { ascending: false })
        .limit(40),
    ]);

    if (!setsErr && Array.isArray(dbSets) && dbSets.length > 0) {
      const mappedDbSets: GymSetRecord[] = dbSets.map((s) => ({
        id: String(s.client_id || s.id),
        exerciseName: String(s.exercise_name),
        setNumber: Number(s.set_number || 1),
        reps: Number(s.reps || 0),
        weightKg: Number(s.weight_kg || 0),
        rpe: Number(s.rpe || 7),
        completed: Boolean(s.completed),
        dataOrigin: "real_synced",
      }));
      volume = calculateTrainingVolume(mappedDbSets);
      setsSource = "supabase";
    }

    if (!error && Array.isArray(data)) {
      return {
        source: "supabase" as const,
        setsSource,
        lastWorkout: data[0] || null,
        recentCount: data.length,
        realSetsVolume: volume,
        excludedDemoCount,
      };
    }
  }

  const workouts = [...(ctx.store.skillSessions || [])]
    .filter((s) => s.domain === "sports")
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));

  return {
    source: "memory_store" as const,
    setsSource,
    lastWorkout: workouts[0]
      ? {
          id: workouts[0].id,
          title: workouts[0].title,
          duration_minutes: workouts[0].duration_minutes,
          notes: workouts[0].details || "",
          completed_at: workouts[0].timestamp,
        }
      : null,
    recentCount: workouts.length,
    realSetsVolume: volume,
    excludedDemoCount,
  };
}

export async function getTrainingConsistency(ctx: MayorToolContext, days = 14) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const info = await getLastRealWorkout(ctx);
  const lastTs = info.lastWorkout ? Date.parse(String(info.lastWorkout.completed_at || "")) : NaN;
  const daysSinceLast = Number.isFinite(lastTs)
    ? Math.max(0, Math.floor((Date.now() - lastTs) / (24 * 60 * 60 * 1000)))
    : null;

  let sessionsInWindow = 0;
  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data } = await ctx.db
      .from("activity_logs")
      .select("id")
      .eq("user_id", ctx.authenticatedUserId)
      .eq("domain", "sports")
      .gte("completed_at", new Date(cutoff).toISOString());
    sessionsInWindow = (data || []).length;
  } else {
    sessionsInWindow = (ctx.store.skillSessions || []).filter(
      (s) => s.domain === "sports" && (Date.parse(s.timestamp) || 0) >= cutoff
    ).length;
  }

  return {
    windowDays: days,
    sessionsInWindow,
    daysSinceLast,
    restNote:
      daysSinceLast !== null && daysSinceLast >= 4
        ? `Llevas ${daysSinceLast} días de descanso — en OakHaven descansar no tiene penalización; retoma con una carga cómoda y gradual.`
        : null,
  };
}

export async function listGymResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "gimnasio", "oakhaven.specialist.gym.bruno");
}

export async function readWorkoutPlan(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.gym.bruno");
}

export function proposeNextWorkout(params: {
  focus: string;
  lastExercise?: string;
  lastWeightKg?: number;
  lastReps?: number;
}): SpecialistProposal {
  const progressionNote =
    params.lastExercise && params.lastWeightKg
      ? `Basado en tu último registro (${params.lastExercise}: ${params.lastWeightKg} kg x ${params.lastReps || 8} reps), sugiere mantener técnica limpia o una progresión conservadora (+1 a +2 reps o +1–2.5 kg solo si RPE <= 8).`
      : "Sin series previas registradas: inicia con carga ligera/moderada (RPE 6–7) y 60–90 s de descanso entre series.";

  return {
    id: `prop-gym-routine-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("gym-routine", [params.focus.toLowerCase(), params.lastExercise || "base"]),
    buildingId: "gimnasio",
    specialistName: "Bruno",
    actionType: "plan_gym_routine",
    title: `Guardar propuesta de rutina: ${params.focus.slice(0, 60)}`,
    summary: "Se guardará como plan en tu Pizarra de Rutinas (`building_resources`) al confirmar. Nunca altera GP ni XP.",
    payload: {
      buildingId: "gimnasio",
      resourceType: "workout_plan",
      title: `Rutina sugerida: ${params.focus.slice(0, 60)}`,
      filename: `rutina-${params.focus.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}.md`,
      mimeType: "text/markdown",
      rawTextContent: `# Propuesta de Entrenamiento — ${params.focus}\n\n${progressionNote}\n\n## Estructura sugerida\n- Calentamiento articular: 5 min\n- Bloque principal: 3 series controladas (RPE 7–8, descanso 90 s)\n- Vuelta a la calma y estiramiento suave: 5 min\n\n*Nota: Sugerencia orientativa, no prescripción médica.*`,
    },
    requiresConfirmation: true,
  };
}

// ============================================================================
// MILO — ENTRENADOR DE SPEEDCUBING WCA (`club_puzzles` / `rubik`)
// ============================================================================

export function getEffectiveSolveSeconds(solve: {
  time_seconds: number;
  penalty?: RubikPenalty | string | null;
}): number | null {
  const pen = String(solve.penalty || "NONE").toUpperCase();
  if (pen === "DNF") return null;
  const raw = Number(solve.time_seconds);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return pen === "+2" ? Math.round((raw + 2) * 100) / 100 : Math.round(raw * 100) / 100;
}

export interface WcaAverageResult {
  windowSize: 5 | 12;
  status: "valid" | "dnf" | "insufficient_solves";
  averageSeconds: number | null;
  haveSolves: number;
  dnfCount: number;
}

/**
 * Cálculo de promedios recortados de speedcubing:
 * - Ao5 (formato oficial WCA, Art. 9f): últimos 5 solves del MISMO tipo de cubo. Elimina 1 mejor y 1 peor. >=2 DNF => DNF.
 * - Ao12 (estadística de entrenamiento, NO formato oficial de competencia WCA): últimos 12 solves del MISMO tipo de cubo. Elimina 1 mejor y 1 peor. >=2 DNF => DNF.
 */
export function calculateWcaAverage(
  solvesSameCubeDesc: Array<{ time_seconds: number; penalty?: RubikPenalty | string | null }>,
  windowSize: 5 | 12
): WcaAverageResult {
  if (solvesSameCubeDesc.length < windowSize) {
    return {
      windowSize,
      status: "insufficient_solves",
      averageSeconds: null,
      haveSolves: solvesSameCubeDesc.length,
      dnfCount: 0,
    };
  }

  const slice = solvesSameCubeDesc.slice(0, windowSize);
  const numericValues: number[] = [];
  let dnfCount = 0;

  for (const s of slice) {
    const eff = getEffectiveSolveSeconds(s);
    if (eff === null) {
      dnfCount += 1;
      numericValues.push(Number.POSITIVE_INFINITY);
    } else {
      numericValues.push(eff);
    }
  }

  if (dnfCount >= 2) {
    return {
      windowSize,
      status: "dnf",
      averageSeconds: null,
      haveSolves: windowSize,
      dnfCount,
    };
  }

  numericValues.sort((a, b) => a - b);
  // Eliminar exactamente 1 mejor (índice 0) y 1 peor (último índice; incluye el único DNF si hubo 1)
  const trimmed = numericValues.slice(1, windowSize - 1);
  const sum = trimmed.reduce((acc, v) => acc + v, 0);
  const avg = Math.round((sum / trimmed.length) * 100) / 100;

  return {
    windowSize,
    status: "valid",
    averageSeconds: avg,
    haveSolves: windowSize,
    dnfCount,
  };
}

export function calculateCubeStatsForType(
  allSolves: Array<{
    cube_type: string;
    time_seconds: number;
    penalty?: RubikPenalty | string | null;
    algorithm_practiced?: string;
    timestamp?: string;
    created_at?: string;
  }>,
  cubeType: RubikCubeType
) {
  const filtered = [...allSolves]
    .filter((s) => s.cube_type === cubeType)
    .sort(
      (a, b) =>
        (Date.parse(b.timestamp || b.created_at || "") || 0) -
        (Date.parse(a.timestamp || a.created_at || "") || 0)
    );

  const validTimes = filtered
    .map((s) => getEffectiveSolveSeconds(s))
    .filter((v): v is number => v !== null);

  const pbSeconds = validTimes.length > 0 ? Math.min(...validTimes) : null;
  const meanSeconds =
    validTimes.length > 0
      ? Math.round((validTimes.reduce((a, b) => a + b, 0) / validTimes.length) * 100) / 100
      : null;

  let stdDevSeconds: number | null = null;
  if (validTimes.length >= 2 && meanSeconds !== null) {
    const variance =
      validTimes.reduce((acc, t) => acc + (t - meanSeconds) ** 2, 0) / validTimes.length;
    stdDevSeconds = Math.round(Math.sqrt(variance) * 100) / 100;
  }

  const ao5 = calculateWcaAverage(filtered, 5);
  const ao12 = calculateWcaAverage(filtered, 12);
  const lastPracticedAlgorithm =
    filtered.find((s) => typeof s.algorithm_practiced === "string" && s.algorithm_practiced.trim().length > 0)
      ?.algorithm_practiced || null;

  return {
    cubeType,
    totalSolves: filtered.length,
    validSolvesCount: validTimes.length,
    dnfCount: filtered.length - validTimes.length,
    pbSeconds,
    meanSeconds,
    stdDevSeconds,
    ao5,
    ao12,
    lastSolve: filtered[0] || null,
    lastPracticedAlgorithm,
  };
}

export async function getCubeSolveHistory(ctx: MayorToolContext, cubeType: RubikCubeType = "3x3") {
  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data, error } = await ctx.db
      .from("rubik_solves")
      .select("id, cube_type, time_seconds, penalty, is_pb, created_at")
      .eq("user_id", ctx.authenticatedUserId)
      .eq("cube_type", cubeType)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && Array.isArray(data)) {
      return {
        source: "supabase" as const,
        stats: calculateCubeStatsForType(data, cubeType),
      };
    }
  }

  const solves = (ctx.store.rubikSolves || []) as RubikSolveEntry[];
  return {
    source: "memory_store" as const,
    stats: calculateCubeStatsForType(solves, cubeType),
  };
}

export async function getRegisteredCubes(ctx: MayorToolContext) {
  if (ctx.isSupabaseConfigured && ctx.db) {
    // Columnas reales de public.rubik_cubes (20261109_v3_5_complete_engine_sync.sql)
    const { data, error } = await ctx.db
      .from("rubik_cubes")
      .select("id, cube_id, cube_type, brand, model, is_favorite")
      .eq("user_id", ctx.authenticatedUserId)
      .limit(30);

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map((c) => ({
        id: String(c.cube_id || c.id),
        cube_type: String(c.cube_type || "3x3"),
        brand: String(c.brand || ""),
        model_name: String(c.model || "Cubo"),
        status: c.is_favorite ? "active_main" : "secondary",
      }));
      const activeCube = mapped.find((c) => c.status === "active_main") || mapped[0] || null;
      return { source: "supabase" as const, count: mapped.length, activeCube, cubes: mapped };
    }
  }

  const cubes = ctx.store.rubikCubes || [];
  const activeCube = cubes.find((c) => c.status === "active_main") || cubes[0] || null;
  return {
    source: "memory_store" as const,
    count: cubes.length,
    activeCube,
    cubes,
  };
}

export function explainCubeNotation(question: string): string {
  return (
    "🧩 **[Notación oficial WCA]**\n" +
    "• **R, L, U, D, F, B:** giro de 90° en sentido horario de la cara Derecha, Izquierda, Superior, Inferior, Frontal o Trasera.\n" +
    "• **Apóstrofe (`'`):** giro de 90° en sentido antihorario (ej. `R'`, `U'`).\n" +
    "• **Número `2`:** giro doble de 180° (ej. `R2`, `U2`).\n" +
    "• **Capas anchas (`r` / `Rw`) y media (`M`):** giran dos capas juntas o la capa central." +
    (/(3x3|f2l|oll|pll)/i.test(question)
      ? "\n💡 Para **3x3**, F2L empareja esquina+arista, OLL orienta la última capa y PLL permuta sus piezas."
      : "")
  );
}

export async function listCubeTrainingResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "club_puzzles", "oakhaven.specialist.cubos.milo");
}

export async function readAlgorithmSheet(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.cubos.milo");
}

export function proposeCubePracticeSession(params: {
  cubeType: RubikCubeType;
  focus: string;
  currentAo5?: number | null;
}): SpecialistProposal {
  const drillByPuzzle =
    params.cubeType === "3x3"
      ? "10 min de F2L lento (lookahead sin pausas) + 10 min de reconocimiento OLL/PLL + 12 solves cronometrados."
      : params.cubeType === "2x2"
      ? "Práctica específica de 2x2: primera cara eficiente (inspección completa) + algoritmos Ortega/CLL."
      : `Práctica específica para ${params.cubeType}: fluidez de giro, transiciones limpias y control de paridades/centros propios de ${params.cubeType} (sin mezclar algoritmos exclusivos de 3x3).`;

  return {
    id: `prop-cube-practice-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("cube-practice", [params.cubeType, params.focus.toLowerCase()]),
    buildingId: "club_puzzles",
    specialistName: "Milo",
    actionType: "plan_cube_practice",
    title: `Guardar plan de práctica ${params.cubeType}: ${params.focus.slice(0, 50)}`,
    summary: "Se guardará en tu Cuaderno de Algoritmos (`building_resources`) al confirmar. Nunca altera GP ni XP.",
    payload: {
      buildingId: "club_puzzles",
      resourceType: "training_note",
      title: `Plan ${params.cubeType}: ${params.focus.slice(0, 55)}`,
      filename: `plan-${params.cubeType.toLowerCase()}-${Date.now().toString(36).slice(-4)}.md`,
      mimeType: "text/markdown",
      rawTextContent: `# Sesión de Práctica — ${params.cubeType}\n\n- Enfoque: ${params.focus}\n- Ao5 actual registrado: ${params.currentAo5 !== null && params.currentAo5 !== undefined ? `${params.currentAo5}s` : "aún sin 5 solves completos"}\n- Plan: ${drillByPuzzle}`,
    },
    requiresConfirmation: true,
  };
}
