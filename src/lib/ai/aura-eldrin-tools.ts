/**
 * ============================================================================
 * OAKHAVEN AI FASE 4 — HERRAMIENTAS ACTIVAS DE AURA (TRABAJO) Y ELDRIN (LECTURA)
 * ============================================================================
 * REGLAS DE SEGURIDAD Y VERACIDAD:
 * 1. Todas las consultas de Nivel 1 son de solo lectura y filtran por authenticatedUserId.
 * 2. Aura JAMÁS presenta proyectos demostrativos (DEFAULT_PROJECTS) como trabajo real.
 * 3. Eldrin distingue estrictamente: libro actual, último agregado, último leído y último terminado.
 *    Nunca trata un libro en wishlist como leído ni inventa recuerdos/páginas inexistentes.
 * 4. Las acciones de Nivel 2 generan propuestas estructuradas con requiresConfirmation: true
 *    e idempotencyKey determinista; nunca mutan GP, XP, COP ni archivos del repositorio.
 */

import crypto from "node:crypto";
import type { MayorToolContext } from "./mayor-readonly-tools.ts";
import {
  getResourceExtractedText,
  listBuildingResources,
  type ResourceQueryContext,
} from "./resource-query-tools.ts";
import type { SpecialistProposal } from "./specialist-engine.ts";
import type { ReadingBook, WorkProject, WorkProjectTask } from "../../types/rpg.ts";

export type DataOriginTag =
  | "real_synced"
  | "real_local"
  | "historical"
  | "demo_template"
  | "imported";

export interface WorkProjectSummary {
  id: string;
  name: string;
  description?: string;
  status: string;
  methodology: string;
  currentStage?: string;
  workScope: "professional" | "personal";
  dataOrigin: DataOriginTag;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalMinutesInvested: number;
  createdAt: string;
}

export interface TechnicalDocumentAnalysis {
  resourceTitle: string;
  sectionsDetected: string[];
  risksAndInconsistencies: string[];
  actionableItems: string[];
  pageCitations: string[];
  hasExtractableText: boolean;
}

export interface CodeSnippetExplanation {
  resourceTitle: string;
  detectedLanguage: string;
  importsCount: number;
  functionsDetected: string[];
  stepByStepSummary: string[];
  potentialEdgeCases: string[];
}

export interface ReadingLibrarySnapshot {
  source: "supabase" | "memory_store";
  totalBooks: number;
  currentlyReading: ReadingBook[];
  completedBooks: ReadingBook[];
  wishlistBooks: ReadingBook[];
  lastAddedBook: (ReadingBook & { created_at?: string }) | null;
  lastReadBook: { title: string; author?: string; sessionDate: string; notes?: string } | null;
  lastCompletedBook: (ReadingBook & { updated_at?: string }) | null;
  pagesReadLast7Days: number;
  totalPagesReadAllTime: number;
  limitations: string[];
}

