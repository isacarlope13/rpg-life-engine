/**
 * ============================================================================
 * OAKHAVEN AI FASE 2 — MOTOR DE ESPECIALISTAS POR EDIFICIO
 * ============================================================================
 * - Cada especialista solo puede invocar las herramientas autorizadas en su skill.
 * - Nivel 1: Consultas grounded de solo lectura con fecha y origen.
 * - Nivel 2: Propuestas estructuradas que SIEMPRE requieren confirmación humana explícita.
 * - Nivel 3: Pagos, COP, GP/XP arbitrario y borrado masivo estrictamente bloqueados.
 */

import { GoogleGenAI } from "@google/genai";
import {
  BUILDING_SPECIALIST_SKILLS,
  type RuntimeBuildingSkill,
} from "./building-skills-registry.ts";
import {
  executeMayorReadOnlyTool,
  type MayorToolContext,
  type ToolExecutionResult,
} from "./mayor-readonly-tools.ts";
import {
  buildDeterministicGroundedAnswer,
  detectUnsafeActionRequest,
  type MayorChatTurn,
  type MayorCitation,
} from "./mayor-rowan-engine.ts";
import {
  buildResourceContextFromMemory,
  estimateCrochetMaterials,
  explainCrochetInstruction,
  generateStudyQuizFromDocument,
  getActiveCrochetProjects,
  getActiveStudySubjects,
  listCrochetPatterns,
  listStudyResources,
  proposeFlashcardsFromDocument,
  readCrochetPattern,
  readStudyResource,
} from "./clara-lyra-tools.ts";
import {
  analyzeTechnicalDocument,
  explainCodeSnippet,
  getActiveWorkProjects,
  getBookQuotesAndNotes,
  getLastWorkSession,
  getPendingWorkTasks,
  getReadingBooks,
  listReadingResources,
  listWorkResources,
  proposeBookReview,
  proposeReadingReflection,
  proposeWorkSessionSummary,
  proposeWorkSprint,
  readReadingResource,
  readWorkDocument,
  recommendNextBook,
} from "./aura-eldrin-tools.ts";
import {
  detectMedicalOrInjuryQuery,
  explainCubeNotation,
  getCubeSolveHistory,
  getGymPersonalRecords,
  getLastRealWorkout,
  getRegisteredCubes,
  getTrainingConsistency,
  listCubeTrainingResources,
  listGymResources,
  proposeCubePracticeSession,
  proposeNextWorkout,
  readAlgorithmSheet,
  readWorkoutPlan,
} from "./bruno-milo-tools.ts";
import {
  explainGpVsCop,
  getCinemaCollection,
  getRecordedObligations,
  getVerifiedFinancialMovements,
  listCinemaResources,
  proposeCinemaReview,
  proposeMovieNight,
  readCinemaReview,
  recommendFromWatchlist,
  simulateBudgetScenario,
  simulateDebtPaymentImpact,
} from "./nora-silas-tools.ts";
import type { PrivateBuildingResource } from "./building-resources-engine.ts";
import type { RubikCubeType } from "../../types/rpg.ts";

export const MAX_TOOLS_PER_SPECIALIST_REQUEST = 4;

export interface SpecialistProposal {
  id: string;
  idempotencyKey?: string;
  buildingId: string;
  specialistName: string;
  actionType:
    | "add_cinema_entry"
    | "add_cinema_review"
    | "add_knitting_project"
    | "add_reading_note"
    | "plan_study_block"
    | "plan_work_sprint"
    | "plan_gym_routine"
    | "plan_cube_practice";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  requiresConfirmation: true;
}

/**
 * Planificador determinista de herramientas por intención (Hito 1 — Fase 4).
 * - El servidor decide qué herramientas ejecutar; el modelo NUNCA amplía sus propios permisos.
 * - Limita estrictamente el número de herramientas por solicitud (MAX_TOOLS_PER_SPECIALIST_REQUEST).
 */
