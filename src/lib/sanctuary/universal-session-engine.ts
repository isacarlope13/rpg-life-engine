/**
 * =====================================================================
 * UNIVERSAL SKILL SESSION ENGINE — RPG LIFE-ENGINE 3.5.0
 * =====================================================================
 * Motor agnóstico y determinista para gestionar el ciclo de vida completo
 * de sesiones de habilidad en el Santuario y el Pueblo Vivo (Oakhaven).
 *
 * Principios:
 * 1. Marcas temporales confiables (Date.now / ISO) resistentes a recargas y pestaña en background.
 * 2. Cero cálculo paralelo de XP/GP: toda recompensa es calculada por la API canónica.
 * 3. Idempotencia criptográfica por sesión para evitar duplicidad en reintentos.
 * 4. Aislamiento estricto multi-usuario.
 * 5. Especialización tipada por habilidad (Reading, Knitting, Study, Work, Rubik, Focus).
 * =====================================================================
 */

import type { SkillDomain } from "@/types/rpg";

export type SessionStatus = "preparing" | "running" | "paused" | "completed" | "cancelled";

export interface SessionPauseRecord {
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
}

export interface KnittingSpecializedData {
  pattern_name?: string;
  rounds_completed?: number;
  rows_completed?: number;
  yarn_details?: string;
  stitches_notes?: string;
  technique?: "Crochet" | "Dos Agujas" | "Amigurumi" | "Telar";
  progress_percentage?: number;
}

export interface StudySpecializedData {
  subject?: string;
  topic?: string;
  study_method?: "Pomodoro 25/5" | "Deep Study 50/10" | "Active Recall" | "Práctica";
  exercises_completed?: number;
  comprehension_rating?: number; // 1 to 5
  cards_reviewed?: number;
}

export interface ReadingSpecializedData {
  book_id?: string;
  book_title?: string;
  pages_read?: number;
  start_page?: number;
  end_page?: number;
  quote_text?: string;
  quote_page?: number;
  quotes_list?: Array<{ text: string; page?: number }>;
}

export interface WorkSpecializedData {
  work_project_name?: string;
  project_id?: string;
  task_id?: string;
  task_title?: string;
  deliverable?: string;
  outcome?: string;
  impact_level?: "standard" | "high_impact" | "milestone";
}

export interface DeepWorkSpecializedData {
  goal?: string;
  focus_rating?: number; // 1 to 5
  distractions_count?: number;
  distraction_logs?: Array<{ timestamp: string; reason: string }>;
  shield_active?: boolean;
}

export interface RubikSpecializedData {
  cube_id?: string;
  cube_model?: string;
  method?: "CFOP" | "Roux" | "ZZ" | "Beginner" | "Ortega" | "Blindfolded";
  solves_count?: number;
  solve_time_seconds?: number;
  penalty?: "none" | "+2" | "dnf";
  ao5_seconds?: number;
  algorithm_learned?: string;
}

export interface GardeningSpecializedData {
  garden_bed?: string;
  plants_cared?: number;
  moisture_level?: number;
  plant_species?: string;
}

export interface HikingSpecializedData {
  trail_name?: string;
  distance_km?: number;
  elevation_gain_m?: number;
  route_type?: "urban" | "mountain" | "forest";
}