function makeIdempotencyKey(prefix: string, parts: string[]): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${prefix}:${parts.join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${hash}`;
}

function isDemoWorkProject(project: Partial<WorkProject> & { isDemo?: boolean; dataOrigin?: string }): boolean {
  if (project.isDemo === true) return true;
  if (project.dataOrigin === "demo_template") return true;
  const id = String(project.id || "").toLowerCase();
  return id.startsWith("demo-") || id.startsWith("template-");
}

function inferWorkScope(project: WorkProject): "professional" | "personal" {
  const text = `${project.name} ${project.description || ""}`.toLowerCase();
  if (/(personal|hobby|side project|propio|oakhaven|casa)/i.test(text)) {
    return "personal";
  }
  return "professional";
}

// ============================================================================
// AURA — HERRAMIENTAS DE TRABAJO (OFICINA)
// ============================================================================

export async function getActiveWorkProjects(ctx: MayorToolContext): Promise<{
  source: "supabase" | "memory_store";
  projects: WorkProjectSummary[];
  excludedDemoCount: number;
  limitationNote?: string;
}> {
  const rawProjects = (ctx.store.workProjects || []) as Array<
    WorkProject & { isDemo?: boolean; dataOrigin?: DataOriginTag }
  >;
  const excludedDemoCount = rawProjects.filter((p) => isDemoWorkProject(p)).length;
  const realProjects = rawProjects.filter((p) => !isDemoWorkProject(p) && p.status !== "completed");

  const mapped: WorkProjectSummary[] = realProjects.map((p) => {
    const tasks = p.tasks || [];
    const completed = tasks.filter((t) => t.is_completed || t.stage === "done" || t.stage === "Completado").length;
    const total = tasks.length || p.tasks_count || 0;
    const done = completed || p.completed_tasks_count || 0;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      methodology: p.methodology,
      currentStage: p.current_stage,
      workScope: inferWorkScope(p),
      dataOrigin: p.dataOrigin || (ctx.isSupabaseConfigured ? "real_local" : "real_local"),
      totalTasks: total,
      completedTasks: done,
      pendingTasks: Math.max(0, total - done),
      totalMinutesInvested: p.total_minutes_invested || 0,
      createdAt: p.created_at,
    };
  });

  return {
    source: "memory_store",
    projects: mapped,
    excludedDemoCount,
    limitationNote:
      mapped.length === 0
        ? "No tienes proyectos reales activos registrados en Trabajo todavía (las plantillas demostrativas no se cuentan como proyectos tuyos)."
        : undefined,
  };
}

export async function getWorkProjectDetails(ctx: MayorToolContext, projectId: string) {
  const realProjects = (ctx.store.workProjects || []).filter((p) => !isDemoWorkProject(p));
  const found = realProjects.find((p) => p.id === projectId) || null;
  if (!found) {
    return { found: false as const, project: null, pendingTasks: [] as WorkProjectTask[] };
  }
  const pendingTasks = (found.tasks || []).filter(
    (t) => !t.is_completed && t.stage !== "done" && t.stage !== "Completado"
  );
  return {
    found: true as const,
    project: found,
    pendingTasks,
  };
}

export async function getPendingWorkTasks(ctx: MayorToolContext, projectId?: string) {
  const realProjects = (ctx.store.workProjects || []).filter((p) => !isDemoWorkProject(p));
  const scoped = projectId ? realProjects.filter((p) => p.id === projectId) : realProjects;
  const tasks: Array<WorkProjectTask & { projectName: string }> = [];
  for (const proj of scoped) {
    for (const task of proj.tasks || []) {
      if (!task.is_completed && task.stage !== "done" && task.stage !== "Completado") {
        tasks.push({ ...task, projectName: proj.name });
      }
    }
  }
  const priorityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  tasks.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
  return {
    count: tasks.length,
    tasks: tasks.slice(0, 20),
  };
}

export async function getLastWorkSession(ctx: MayorToolContext) {
  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data, error } = await ctx.db
      .from("activity_logs")
      .select("id, title, duration_minutes, notes, completed_at")
      .eq("user_id", ctx.authenticatedUserId)
      .eq("domain", "work")
      .order("completed_at", { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      return {
        source: "supabase" as const,
        session: {
          id: String(data[0].id),
          title: String(data[0].title || "Sesión de trabajo"),
          duration_minutes: Number(data[0].duration_minutes || 0),
          notes: String(data[0].notes || ""),
          timestamp: String(data[0].completed_at),
        },
      };
    }
  }

  const workLogs = [...(ctx.store.skillSessions || [])]
    .filter((s) => s.domain === "work")
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));

  return {
    source: "memory_store" as const,
    session: workLogs[0]
      ? {
          id: workLogs[0].id,
          title: workLogs[0].title,
          duration_minutes: workLogs[0].duration_minutes,
          notes: workLogs[0].details || "",
          timestamp: workLogs[0].timestamp,
        }
      : null,
  };
}

export async function getWorkSessionsByPeriod(
  ctx: MayorToolContext,
  startDateIso: string,
  endDateIso: string
) {
  const startMs = Date.parse(startDateIso);
  const endMs = Date.parse(endDateIso);

  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data, error } = await ctx.db
      .from("activity_logs")
      .select("id, title, duration_minutes, notes, completed_at")
      .eq("user_id", ctx.authenticatedUserId)
      .eq("domain", "work")
      .gte("completed_at", startDateIso)
      .lte("completed_at", endDateIso)
      .order("completed_at", { ascending: false })
      .limit(25);

    if (!error && Array.isArray(data)) {
      const totalMinutes = data.reduce((sum, r) => sum + (Number(r.duration_minutes) || 0), 0);
      return { source: "supabase" as const, count: data.length, totalMinutes, sessions: data };
    }
  }

  const filtered = (ctx.store.skillSessions || []).filter((s) => {
    if (s.domain !== "work") return false;
    const ts = Date.parse(s.timestamp);
    return Number.isFinite(ts) && ts >= startMs && ts <= endMs;
  });
  const totalMinutes = filtered.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
  return { source: "memory_store" as const, count: filtered.length, totalMinutes, sessions: filtered };
}

export async function listWorkResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "oficina", "oakhaven.specialist.trabajo.aura");
}

export async function readWorkDocument(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.trabajo.aura");
}

export function analyzeTechnicalDocument(
  resourceTitle: string,
  extractedText: string
): TechnicalDocumentAnalysis {
  const clean = (extractedText || "").trim();
  if (!clean) {
    return {
      resourceTitle,
      sectionsDetected: [],
      risksAndInconsistencies: [],
      actionableItems: [],
      pageCitations: [],
      hasExtractableText: false,
    };
  }

  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sectionsDetected = lines
    .filter((l) => /^#{1,3}\s+/.test(l) || /^[0-9]+\.\s+[A-ZÁÉÍÓÚ]/.test(l))
    .slice(0, 6);

  const risksAndInconsistencies = lines
    .filter((l) => /(TODO|FIXME|riesgo|inconsisten|pendiente|bloqueo|bloqueado|sin definir|vulnerab|deuda t[eé]cnica)/i.test(l))
    .slice(0, 6);

  const actionableItems = lines
    .filter((l) => /^[-*]\s+/.test(l) || /(implementar|validar|migrar|probar|documentar|corregir)/i.test(l))
    .slice(0, 6);

  const pageCitations = Array.from(
    new Set(
      (clean.match(/\[Página\s+\d+\]/gi) || []).map((p) => `${resourceTitle} ${p}`)
    )
  ).slice(0, 8);

  return {
    resourceTitle,
    sectionsDetected,
    risksAndInconsistencies,
    actionableItems,
    pageCitations,
    hasExtractableText: true,
  };
}

export function explainCodeSnippet(resourceTitle: string, rawCode: string): CodeSnippetExplanation {
  const code = (rawCode || "").trim();
  const isSql = /\bSELECT\b.+\bFROM\b|\bCREATE\s+TABLE\b/i.test(code);
  const isTsJs = /\b(interface|type|const|let|export|function)\b|import\s+.+\s+from\s+['"]/.test(code);
  const isPython = !isTsJs && (/\bdef\s+\w+\s*\(/.test(code) || /^import\s+\w+\s*$/m.test(code));
  const detectedLanguage = isSql
    ? "SQL"
    : isTsJs
    ? "TypeScript / JavaScript"
    : isPython
    ? "Python"
    : "Texto técnico / código";

  const importsCount = (code.match(/^\s*(import|from)\s+/gm) || []).length;
  const funcMatches = Array.from(
    code.matchAll(/(?:export\s+)?(?:async\s+)?(?:function|def)\s+([a-zA-Z0-9_]+)/g)
  ).map((m) => m[1]);

  const stepByStepSummary: string[] = [];
  if (importsCount > 0) stepByStepSummary.push(`1. Importa ${importsCount} dependencia(s) externa(s) o interna(s).`);
  if (funcMatches.length > 0) {
    stepByStepSummary.push(`2. Define las funciones principales: ${funcMatches.slice(0, 5).join(", ")}.`);
  }
  if (/\basync\b|\bawait\b/.test(code)) {
    stepByStepSummary.push("3. Ejecuta operaciones asíncronas (`async/await`), por lo que conviene manejar errores con `try/catch`.");
  }
  if (stepByStepSummary.length === 0) {
    stepByStepSummary.push("1. Fragmento compacto sin declaraciones de función explícitas; revisa sus entradas y salidas directas.");
  }

  const potentialEdgeCases: string[] = [];
  if (/\bany\b/.test(code)) potentialEdgeCases.push("Uso de `any`: conviene reemplazarlo por tipos explícitos.");
  if (/eval\(|dangerouslySetInnerHTML/i.test(code)) {
    potentialEdgeCases.push("Patrón sensible de seguridad detectado (`eval` o HTML sin sanear).");
  }
  if (/TODO|FIXME/i.test(code)) {
    potentialEdgeCases.push("Contiene marcadores `TODO`/`FIXME` pendientes de resolver.");
  }

  return {
    resourceTitle,
    detectedLanguage,
    importsCount,
    functionsDetected: funcMatches.slice(0, 8),
    stepByStepSummary,
    potentialEdgeCases,
  };
}

export function proposeWorkSprint(params: {
  projectId?: string;
  projectName: string;
  objective: string;
  suggestedTasks?: string[];
}): SpecialistProposal {
  const tasks =
    params.suggestedTasks && params.suggestedTasks.length > 0
      ? params.suggestedTasks.slice(0, 5)
      : [
          `Definir alcance mínimo y criterios de aceptación para "${params.objective}"`,
          "Implementar bloque central en un sprint enfocado de 25–45 min",
          "Verificar resultado y registrar entregable de cierre",
        ];

  return {
    id: `prop-work-sprint-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("work-sprint", [params.projectId || "general", params.objective.toLowerCase()]),
    buildingId: "oficina",
    specialistName: "Aura",
    actionType: "plan_work_sprint",
    title: `Guardar plan de sprint para "${params.projectName}"`,
    summary: `Incluye ${tasks.length} tareas divididas y checklist de entregable (se guardará en tu Archivo de Proyectos al confirmar).`,
    payload: {
      buildingId: "oficina",
      resourceType: "project_document",
      projectId: params.projectId || null,
      title: `Sprint: ${params.objective.slice(0, 70)}`,
      filename: `sprint-${params.projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}.md`,
      mimeType: "text/markdown",
      rawTextContent: `# Plan de Sprint — ${params.projectName}\n\nObjetivo: ${params.objective}\n\n## Tareas propuestas\n${tasks.map((t, i) => `${i + 1}. [ ] ${t}`).join("\n")}\n\n## Checklist de cierre\n- [ ] Verificar pruebas/validaciones\n- [ ] Documentar avance real`,
    },
    requiresConfirmation: true,
  };
}