export function selectAuthorizedToolsForIntent(
  skill: RuntimeBuildingSkill,
  question: string,
  hasSelectedResource: boolean
): string[] {
  const q = question.toLowerCase();
  const planned: string[] = [];

  if (skill.buildingId === "oficina") {
    planned.push("getActiveWorkProjects");
    if (/(tarea|pendiente|prioridad|backlog|sprint|divid)/i.test(q)) {
      planned.push("getPendingWorkTasks");
    }
    if (/(sesi[oó]n|jornada|cierre|reciente|trabaj[eé]|avance)/i.test(q)) {
      planned.push("getLastWorkSession");
    }
    if (hasSelectedResource) {
      planned.push("readWorkDocument");
    } else if (/(documento|spec|especificaci[oó]n|archivo|recurso|c[oó]digo|pdf|markdown)/i.test(q)) {
      planned.push("listWorkResources");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  if (skill.buildingId === "libreria") {
    planned.push("getReadingBooks");
    if (/(cita|nota|rese[nñ]a|diario|reflexi[oó]n|frase)/i.test(q)) {
      planned.push("getBookQuotesAndNotes");
    }
    if (hasSelectedResource) {
      planned.push("readReadingResource");
    } else if (/(recurso|archivo|pdf|portada|ficha)/i.test(q)) {
      planned.push("listReadingResources");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  if (skill.buildingId === "gimnasio") {
    planned.push("getLastRealWorkout");
    if (/(constancia|semana|descanso|frecuencia|racha|tendencia)/i.test(q)) {
      planned.push("getTrainingConsistency");
    }
    if (hasSelectedResource) {
      planned.push("readWorkoutPlan");
    } else if (/(rutina|plan|documento|archivo|pdf)/i.test(q)) {
      planned.push("listGymResources");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  if (skill.buildingId === "club_puzzles") {
    planned.push("getCubeSolveHistory");
    if (/(cubo|hardware|arsenal|registrado|activo)/i.test(q)) {
      planned.push("getRegisteredCubes");
    }
    if (hasSelectedResource) {
      planned.push("readAlgorithmSheet");
    } else if (/(algoritmo|hoja|gu[ií]a|documento|archivo|pdf)/i.test(q)) {
      planned.push("listCubeTrainingResources");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  if (skill.buildingId === "cine") {
    planned.push("getCinemaCollection");
    if (/(recomienda|qu[eé] ver|noche|pendiente|watchlist|musical)/i.test(q)) {
      planned.push("recommendFromWatchlist");
    }
    if (hasSelectedResource) {
      planned.push("readCinemaReview");
    } else if (/(rese[nñ]a|documento|recurso|archivo)/i.test(q)) {
      planned.push("listCinemaResources");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  if (skill.buildingId === "banco_oakhaven") {
    planned.push("getVerifiedFinancialMovements");
    if (/(obligaci[oó]n|deuda|vencimiento|fijo|cuota|disponible)/i.test(q)) {
      planned.push("getRecordedObligations");
    }
    if (/(simula|ahorro|ahorrar|escenario|qu[eé] pasar[ií]a|impacto)/i.test(q)) {
      planned.push("simulateBudgetScenario");
    }
    if (/(gp|moneda|diferencia|conversi[oó]n)/i.test(q)) {
      planned.push("explainGpVsCop");
    }
    return planned.slice(0, MAX_TOOLS_PER_SPECIALIST_REQUEST);
  }

  return skill.allowedTools.slice(0, 1);
}

export interface SpecialistAnswerResponse {
  specialist: {
    skillId: string;
    name: string;
    role: string;
    buildingId: string;
  };
  answer: string;
  mode: "gemini_grounded" | "deterministic_grounded" | "blocked_safety" | "disabled";
  toolsUsed: string[];
  citations: MayorCitation[];
  proposal?: SpecialistProposal;
}

export function getSpecialistSkillForBuilding(
  buildingId: string
): RuntimeBuildingSkill | undefined {
  return BUILDING_SPECIALIST_SKILLS.find((s) => s.buildingId === buildingId);
}

/**
 * Detecta si el usuario pide crear/proponer algo seguro (Nivel 2).
 * NUNCA ejecuta la escritura: solo devuelve una propuesta estructurada con requiresConfirmation: true.
 */
export function buildLevel2ProposalIfRequested(
  skill: RuntimeBuildingSkill,
  question: string
): SpecialistProposal | undefined {
  const q = question.trim();
  const quoted = q.match(/["“]([^"”]{2,120})["”]/)?.[1]?.trim();

  if (
    skill.buildingId === "cine" &&
    /(agrega|añade|anota|guarda|pon)\s+(la\s+|una\s+|el\s+|un\s+)?(pel[ií]cula|serie|musical)/i.test(q)
  ) {
    const kind = /musical/i.test(q) ? "musical" : /serie/i.test(q) ? "series" : "movie";
    const extractedTitle =
      quoted ||
      q
        .replace(/^.*?(pel[ií]cula|serie|musical)\s+/i, "")
        .replace(/[?.!]+$/, "")
        .trim()
        .slice(0, 100) ||
      "Nueva obra cultural";
    return {
      id: `prop-cine-${Date.now()}`,
      buildingId: "cine",
      specialistName: skill.name,
      actionType: "add_cinema_entry",
      title: `Agregar "${extractedTitle}" a tu Cine`,
      summary: `Tipo: ${kind === "musical" ? "Musical" : kind === "series" ? "Serie" : "Película"} • Estado inicial: Por ver (Watchlist).`,
      payload: {
        title: extractedTitle,
        kind,
        status: "watchlist",
      },
      requiresConfirmation: true,
    };
  }

  if (
    skill.buildingId === "atelier" &&
    /(crea|nuevo|empieza|agrega|monta)\s+(un\s+)?proyecto/i.test(q)
  ) {
    const extractedName =
      quoted ||
      q
        .replace(/^.*?proyecto\s+(de\s+)?/i, "")
        .replace(/[?.!]+$/, "")
        .trim()
        .slice(0, 100) ||
      "Nuevo proyecto de crochet";
    return {
      id: `prop-knit-${Date.now()}`,
      buildingId: "atelier",
      specialistName: skill.name,
      actionType: "add_knitting_project",
      title: `Crear proyecto "${extractedName}"`,
      summary: "Técnica: Crochet • Meta sugerida: 50 vueltas (editable después).",
      payload: {
        action: "add_knitting_project",
        title: extractedName,
        knitting_technique: "Crochet",
        knitting_total_rows: 50,
        yarn_details: "Hilado por definir",
      },
      requiresConfirmation: true,
    };
  }

  return undefined;
}

async function trySpecialistGeminiPolish(
  skill: RuntimeBuildingSkill,
  question: string,
  deterministicDraft: string,
  toolResults: ToolExecutionResult[],
  history: MayorChatTurn[]
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || process.env.OAKHAVEN_AI_ENABLED === "false") {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  const recentHistory = history
    .slice(-4)
    .map((h) => `${h.role === "user" ? "Jugador" : skill.name}: ${h.content.slice(0, 200)}`)
    .join("\n");

  const prompt = [
    `Eres ${skill.name}, ${skill.role} en OakHaven.`,
    skill.specializedInstructions,
    "REGLA ESTRICTA: Usa únicamente DATOS_VERIFICADOS. No inventes fechas, títulos ni números. Nunca ejecutes pagos ni modifiques GP/XP/COP.",
    recentHistory ? `CONTEXTO RECIENTE:\n${recentHistory}` : "",
    `PREGUNTA:\n${question}`,
    `DATOS_VERIFICADOS:\n${JSON.stringify(toolResults).slice(0, 3200)}`,
    `BORRADOR_DETERMINISTA:\n${deterministicDraft}`,
    "Responde en español, tono cozy y claro, máximo 100 palabras.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000));
  const genPromise = ai.models
    .generateContent({
      model: skill.providerConfig.model,
      contents: prompt,
      config: {
        temperature: skill.providerConfig.temperature,
        maxOutputTokens: skill.providerConfig.maxOutputTokens,
      },
    })
    .then((res) => (res.text && res.text.trim().length > 10 ? res.text.trim() : null))
    .catch(() => null);

  return Promise.race([genPromise, timeoutPromise]);
}

export async function askBuildingSpecialist(params: {
  buildingId: string;
  question: string;
  history?: MayorChatTurn[];
  ctx: MayorToolContext;
  allowGemini?: boolean;
  disabledSkillIds?: string[];
  selectedResourceId?: string;
  memoryResources?: PrivateBuildingResource[];
  /** Gancho opcional de instrumentación para pruebas de aislamiento de Gemini */
  onGeminiAttemptForTests?: () => void;
}): Promise<SpecialistAnswerResponse> {
  const skill = getSpecialistSkillForBuilding(params.buildingId);
  if (!skill) {
    throw new Error(`No existe un especialista registrado para el edificio "${params.buildingId}".`);
  }

  const specialistMeta = {
    skillId: skill.skillId,
    name: skill.name,
    role: skill.role,
    buildingId: skill.buildingId,
  };

  if (params.disabledSkillIds?.includes(skill.skillId)) {
    return {
      specialist: specialistMeta,
      answer: `${skill.name} está en pausa según tus preferencias de asistentes. Puedes reactivarlo cuando desees.`,
      mode: "disabled",
      toolsUsed: [],
      citations: [],
    };
  }

  const cleanQuestion = (params.question || "").trim().slice(0, 600);

  // 1. Defensa Nivel 3 (pagos, GP/XP, prompt injection)
  const safetyBlock = detectUnsafeActionRequest(cleanQuestion);
  if (safetyBlock) {
    return {
      specialist: specialistMeta,
      answer: safetyBlock,
      mode: "blocked_safety",
      toolsUsed: [],
      citations: [],
    };
  }

  // 2. Ejecutar ÚNICAMENTE la herramienta principal permitida del especialista (estricto aislamiento por dominio)
  const primaryTool = skill.allowedTools[0];
  const results: ToolExecutionResult[] = [];
  if (primaryTool) {
    const args = primaryTool === "getRecentExpenses" ? { days: 7, limit: 15 } : undefined;
    const res = await executeMayorReadOnlyTool(primaryTool, params.ctx, args);
    results.push(res);
  }

  // 3. Construir propuesta Nivel 2 (si aplica, siempre requiresConfirmation: true)
  let proposal = buildLevel2ProposalIfRequested(skill, cleanQuestion);

  // 4. Respuesta determinista grounded + enriquecimiento activo Fase 3 para Clara (Crochet) y Lyra (Estudio)
  let deterministicDraft = buildDeterministicGroundedAnswer(cleanQuestion, results);
  const resCtx = buildResourceContextFromMemory(
    params.ctx.authenticatedUserId,
    params.ctx.db,
    params.ctx.isSupabaseConfigured,
    params.memoryResources
  );
  const extraTools: string[] = [];

  if (skill.buildingId === "atelier") {
    const activeProjs = await getActiveCrochetProjects(params.ctx);
    const activeProj = activeProjs.projects[0] as Record<string, unknown> | undefined;
    const patternsList = await listCrochetPatterns(resCtx);
    extraTools.push("getActiveCrochetProjects", "listCrochetPatterns");

    const extraLines: string[] = [];
    if (/(vuelta|qued[eé]|progreso|avance)/i.test(cleanQuestion) && activeProj) {
      const done = Number(activeProj.completed_rows || 0);
      const target = Number(activeProj.total_rows_target || 60);
      extraLines.push(
        `🧶 **[Tus registros]** En "${activeProj.name}" llevas **${done}/${target} vueltas** (${Math.round((done / Math.max(1, target)) * 100)}%). Tu siguiente vuelta es la **#${done + 1}**.`
      );
    }
    if (/(explica|abreviatura|punto|\bpb\b|\bpa\b|\bcad\b|\baum\b|\bdism\b|\bam\b|sc|dc)/i.test(cleanQuestion)) {
      const exp = explainCrochetInstruction(cleanQuestion);
      extraTools.push("explainCrochetInstruction");
      extraLines.push(`📖 **[Conocimiento general de crochet]**\n${exp.stepExplanation}`);
      if (exp.estimatedStitchesHint) extraLines.push(`💡 ${exp.estimatedStitchesHint}`);
    }
    if (/(hilo|lana|ovillo|material|cu[aá]nto)/i.test(cleanQuestion)) {
      extraLines.push(
        `🧺 **[Sugerencia orientativa]** ${estimateCrochetMaterials({
          projectName: activeProj ? String(activeProj.name) : undefined,
          targetRows: activeProj ? Number(activeProj.total_rows_target) : undefined,
          technique: activeProj ? String(activeProj.technique) : undefined,
        })}`
      );
    }
    if (/(prepara|sesi[oó]n)/i.test(cleanQuestion) && activeProj) {
      extraLines.push(
        `⏱️ **[Sesión sugerida]** Te propongo un bloque tranquilo de 15–25 min en "${activeProj.name}" retomando desde la vuelta #${Number(activeProj.completed_rows || 0) + 1}. Puedes iniciar el contador en la Mesa con o sin cronómetro.`
      );
    }
    if (params.selectedResourceId) {
      const docRead = await readCrochetPattern(resCtx, params.selectedResourceId);
      extraTools.push("readCrochetPattern");
      if (docRead.ok && docRead.data?.text) {
        extraLines.push(
          `📜 **[Contenido de tu patrón]** ${docRead.data.text.slice(0, 600)}${docRead.data.text.length > 600 ? "..." : ""}`
        );
      } else {
        extraLines.push(
          `⚠️ **Recurso:** ${docRead.error || "Este patrón no tiene texto extraíble (por ejemplo, PDF escaneado o imagen sin OCR); no inventaré instrucciones."}`
        );
      }
    } else if (Array.isArray(patternsList.data) && patternsList.data.length > 0) {
      const names = (patternsList.data as Array<{ title: string }>)
        .slice(0, 3)
        .map((p) => `"${p.title}"`)
        .join(", ");
      extraLines.push(`📂 **Patrones en tu Carpeta:** ${names}.`);
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "biblioteca") {
    const studyCtx = await getActiveStudySubjects(params.ctx);
    const docsList = await listStudyResources(resCtx);
    extraTools.push("getActiveStudySubjects", "listStudyResources");

    const extraLines: string[] = [];
    if (/(repas|hoy|pendiente|ruta|sesi[oó]n)/i.test(cleanQuestion)) {
      extraLines.push(
        `📚 **[Tu progreso real]** Materias recientes: ${studyCtx.subjects.slice(0, 3).join(", ") || "sin materias registradas aún"} • Tarjetas SM-2 pendientes de repaso: **${studyCtx.dueCardsCount}**.`
      );
    }

    if (params.selectedResourceId) {
      const docRead = await readStudyResource(resCtx, params.selectedResourceId);
      extraTools.push("readStudyResource");
      const docMeta = Array.isArray(docsList.data)
        ? (docsList.data as Array<{ id: string; title: string }>).find((d) => d.id === params.selectedResourceId)
        : undefined;
      const docTitle = docMeta?.title || "tu documento de Estudio";

      if (docRead.ok && docRead.data?.text) {
        if (/(examen|quiz|pregunta|evalua|test)/i.test(cleanQuestion)) {
          const countMatch = cleanQuestion.match(/(\d+)\s*pregunta/i);
          const quiz = generateStudyQuizFromDocument({
            resourceTitle: docTitle,
            extractedText: docRead.data.text,
            count: countMatch ? Number(countMatch[1]) : 3,
          });
          extraTools.push("generateStudyQuiz");
          if (quiz.questions.length > 0) {
            const qLines = quiz.questions
              .map(
                (q) =>
                  `**${q.index}.** ${q.question}\n   a) ${q.options[0]}\n   b) ${q.options[1]}\n   *(Fuente: ${q.sourceCitation})*`
              )
              .join("\n");
            extraLines.push(`📝 **[Examen basado en tu documento "${docTitle}"]**\n${qLines}`);
          } else {
            extraLines.push(`⚠️ El documento "${docTitle}" tiene muy poco texto extraíble para armar preguntas.`);
          }
        } else if (/(flashcard|tarjeta|sm-2)/i.test(cleanQuestion)) {
          proposal = proposeFlashcardsFromDocument(docTitle, docRead.data.text);
          extraTools.push("proposeFlashcards");
          extraLines.push(
            `🧠 **[Propuesta basada en tu documento "${docTitle}"]** Preparé flashcards SM-2 para que las confirmes antes de guardarlas.`
          );
        } else {
          extraLines.push(
            `📖 **[Contenido de tu documento "${docTitle}"]**\n${docRead.data.text.slice(0, 700)}${docRead.data.text.length > 700 ? "..." : ""}`
          );
        }
      } else {
        extraLines.push(
          `⚠️ **Documento "${docTitle}":** ${docRead.error || "No contiene texto extraíble (ej. PDF escaneado sin capa de texto). No inventaré páginas ni citas."}`
        );
      }
    } else if (Array.isArray(docsList.data) && docsList.data.length > 0) {
      const names = (docsList.data as Array<{ title: string }>)
        .slice(0, 3)
        .map((d) => `"${d.title}"`)
        .join(", ");
      extraLines.push(`📂 **Documentos en tu Estantería Académica:** ${names}. Selecciona uno arriba para analizarlo o generar un examen.`);
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "oficina") {
    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, Boolean(params.selectedResourceId));
    const extraLines: string[] = [];

    const workProjects = await getActiveWorkProjects(params.ctx);
    extraTools.push("getActiveWorkProjects");
    const firstProject = workProjects.projects[0];

    if (workProjects.projects.length > 0) {
      const projList = workProjects.projects
        .slice(0, 4)
        .map(
          (p) =>
            `• **${p.name}** (${p.workScope === "personal" ? "Personal" : "Profesional"} • ${p.pendingTasks} pendientes / ${p.totalTasks} tareas)`
        )
        .join("\n");
      extraLines.push(`💼 **[Tus proyectos reales en Trabajo]**\n${projList}`);
    } else if (workProjects.limitationNote) {
      extraLines.push(`ℹ️ **[Veracidad de proyectos]** ${workProjects.limitationNote}`);
    }

    if (plannedTools.includes("getPendingWorkTasks")) {
      const pending = await getPendingWorkTasks(params.ctx, firstProject?.id);
      extraTools.push("getPendingWorkTasks");
      if (pending.count > 0) {
        const taskList = pending.tasks
          .slice(0, 4)
          .map((t) => `• [${t.priority.toUpperCase()}] ${t.title} (${t.projectName})`)
          .join("\n");
        extraLines.push(`📋 **[Tareas pendientes prioritarias]**\n${taskList}`);
      } else {
        extraLines.push("📋 No tienes tareas pendientes registradas en proyectos reales.");
      }
    }

    if (plannedTools.includes("getLastWorkSession")) {
      const lastSession = await getLastWorkSession(params.ctx);
      extraTools.push("getLastWorkSession");
      if (lastSession.session) {
        extraLines.push(
          `⏱️ **[Última sesión de trabajo]** "${lastSession.session.title}" (${lastSession.session.duration_minutes} min, ${lastSession.session.timestamp.slice(0, 10)}, origen: ${lastSession.source}).`
        );
      } else {
        extraLines.push("⏱️ Aún no registras sesiones de trabajo en tu historial.");
      }
    }

    if (params.selectedResourceId) {
      const docRead = await readWorkDocument(resCtx, params.selectedResourceId);
      extraTools.push("readWorkDocument");
      if (docRead.ok && docRead.data?.text) {
        const docsList = await listWorkResources(resCtx);
        const docMeta = Array.isArray(docsList.data)
          ? (docsList.data as Array<{ id: string; title: string }>).find((d) => d.id === params.selectedResourceId)
          : undefined;
        const docTitle = docMeta?.title || "tu documento técnico";

        if (/(explica|c[oó]digo|funci[oó]n|snippet|paso a paso)/i.test(cleanQuestion)) {
          const codeExp = explainCodeSnippet(docTitle, docRead.data.text);
          extraTools.push("explainCodeSnippet");
          extraLines.push(
            `💻 **[Explicación de código — "${docTitle}" (${codeExp.detectedLanguage})]**\n${codeExp.stepByStepSummary.join("\n")}` +
              (codeExp.potentialEdgeCases.length > 0
                ? `\n⚠️ Puntos a vigilar: ${codeExp.potentialEdgeCases.join(" | ")}`
                : "")
          );
        } else {
          const analysis = analyzeTechnicalDocument(docTitle, docRead.data.text);
          extraTools.push("analyzeTechnicalDocument");
          const riskSummary =
            analysis.risksAndInconsistencies.length > 0
              ? `\n⚠️ **Riesgos/pendientes detectados:** ${analysis.risksAndInconsistencies.slice(0, 3).join(" | ")}`
              : "";
          const citeSummary =
            analysis.pageCitations.length > 0
              ? `\n📎 **Citas verificables:** ${analysis.pageCitations.join(", ")}`
              : "";
          extraLines.push(
            `📑 **[Análisis técnico — "${docTitle}"]**\n${docRead.data.text.slice(0, 550)}${docRead.data.text.length > 550 ? "..." : ""}${riskSummary}${citeSummary}`
          );
        }
      } else {
        extraLines.push(
          `⚠️ **Documento de Trabajo:** ${docRead.error || "No tiene texto extraíble o pertenece a otro edificio; no inventaré especificaciones."}`
        );
      }
    } else if (plannedTools.includes("listWorkResources")) {
      const docsList = await listWorkResources(resCtx);
      extraTools.push("listWorkResources");
      if (Array.isArray(docsList.data) && docsList.data.length > 0) {
        const names = (docsList.data as Array<{ title: string }>)
          .slice(0, 3)
          .map((d) => `"${d.title}"`)
          .join(", ");
        extraLines.push(`📂 **Archivo de Proyectos:** ${names}. Selecciona uno arriba para analizarlo.`);
      }
    }

    if (/(sprint|plan de trabajo|divide|dividir|prop[oó]n.*tarea|checklist|entregable)/i.test(cleanQuestion)) {
      proposal = proposeWorkSprint({
        projectId: firstProject?.id,
        projectName: firstProject?.name || "Proyecto activo",
        objective: cleanQuestion.slice(0, 90),
      });
      extraTools.push("proposeWorkSprint");
    } else if (/(cierre de jornada|resumen de cierre|cerrar el d[ií]a)/i.test(cleanQuestion)) {
      const last = await getLastWorkSession(params.ctx);
      proposal = proposeWorkSessionSummary({
        projectName: firstProject?.name || "Jornada de Trabajo",
        lastSessionTitle: last.session?.title,
        durationMinutes: last.session?.duration_minutes,
        notes: last.session?.notes,
      });
      extraTools.push("proposeWorkSessionSummary");
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "libreria") {
    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, Boolean(params.selectedResourceId));
    const extraLines: string[] = [];

    const lib = await getReadingBooks(params.ctx);
    extraTools.push("getReadingBooks");
    const activeBook = lib.currentlyReading[0];

    if (activeBook) {
      const pct =
        activeBook.total_pages > 0
          ? Math.round(((activeBook.pages_read || 0) / activeBook.total_pages) * 100)
          : 0;
      extraLines.push(
        `📖 **[Libro en curso]** "${activeBook.title}" de ${activeBook.author} — **${activeBook.pages_read}/${activeBook.total_pages} páginas (${pct}%)**.`
      );
    } else if (lib.totalBooks === 0) {
      extraLines.push("📚 Aún no tienes libros registrados en tu Librería.");
    } else {
      extraLines.push("📖 No tienes ningún libro marcado actualmente en curso (tus libros en wishlist no se cuentan como leídos).");
    }

    if (/(agregado|terminado|[uú]ltimo|sesi[oó]n|semana|p[aá]gina)/i.test(cleanQuestion)) {
      const detailParts: string[] = [];
      if (lib.lastAddedBook) detailParts.push(`• **Último agregado:** "${lib.lastAddedBook.title}"`);
      if (lib.lastReadBook) {
        detailParts.push(
          `• **Última sesión verificable:** "${lib.lastReadBook.title}" (${lib.lastReadBook.sessionDate.slice(0, 10)})`
        );
      } else {
        detailParts.push("• **Última sesión verificable:** sin sesiones de lectura registradas aún.");
      }
      if (lib.lastCompletedBook) {
        detailParts.push(`• **Último terminado:** "${lib.lastCompletedBook.title}"`);
      } else {
        detailParts.push("• **Último terminado:** aún no has marcado ningún libro como terminado.");
      }
      detailParts.push(`• **Páginas registradas esta semana:** ${lib.pagesReadLast7Days}`);
      if (lib.limitations.length > 0) detailParts.push(`• *Nota:* ${lib.limitations[0]}`);
      extraLines.push(`🕰️ **[Línea de tiempo literaria]**\n${detailParts.join("\n")}`);
    }

    if (plannedTools.includes("getBookQuotesAndNotes")) {
      const notes = await getBookQuotesAndNotes(params.ctx, activeBook?.id);
      extraTools.push("getBookQuotesAndNotes");
      if (notes.totalQuotesCount > 0) {
        const firstEntry = notes.entries[0];
        const quoteSample = firstEntry.quotes
          .slice(0, 2)
          .map((q) => `> "${q.text}"${q.page ? ` (pág. ${q.page})` : ""}`)
          .join("\n");
        extraLines.push(`✒️ **[Tus citas guardadas de "${firstEntry.title}"]**\n${quoteSample}`);
      } else {
        extraLines.push("✒️ Aún no tienes citas o reseñas personales guardadas para este libro.");
      }
    }

    if (/(reflexi[oó]n|diario|pregunta|personaje)/i.test(cleanQuestion) && activeBook) {
      extraLines.push(proposeReadingReflection(activeBook));
      extraTools.push("proposeReadingReflection");
    }

    if (/(pr[oó]xima lectura|recomienda|qu[eé] leer|siguiente libro)/i.test(cleanQuestion)) {
      extraLines.push(recommendNextBook(lib));
      extraTools.push("recommendNextBook");
    }

    if (/(rese[nñ]a|guardar.*nota|anotar.*cita|prop[oó]n.*rese[nñ]a)/i.test(cleanQuestion) && activeBook) {
      proposal = proposeBookReview(activeBook);
      extraTools.push("proposeBookReview");
    }

    if (params.selectedResourceId) {
      const docRead = await readReadingResource(resCtx, params.selectedResourceId);
      extraTools.push("readReadingResource");
      if (docRead.ok && docRead.data?.text) {
        extraLines.push(
          `📜 **[Tu recurso literario]** ${docRead.data.text.slice(0, 550)}${docRead.data.text.length > 550 ? "..." : ""}`
        );
      } else {
        extraLines.push(
          `⚠️ **Recurso literario:** ${docRead.error || "No contiene texto extraíble o pertenece a otro edificio; no inventaré citas ni páginas."}`
        );
      }
    } else if (plannedTools.includes("listReadingResources")) {
      const docsList = await listReadingResources(resCtx);
      extraTools.push("listReadingResources");
      if (Array.isArray(docsList.data) && docsList.data.length > 0) {
        const names = (docsList.data as Array<{ title: string }>)
          .slice(0, 3)
          .map((d) => `"${d.title}"`)
          .join(", ");
        extraLines.push(`📂 **Recursos en tu Librería:** ${names}.`);
      }
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "gimnasio") {
    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, Boolean(params.selectedResourceId));
    const extraLines: string[] = [];

    const medGuard = detectMedicalOrInjuryQuery(cleanQuestion);
    if (medGuard) {
      extraLines.push(medGuard);
    }

    const workout = await getLastRealWorkout(params.ctx);
    extraTools.push("getLastRealWorkout");
    const vol = workout.realSetsVolume;

    if (vol.completedSetsCount > 0) {
      const prs = getGymPersonalRecords(params.ctx.localSnapshot?.gymSets || []);
      const topEx = prs[0];
      extraLines.push(
        `🏋️ **[Series registradas en tu navegador local (local_snapshot — no verificadas aún en servidor)]** ${vol.completedSetsCount} series completadas • Volumen total: **${vol.totalVolumeKg} kg**` +
          (vol.averageRpe !== null ? ` • RPE medio: **${vol.averageRpe}/10**` : "") +
          (topEx ? ` • Último peso en ${topEx.exerciseName}: **${topEx.lastWeightKg} kg x ${topEx.lastReps} reps** (máx. ${topEx.maxWeightKg} kg).` : ".")
      );
    } else if (!workout.lastWorkout) {
      extraLines.push(
        "🏋️ Aún no tienes entrenamientos ni series reales registradas (las series de ejemplo precargadas no se cuentan como historial tuyo)."
      );
    }

    if (plannedTools.includes("getTrainingConsistency")) {
      const consistency = await getTrainingConsistency(params.ctx, 14);
      extraTools.push("getTrainingConsistency");
      extraLines.push(
        `📅 **[Constancia 14 días]** ${consistency.sessionsInWindow} sesiones registradas.` +
          (consistency.restNote ? ` ${consistency.restNote}` : "")
      );
    }

    if (params.selectedResourceId) {
      const docRead = await readWorkoutPlan(resCtx, params.selectedResourceId);
      extraTools.push("readWorkoutPlan");
      if (docRead.ok && docRead.data?.text) {
        extraLines.push(
          `📋 **[Tu plan en Pizarra de Rutinas]** ${docRead.data.text.slice(0, 550)}${docRead.data.text.length > 550 ? "..." : ""}`
        );
      } else {
        extraLines.push(
          `⚠️ **Recurso de Gym:** ${docRead.error || "No tiene texto extraíble o pertenece a otro edificio; no inventaré rutinas."}`
        );
      }
    } else if (plannedTools.includes("listGymResources")) {
      const docsList = await listGymResources(resCtx);
      extraTools.push("listGymResources");
      if (Array.isArray(docsList.data) && docsList.data.length > 0) {
        const names = (docsList.data as Array<{ title: string }>)
          .slice(0, 3)
          .map((d) => `"${d.title}"`)
          .join(", ");
        extraLines.push(`📂 **Pizarra de Rutinas:** ${names}.`);
      }
    }

    if (!medGuard && /(prop[oó]n|rutina|pr[oó]ximo entrenamiento|prepara.*sesi[oó]n|progresi[oó]n)/i.test(cleanQuestion)) {
      const prs = getGymPersonalRecords(params.ctx.localSnapshot?.gymSets || []);
      const last = prs[0];
      proposal = proposeNextWorkout({
        focus: cleanQuestion.slice(0, 70),
        lastExercise: last?.exerciseName,
        lastWeightKg: last?.lastWeightKg,
        lastReps: last?.lastReps,
      });
      extraTools.push("proposeNextWorkout");
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "club_puzzles") {
    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, Boolean(params.selectedResourceId));
    const extraLines: string[] = [];

    const cubeTypeMatch = cleanQuestion.match(/\b(2x2|3x3|4x4|pyraminx|megaminx)\b/i);
    const detectedCubeType: RubikCubeType = cubeTypeMatch
      ? ((cubeTypeMatch[1].toLowerCase() === "pyraminx"
          ? "Pyraminx"
          : cubeTypeMatch[1].toLowerCase() === "megaminx"
          ? "Megaminx"
          : cubeTypeMatch[1].toLowerCase()) as RubikCubeType)
      : "3x3";

    const historyRes = await getCubeSolveHistory(params.ctx, detectedCubeType);
    extraTools.push("getCubeSolveHistory");
    const st = historyRes.stats;

    if (st.totalSolves > 0) {
      const ao5Label =
        st.ao5.status === "valid"
          ? `${st.ao5.averageSeconds}s`
          : st.ao5.status === "dnf"
          ? "DNF"
          : `pendiente (${st.ao5.haveSolves}/5 solves)`;
      const ao12Label =
        st.ao12.status === "valid"
          ? `${st.ao12.averageSeconds}s`
          : st.ao12.status === "dnf"
          ? "DNF"
          : `pendiente (${st.ao12.haveSolves}/12 solves)`;
      extraLines.push(
        `🧩 **[Estadísticas reales — ${st.cubeType} (${historyRes.source})]** ` +
          `Solves: **${st.totalSolves}** (DNFs: ${st.dnfCount}) • PB: **${st.pbSeconds !== null ? `${st.pbSeconds}s` : "sin tiempo válido"}** • ` +
          `Ao5 (WCA): **${ao5Label}** • Ao12 (entrenamiento): **${ao12Label}**` +
          (st.stdDevSeconds !== null ? ` • Consistencia (σ): **±${st.stdDevSeconds}s**` : "") +
          (st.lastPracticedAlgorithm ? ` • Último algoritmo practicado: **${st.lastPracticedAlgorithm}**.` : ".")
      );
    } else {
      extraLines.push(
        `🧩 Aún no tienes solves reales registrados para **${detectedCubeType}** (los valores precargados en inputs no se cuentan como historial).`
      );
    }

    if (plannedTools.includes("getRegisteredCubes")) {
      const cubes = await getRegisteredCubes(params.ctx);
      extraTools.push("getRegisteredCubes");
      if (cubes.activeCube) {
        extraLines.push(
          `🧊 **[Tu cubo activo]** ${cubes.activeCube.brand} ${cubes.activeCube.model_name} (${cubes.activeCube.cube_type}) • Total registrados: ${cubes.count}.`
        );
      } else {
        extraLines.push("🧊 Aún no tienes cubos físicos registrados en tu estantería.");
      }
    }

    if (/(notaci[oó]n|qu[eé] significa|r'|u2|f2l|oll|pll|movimiento)/i.test(cleanQuestion)) {
      extraLines.push(explainCubeNotation(cleanQuestion));
      extraTools.push("explainCubeNotation");
    }

    if (params.selectedResourceId) {
      const docRead = await readAlgorithmSheet(resCtx, params.selectedResourceId);
      extraTools.push("readAlgorithmSheet");
      if (docRead.ok && docRead.data?.text) {
        extraLines.push(
          `📜 **[Tu hoja de algoritmos]** ${docRead.data.text.slice(0, 550)}${docRead.data.text.length > 550 ? "..." : ""}`
        );
      } else {
        extraLines.push(
          `⚠️ **Recurso de Cubos:** ${docRead.error || "No tiene texto extraíble o pertenece a otro edificio; no inventaré algoritmos."}`
        );
      }
    } else if (plannedTools.includes("listCubeTrainingResources")) {
      const docsList = await listCubeTrainingResources(resCtx);
      extraTools.push("listCubeTrainingResources");
      if (Array.isArray(docsList.data) && docsList.data.length > 0) {
        const names = (docsList.data as Array<{ title: string }>)
          .slice(0, 3)
          .map((d) => `"${d.title}"`)
          .join(", ");
        extraLines.push(`📂 **Cuaderno de Algoritmos:** ${names}.`);
      }
    }

    if (/(plan|pr[aá]ctica|rutina|mejorar|prop[oó]n.*sesi[oó]n|estudiar.*algoritmo)/i.test(cleanQuestion)) {
      proposal = proposeCubePracticeSession({
        cubeType: detectedCubeType,
        focus: cleanQuestion.slice(0, 70),
        currentAo5: st.ao5.averageSeconds,
      });
      extraTools.push("proposeCubePracticeSession");
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "cine") {
    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, Boolean(params.selectedResourceId));
    const extraLines: string[] = [];

    const col = await getCinemaCollection(params.ctx);
    extraTools.push("getCinemaCollection");

    if (col.entries.length > 0) {
      const parts: string[] = [];
      if (col.lastWatchedMovie) {
        parts.push(
          `• **Última película vista:** "${col.lastWatchedMovie.title}" (${(col.lastWatchedMovie.watchedAt || col.lastWatchedMovie.updatedAt).slice(0, 10)})`
        );
      }
      if (col.watching.length > 0) {
        const s = col.watching[0];
        const ep = s.kind === "series" ? ` — T${s.season || 1} E${s.episode || 0}` : "";
        parts.push(`• **Viendo ahora:** "${s.title}" (${s.kind}${ep})`);
      }
      const pendingMusicals = col.watchlist.filter((e) => e.kind === "musical");
      if (pendingMusicals.length > 0) {
        parts.push(`• **Musicales pendientes (${pendingMusicals.length}):** ${pendingMusicals.slice(0, 3).map((m) => `"${m.title}"`).join(", ")}`);
      }
      if (col.topRated.length > 0) {
        parts.push(`• **Mejor valorada:** "${col.topRated[0].title}" (${col.topRated[0].rating}/5)`);
      }
      if (col.limitationNote) parts.push(`• *Origen:* ${col.limitationNote}`);
      if (parts.length > 0) {
        extraLines.push(`🎬 **[Tu Cartelera Cultural (${col.source})]**\n${parts.join("\n")}`);
      }
    }

    const wantsMusical = /musical/i.test(cleanQuestion);
    if (/(noche de|marat[oó]n|prepara)/i.test(cleanQuestion)) {
      extraLines.push(proposeMovieNight(col, wantsMusical ? "musical" : undefined));
      extraTools.push("proposeMovieNight");
    } else if (plannedTools.includes("recommendFromWatchlist")) {
      const rec = recommendFromWatchlist(col, wantsMusical ? "musical" : undefined);
      extraLines.push(rec.message);
      extraTools.push("recommendFromWatchlist");
    }

    if (/(prop[oó]n.*rese[nñ]a|escrib.*rese[nñ]a|guardar.*rese[nñ]a)/i.test(cleanQuestion)) {
      const target = col.lastWatchedMovie || col.favorites[0] || col.entries[0];
      if (target) {
        proposal = proposeCinemaReview(target);
        extraTools.push("proposeCinemaReview");
      }
    }

    if (params.selectedResourceId) {
      const docRead = await readCinemaReview(resCtx, params.selectedResourceId);
      extraTools.push("readCinemaReview");
      if (docRead.ok && docRead.data?.text) {
        extraLines.push(
          `📜 **[Tu recurso en Cine]** ${docRead.data.text.slice(0, 550)}${docRead.data.text.length > 550 ? "..." : ""}`
        );
      } else {
        extraLines.push(
          `⚠️ **Recurso de Cine:** ${docRead.error || "No tiene texto extraíble o pertenece a otro edificio."}`
        );
      }
    } else if (plannedTools.includes("listCinemaResources")) {
      const docsList = await listCinemaResources(resCtx);
      extraTools.push("listCinemaResources");
      if (Array.isArray(docsList.data) && docsList.data.length > 0) {
        const names = (docsList.data as Array<{ title: string }>)
          .slice(0, 3)
          .map((d) => `"${d.title}"`)
          .join(", ");
        extraLines.push(`📂 **Cartelera Personal (documentos):** ${names}.`);
      }
    }

    if (extraLines.length > 0) {
      deterministicDraft = `${deterministicDraft}\n\n${extraLines.join("\n\n")}`;
    }
  } else if (skill.buildingId === "banco_oakhaven") {
    // Defensa estricta adicional para Silas: jamás modifica saldos, cuentas, deudas ni pagos
    if (/(modifica|cambia|actualiza|crea|borra|elimina|liquida|paga|transfiere)\s+(mi\s+|un\s+|una\s+|el\s+|la\s+)?(saldo|cuenta|deuda|obligaci[oó]n|pago|transferencia|movimiento)/i.test(cleanQuestion)) {
      return {
        specialist: specialistMeta,
        answer:
          "🛡️ **Bloqueo financiero de Silas:** Analizo tu información en modo de solo lectura, pero **no muevo dinero ni modifico saldos, pagos u obligaciones**. Usa los controles manuales del Banco para registrar cualquier operación real.",
        mode: "blocked_safety",
        toolsUsed: [],
        citations: [],
      };
    }

    const plannedTools = selectAuthorizedToolsForIntent(skill, cleanQuestion, false);
    const periodDays = /mes|mensual|30/i.test(cleanQuestion) ? 30 : /semana|7/i.test(cleanQuestion) ? 7 : 15;
    const fin = await getVerifiedFinancialMovements(params.ctx, periodDays);
    extraTools.push("getVerifiedFinancialMovements");

    const lines: string[] = [
      `🏦 **[HECHO REGISTRADO — ${fin.currency}, últimos ${fin.periodDays} días • origen: ${fin.provenance}]**`,
      `• Ingresos verificados: **$${fin.totalIncomeCop.toLocaleString("es-CO")} COP**`,
      `• Gastos verificados: **$${fin.totalExpenseCop.toLocaleString("es-CO")} COP**`,
      `• Flujo neto (cálculo determinista): **$${fin.netCashflowCop.toLocaleString("es-CO")} COP** (${fin.verifiedCount} movimientos)`,
    ];

    if (fin.breakdownByCategory.length > 0) {
      const topCats = fin.breakdownByCategory
        .slice(0, 3)
        .map((c) => `${c.category}: $${c.totalCop.toLocaleString("es-CO")} COP`)
        .join(" • ");
      lines.push(`• Principales categorías de gasto: ${topCats}`);
    }
    if (fin.potentialDuplicates.length > 0) {
      lines.push(
        `• ⚠️ **Posibles duplicados para revisión manual (${fin.potentialDuplicates.length}):** "${fin.potentialDuplicates[0].description}" por $${fin.potentialDuplicates[0].amountCop.toLocaleString("es-CO")} COP (${fin.potentialDuplicates[0].date}).`
      );
    }
    if (fin.isStale) {
      lines.push(
        `• ℹ️ **Frescura de datos:** ${fin.latestMovementDate ? `último registro fechado ${fin.latestMovementDate.slice(0, 10)} (posiblemente desactualizado)` : "sin movimientos recientes verificados"}.`
      );
    }
    if (fin.limitationNote) {
      lines.push(`• *Nota:* ${fin.limitationNote}`);
    }

    if (plannedTools.includes("getRecordedObligations")) {
      const ob = await getRecordedObligations(params.ctx);
      extraTools.push("getRecordedObligations");
      lines.push(
        `📅 **[OBLIGACIONES REGISTRADAS (${ob.provenance})]** Costos fijos: **$${ob.totalFixedObligationsCop.toLocaleString("es-CO")} COP** (${ob.fixedCostsCount}) • Cuotas mínimas de deudas activas: **$${ob.totalMinDebtPaymentsCop.toLocaleString("es-CO")} COP** (${ob.activeDebtsCount}). *Nota: no se asume pago automático sin evidencia.*`
      );
    }

    if (plannedTools.includes("simulateBudgetScenario")) {
      const amountMatch = cleanQuestion.match(/(\d[\d.,]*)\s*(cop|pesos)?/i);
      const parsedAmount = amountMatch ? Number(amountMatch[1].replace(/[.,]/g, "")) : 100000;
      const safeAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 100000;
      if (/deuda|abono|pago extra/i.test(cleanQuestion)) {
        const ob = await getRecordedObligations(params.ctx);
        const firstDebt = ob.debts[0];
        const sim = simulateDebtPaymentImpact({
          debtName: firstDebt?.name || "Deuda de ejemplo",
          currentBalanceCop: firstDebt?.currentBalanceCop || safeAmount * 4,
          extraPaymentCop: safeAmount,
        });
        extraTools.push("simulateDebtPaymentImpact");
        lines.push(
          `🧮 **[ESCENARIO HIPOTÉTICO — SIN ESCRITURA]** Si aplicaras un abono extra de **$${sim.hypotheticalExtraPaymentCop.toLocaleString("es-CO")} COP** a "${sim.debtName}", el saldo proyectado bajaría de $${sim.currentBalanceCop.toLocaleString("es-CO")} a **$${sim.projectedBalanceCop.toLocaleString("es-CO")} COP** (-${sim.reductionPercent}%). ${sim.disclaimer}`
        );
      } else {
        const sim = simulateBudgetScenario({
          monthlySavingCop: safeAmount,
          months: 6,
          currentNetCashflowCop: fin.netCashflowCop,
        });
        extraTools.push("simulateBudgetScenario");
        lines.push(
          `🧮 **[ESCENARIO HIPOTÉTICO — SIN ESCRITURA]** Si ahorraras **$${sim.monthlySavingCop.toLocaleString("es-CO")} COP/mes** durante ${sim.months} meses, acumularías **$${sim.projectedSavedCop.toLocaleString("es-CO")} COP** (flujo remanente estimado: $${sim.remainingCashflowCop.toLocaleString("es-CO")} COP). ${sim.disclaimer}`
        );
      }
    }

    if (plannedTools.includes("explainGpVsCop")) {
      extraTools.push("explainGpVsCop");
      lines.push(explainGpVsCop());
    }

    // Privacidad financiera estricta: Silas responde 100% desde cálculos deterministas locales sin enviar datos a Gemini
    deterministicDraft = lines.join("\n");
  }

  let finalAnswer = proposal
    ? `${deterministicDraft}\n\n💡 **Propuesta lista para tu confirmación:** ${proposal.title}. Revisa los detalles abajo y pulsa **Confirmar** solo si deseas aplicarla.`
    : deterministicDraft;
  let mode: SpecialistAnswerResponse["mode"] = "deterministic_grounded";

  // Regla obligatoria Fase 6 (Hito 7): NUNCA enviar datos financieros de Silas a Gemini por defecto
  const canUseGeminiForBuilding =
    params.allowGemini !== false && skill.buildingId !== "banco_oakhaven";

  if (canUseGeminiForBuilding) {
    params.onGeminiAttemptForTests?.();
    const polished = await trySpecialistGeminiPolish(
      skill,
      cleanQuestion,
      finalAnswer,
      results,
      params.history || []
    );
    if (polished) {
      finalAnswer = polished;
      mode = "gemini_grounded";
    }
  }

  const citations: MayorCitation[] = results.map((r) => ({
    tool: r.tool,
    buildingId: r.buildingId,
    source:
      r.source === "supabase"
        ? "Supabase (nube)"
        : r.source === "local_device_snapshot"
        ? "Navegador local"
        : r.source === "memory_store"
        ? "Estado de sesión"
        : "Sin datos",
    asOf: r.asOf,
    limitationNote: r.limitationNote,
  }));

  return {
    specialist: specialistMeta,
    answer: finalAnswer,
    mode,
    toolsUsed: Array.from(new Set([...results.map((r) => r.tool), ...extraTools])),
    citations,
    proposal,
  };
}
