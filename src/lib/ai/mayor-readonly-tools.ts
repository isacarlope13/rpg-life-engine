/**
 * ============================================================================
 * HERRAMIENTAS DE SOLO LECTURA DEL PRESIDENTE ROWAN (FASE 1)
 * ============================================================================
 * REGLAS DE SEGURIDAD:
 * 1. El userId SIEMPRE proviene del contexto autenticado del servidor (`requireShortcutUser`).
 * 2. Nunca aceptan un userId arbitrario del modelo o del cliente.
 * 3. Nunca modifican GP, XP, COP ni registros en base de datos.
 * 4. Limitan resultados (máx. 25), devuelven fechas reales y especifican origen (`source`).
 * 5. Distinguen ausencia de datos, sincronización solo local y errores.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RPGEngineMemoryStore } from "../demo-store.ts";
import type { CinemaEntry } from "../sanctuary/cinema-store.ts";
import type { MayorReadOnlyToolName } from "./building-skills-registry.ts";

export type DataSourceOrigin =
  | "supabase"
  | "memory_store"
  | "local_device_snapshot"
  | "none";

export interface LocalClientSnapshot {
  cinemaEntries?: CinemaEntry[];
  localPatternProjectsCount?: number;
}

export interface MayorToolContext {
  authenticatedUserId: string;
  db: SupabaseClient | null;
  store: RPGEngineMemoryStore;
  isSupabaseConfigured: boolean;
  localSnapshot?: LocalClientSnapshot;
}

export interface ToolExecutionResult<T = Record<string, unknown>> {
  ok: boolean;
  tool: string;
  blocked?: boolean;
  source: DataSourceOrigin;
  asOf: string;
  buildingId: string;
  hasData: boolean;
  data: T | null;
  limitationNote?: string;
  error?: string;
}

const ALLOWED_TOOL_SET = new Set<MayorReadOnlyToolName>([
  "getLastReadBook",
  "getLastKnittingActivity",
  "getLastWatchedMedia",
  "getRecentExpenses",
  "getLastWorkout",
  "getRecentCubeSolves",
  "getPendingWorkProjects",
  "getStudyProgress",
  "getVillageSummary",
]);

function clampLimit(limit: unknown, fallback = 10): number {
  const num = Number(limit);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(25, Math.max(1, Math.floor(num)));
}

function isoDateOrNull(val: unknown): string | null {
  if (typeof val !== "string" || !val.trim()) return null;
  const parsed = Date.parse(val);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sortByTimestampDesc<T>(items: T[], getTs: (item: T) => string | undefined | null): T[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(getTs(a) || "") || 0;
    const tb = Date.parse(getTs(b) || "") || 0;
    return tb - ta;
  });
}

export async function getLastReadBook(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const [{ data: books, error: bErr }, { data: logs }] = await Promise.all([
        ctx.db
          .from("reading_books")
          .select("id, title, author, status, current_page, total_pages, created_at, updated_at")
          .eq("user_id", ctx.authenticatedUserId)
          .order("updated_at", { ascending: false })
          .limit(25),
        ctx.db
          .from("activity_logs")
          .select("id, title, duration_minutes, notes, completed_at")
          .eq("user_id", ctx.authenticatedUserId)
          .eq("domain", "reading")
          .order("completed_at", { ascending: false })
          .limit(5),
      ]);

      if (bErr) {
        return {
          ok: false,
          tool: "getLastReadBook",
          source: "supabase",
          asOf,
          buildingId: "libreria",
          hasData: false,
          data: null,
          error: "No se pudo consultar tu tabla de libros en Supabase.",
        };
      }

      const list = books || [];
      const lastCreated = sortByTimestampDesc(list, (b) => b.created_at)[0] || null;
      const lastUpdated = sortByTimestampDesc(list, (b) => b.updated_at)[0] || null;
      const currentlyReading = list.find((b) => b.status === "reading") || null;
      const lastCompleted =
        sortByTimestampDesc(
          list.filter((b) => b.status === "completed"),
          (b) => b.updated_at
        )[0] || null;
      const lastReadingSession = (logs || [])[0] || null;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const pagesReadLast7Days = (logs || [])
        .filter((l) => (Date.parse(String(l.completed_at || "")) || 0) >= sevenDaysAgo)
        .reduce((sum, l) => {
          const m = String(l.notes || "").match(/(\d+)\s*p[aá]g/i);
          return sum + (m ? Number(m[1]) : 0);
        }, 0);

      return {
        ok: true,
        tool: "getLastReadBook",
        source: "supabase",
        asOf,
        buildingId: "libreria",
        hasData: list.length > 0 || Boolean(lastReadingSession),
        data: {
          totalBooks: list.length,
          currentlyReadingBook: currentlyReading,
          lastCreatedBook: lastCreated,
          lastUpdatedBook: lastUpdated,
          lastCompletedBook: lastCompleted,
          lastReadingSession,
          pagesReadLast7Days,
          currentBookQuotes: [],
        },
      };
    }

    const books = ctx.store.readingBooks || [];
    const readingLogs = sortByTimestampDesc(
      (ctx.store.skillSessions || []).filter((s) => s.domain === "reading"),
      (s) => s.timestamp
    );
    const currentlyReadingBook = books.find((b) => b.status === "reading") || null;
    const lastCreatedBook = books[0] || null;
    const lastCompletedBook = books.find((b) => b.status === "completed") || null;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const pagesReadLast7Days = readingLogs
      .filter((l) => (Date.parse(l.timestamp) || 0) >= sevenDaysAgo)
      .reduce((sum, l) => {
        const m = String(l.details || "").match(/(\d+)\s*p[aá]g/i);
        return sum + (m ? Number(m[1]) : 0);
      }, 0);

    return {
      ok: true,
      tool: "getLastReadBook",
      source: "memory_store",
      asOf,
      buildingId: "libreria",
      hasData: books.length > 0 || readingLogs.length > 0,
      data: {
        totalBooks: books.length,
        currentlyReadingBook,
        lastCreatedBook,
        lastUpdatedBook: lastCreatedBook,
        lastCompletedBook,
        lastReadingSession: readingLogs[0] || null,
        pagesReadLast7Days,
        currentBookQuotes: currentlyReadingBook?.quotes || [],
      },
    };
  } catch {
    return {
      ok: false,
      tool: "getLastReadBook",
      source: "none",
      asOf,
      buildingId: "libreria",
      hasData: false,
      data: null,
      error: "Error inesperado consultando lecturas.",
    };
  }
}

export async function getLastKnittingActivity(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  const localNote =
    ctx.localSnapshot?.localPatternProjectsCount !== undefined
      ? `Patrones con imágenes guardados localmente en este dispositivo: ${ctx.localSnapshot.localPatternProjectsCount}.`
      : "Los patrones e imágenes del Atelier se guardan actualmente en el navegador local de cada dispositivo.";

  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const [{ data: projects, error: pErr }, { data: logs }] = await Promise.all([
        ctx.db
          .from("knitting_projects")
          .select("id, name, technique, completed_rows, total_rows_target, yarn_details, status, created_at, updated_at")
          .eq("user_id", ctx.authenticatedUserId)
          .order("updated_at", { ascending: false })
          .limit(25),
        ctx.db
          .from("activity_logs")
          .select("id, title, duration_minutes, notes, completed_at")
          .eq("user_id", ctx.authenticatedUserId)
          .eq("domain", "knitting")
          .order("completed_at", { ascending: false })
          .limit(5),
      ]);

      if (pErr) {
        return {
          ok: false,
          tool: "getLastKnittingActivity",
          source: "supabase",
          asOf,
          buildingId: "atelier",
          hasData: false,
          data: null,
          error: "No se pudo consultar tus proyectos de crochet en Supabase.",
        };
      }

      const list = projects || [];
      const lastCreated = sortByTimestampDesc(list, (p) => p.created_at)[0] || null;
      const lastUpdated = sortByTimestampDesc(list, (p) => p.updated_at)[0] || null;
      const lastCompleted =
        sortByTimestampDesc(
          list.filter((p) => p.status === "completed"),
          (p) => p.updated_at
        )[0] || null;

      return {
        ok: true,
        tool: "getLastKnittingActivity",
        source: "supabase",
        asOf,
        buildingId: "atelier",
        hasData: list.length > 0 || (logs || []).length > 0,
        data: {
          totalProjects: list.length,
          lastCreatedProject: lastCreated,
          lastUpdatedProject: lastUpdated,
          lastCompletedProject: lastCompleted,
          lastKnittingSession: (logs || [])[0] || null,
        },
        limitationNote: localNote,
      };
    }

    const projects = ctx.store.knittingProjects || [];
    const knittingLogs = sortByTimestampDesc(
      (ctx.store.skillSessions || []).filter((s) => s.domain === "knitting"),
      (s) => s.timestamp
    );

    return {
      ok: true,
      tool: "getLastKnittingActivity",
      source: "memory_store",
      asOf,
      buildingId: "atelier",
      hasData: projects.length > 0 || knittingLogs.length > 0,
      data: {
        totalProjects: projects.length,
        lastCreatedProject: projects[0] || null,
        lastUpdatedProject: projects[0] || null,
        lastCompletedProject: projects.find((p) => p.status === "completed") || null,
        lastKnittingSession: knittingLogs[0] || null,
      },
      limitationNote: localNote,
    };
  } catch {
    return {
      ok: false,
      tool: "getLastKnittingActivity",
      source: "none",
      asOf,
      buildingId: "atelier",
      hasData: false,
      data: null,
      error: "Error inesperado consultando actividad de crochet.",
    };
  }
}

export async function getLastWatchedMedia(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();

  // 1. Intentar Supabase primero (sincronizado entre dispositivos con RLS)
  if (ctx.isSupabaseConfigured && ctx.db) {
    try {
      const { data: rows, error } = await ctx.db
        .from("cinema_entries")
        .select("id, title, kind, status, rating, season, episode, favorite_song_or_scene, notes, watched_at, created_at, updated_at")
        .eq("user_id", ctx.authenticatedUserId)
        .order("updated_at", { ascending: false })
        .limit(25);

      if (!error && Array.isArray(rows) && rows.length > 0) {
        const mapped: CinemaEntry[] = rows.map((r) => ({
          id: String(r.id),
          title: String(r.title),
          kind: r.kind as CinemaEntry["kind"],
          status: r.status as CinemaEntry["status"],
          rating: r.rating ?? undefined,
          season: r.season ?? undefined,
          episode: r.episode ?? undefined,
          favoriteSongOrScene: r.favorite_song_or_scene ?? undefined,
          notes: String(r.notes || ""),
          watchedAt: r.watched_at ?? undefined,
          createdAt: String(r.created_at),
          updatedAt: String(r.updated_at),
        }));
        const watching = sortByTimestampDesc(
          mapped.filter((e) => e.status === "watching"),
          (e) => e.updatedAt
        );
        const watchedMovies = sortByTimestampDesc(
          mapped.filter((e) => e.kind === "movie" && (e.status === "watched" || e.status === "favorite")),
          (e) => e.watchedAt || e.updatedAt
        );
        return {
          ok: true,
          tool: "getLastWatchedMedia",
          source: "supabase",
          asOf,
          buildingId: "cine",
          hasData: true,
          data: {
            totalEntries: mapped.length,
            currentlyWatching: watching.slice(0, 5),
            lastWatchedMovie: watchedMovies[0] || null,
            lastWatchedAny:
              sortByTimestampDesc(
                mapped.filter((e) => e.status === "watched" || e.status === "favorite"),
                (e) => e.watchedAt || e.updatedAt
              )[0] || null,
            lastCreatedEntry: sortByTimestampDesc(mapped, (e) => e.createdAt)[0] || null,
          },
        };
      }
    } catch {
      // Fallback limpio a snapshot local si la tabla aún no fue aplicada en Supabase
    }
  }

  // 2. Fallback a snapshot local del dispositivo actual (sin sobrescribir nada)
  const entries = ctx.localSnapshot?.cinemaEntries;

  if (!Array.isArray(entries)) {
    return {
      ok: true,
      tool: "getLastWatchedMedia",
      source: "none",
      asOf,
      buildingId: "cine",
      hasData: false,
      data: null,
      limitationNote:
        "Tu catálogo de Cine (películas, series y musicales) se guarda actualmente solo en el navegador local (localStorage). Ejecuta la migración supabase/migrations/20261119_oakhaven_ai_phase1_sync.sql para sincronizarlo en la nube.",
    };
  }

  const sanitized = entries.slice(0, 25);
  const watching = sortByTimestampDesc(
    sanitized.filter((e) => e.status === "watching"),
    (e) => e.updatedAt
  );
  const watchedMovies = sortByTimestampDesc(
    sanitized.filter((e) => e.kind === "movie" && (e.status === "watched" || e.status === "favorite")),
    (e) => e.watchedAt || e.updatedAt
  );
  const lastCreated = sortByTimestampDesc(sanitized, (e) => e.createdAt)[0] || null;
  const lastWatchedAny =
    sortByTimestampDesc(
      sanitized.filter((e) => e.status === "watched" || e.status === "favorite"),
      (e) => e.watchedAt || e.updatedAt
    )[0] || null;

  return {
    ok: true,
    tool: "getLastWatchedMedia",
    source: "local_device_snapshot",
    asOf,
    buildingId: "cine",
    hasData: sanitized.length > 0,
    data: {
      totalEntries: sanitized.length,
      currentlyWatching: watching.slice(0, 5),
      lastWatchedMovie: watchedMovies[0] || null,
      lastWatchedAny,
      lastCreatedEntry: lastCreated,
    },
    limitationNote:
      "Estos datos provienen del almacenamiento local de este dispositivo (localStorage); la sincronización en Supabase requiere aprobar la migración pendiente.",
  };
}

export async function getRecentExpenses(
  ctx: MayorToolContext,
  args?: { days?: number; limit?: number }
): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  const days = Math.min(90, Math.max(1, Number(args?.days) || 7));
  const limit = clampLimit(args?.limit, 15);
  const sinceIso = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const { data: rows, error } = await ctx.db
        .from("financial_transactions")
        .select("id, amount_cop, category, merchant_or_concept, created_at")
        .eq("user_id", ctx.authenticatedUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          ok: false,
          tool: "getRecentExpenses",
          source: "supabase",
          asOf,
          buildingId: "banco_oakhaven",
          hasData: false,
          data: null,
          error: "No se pudieron consultar tus movimientos financieros en Supabase.",
        };
      }

      const list = rows || [];
      const inWindow = list.filter((tx) => {
        const ts = Date.parse(tx.created_at || "");
        return Number.isFinite(ts) && ts >= Date.parse(sinceIso);
      });
      const totalWindowCop = inWindow.reduce((sum, tx) => sum + (Number(tx.amount_cop) || 0), 0);

      return {
        ok: true,
        tool: "getRecentExpenses",
        source: "supabase",
        asOf,
        buildingId: "banco_oakhaven",
        hasData: list.length > 0,
        data: {
          windowDays: days,
          transactionsInWindowCount: inWindow.length,
          totalSpentWindowCop: totalWindowCop,
          lastExpense: list[0] || null,
          recentTransactions: list.slice(0, 5),
        },
      };
    }

    const expenses = sortByTimestampDesc(
      (ctx.store.financialMovements || []).filter((m) => m.tipo === "Gasto"),
      (m) => m.created_at || m.fecha
    ).slice(0, limit);
    const inWindow = expenses.filter((tx) => {
      const ts = Date.parse(tx.created_at || tx.fecha || "");
      return Number.isFinite(ts) && ts >= Date.parse(sinceIso);
    });
    const totalWindowCop = inWindow.reduce((sum, tx) => sum + (Number(tx.monto) || 0), 0);
    const normalizeTx = (tx: (typeof expenses)[number]) => ({
      id: tx.id,
      amount_cop: tx.monto,
      category: tx.categoria,
      merchant_or_concept: tx.descripcion,
      created_at: tx.created_at || tx.fecha,
    });

    return {
      ok: true,
      tool: "getRecentExpenses",
      source: "memory_store",
      asOf,
      buildingId: "banco_oakhaven",
      hasData: expenses.length > 0,
      data: {
        windowDays: days,
        transactionsInWindowCount: inWindow.length,
        totalSpentWindowCop: totalWindowCop,
        lastExpense: expenses[0] ? normalizeTx(expenses[0]) : null,
        recentTransactions: expenses.slice(0, 5).map(normalizeTx),
      },
    };
  } catch {
    return {
      ok: false,
      tool: "getRecentExpenses",
      source: "none",
      asOf,
      buildingId: "banco_oakhaven",
      hasData: false,
      data: null,
      error: "Error inesperado consultando gastos recientes.",
    };
  }
}

export async function getLastWorkout(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const { data: logs, error } = await ctx.db
        .from("activity_logs")
        .select("id, title, duration_minutes, notes, completed_at")
        .eq("user_id", ctx.authenticatedUserId)
        .eq("domain", "sports")
        .order("completed_at", { ascending: false })
        .limit(5);

      if (error) {
        return {
          ok: false,
          tool: "getLastWorkout",
          source: "supabase",
          asOf,
          buildingId: "gimnasio",
          hasData: false,
          data: null,
          error: "No se pudo consultar tu historial de entrenamientos.",
        };
      }
      const list = logs || [];
      return {
        ok: true,
        tool: "getLastWorkout",
        source: "supabase",
        asOf,
        buildingId: "gimnasio",
        hasData: list.length > 0,
        data: {
          workoutsCount: list.length,
          lastWorkout: list[0] || null,
        },
      };
    }

    const workouts = sortByTimestampDesc(
      (ctx.store.skillSessions || []).filter((s) => s.domain === "sports"),
      (s) => s.timestamp
    );
    return {
      ok: true,
      tool: "getLastWorkout",
      source: "memory_store",
      asOf,
      buildingId: "gimnasio",
      hasData: workouts.length > 0,
      data: {
        workoutsCount: workouts.length,
        lastWorkout: workouts[0] || null,
      },
    };
  } catch {
    return {
      ok: false,
      tool: "getLastWorkout",
      source: "none",
      asOf,
      buildingId: "gimnasio",
      hasData: false,
      data: null,
      error: "Error inesperado consultando entrenamientos.",
    };
  }
}

export async function getRecentCubeSolves(
  ctx: MayorToolContext,
  args?: { limit?: number }
): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  const limit = clampLimit(args?.limit, 10);
  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const { data: solves, error } = await ctx.db
        .from("rubik_solves")
        .select("id, cube_type, time_seconds, penalty, is_pb, ao5_after, ao12_after, created_at")
        .eq("user_id", ctx.authenticatedUserId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        return {
          ok: false,
          tool: "getRecentCubeSolves",
          source: "supabase",
          asOf,
          buildingId: "club_puzzles",
          hasData: false,
          data: null,
          error: "No se pudieron consultar tus tiempos de cubos en Supabase.",
        };
      }
      const list = solves || [];
      const bestPb = list
        .filter((s) => Number.isFinite(Number(s.time_seconds)))
        .sort((a, b) => Number(a.time_seconds) - Number(b.time_seconds))[0] || null;
      return {
        ok: true,
        tool: "getRecentCubeSolves",
        source: "supabase",
        asOf,
        buildingId: "club_puzzles",
        hasData: list.length > 0,
        data: {
          recentCount: list.length,
          lastSolve: list[0] || null,
          bestRecentSolve: bestPb,
          lastMarkedPb: list.find((s) => s.is_pb) || bestPb,
        },
      };
    }

    const solves = sortByTimestampDesc(ctx.store.rubikSolves || [], (s) => s.timestamp).slice(0, limit);
    const bestPb =
      [...solves].sort((a, b) => a.time_seconds - b.time_seconds)[0] || null;
    return {
      ok: true,
      tool: "getRecentCubeSolves",
      source: "memory_store",
      asOf,
      buildingId: "club_puzzles",
      hasData: solves.length > 0,
      data: {
        recentCount: solves.length,
        lastSolve: solves[0] || null,
        bestRecentSolve: bestPb,
        lastMarkedPb: solves.find((s) => s.is_pb) || bestPb,
      },
    };
  } catch {
    return {
      ok: false,
      tool: "getRecentCubeSolves",
      source: "none",
      asOf,
      buildingId: "club_puzzles",
      hasData: false,
      data: null,
      error: "Error inesperado consultando tiempos de cubos.",
    };
  }
}

export async function getPendingWorkProjects(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  const workProjects = (ctx.store.workProjects || []).filter(
    (p) =>
      p.status !== "completed" &&
      !String(p.id || "").toLowerCase().startsWith("demo-") &&
      !String(p.id || "").toLowerCase().startsWith("template-")
  );

  let lastWorkSession: Record<string, unknown> | null = null;
  let source: DataSourceOrigin = "memory_store";

  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data: dbLogs, error } = await ctx.db
      .from("activity_logs")
      .select("id, title, duration_minutes, notes, completed_at")
      .eq("user_id", ctx.authenticatedUserId)
      .eq("domain", "work")
      .order("completed_at", { ascending: false })
      .limit(1);
    if (!error && dbLogs && dbLogs.length > 0) {
      lastWorkSession = dbLogs[0] as Record<string, unknown>;
      source = "supabase";
    }
  }

  if (!lastWorkSession) {
    const workLogs = sortByTimestampDesc(
      (ctx.store.skillSessions || []).filter((s) => s.domain === "work"),
      (s) => s.timestamp
    );
    lastWorkSession = (workLogs[0] as unknown as Record<string, unknown>) || null;
  }

  return {
    ok: true,
    tool: "getPendingWorkProjects",
    source,
    asOf,
    buildingId: "oficina",
    hasData: workProjects.length > 0 || Boolean(lastWorkSession),
    data: {
      pendingProjectsCount: workProjects.length,
      pendingProjects: workProjects.slice(0, 10).map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        current_stage: p.current_stage,
        pendingTasksCount: (p.tasks || []).filter((t) => !t.is_completed && t.stage !== "done" && t.stage !== "Completado").length,
      })),
      lastWorkSession,
    },
  };
}

export async function getStudyProgress(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  try {
    if (ctx.isSupabaseConfigured && ctx.db) {
      const { data: logs, error } = await ctx.db
        .from("activity_logs")
        .select("id, title, duration_minutes, notes, completed_at")
        .eq("user_id", ctx.authenticatedUserId)
        .eq("domain", "study")
        .order("completed_at", { ascending: false })
        .limit(10);

      if (error) {
        return {
          ok: false,
          tool: "getStudyProgress",
          source: "supabase",
          asOf,
          buildingId: "biblioteca",
          hasData: false,
          data: null,
          error: "No se pudo consultar tu progreso de estudio.",
        };
      }
      const list = logs || [];
      const totalMinutes = list.reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);
      return {
        ok: true,
        tool: "getStudyProgress",
        source: "supabase",
        asOf,
        buildingId: "biblioteca",
        hasData: list.length > 0,
        data: {
          recentSessionsCount: list.length,
          recentTotalMinutes: totalMinutes,
          lastStudySession: list[0] || null,
          spacedCardsCount: (ctx.store.spacedCards || []).length,
        },
      };
    }

    const studyLogs = sortByTimestampDesc(
      (ctx.store.skillSessions || []).filter((s) => s.domain === "study"),
      (s) => s.timestamp
    );
    const totalMinutes = studyLogs.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    return {
      ok: true,
      tool: "getStudyProgress",
      source: "memory_store",
      asOf,
      buildingId: "biblioteca",
      hasData: studyLogs.length > 0 || (ctx.store.spacedCards || []).length > 0,
      data: {
        recentSessionsCount: studyLogs.length,
        recentTotalMinutes: totalMinutes,
        lastStudySession: studyLogs[0] || null,
        spacedCardsCount: (ctx.store.spacedCards || []).length,
      },
    };
  } catch {
    return {
      ok: false,
      tool: "getStudyProgress",
      source: "none",
      asOf,
      buildingId: "biblioteca",
      hasData: false,
      data: null,
      error: "Error inesperado consultando progreso de estudio.",
    };
  }
}

export async function getVillageSummary(ctx: MayorToolContext): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  const [books, knitting, expenses, workout] = await Promise.all([
    getLastReadBook(ctx),
    getLastKnittingActivity(ctx),
    getRecentExpenses(ctx, { days: 7, limit: 10 }),
    getLastWorkout(ctx),
  ]);

  return {
    ok: true,
    tool: "getVillageSummary",
    source: books.source !== "none" ? books.source : "memory_store",
    asOf,
    buildingId: "ayuntamiento",
    hasData: true,
    data: {
      playerLevel: ctx.store.player_level,
      walletGp: ctx.store.wallet_gp,
      vaultRemainingGp: ctx.store.vault_remaining_gp,
      lastBook: (books.data as Record<string, unknown> | null)?.lastUpdatedBook || null,
      lastKnittingProject: (knitting.data as Record<string, unknown> | null)?.lastUpdatedProject || null,
      weeklySpentCop: (expenses.data as Record<string, unknown> | null)?.totalSpentWindowCop || 0,
      lastWorkoutAt:
        isoDateOrNull(
          ((workout.data as Record<string, unknown> | null)?.lastWorkout as Record<string, unknown> | null)
            ?.completed_at ||
            ((workout.data as Record<string, unknown> | null)?.lastWorkout as Record<string, unknown> | null)
              ?.timestamp
        ) || null,
    },
  };
}

/**
 * Despachador estricto de solo lectura.
 * Rechaza cualquier nombre de herramienta fuera de la lista blanca (pagos, mutaciones, etc.).
 */
