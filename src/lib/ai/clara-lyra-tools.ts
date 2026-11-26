/**
 * ============================================================================
 * OAKHAVEN AI FASE 3 — HERRAMIENTAS ACTIVAS DE CLARA (CROCHET) Y LYRA (ESTUDIO)
 * ============================================================================
 * - Clara solo opera sobre `atelier` (`knitting_projects`, `building_resources` atelier).
 * - Lyra solo opera sobre `biblioteca` (`activity_logs` study, `spacedCards`, `building_resources` biblioteca).
 * - Consultas 100 % solo lectura; cualquier creación/guardado devuelve propuesta Nivel 2
 *   (`requiresConfirmation: true`). Nunca alteran GP, XP ni COP.
 */

import type { MayorToolContext } from "./mayor-readonly-tools.ts";
import {
  getResourceExtractedText,
  listBuildingResources,
  type ResourceQueryContext,
} from "./resource-query-tools.ts";
import type { PrivateBuildingResource } from "./building-resources-engine.ts";
import type { SpecialistProposal } from "./specialist-engine.ts";
import {
  buildGuidedProgressSummary,
  formatGuidedSegmentSpeech,
  type FiletGuidedProgressState,
  type GuidedProgressSummary,
} from "../sanctuary/filet-guided-engine.ts";

// ============================================================================
// CLARA — MAESTRA DE CROCHET
// ============================================================================

export const CROCHET_ABBREVIATIONS: Record<string, string> = {
  am: "Anillo mágico (inicio circular ajustable para amigurumis o centros).",
  mr: "Magic ring / anillo mágico.",
  cad: "Cadeneta (cadena base o cadenetas de subida).",
  ch: "Chain / cadeneta.",
  pb: "Punto bajo (tejido tupido y firme).",
  sc: "Single crochet / punto bajo.",
  mpa: "Medio punto alto (altura intermedia con lazada previa).",
  hdc: "Half double crochet / medio punto alto.",
  pa: "Punto alto (vareta clásica, tejido más ligero y alto).",
  dc: "Double crochet / punto alto.",
  pe: "Punto enano o deslizado (para cerrar vueltas o unir piezas sin altura).",
  pr: "Punto raso / punto deslizado.",
  aum: "Aumento (tejer 2 puntos en el mismo punto base).",
  inc: "Increase / aumento.",
  dism: "Disminución (cerrar 2 puntos juntos para reducir contorno).",
  dec: "Decrease / disminución.",
  blo: "Back Loop Only (tomar solo la hebra trasera para efecto canalé).",
  flo: "Front Loop Only (tomar solo la hebra delantera).",
};