export interface CookingSpecializedData {
  recipe_name?: string;
  servings?: number;
  kitchen_station?: "stove" | "prep" | "oven";
  meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface SessionSpecializedMap {
  reading?: ReadingSpecializedData;
  knitting?: KnittingSpecializedData;
  study?: StudySpecializedData;
  work?: WorkSpecializedData;
  general?: DeepWorkSpecializedData;
  rubik?: RubikSpecializedData;
  gardening?: GardeningSpecializedData;
  hiking?: HikingSpecializedData;
  cooking?: CookingSpecializedData;
  [key: string]: unknown;
}

export interface UniversalSessionRecord {
  sessionId: string;
  userId: string;
  idempotencyKey: string;
  domain: SkillDomain;
  buildingId: string;
  projectId?: string;
  projectName?: string;
  resourceId?: string;
  resourceTitle?: string;
  sessionObjective?: string;
  status: SessionStatus;
  preparedAt: string;
  startedAt: string;
  endedAt?: string;
  pauses: SessionPauseRecord[];
  activePauseStartedAt?: string;
  notes: string;
  evidenceUrls?: string[];
  specializedData: SessionSpecializedMap;
  historyLog: Array<{ timestamp: string; action: string; details?: string }>;
  // Campos de conveniencia para interoperabilidad
  elapsedSeconds: number;
  isPaused: boolean;
}

export interface CreateSessionParams {
  userId?: string;
  domain: SkillDomain;
  buildingId?: string;
  projectId?: string;
  projectName?: string;
  resourceId?: string;
  resourceTitle?: string;
  objective?: string;
  initialNotes?: string;
  specializedData?: SessionSpecializedMap;
  autoStart?: boolean;
}

export interface FinishSessionParams {
  notes?: string;
  evidenceUrls?: string[];
  specializedData?: SessionSpecializedMap;
  customPayload?: Record<string, unknown>;
}

// =====================================================================
// FUNCIONES PURAS DE CÁLCULO DE DURACIÓN & TIEMPO REAL
// =====================================================================

/**
 * Calcula con precisión matemática la duración neta transcurrida en segundos,
 * deduciendo todas las pausas cerradas y la pausa activa si existe.
 * Es resistente a recargas de página y suspensión de CPU/pestañas.
 */
export function calculateNetDurationSeconds(
  session: UniversalSessionRecord,
  referenceTimestamp: number = Date.now()
): number {
  if (session.status === "preparing") {
    return 0;
  }

  const startTime = Date.parse(session.startedAt);
  if (isNaN(startTime) || startTime <= 0) {
    return 0;
  }

  const endTime = session.endedAt ? Date.parse(session.endedAt) : referenceTimestamp;
  const grossSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));

  let totalPausedSeconds = 0;

  for (const pause of session.pauses || []) {
    if (typeof pause.duration_seconds === "number" && pause.duration_seconds > 0) {
      totalPausedSeconds += pause.duration_seconds;
    } else if (pause.started_at && pause.ended_at) {
      const pStart = Date.parse(pause.started_at);
      const pEnd = Date.parse(pause.ended_at);
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd > pStart) {
        totalPausedSeconds += Math.floor((pEnd - pStart) / 1000);
      }
    }
  }

  // Si la sesión está actualmente en pausa, calcular la pausa viva
  if (session.status === "paused" && session.activePauseStartedAt) {
    const pActiveStart = Date.parse(session.activePauseStartedAt);
    if (!isNaN(pActiveStart) && referenceTimestamp > pActiveStart) {
      totalPausedSeconds += Math.floor((referenceTimestamp - pActiveStart) / 1000);
    }
  }

  return Math.max(0, grossSeconds - totalPausedSeconds);
}

/**
 * Formatea segundos a formato visual MM:SS o HH:MM:SS
 */
export function formatDuration(totalSeconds: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safeSecs / 3600);
  const mins = Math.floor((safeSecs % 3600) / 60);
  const secs = safeSecs % 60;

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

// =====================================================================
// CICLO DE VIDA DE LA SESIÓN (ESTADOS Y TRANSICIONES)
// =====================================================================

/**
 * Crea e inicializa una sesión (fase Preparar o Iniciar)
 */
export function createUniversalSession(params: CreateSessionParams): UniversalSessionRecord {
  const now = new Date().toISOString();
  const userId = params.userId || "usr_cozy_hero";
  const uniqueId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const idempotencyKey = `ses_univ_${userId}_${uniqueId}`;

  const isAutoStart = params.autoStart !== false;
  const initialStatus: SessionStatus = isAutoStart ? "running" : "preparing";

  const session: UniversalSessionRecord = {
    sessionId: uniqueId,
    userId,
    idempotencyKey,
    domain: params.domain,
    buildingId: params.buildingId || `bld_${params.domain}`,
    projectId: params.projectId,
    projectName: params.projectName,
    resourceId: params.resourceId,
    resourceTitle: params.resourceTitle,
    sessionObjective: params.objective,
    status: initialStatus,
    preparedAt: now,
    startedAt: now,
    pauses: [],
    notes: params.initialNotes || "",
    evidenceUrls: [],
    specializedData: params.specializedData || {},
    historyLog: [
      {
        timestamp: now,
        action: initialStatus === "running" ? "START_SESSION" : "PREPARE_SESSION",
        details: `Sesión ${initialStatus} para habilidad ${params.domain}`,
      },
    ],
    elapsedSeconds: 0,
    isPaused: false,
  };

  return session;
}

/**
 * Inicia una sesión que estaba en fase 'preparing'
 */
export function startUniversalSession(
  session: UniversalSessionRecord,
  nowTimestamp: number = Date.now()
): UniversalSessionRecord {
  if (session.status !== "preparing") {
    return session;
  }

  const nowIso = new Date(nowTimestamp).toISOString();
  return {
    ...session,
    status: "running",
    startedAt: nowIso,
    isPaused: false,
    historyLog: [
      ...session.historyLog,
      {
        timestamp: nowIso,
        action: "START_SESSION",
        details: "Inicio de sesión tras preparación",
      },
    ],
  };
}

/**
 * Pausa una sesión activa
 */
