/**
 * ============================================================================
 * MOTOR DEL PRESIDENTE ROWAN — ORQUESTADOR GROUNDED (FASE 1)
 * ============================================================================
 * 1. Selecciona solo 1–3 herramientas de solo lectura según la pregunta (nunca envía toda la BD).
 * 2. Bloquea intentos de prompt injection o solicitudes de pagos/mutaciones de nivel 3.
 * 3. Construye una respuesta determinista 100 % basada en datos reales con fecha y origen.
 * 4. Opcionalmente pule la redacción con Gemini (con timeout, rate limit y fallback determinista).
 */

import { GoogleGenAI } from "@google/genai";
import {
  MAYOR_ROWAN_SKILL,
  type MayorReadOnlyToolName,
} from "./building-skills-registry.ts";
import {
  executeMayorReadOnlyTool,
  type MayorToolContext,
  type ToolExecutionResult,
} from "./mayor-readonly-tools.ts";
import { recordAiTelemetryEvent } from "./ai-observability.ts";
import {
  buildRowanDailyPlan,
  detectDailyPlanIntent,
} from "./rowan-command-center.ts";

export interface MayorChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface MayorCitation {
  tool: string;
  buildingId: string;
  source: string;
  asOf: string;
  limitationNote?: string;
}

export interface MayorBuildingLink {
  buildingId: string;
  label: string;
  icon: string;
}

export interface MayorAnswerResponse {
  answer: string;
  mode: "gemini_grounded" | "deterministic_grounded" | "blocked_safety";
  toolsUsed: string[];
  citations: MayorCitation[];
  buildingLinks: MayorBuildingLink[];
  warnings?: string[];
}

const BUILDING_LINK_META: Record<string, MayorBuildingLink> = {
  banco_oakhaven: { buildingId: "banco_oakhaven", label: "Abrir Banco", icon: "🏦" },
  biblioteca: { buildingId: "biblioteca", label: "Abrir Estudio", icon: "🏛️" },
  oficina: { buildingId: "oficina", label: "Abrir Trabajo", icon: "💼" },
  gimnasio: { buildingId: "gimnasio", label: "Abrir Gym", icon: "🏋️" },
  club_puzzles: { buildingId: "club_puzzles", label: "Abrir Cubos", icon: "🧩" },
  libreria: { buildingId: "libreria", label: "Abrir Lectura", icon: "📚" },
  cine: { buildingId: "cine", label: "Abrir Cine", icon: "🎬" },
  atelier: { buildingId: "atelier", label: "Abrir Crochet", icon: "🧶" },
};

const MAX_TOOL_CALLS_PER_TURN = 3;

const EXPLICIT_FINANCIAL_INTENT_REGEX =
  /(gast[eé]|gastos?|banco|dinero|\bcop\b|presupuesto|obligaci[oó]n|deuda|flujo de caja|ingresos?|quincena|compra)/i;

export function isExplicitFinancialQuestion(message: string): boolean {
  return EXPLICIT_FINANCIAL_INTENT_REGEX.test((message || "").toLowerCase());
}

export function stripFinancialHistoryForGemini(history: MayorChatTurn[]): MayorChatTurn[] {
  return history.filter((turn) => {
    const c = turn.content || "";
    return !/(\bcop\b|\$\s?\d|banco|gastos?\s+[uú]ltimos|extracto|deuda|obligaci[oó]n|presupuesto|saldo)/i.test(c);
  });
}