export function explainCrochetInstruction(instructionText: string): {
  detectedAbbreviations: Array<{ code: string; meaning: string }>;
  stepExplanation: string;
  estimatedStitchesHint?: string;
} {
  const clean = (instructionText || "").trim();
  const tokens = clean
    .toLowerCase()
    .replace(/[^a-záéíóúñ0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

  const seen = new Set<string>();
  const detected: Array<{ code: string; meaning: string }> = [];
  for (const tok of tokens) {
    if (CROCHET_ABBREVIATIONS[tok] && !seen.has(tok)) {
      seen.add(tok);
      detected.push({ code: tok, meaning: CROCHET_ABBREVIATIONS[tok] });
    }
  }

  const repeatMatch = clean.match(/x\s*(\d+)/i);
  const estimatedStitchesHint = repeatMatch
    ? `Detecté una repetición de ×${repeatMatch[1]} veces en la vuelta; conviene usar marcador en el primer punto para evitar saltos.`
    : undefined;

  const stepExplanation =
    detected.length > 0
      ? detected.map((d) => `• **${d.code.toUpperCase()}**: ${d.meaning}`).join("\n")
      : "No detecté abreviaturas estándar (como pb, pa, cad, aum, dism, am). Pégame la línea exacta de tu patrón y te la desgloso paso a paso.";

  return { detectedAbbreviations: detected, stepExplanation, estimatedStitchesHint };
}

export function estimateCrochetMaterials(params: {
  projectName?: string;
  targetRows?: number;
  technique?: string;
}): string {
  const name = (params.projectName || "tu proyecto").toLowerCase();
  const rows = params.targetRows || 60;
  if (/amigurumi|muñec|peluche/.test(name) || params.technique === "Amigurumi") {
    return "Estimación orientativa para Amigurumi: 1–2 ovillos de algodón (50g c/u), ganchillo 2.5–3.5 mm, relleno sintético, aguja lanera y marcador de puntos.";
  }
  if (/manta|cobija|chal/.test(name) || rows >= 120) {
    return `Estimación orientativa para prenda grande (~${rows} vueltas): 5–8 ovillos de 100g (grosor DK o Worsted), ganchillo 4.5–5.5 mm y marcadores cada 20 puntos.`;
  }
  if (/bufanda|cuello|gorro/.test(name)) {
    return `Estimación orientativa para accesorio (~${rows} vueltas): 2–3 ovillos de 100g (lana merino o acrílico suave) y ganchillo 4.0–5.0 mm.`;
  }
  return `Estimación orientativa (~${rows} vueltas): 2–4 ovillos de 100g según tensión y calibre del hilo, ganchillo acorde a la etiqueta y tijeras + aguja lanera.`;
}

export async function getActiveCrochetProjects(ctx: MayorToolContext) {
  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data } = await ctx.db
      .from("knitting_projects")
      .select("id, name, technique, completed_rows, total_rows_target, yarn_details, status, updated_at")
      .eq("user_id", ctx.authenticatedUserId)
      .order("updated_at", { ascending: false })
      .limit(15);
    return { source: "supabase" as const, projects: data || [] };
  }
  return { source: "memory_store" as const, projects: ctx.store.knittingProjects || [] };
}

export async function listCrochetPatterns(
  resCtx: ResourceQueryContext,
  projectId?: string
) {
  const listed = await listBuildingResources(resCtx, "atelier", "oakhaven.specialist.crochet.clara");
  if (!listed.ok || !Array.isArray(listed.data)) return listed;
  const items = projectId
    ? (listed.data as Array<Record<string, unknown>>).filter((r) => r.project_id === projectId)
    : listed.data;
  return { ...listed, data: items };
}

export async function readCrochetPattern(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.crochet.clara");
}

export function proposeCrochetProjectNote(
  projectId: string,
  projectName: string,
  note: string
): SpecialistProposal {
  return {
    id: `prop-knit-note-${Date.now()}`,
    buildingId: "atelier",
    specialistName: "Clara",
    actionType: "add_knitting_project",
    title: `Guardar nota en "${projectName}"`,
    summary: `Nota propuesta (Nivel 2 — requiere tu confirmación): "${note.slice(0, 140)}"`,
    payload: {
      project_id: projectId,
      note: note.trim(),
    },
    requiresConfirmation: true,
  };
}

export interface ClaraGuidedFiletBriefing {
  projectId: string;
  projectName: string;
  patternName: string;
  patternVersionNumber: number;
  meshSize: 3 | 4;
  activeRowNumber: number;
  totalRows: number;
  directionLabel: string;
  activeSegmentText: string;
  nextSegmentText: string;
  remainingCellsInRow: number;
  remainingRowsCount: number;
  progressPercent: number;
  recordedMinutes: number;
  speechSummary: string;
  summary: GuidedProgressSummary;
}

/**
 * Bloque 5 — Consulta determinista de Clara sobre un proyecto guiado de Filet Crochet.
 * Lee exclusivamente del motor determinista (`filet-guided-engine.ts`); jamás inventa
 * instrucciones ni altera contadores, GP o XP.
 */