export function proposeWorkSessionSummary(params: {
  projectName: string;
  lastSessionTitle?: string;
  durationMinutes?: number;
  notes?: string;
}): SpecialistProposal {
  const summaryBody = [
    `# Cierre de Jornada — ${params.projectName}`,
    params.lastSessionTitle
      ? `- Última sesión registrada: ${params.lastSessionTitle} (${params.durationMinutes || 0} min)`
      : "- Sin sesión cronometrada previa; resumen manual de cierre.",
    params.notes ? `- Notas: ${params.notes}` : "- Próximo paso sugerido: retomar la tarea prioritaria en el próximo bloque.",
  ].join("\n");

  return {
    id: `prop-work-summary-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("work-summary", [params.projectName, params.lastSessionTitle || "manual"]),
    buildingId: "oficina",
    specialistName: "Aura",
    actionType: "plan_work_sprint",
    title: `Guardar cierre de jornada de "${params.projectName}"`,
    summary: "Registra tu resumen de cierre como nota técnica en el Archivo de Proyectos (sin alterar GP, XP ni COP).",
    payload: {
      buildingId: "oficina",
      resourceType: "deliverable",
      title: `Cierre de jornada: ${params.projectName}`,
      filename: `cierre-${new Date().toISOString().slice(0, 10)}.md`,
      mimeType: "text/markdown",
      rawTextContent: summaryBody,
    },
    requiresConfirmation: true,
  };
}

// ============================================================================
// ELDRIN — HERRAMIENTAS DE LECTURA (LIBRERÍA)
// ============================================================================

export async function getReadingBooks(ctx: MayorToolContext): Promise<ReadingLibrarySnapshot> {
  const limitations: string[] = [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  if (ctx.isSupabaseConfigured && ctx.db) {
    const [{ data: dbBooks }, { data: dbLogs }] = await Promise.all([
      ctx.db
        .from("reading_books")
        .select("id, title, author, status, current_page, total_pages, category, created_at, updated_at")
        .eq("user_id", ctx.authenticatedUserId)
        .order("updated_at", { ascending: false })
        .limit(40),
      ctx.db
        .from("activity_logs")
        .select("id, title, duration_minutes, notes, completed_at")
        .eq("user_id", ctx.authenticatedUserId)
        .eq("domain", "reading")
        .order("completed_at", { ascending: false })
        .limit(25),
    ]);

    const mappedBooks: Array<ReadingBook & { created_at?: string; updated_at?: string }> = (dbBooks || []).map((b) => ({
      id: String(b.id),
      title: String(b.title),
      author: String(b.author || "Autor no registrado"),
      status: (b.status as ReadingBook["status"]) || "reading",
      pages_read: Number(b.current_page || 0),
      total_pages: Number(b.total_pages || 0),
      category: String(b.category || "General"),
      created_at: b.created_at ? String(b.created_at) : undefined,
      updated_at: b.updated_at ? String(b.updated_at) : undefined,
    }));

    const lastAdded =
      [...mappedBooks].sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0))[0] ||
      null;
    const completed = mappedBooks.filter((b) => b.status === "completed");
    const lastCompleted =
      [...completed].sort((a, b) => (Date.parse(b.updated_at || "") || 0) - (Date.parse(a.updated_at || "") || 0))[0] ||
      null;
    const logs = dbLogs || [];
    const lastLog = logs[0] || null;
    const pagesLast7 = logs
      .filter((l) => (Date.parse(String(l.completed_at || "")) || 0) >= sevenDaysAgo)
      .reduce((sum, l) => {
        const m = String(l.notes || "").match(/(\d+)\s*p[aá]g/i);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);

    return {
      source: "supabase",
      totalBooks: mappedBooks.length,
      currentlyReading: mappedBooks.filter((b) => b.status === "reading"),
      completedBooks: completed,
      wishlistBooks: mappedBooks.filter((b) => b.status === "wishlist"),
      lastAddedBook: lastAdded,
      lastReadBook: lastLog
        ? {
            title: String(lastLog.title || "Sesión de lectura"),
            sessionDate: String(lastLog.completed_at),
            notes: lastLog.notes ? String(lastLog.notes) : undefined,
          }
        : null,
      lastCompletedBook: lastCompleted,
      pagesReadLast7Days: pagesLast7,
      totalPagesReadAllTime: mappedBooks.reduce((s, b) => s + (b.pages_read || 0), 0),
      limitations,
    };
  }

  const books = (ctx.store.readingBooks || []) as Array<ReadingBook & { created_at?: string; updated_at?: string }>;
  const readingLogs = [...(ctx.store.skillSessions || [])]
    .filter((s) => s.domain === "reading")
    .sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));

  const hasCreatedDates = books.some((b) => Boolean(b.created_at));
  if (books.length > 0 && !hasCreatedDates) {
    limitations.push("En modo de sesión local algunos libros no registran fecha exacta de creación (`created_at`).");
  }

  const lastAdded = hasCreatedDates
    ? [...books].sort((a, b) => (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0))[0] || null
    : books[0] || null;

  const completed = books.filter((b) => b.status === "completed");
  const lastCompleted =
    [...completed].sort((a, b) => (Date.parse(b.updated_at || "") || 0) - (Date.parse(a.updated_at || "") || 0))[0] ||
    null;

  const pagesLast7 = readingLogs
    .filter((l) => (Date.parse(l.timestamp) || 0) >= sevenDaysAgo)
    .reduce((sum, l) => {
      const m = String(l.details || "").match(/(\d+)\s*p[aá]g/i);
      return sum + (m ? Number(m[1]) : 0);
    }, 0);

  return {
    source: "memory_store",
    totalBooks: books.length,
    currentlyReading: books.filter((b) => b.status === "reading"),
    completedBooks: completed,
    wishlistBooks: books.filter((b) => b.status === "wishlist"),
    lastAddedBook: lastAdded,
    lastReadBook: readingLogs[0]
      ? {
          title: readingLogs[0].title,
          sessionDate: readingLogs[0].timestamp,
          notes: readingLogs[0].details,
        }
      : null,
    lastCompletedBook: lastCompleted,
    pagesReadLast7Days: pagesLast7,
    totalPagesReadAllTime: books.reduce((s, b) => s + (b.pages_read || 0), 0),
    limitations,
  };
}

export async function getBookQuotesAndNotes(ctx: MayorToolContext, bookId?: string) {
  const books = ctx.store.readingBooks || [];
  const scoped = bookId ? books.filter((b) => b.id === bookId) : books;
  const quotesByBook = scoped
    .map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      quotes: b.quotes || [],
      personalReview: b.personal_review || null,
      rating: b.rating ?? null,
    }))
    .filter((entry) => entry.quotes.length > 0 || Boolean(entry.personalReview));

  return {
    booksWithNotesCount: quotesByBook.length,
    totalQuotesCount: quotesByBook.reduce((sum, b) => sum + b.quotes.length, 0),
    entries: quotesByBook,
  };
}

export async function listReadingResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "libreria", "oakhaven.specialist.lectura.eldrin");
}

export async function readReadingResource(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.lectura.eldrin");
}

export function proposeReadingReflection(book: ReadingBook): string {
  const pct = book.total_pages > 0 ? Math.round(((book.pages_read || 0) / book.total_pages) * 100) : 0;
  const quoteHint =
    book.quotes && book.quotes.length > 0
      ? `Retomando tu cita guardada ("${book.quotes[0].text.slice(0, 90)}...")`
      : `A la altura de la página ${book.pages_read || 0} de ${book.total_pages || "?"} (${pct}%)`;
  return (
    `🕯️ **Reflexión literaria sobre "${book.title}" (${book.author}):** ${quoteHint}, te propongo tres preguntas tranquilas:\n` +
    `1. ¿Qué idea o escena de tus últimas páginas te gustaría conservar en tu Cuaderno de Citas?\n` +
    `2. ¿Qué pregunta te dejó abierta el autor hasta este punto?\n` +
    `3. ¿Cambió alguna perspectiva tuya respecto a cuando empezaste el libro?`
  );
}

export function recommendNextBook(snapshot: ReadingLibrarySnapshot): string {
  if (snapshot.wishlistBooks.length > 0) {
    const favoriteCategories = new Set(
      [...snapshot.completedBooks, ...snapshot.currentlyReading]
        .map((b) => (b.category || "").toLowerCase())
        .filter(Boolean)
    );
    const prioritized =
      snapshot.wishlistBooks.find((w) => favoriteCategories.has((w.category || "").toLowerCase())) ||
      snapshot.wishlistBooks[0];
    return `📚 **Próxima lectura sugerida de tu propia lista por leer:** "${prioritized.title}" de ${prioritized.author} (${prioritized.category}). Nota: está en tu wishlist, aún no figura como leído.`;
  }
  if (snapshot.currentlyReading.length > 0) {
    const current = snapshot.currentlyReading[0];
    return `📖 Ahora mismo estás leyendo "${current.title}" (${current.pages_read}/${current.total_pages} páginas). No tienes libros en tu wishlist aún; si quieres elegir tu próxima lectura, agrega 1 o 2 títulos a tu estantería.`;
  }
  return "📚 Aún no tienes libros en tu estantería ni en tu wishlist. Cuando registres tus lecturas o intereses, podré recomendarte tu próximo libro basándome en tus gustos reales.";
}

export function proposeBookReview(book: ReadingBook, draftText?: string): SpecialistProposal {
  const pct = book.total_pages > 0 ? Math.round(((book.pages_read || 0) / book.total_pages) * 100) : 0;
  const content =
    draftText && draftText.trim().length > 0
      ? draftText.trim()
      : `# Reseña personal — ${book.title}\nAutor: ${book.author}\nProgreso registrado: ${book.pages_read}/${book.total_pages} páginas (${pct}%)\n\n## Impresiones\n(Completa o edita tus impresiones personales antes o después de guardar.)`;

  return {
    id: `prop-book-review-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("book-review", [book.id, content.slice(0, 60)]),
    buildingId: "libreria",
    specialistName: "Eldrin",
    actionType: "add_reading_note",
    title: `Guardar reseña/nota literaria de "${book.title}"`,
    summary: "Se guardará en tu Biblioteca de Lectura como nota personal (requiere tu confirmación explícita; no modifica GP ni XP).",
    payload: {
      buildingId: "libreria",
      resourceType: "reading_note",
      projectId: book.id,
      title: `Reseña: ${book.title}`,
      filename: `resena-${book.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}.md`,
      mimeType: "text/markdown",
      rawTextContent: content,
    },
    requiresConfirmation: true,
  };
}