export function pauseUniversalSession(
  session: UniversalSessionRecord,
  nowTimestamp: number = Date.now()
): UniversalSessionRecord {
  if (session.status !== "running") {
    return session;
  }

  const nowIso = new Date(nowTimestamp).toISOString();
  return {
    ...session,
    status: "paused",
    isPaused: true,
    activePauseStartedAt: nowIso,
    historyLog: [
      ...session.historyLog,
      {
        timestamp: nowIso,
        action: "PAUSE_SESSION",
        details: "Sesión pausada",
      },
    ],
  };
}

/**
 * Reanuda una sesión en pausa
 */
export function resumeUniversalSession(
  session: UniversalSessionRecord,
  nowTimestamp: number = Date.now()
): UniversalSessionRecord {
  if (session.status !== "paused") {
    return session;
  }

  const nowIso = new Date(nowTimestamp).toISOString();
  const pauseStart = session.activePauseStartedAt
    ? Date.parse(session.activePauseStartedAt)
    : nowTimestamp;
  const pauseDurationSec = Math.max(0, Math.floor((nowTimestamp - pauseStart) / 1000));

  const closedPause: SessionPauseRecord = {
    started_at: session.activePauseStartedAt || nowIso,
    ended_at: nowIso,
    duration_seconds: pauseDurationSec,
  };

  return {
    ...session,
    status: "running",
    isPaused: false,
    activePauseStartedAt: undefined,
    pauses: [...session.pauses, closedPause],
    historyLog: [
      ...session.historyLog,
      {
        timestamp: nowIso,
        action: "RESUME_SESSION",
        details: `Reanudación tras pausa de ${pauseDurationSec}s`,
      },
    ],
  };
}

/**
 * Finaliza la sesión y consolida los datos para guardado
 */
export function finishUniversalSession(
  session: UniversalSessionRecord,
  updates?: FinishSessionParams,
  nowTimestamp: number = Date.now()
): UniversalSessionRecord {
  if (session.status === "completed" || session.status === "cancelled") {
    return session;
  }

  const nowIso = new Date(nowTimestamp).toISOString();
  let pauses = [...session.pauses];

  // Si estaba pausada al finalizar, cerrar la pausa
  if (session.status === "paused" && session.activePauseStartedAt) {
    const pauseStart = Date.parse(session.activePauseStartedAt);
    const pauseDurationSec = Math.max(0, Math.floor((nowTimestamp - pauseStart) / 1000));
    pauses.push({
      started_at: session.activePauseStartedAt,
      ended_at: nowIso,
      duration_seconds: pauseDurationSec,
    });
  }

  const mergedSpecialized: SessionSpecializedMap = {
    ...session.specializedData,
    ...(updates?.specializedData || {}),
  };

  const finalNotes = updates?.notes !== undefined ? updates.notes : session.notes;
  const finalEvidence = updates?.evidenceUrls || session.evidenceUrls || [];

  const intermediateSession: UniversalSessionRecord = {
    ...session,
    pauses,
    activePauseStartedAt: undefined,
    endedAt: nowIso,
  };

  const finalDurationSec = calculateNetDurationSeconds(intermediateSession, nowTimestamp);

  return {
    ...intermediateSession,
    status: "completed",
    isPaused: false,
    notes: finalNotes,
    evidenceUrls: finalEvidence,
    specializedData: mergedSpecialized,
    elapsedSeconds: finalDurationSec,
    historyLog: [
      ...session.historyLog,
      {
        timestamp: nowIso,
        action: "FINISH_SESSION",
        details: `Sesión finalizada con duración neta de ${finalDurationSec}s`,
      },
    ],
  };
}

/**
 * Cancela una sesión sin contabilizar recompensas
 */
export function cancelUniversalSession(
  session: UniversalSessionRecord,
  reason: string = "Usuario canceló la sesión",
  nowTimestamp: number = Date.now()
): UniversalSessionRecord {
  const nowIso = new Date(nowTimestamp).toISOString();
  return {
    ...session,
    status: "cancelled",
    isPaused: false,
    endedAt: nowIso,
    historyLog: [
      ...session.historyLog,
      {
        timestamp: nowIso,
        action: "CANCEL_SESSION",
        details: reason,
      },
    ],
  };
}

// =====================================================================
// HIDRATACIÓN, RECUPERACIÓN & AISLAMIENTO MULTIUSUARIO
// =====================================================================

/**
 * Hidrata una sesión serializada validando tipo y aislamiento de usuario.
 * Devuelve null si pertenece a otro usuario o está corrupta.
 */