export function getGuidedFiletProjectStatus(params: {
  progress: FiletGuidedProgressState;
  recordedMinutes?: number;
}): ClaraGuidedFiletBriefing {
  const summary = buildGuidedProgressSummary(params.progress);
  const view = summary.activeRowView;
  const recordedMinutes = Math.max(0, Math.round(params.recordedMinutes || 0));

  const directionLabel = !view
    ? "Sin fila activa"
    : view.direction === "rtl"
      ? "Derecha a Izquierda (←)"
      : "Izquierda a Derecha (→)";

  const activeSegmentText = !view
    ? "Proyecto completado."
    : view.allSegmentsCompleted
      ? `Todos los segmentos de la vuelta ${view.rowNumber} completados (falta confirmar vuelta).`
      : view.activeSegment
        ? `${view.activeSegment.count} ${
            view.activeSegment.kind === "filled" ? "cuadro(s) lleno(s)" : "cuadro(s) vacío(s)"
          }`
        : "Sin segmento activo.";

  const nextSegmentText =
    view?.nextSegment
      ? `${view.nextSegment.count} ${
          view.nextSegment.kind === "filled" ? "lleno(s)" : "vacío(s)"
        }`
      : view?.allSegmentsCompleted
        ? "Confirmar vuelta"
        : "Fin de vuelta";

  const speechSummary = view
    ? `${formatGuidedSegmentSpeech(view)} Avance total: ${summary.progressPercent} por ciento.`
    : `Proyecto ${summary.projectName} completado al 100 por ciento.`;

  return {
    projectId: summary.projectId,
    projectName: summary.projectName,
    patternName: summary.patternName,
    patternVersionNumber: summary.patternVersionNumber,
    meshSize: summary.meshSize,
    activeRowNumber: summary.activeRowNumber,
    totalRows: summary.totalRows,
    directionLabel,
    activeSegmentText,
    nextSegmentText,
    remainingCellsInRow: view?.remainingCellsInRow ?? 0,
    remainingRowsCount: summary.remainingRowsCount,
    progressPercent: summary.progressPercent,
    recordedMinutes,
    speechSummary,
    summary,
  };
}

// ============================================================================
// LYRA — TUTORA DE ESTUDIO
// ============================================================================

export interface StudyQuizQuestion {
  index: number;
  question: string;
  options: string[];
  correctIndex: number;
  sourceCitation: string;
  explanation: string;
}

export interface StudyQuiz {
  quizId: string;
  resourceTitle: string;
  difficulty: "basico" | "intermedio" | "avanzado";
  questions: StudyQuizQuestion[];
}

export async function getActiveStudySubjects(ctx: MayorToolContext) {
  const sessions =
    ctx.isSupabaseConfigured && ctx.db
      ? (
          await ctx.db
            .from("activity_logs")
            .select("id, title, duration_minutes, notes, completed_at")
            .eq("user_id", ctx.authenticatedUserId)
            .eq("domain", "study")
            .order("completed_at", { ascending: false })
            .limit(15)
        ).data || []
      : (ctx.store.skillSessions || []).filter((s) => s.domain === "study");

  const sessionList: Array<{ title?: string }> = sessions as Array<{ title?: string }>;
  const subjects = Array.from(
    new Set(
      sessionList
        .map((s) => String(s.title || "").trim())
        .filter(Boolean)
    )
  );
  const dueCards = (ctx.store.spacedCards || []).filter((c) => {
    const rawDue = (c as unknown as { next_review_at?: string; next_review_date?: string }).next_review_at
      || (c as unknown as { next_review_date?: string }).next_review_date
      || "";
    const due = Date.parse(rawDue);
    return !Number.isFinite(due) || due <= Date.now();
  });

  return {
    source: ctx.isSupabaseConfigured && ctx.db ? ("supabase" as const) : ("memory_store" as const),
    subjects,
    sessionsCount: sessions.length,
    dueCardsCount: dueCards.length,
    lastSession: sessions[0] || null,
  };
}

export async function listStudyResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "biblioteca", "oakhaven.specialist.estudio.lyra");
}

export async function readStudyResource(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.estudio.lyra");
}

/**
 * Genera preguntas de opción múltiple deterministas basadas EXCLUSIVAMENTE en el
 * texto real del documento (nunca inventa páginas ni citas).
 */