export function redactSensitiveForLogs(text: string): string {
  return (text || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[CARD_REDACTED]")
    .replace(/\b\d{6,12}\b/g, "[ACCOUNT_REDACTED]")
    .replace(/(sk-[a-zA-Z0-9]{12,}|AIza[0-9A-Za-z\-_]{20,}|eyJ[a-zA-Z0-9._-]{20,})/g, "[SECRET_REDACTED]");
}

export function detectUnsafeActionRequest(message: string): string | null {
  const lower = (message || "").toLowerCase();
  if (
    /(pagar|transfiere|transferir|ejecuta(r)?\s+(un\s+)?pago|haz\s+un\s+pago|descuenta\s+saldo|modifica(r)?\s+mi\s+saldo|cambia(r)?\s+cop)/i.test(
      lower
    )
  ) {
    return "Como Presidente de OakHaven (Nivel 1 — Solo Lectura), tengo prohibido ejecutar pagos, transferencias o modificar saldos reales en COP. Puedes revisar o registrar tus movimientos directamente en el Banco.";
  }
  if (
    /(dame\s+\d+\s*(gp|xp)|s[uú]beme\s+(de\s+nivel|gp|xp)|reg[aá]lame\s+(gp|xp)|modifica(r)?\s+(gp|xp))/i.test(
      lower
    )
  ) {
    return "No puedo alterar GP ni XP directamente. Todas las recompensas provienen exclusivamente del motor RPG canónico al completar actividades reales.";
  }
  if (
    /(ignora\s+(todas\s+las\s+)?instrucciones|system\s+prompt|act[uú]a\s+como\s+admin|mu[eé]strame\s+datos\s+de\s+otro\s+usuario|bypass\s+rls)/i.test(
      lower
    )
  ) {
    return "Solo puedo consultar tu propia información verificada de OakHaven dentro de las reglas de seguridad vigentes.";
  }
  return null;
}

export function selectToolsForQuestion(message: string): Array<{
  tool: MayorReadOnlyToolName;
  args?: Record<string, unknown>;
}> {
  const q = (message || "").toLowerCase();
  const plan: Array<{ tool: MayorReadOnlyToolName; args?: Record<string, unknown> }> = [];

  if (/(libro|lectura|le[ií]|termin[eé].*libro|biblioteca|p[aá]gina)/i.test(q)) {
    plan.push({ tool: "getLastReadBook" });
  }
  if (/(crochet|tejido|tej[ií]|vuelta|atelier|ovillo|patr[oó]n)/i.test(q)) {
    plan.push({ tool: "getLastKnittingActivity" });
  }
  if (/(pel[ií]cula|serie|musical|cine|viendo|marqu[eé]\s+como\s+vista|watchlist)/i.test(q)) {
    plan.push({ tool: "getLastWatchedMedia" });
  }
  // P0 Privacidad (Fase 7): exigir intención financiera explícita; nunca activar por "semana" genérico
  if (isExplicitFinancialQuestion(q)) {
    const days = /mes|mensual|30\s*d[ií]as/i.test(q) ? 30 : /quincena|15\s*d[ií]as/i.test(q) ? 15 : 7;
    plan.push({ tool: "getRecentExpenses", args: { days, limit: 20 } });
  }
  if (/(entren|gym|gimnasio|ejercicio|rutina|deporte|fuerza)/i.test(q)) {
    plan.push({ tool: "getLastWorkout" });
  }
  if (/(cubo|rubik|r[eé]cord|pb|ao5|ao12|solve|speedcubing)/i.test(q)) {
    plan.push({ tool: "getRecentCubeSolves", args: { limit: 15 } });
  }
  if (/(trabajo|proyecto|oficina|pendiente|entregable|programaci[oó]n|sprint)/i.test(q)) {
    plan.push({ tool: "getPendingWorkProjects" });
  }
  if (/(estudi|academia|sm-2|flashcard|repaso|materia)/i.test(q)) {
    plan.push({ tool: "getStudyProgress" });
  }

  if (plan.length === 0) {
    plan.push({ tool: "getVillageSummary" });
  }

  return plan.slice(0, MAX_TOOL_CALLS_PER_TURN);
}

function formatDateEs(iso?: string | null): string {
  if (!iso) return "sin fecha registrada";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "sin fecha registrada";
  return new Date(ts).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sourceLabel(source: string): string {
  switch (source) {
    case "supabase":
      return "Supabase (nube)";
    case "memory_store":
      return "Estado de sesión actual";
    case "local_device_snapshot":
      return "Navegador local (este dispositivo)";
    default:
      return "Sin fuente disponible";
  }
}

export function buildDeterministicGroundedAnswer(
  question: string,
  results: ToolExecutionResult[]
): string {
  const sections: string[] = [];

  for (const res of results) {
    if (!res.ok) {
      sections.push(`• (${res.tool}): ${res.error || "No fue posible consultar esta fuente."}`);
      continue;
    }

    const d = (res.data || {}) as Record<string, unknown>;

    if (res.tool === "getLastReadBook") {
      if (!res.hasData) {
        sections.push("📚 **Lectura:** Todavía no tienes libros ni sesiones de lectura registrados.");
      } else {
        const current = d.currentlyReadingBook as Record<string, unknown> | null;
        const created = d.lastCreatedBook as Record<string, unknown> | null;
        const completed = d.lastCompletedBook as Record<string, unknown> | null;
        const session = d.lastReadingSession as Record<string, unknown> | null;
        const pages7 = Number(d.pagesReadLast7Days || 0);
        const quotes = (d.currentBookQuotes as Array<{ text: string; page?: number }>) || [];
        const lines: string[] = [`📚 **Lectura** *(fuente: ${sourceLabel(res.source)})*:`];
        if (current) {
          lines.push(
            `- **Libro en curso:** "${current.title}" (${current.pages_read || current.current_page || 0}/${current.total_pages || "?"} págs.).`
          );
        }
        if (created) {
          lines.push(
            `- **Último libro registrado:** "${created.title}" (${created.pages_read || created.current_page || 0}/${created.total_pages || "?"} págs., creado: ${formatDateEs(String(created.created_at || ""))}).`
          );
        }
        if (completed) {
          lines.push(
            `- **Último libro terminado:** "${completed.title}" (actualizado: ${formatDateEs(String(completed.updated_at || ""))}).`
          );
        } else {
          lines.push("- **Libro terminado más reciente:** Ninguno marcado como completado aún.");
        }
        if (session) {
          lines.push(
            `- **Última sesión de lectura:** "${session.title}" (${session.duration_minutes || 0} min, fecha: ${formatDateEs(String(session.completed_at || session.timestamp || ""))}).`
          );
        }
        if (pages7 > 0) {
          lines.push(`- **Páginas registradas esta semana:** ${pages7}.`);
        }
        if (quotes.length > 0) {
          lines.push(`- **Citas guardadas en tu libro actual (${quotes.length}):** "${quotes[0].text.slice(0, 90)}"${quotes[0].page ? ` (pág. ${quotes[0].page})` : ""}.`);
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getLastKnittingActivity") {
      if (!res.hasData) {
        sections.push("🧶 **Crochet (Atelier):** No encontré proyectos ni sesiones de tejido registradas aún.");
      } else {
        const updated = d.lastUpdatedProject as Record<string, unknown> | null;
        const created = d.lastCreatedProject as Record<string, unknown> | null;
        const session = d.lastKnittingSession as Record<string, unknown> | null;
        const lines: string[] = [`🧶 **Crochet (Atelier)** *(fuente: ${sourceLabel(res.source)})*:`];
        if (updated) {
          lines.push(
            `- **Último proyecto modificado:** "${updated.name}" (${updated.completed_rows || 0}/${updated.total_rows_target || "?"} vueltas, estado: ${updated.status}, actualizado: ${formatDateEs(String(updated.updated_at || ""))}).`
          );
        }
        if (created && created.id !== updated?.id) {
          lines.push(
            `- **Último proyecto creado:** "${created.name}" (${formatDateEs(String(created.created_at || ""))}).`
          );
        }
        if (session) {
          lines.push(
            `- **Última sesión realizada:** "${session.title}" (${session.duration_minutes || 0} min, fecha: ${formatDateEs(String(session.completed_at || session.timestamp || ""))}).`
          );
        }
        if (res.limitationNote) lines.push(`- *Nota:* ${res.limitationNote}`);
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getLastWatchedMedia") {
      if (!res.hasData) {
        sections.push(
          `🎬 **Cine:** No encontré películas, series ni musicales disponibles. ${res.limitationNote || ""}`.trim()
        );
      } else {
        const watching = (d.currentlyWatching as Array<Record<string, unknown>>) || [];
        const lastMovie = d.lastWatchedMovie as Record<string, unknown> | null;
        const lines: string[] = [`🎬 **Cine** *(fuente: ${sourceLabel(res.source)})*:`];
        if (watching.length > 0) {
          const w = watching[0];
          const ep = w.kind === "series" ? ` (T${w.season || 1} E${w.episode || 0})` : "";
          lines.push(`- **Viendo ahora:** "${w.title}"${ep} (actualizado: ${formatDateEs(String(w.updatedAt || ""))}).`);
        } else {
          lines.push("- **Viendo ahora:** Ninguna obra marcada actualmente.");
        }
        if (lastMovie) {
          lines.push(
            `- **Última película marcada como vista:** "${lastMovie.title}" (${formatDateEs(String(lastMovie.watchedAt || lastMovie.updatedAt || ""))}).`
          );
        } else {
          lines.push("- **Última película vista:** Ninguna marcada como vista todavía.");
        }
        if (res.limitationNote) lines.push(`- *Nota:* ${res.limitationNote}`);
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getRecentExpenses") {
      if (!res.hasData) {
        sections.push("🏦 **Banco:** No tienes gastos registrados todavía en tu historial.");
      } else {
        const lastTx = d.lastExpense as Record<string, unknown> | null;
        const totalWindow = Number(d.totalSpentWindowCop || 0);
        const days = Number(d.windowDays || 7);
        const count = Number(d.transactionsInWindowCount || 0);
        const lines: string[] = [`🏦 **Banco** *(fuente: ${sourceLabel(res.source)})*:`];
        lines.push(
          `- **Total gastado en los últimos ${days} días:** $${totalWindow.toLocaleString("es-CO")} COP (${count} movimiento${count === 1 ? "" : "s"}).`
        );
        if (lastTx) {
          lines.push(
            `- **Último gasto registrado:** "${lastTx.merchant_or_concept || "Movimiento"}" por $${Number(lastTx.amount_cop || 0).toLocaleString("es-CO")} COP (${formatDateEs(String(lastTx.created_at || lastTx.timestamp || ""))}).`
          );
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getLastWorkout") {
      if (!res.hasData) {
        sections.push("🏋️ **Gym:** No tienes sesiones de entrenamiento registradas todavía.");
      } else {
        const w = d.lastWorkout as Record<string, unknown> | null;
        const lastSet = d.lastRealSet as { exerciseName?: string; weightKg?: number; reps?: number } | null;
        const lines: string[] = [`🏋️ **Gym** *(fuente: ${sourceLabel(res.source)})*:`];
        if (w) {
          lines.push(
            `- **Último entrenamiento:** "${w.title || "Sesión de gimnasio"}" (${w.duration_minutes || 0} min, fecha: ${formatDateEs(String(w.completed_at || w.timestamp || ""))}).`
          );
        }
        if (lastSet) {
          lines.push(
            `- **Última serie en navegador local (local_snapshot):** ${lastSet.exerciseName} — ${lastSet.weightKg} kg x ${lastSet.reps} reps (volumen local: ${Number(d.totalVolumeKg || 0)} kg; pendiente de sincronización en servidor).`
          );
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getRecentCubeSolves") {
      if (!res.hasData) {
        sections.push("🧩 **Cubos:** Todavía no tienes solves registrados en el Club WCA.");
      } else {
        const last = d.lastSolve as Record<string, unknown> | null;
        const pb = d.lastMarkedPb as Record<string, unknown> | null;
        const lastAlg = d.lastPracticedAlgorithm as string | null;
        const lines: string[] = [`🧩 **Cubos (WCA)** *(fuente: ${sourceLabel(res.source)})*:`];
        if (pb) {
          lines.push(
            `- **Último récord / mejor tiempo reciente:** ${Number(pb.time_seconds).toFixed(2)}s en ${pb.cube_type || "3x3"} (${formatDateEs(String(pb.created_at || pb.timestamp || ""))}).`
          );
        }
        if (last) {
          lines.push(
            `- **Último solve registrado:** ${Number(last.time_seconds).toFixed(2)}s en ${last.cube_type || "3x3"} (${formatDateEs(String(last.created_at || last.timestamp || ""))}).`
          );
        }
        if (lastAlg) {
          lines.push(`- **Último algoritmo practicado:** ${lastAlg}.`);
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getPendingWorkProjects") {
      if (!res.hasData) {
        sections.push("💼 **Trabajo:** No hay proyectos pendientes ni sesiones recientes registradas.");
      } else {
        const pending = (d.pendingProjects as Array<Record<string, unknown>>) || [];
        const lastSess = d.lastWorkSession as Record<string, unknown> | null;
        const lines: string[] = [`💼 **Trabajo** *(fuente: ${sourceLabel(res.source)})*:`];
        if (pending.length > 0) {
          const names = pending
            .slice(0, 3)
            .map((p) => `"${p.name}" (${p.pendingTasksCount} tarea(s) pendiente(s))`)
            .join(", ");
          lines.push(`- **Proyectos pendientes (${pending.length}):** ${names}.`);
        } else {
          lines.push("- **Proyectos pendientes:** Ninguno pendiente.");
        }
        if (lastSess) {
          lines.push(
            `- **Última sesión de trabajo:** "${lastSess.title}" (${lastSess.duration_minutes || 0} min, ${formatDateEs(String(lastSess.completed_at || lastSess.timestamp || ""))}).`
          );
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getStudyProgress") {
      if (!res.hasData) {
        sections.push("🏛️ **Estudio:** Todavía no tienes bloques de estudio ni tarjetas SM-2 registradas.");
      } else {
        const last = d.lastStudySession as Record<string, unknown> | null;
        const mins = Number(d.recentTotalMinutes || 0);
        const cards = Number(d.spacedCardsCount || 0);
        const lines: string[] = [`🏛️ **Estudio** *(fuente: ${sourceLabel(res.source)})*:`];
        lines.push(`- **Minutos recientes estudiados:** ${mins} min • **Tarjetas SM-2:** ${cards}.`);
        if (last) {
          lines.push(
            `- **Última sesión de estudio:** "${last.title}" (${last.duration_minutes || 0} min, ${formatDateEs(String(last.completed_at || last.timestamp || ""))}).`
          );
        }
        sections.push(lines.join("\n"));
      }
    } else if (res.tool === "getVillageSummary") {
      // P0 Privacidad (Fase 7): no filtrar cifras COP automáticamente en resúmenes generales del pueblo
      sections.push(
        `🏛️ **Resumen del Pueblo** *(fuente: ${sourceLabel(res.source)})*:\n` +
          `- **Nivel:** ${d.playerLevel || 1} • **Billetera:** ${Number(d.walletGp || 0).toLocaleString("es-CO")} GP • **Bóveda restante:** ${Number(d.vaultRemainingGp || 0).toLocaleString("es-CO")} GP.\n` +
          `- **Último entrenamiento:** ${formatDateEs(d.lastWorkoutAt as string | null)}.\n` +
          `- *Nota:* Para revisar finanzas en COP, pregúntame explícitamente por gastos o consulta a Silas en el Banco.`
      );
    }
  }

  if (sections.length === 0) {
    return `No encontré registros verificables para responder "${question.slice(0, 80)}".`;
  }

  return sections.join("\n\n");
}

async function tryGeminiPolish(
  question: string,
  deterministicDraft: string,
  toolResults: ToolExecutionResult[],
  history: MayorChatTurn[],
  onGeminiAttemptForTests?: (payload: { prompt: string }) => void
): Promise<{ text: string | null; inputTokens?: number; outputTokens?: number; timedOut?: boolean }> {
  const safeHistory = stripFinancialHistoryForGemini(history);
  const safeToolResults = toolResults
    .filter((r) => r.buildingId !== "banco_oakhaven" && r.tool !== "getRecentExpenses")
    .map((r) => {
      if (r.tool === "getVillageSummary" && r.data && typeof r.data === "object") {
        const clone = { ...(r.data as Record<string, unknown>) };
        delete clone.weeklySpentCop;
        return { ...r, data: clone };
      }
      return r;
    });

  const recentHistory = safeHistory
    .slice(-4)
    .map((h) => `${h.role === "user" ? "Jugador" : "Rowan"}: ${h.content.slice(0, 220)}`)
    .join("\n");

  const prompt = [
    MAYOR_ROWAN_SKILL.specializedInstructions,
    "REGLA ESTRICTA: NO inventes ningún título, cifra, fecha ni logro que no esté en DATOS_VERIFICADOS. Conserva exactamente los números y fechas reales.",
    recentHistory ? `CONTEXTO RECIENTE:\n${recentHistory}` : "",
    `PREGUNTA DEL JUGADOR:\n${question}`,
    `DATOS_VERIFICADOS:\n${JSON.stringify(safeToolResults).slice(0, 4000)}`,
    `BORRADOR_DETERMINISTA:\n${deterministicDraft}`,
    "Redacta una respuesta breve (máximo 120 palabras), amable, cálida y fiel a los hechos verificados.",
  ]
    .filter(Boolean)
    .join("\n\n");

  onGeminiAttemptForTests?.({ prompt });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || process.env.OAKHAVEN_AI_ENABLED === "false") {
    return { text: null };
  }

  const ai = new GoogleGenAI({ apiKey });
  let timedOut = false;
  const timeoutPromise = new Promise<{ text: null; timedOut: true }>((resolve) =>
    setTimeout(() => {
      timedOut = true;
      resolve({ text: null, timedOut: true });
    }, 7000)
  );

  const genPromise = ai.models
    .generateContent({
      model: MAYOR_ROWAN_SKILL.providerConfig.model,
      contents: prompt,
      config: {
        temperature: MAYOR_ROWAN_SKILL.providerConfig.temperature,
        maxOutputTokens: MAYOR_ROWAN_SKILL.providerConfig.maxOutputTokens,
      },
    })
    .then((res) => ({
      text: res.text && res.text.trim().length > 10 ? res.text.trim() : null,
      inputTokens: res.usageMetadata?.promptTokenCount,
      outputTokens: res.usageMetadata?.candidatesTokenCount,
      timedOut: false,
    }))
    .catch(() => ({ text: null, timedOut }));

  return Promise.race([genPromise, timeoutPromise]);
}

const TOOL_TO_SKILL_ID: Partial<Record<MayorReadOnlyToolName, string>> = {
  getRecentExpenses: "oakhaven.specialist.banco.silas",
  getStudyProgress: "oakhaven.specialist.estudio.lyra",
  getPendingWorkProjects: "oakhaven.specialist.trabajo.aura",
  getLastWorkout: "oakhaven.specialist.gym.bruno",
  getRecentCubeSolves: "oakhaven.specialist.cubos.milo",
  getLastReadBook: "oakhaven.specialist.lectura.eldrin",
  getLastWatchedMedia: "oakhaven.specialist.cine.nora",
  getLastKnittingActivity: "oakhaven.specialist.crochet.clara",
};

export async function askMayorRowan(params: {
  question: string;
  history?: MayorChatTurn[];
  ctx: MayorToolContext;
  allowGemini?: boolean;
  disabledSkillIds?: string[];
  /** Gancho opcional de instrumentación para verificar aislamiento financiero hacia Gemini */
  onGeminiAttemptForTests?: (payload: { prompt: string }) => void;
}): Promise<MayorAnswerResponse> {
  const startedAt = Date.now();
  const cleanQuestion = (params.question || "").trim().slice(0, 600);

  // 1. Defensa contra acciones prohibidas (pagos, GP/XP arbitrario, prompt injection)
  const safetyBlock = detectUnsafeActionRequest(cleanQuestion);
  if (safetyBlock) {
    recordAiTelemetryEvent({
      agentId: "rowan",
      buildingId: "ayuntamiento",
      mode: "blocked_safety",
      durationMs: Date.now() - startedAt,
      usedGemini: false,
    });
    return {
      answer: safetyBlock,
      mode: "blocked_safety",
      toolsUsed: [],
      citations: [],
      buildingLinks: [BUILDING_LINK_META.banco_oakhaven],
    };
  }

  // 2. Planificación cotidiana / memoria contextual no financiera (Hitos 2, 4, 5)
  const dailyPlanMode = !isExplicitFinancialQuestion(cleanQuestion)
    ? detectDailyPlanIntent(cleanQuestion)
    : null;

  // 3. Plan mínimo de herramientas de solo lectura (máximo 3), respetando skills desactivadas
  const disabledSet = new Set(params.disabledSkillIds || []);
  const rawPlanned = selectToolsForQuestion(cleanQuestion);
  const skippedDisabledTools: string[] = [];
  const planned = rawPlanned.filter((step) => {
    const skillId = TOOL_TO_SKILL_ID[step.tool];
    if (skillId && disabledSet.has(skillId)) {
      skippedDisabledTools.push(step.tool);
      return false;
    }
    return true;
  });

  const results: ToolExecutionResult[] = [];
  for (const step of planned) {
    const res = await executeMayorReadOnlyTool(step.tool, params.ctx, step.args);
    results.push(res);
  }

  let deterministicAnswer =
    results.length > 0
      ? buildDeterministicGroundedAnswer(cleanQuestion, results)
      : skippedDisabledTools.length > 0
      ? "El especialista correspondiente a esta consulta está desactivado en tus preferencias. Puedes reactivarlo cuando desees."
      : buildDeterministicGroundedAnswer(cleanQuestion, results);
  const extraLinkBuildings: string[] = [];

  if (dailyPlanMode) {
    const planRes = await buildRowanDailyPlan(params.ctx, dailyPlanMode);
    deterministicAnswer =
      planned.length === 1 && planned[0].tool === "getVillageSummary"
        ? planRes.answer
        : `${planRes.answer}\n\n${deterministicAnswer}`;
    extraLinkBuildings.push(...planRes.buildingIds);
  }

  // 4. Control estructural P0 (Hito 1): NUNCA enviar datos financieros a Gemini por defecto
  const containsFinancialContext =
    isExplicitFinancialQuestion(cleanQuestion) ||
    results.some((r) => r.buildingId === "banco_oakhaven" || r.tool === "getRecentExpenses");

  let finalAnswer = deterministicAnswer;
  let mode: MayorAnswerResponse["mode"] = "deterministic_grounded";
  let usedGemini = false;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let timedOut = false;

  if (params.allowGemini !== false && !containsFinancialContext) {
    const polished = await tryGeminiPolish(
      cleanQuestion,
      deterministicAnswer,
      results,
      params.history || [],
      params.onGeminiAttemptForTests
    );
    inputTokens = polished.inputTokens;
    outputTokens = polished.outputTokens;
    timedOut = Boolean(polished.timedOut);
    if (polished.text) {
      finalAnswer = polished.text;
      mode = "gemini_grounded";
      usedGemini = true;
    }
  }

  recordAiTelemetryEvent({
    agentId: "rowan",
    buildingId: "ayuntamiento",
    mode,
    durationMs: Date.now() - startedAt,
    usedGemini,
    timedOut,
    inputTokens,
    outputTokens,
  });

  const citations: MayorCitation[] = results.map((r) => ({
    tool: r.tool,
    buildingId: r.buildingId,
    source: sourceLabel(r.source),
    asOf: r.asOf,
    limitationNote: r.limitationNote,
  }));

  const uniqueBuildings = Array.from(
    new Set([...results.map((r) => r.buildingId), ...extraLinkBuildings])
  );
  const buildingLinks = uniqueBuildings
    .map((id) => BUILDING_LINK_META[id])
    .filter((link): link is MayorBuildingLink => Boolean(link));

  return {
    answer: finalAnswer,
    mode,
    toolsUsed: dailyPlanMode
      ? Array.from(new Set([...results.map((r) => r.tool), `commandCenter:${dailyPlanMode}`]))
      : results.map((r) => r.tool),
    citations,
    buildingLinks,
  };
}