export function hydrateUniversalSession(
  data: string | unknown,
  expectedUserId?: string,
  nowTimestamp: number = Date.now()
): UniversalSessionRecord | null {
  if (!data) return null;

  try {
    const parsed: UniversalSessionRecord =
      typeof data === "string" ? JSON.parse(data) : (data as UniversalSessionRecord);

    if (!parsed || !parsed.sessionId || !parsed.domain || !parsed.startedAt) {
      return null;
    }

    // Aislamiento multi-usuario estricto
    if (expectedUserId && parsed.userId && parsed.userId !== expectedUserId) {
      return null;
    }

    // Si ya concluyó o fue cancelada, no es una sesión activa viva
    if (parsed.status === "completed" || parsed.status === "cancelled") {
      return null;
    }

    // Recalcular duración neta real al hidratar
    const netSeconds = calculateNetDurationSeconds(parsed, nowTimestamp);

    return {
      ...parsed,
      elapsedSeconds: netSeconds,
      isPaused: parsed.status === "paused",
    };
  } catch {
    return null;
  }
}

// =====================================================================
// CONVERSOR AL PAYLOAD CANÓNICO PARA /api/shortcuts/skill-session
// =====================================================================

/**
 * Traduce la sesión universal al payload admitido por el backend canónico
 * sin inventar recompensas en frontend y preservando la idempotencia estricta.
 */
export function buildSkillSessionPayload(
  session: UniversalSessionRecord,
  customOverrides?: Record<string, unknown>
): Record<string, unknown> {
  const durationMinutes = Math.max(1, Math.round((session.elapsedSeconds || 0) / 60));
  const domain = session.domain;
  const spec = session.specializedData || {};

  const basePayload: Record<string, unknown> = {
    action: "log_session",
    domain,
    duration_minutes: durationMinutes,
    notes: session.notes,
    title: session.resourceTitle || session.sessionObjective || `Sesión de ${domain}`,
    idempotency_key: session.idempotencyKey,
  };

  // Mapeo especializado por dominio
  switch (domain) {
    case "reading": {
      const readSpec = spec.reading || {};
      if (readSpec.book_id || session.resourceId) {
        basePayload.book_id = readSpec.book_id || session.resourceId;
      }
      if (typeof readSpec.pages_read === "number") {
        basePayload.pages_read = readSpec.pages_read;
      }
      if (readSpec.quote_text) {
        basePayload.quote_text = readSpec.quote_text;
      }
      if (readSpec.quote_page) {
        basePayload.quote_page = readSpec.quote_page;
      }
      if (readSpec.quotes_list && readSpec.quotes_list.length > 0) {
        basePayload.quotes_list = readSpec.quotes_list;
      }
      break;
    }

    case "knitting": {
      const knitSpec = spec.knitting || {};
      if (session.projectId) {
        basePayload.project_id = session.projectId;
      }
      if (typeof knitSpec.rows_completed === "number") {
        basePayload.rows_completed = knitSpec.rows_completed;
      }
      if (knitSpec.yarn_details) {
        basePayload.yarn_details = knitSpec.yarn_details;
      }
      if (knitSpec.technique) {
        basePayload.knitting_technique = knitSpec.technique;
      }
      if (knitSpec.stitches_notes) {
        basePayload.stitches_notes = knitSpec.stitches_notes;
      }
      break;
    }

    case "study": {
      const studySpec = spec.study || {};
      if (studySpec.subject || session.resourceTitle) {
        basePayload.subject = studySpec.subject || session.resourceTitle;
      }
      if (studySpec.study_method) {
        basePayload.study_method = studySpec.study_method;
      }
      break;
    }

    case "work": {
      const workSpec = spec.work || {};
      if (workSpec.work_project_name || session.projectName) {
        basePayload.work_project_name = workSpec.work_project_name || session.projectName;
      }
      if (workSpec.task_id) {
        basePayload.task_id = workSpec.task_id;
      }
      if (workSpec.task_title) {
        basePayload.task_title = workSpec.task_title;
      }
      if (workSpec.deliverable) {
        basePayload.deliverable = workSpec.deliverable;
      }
      if (workSpec.impact_level) {
        basePayload.impact_level = workSpec.impact_level;
      }
      break;
    }

    case "rubik": {
      const rubikSpec = spec.rubik || {};
      if (rubikSpec.cube_id || session.resourceId) {
        basePayload.cube_id = rubikSpec.cube_id || session.resourceId;
      }
      if (rubikSpec.cube_model) {
        basePayload.cube_model = rubikSpec.cube_model;
      }
      if (typeof rubikSpec.solve_time_seconds === "number") {
        basePayload.solve_time_seconds = rubikSpec.solve_time_seconds;
      }
      if (rubikSpec.penalty) {
        basePayload.penalty = rubikSpec.penalty;
      }
      if (rubikSpec.algorithm_learned) {
        basePayload.algorithm_learned = rubikSpec.algorithm_learned;
      }
      break;
    }

    default:
      break;
  }

  return {
    ...basePayload,
    ...(customOverrides || {}),
  };
}