export async function executeMayorReadOnlyTool(
  toolName: string,
  ctx: MayorToolContext,
  args?: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const asOf = new Date().toISOString();
  if (!ALLOWED_TOOL_SET.has(toolName as MayorReadOnlyToolName)) {
    return {
      ok: false,
      blocked: true,
      tool: toolName,
      source: "none",
      asOf,
      buildingId: "ayuntamiento",
      hasData: false,
      data: null,
      error: `Herramienta "${toolName}" rechazada: el Presidente Rowan solo tiene acceso a herramientas de solo lectura autorizadas.`,
    };
  }

  switch (toolName as MayorReadOnlyToolName) {
    case "getLastReadBook":
      return getLastReadBook(ctx);
    case "getLastKnittingActivity":
      return getLastKnittingActivity(ctx);
    case "getLastWatchedMedia":
      return getLastWatchedMedia(ctx);
    case "getRecentExpenses":
      return getRecentExpenses(ctx, args as { days?: number; limit?: number });
    case "getLastWorkout":
      return getLastWorkout(ctx);
    case "getRecentCubeSolves":
      return getRecentCubeSolves(ctx, args as { limit?: number });
    case "getPendingWorkProjects":
      return getPendingWorkProjects(ctx);
    case "getStudyProgress":
      return getStudyProgress(ctx);
    case "getVillageSummary":
      return getVillageSummary(ctx);
  }
}
