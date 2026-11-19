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

export interface SpecialistProposal {
  id: string;
  buildingId: string;
  specialistName: string;
  actionType:
    | "add_cinema_entry"
    | "add_knitting_project"
    | "add_reading_note"
    | "plan_study_block"
    | "plan_work_sprint"
    | "plan_gym_routine";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  requiresConfirmation: true;
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
  const proposal = buildLevel2ProposalIfRequested(skill, cleanQuestion);

  // 4. Respuesta determinista grounded
  const deterministicDraft = buildDeterministicGroundedAnswer(cleanQuestion, results);
  let finalAnswer = proposal
    ? `${deterministicDraft}\n\n💡 **Propuesta lista para tu confirmación:** ${proposal.title}. Revisa los detalles abajo y pulsa **Confirmar** solo si deseas aplicarla.`
    : deterministicDraft;
  let mode: SpecialistAnswerResponse["mode"] = "deterministic_grounded";

  if (params.allowGemini !== false) {
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
    toolsUsed: results.map((r) => r.tool),
    citations,
    proposal,
  };
}