export function generateStudyQuizFromDocument(params: {
  resourceTitle: string;
  extractedText: string;
  difficulty?: "basico" | "intermedio" | "avanzado";
  count?: number;
}): StudyQuiz {
  const difficulty = params.difficulty || "intermedio";
  const maxQ = Math.min(10, Math.max(1, params.count || 3));
  const rawSentences = (params.extractedText || "")
    .split(/[\n.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  const questions: StudyQuizQuestion[] = [];
  for (let i = 0; i < Math.min(maxQ, rawSentences.length); i++) {
    const sentence = rawSentences[i];
    const pageMatch = sentence.match(/\[Página\s+(\d+)\]/i);
    const citation = pageMatch
      ? `${params.resourceTitle} — Página ${pageMatch[1]}`
      : `${params.resourceTitle} — Sección ${i + 1}`;
    const cleanSentence = sentence.replace(/\[Página\s+\d+\]\s*/i, "").trim();

    questions.push({
      index: i + 1,
      question: `Según "${citation}", ¿cuál afirmación corresponde al material estudiado?`,
      options: [
        cleanSentence.slice(0, 110),
        "El documento afirma exactamente lo contrario a este concepto.",
        "Este tema no aparece mencionado en el documento.",
        "Ninguna de las anteriores aplica al texto.",
      ],
      correctIndex: 0,
      sourceCitation: citation,
      explanation: `Confirmado en ${citation}: "${cleanSentence.slice(0, 140)}".`,
    });
  }

  return {
    quizId: `quiz-${Date.now()}`,
    resourceTitle: params.resourceTitle,
    difficulty,
    questions,
  };
}

export function evaluateStudyAnswers(
  quiz: StudyQuiz,
  answers: number[]
): {
  correctCount: number;
  total: number;
  recommendedNextDifficulty: "basico" | "intermedio" | "avanzado";
  feedback: string[];
} {
  let correctCount = 0;
  const feedback: string[] = [];

  quiz.questions.forEach((q, idx) => {
    const chosen = answers[idx];
    if (chosen === q.correctIndex) {
      correctCount += 1;
      feedback.push(`✅ Pregunta ${q.index}: Correcta (${q.sourceCitation}).`);
    } else {
      feedback.push(`❌ Pregunta ${q.index}: Revisa ${q.explanation}`);
    }
  });

  const ratio = quiz.questions.length > 0 ? correctCount / quiz.questions.length : 0;
  const recommendedNextDifficulty =
    ratio >= 0.8 ? "avanzado" : ratio >= 0.5 ? "intermedio" : "basico";

  return {
    correctCount,
    total: quiz.questions.length,
    recommendedNextDifficulty,
    feedback,
  };
}

export function proposeFlashcardsFromDocument(
  resourceTitle: string,
  extractedText: string
): SpecialistProposal {
  const sentences = (extractedText || "")
    .split(/[\n.!?]+/)
    .map((s) => s.replace(/\[Página\s+\d+\]\s*/i, "").trim())
    .filter((s) => s.length >= 18)
    .slice(0, 3);

  const cards = sentences.map((s, idx) => ({
    prompt: `Concepto clave #${idx + 1} de "${resourceTitle}"`,
    reflection: s.slice(0, 220),
    source: resourceTitle,
  }));

  return {
    id: `prop-flashcards-${Date.now()}`,
    buildingId: "biblioteca",
    specialistName: "Lyra",
    actionType: "plan_study_block",
    title: `Guardar ${cards.length} flashcard(s) SM-2 desde "${resourceTitle}"`,
    summary:
      cards.length > 0
        ? `Tarjetas listas para tu confirmación: ${cards.map((c) => c.prompt).join(" • ")}`
        : "No se encontró suficiente texto extraíble para proponer flashcards.",
    payload: {
      action: "add_spaced_card_batch",
      resourceTitle,
      cards,
    },
    requiresConfirmation: true,
  };
}

export function buildResourceContextFromMemory(
  userId: string,
  db: MayorToolContext["db"],
  isSupabaseConfigured: boolean,
  memoryResources?: PrivateBuildingResource[]
): ResourceQueryContext {
  return {
    authenticatedUserId: userId,
    db,
    isSupabaseConfigured,
    memoryResources,
  };
}
