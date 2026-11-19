/**
 * ============================================================================
 * OAKHAVEN AI FASE 6 — HERRAMIENTAS ACTIVAS DE NORA (CINE) Y SILAS (BANCO)
 * ============================================================================
 * REGLAS DE SEGURIDAD, VERACIDAD Y PRIVACIDAD FINANCIERA:
 * 1. Nora distingue película, serie y musical; separa estado `favorite` de evento `watchedAt`;
 *    nunca asume que un título en `watchlist` fue visto ni afirma disponibilidad en streaming.
 * 2. Silas analiza dinero, PERO NO MUEVE DINERO:
 *    - Todas sus herramientas son 100% de solo lectura respecto a registros financieros.
 *    - Excluye estrictamente `INITIAL_FINANCIAL_MOVEMENTS`, `CASE_STUDY_ACCOUNTS` y demos.
 *    - Usa aritmética entera en COP (sin errores de coma flotante), no mezcla monedas ni GP↔COP.
 *    - Las simulaciones operan sobre copias puras sin efectos secundarios.
 *    - Por defecto NO envía datos financieros detallados a Gemini.
 */

import crypto from "node:crypto";
import type { MayorToolContext } from "./mayor-readonly-tools.ts";
import {
  getResourceExtractedText,
  listBuildingResources,
  type ResourceQueryContext,
} from "./resource-query-tools.ts";
import type { SpecialistProposal } from "./specialist-engine.ts";
import type { CinemaEntry, CinemaMediaKind } from "../sanctuary/cinema-store.ts";
import { INITIAL_FINANCIAL_MOVEMENTS } from "../initial-financial-movements.ts";

export type FinancialProvenance =
  | "authenticated_db"
  | "user_confirmed"
  | "local_unverified"
  | "demo_template"
  | "simulation";

const SEED_MOVEMENT_IDS = new Set<string>(INITIAL_FINANCIAL_MOVEMENTS.map((m) => m.id));
const SEED_ACCOUNT_IDS = new Set<string>(["acc_nu_39", "acc_nequi_39"]);

function makeIdempotencyKey(prefix: string, parts: string[]): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${prefix}:${parts.join("|")}`)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${hash}`;
}

export function isDemoFinancialMovement(mov: { id?: string; provenance?: string; isDemo?: boolean }): boolean {
  if (mov.isDemo === true) return true;
  if (mov.provenance === "demo_template") return true;
  const id = String(mov.id || "");
  if (SEED_MOVEMENT_IDS.has(id)) return true;
  const low = id.toLowerCase();
  return low.startsWith("demo-") || low.startsWith("seed-") || low.startsWith("case-study-");
}

export function isDemoBankAccount(accId: string): boolean {
  const low = (accId || "").toLowerCase();
  return SEED_ACCOUNT_IDS.has(accId) || low.startsWith("demo-") || low.startsWith("case-study-");
}

export function maskFinancialIdentifiers(text: string): string {
  return (text || "").replace(/\b\d{6,19}\b/g, "[CUENTA_OCULTA]");
}

// ============================================================================
// NORA — CURADORA CULTURAL DE CINE, SERIES Y MUSICALES (`cine`)
// ============================================================================

export interface CinemaCollectionSnapshot {
  source: "supabase" | "local_device_snapshot" | "none";
  entries: CinemaEntry[];
  movies: CinemaEntry[];
  series: CinemaEntry[];
  musicals: CinemaEntry[];
  watching: CinemaEntry[];
  watchlist: CinemaEntry[];
  watched: CinemaEntry[];
  favorites: CinemaEntry[];
  lastWatchedMovie: CinemaEntry | null;
  lastWatchedMusical: CinemaEntry | null;
  lastAddedEntry: CinemaEntry | null;
  lastUpdatedSeries: CinemaEntry | null;
  topRated: CinemaEntry[];
  weeklyActivityCount: number;
  limitationNote?: string;
}

function sortCinemaDesc(items: CinemaEntry[], field: "updatedAt" | "createdAt" | "watchedAt"): CinemaEntry[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a[field] || a.updatedAt || "") || 0;
    const tb = Date.parse(b[field] || b.updatedAt || "") || 0;
    return tb - ta;
  });
}

export async function getCinemaCollection(ctx: MayorToolContext): Promise<CinemaCollectionSnapshot> {
  let entries: CinemaEntry[] = [];
  let source: CinemaCollectionSnapshot["source"] = "none";
  let limitationNote: string | undefined;

  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data, error } = await ctx.db
      .from("cinema_entries")
      .select("id, title, kind, status, rating, season, episode, favorite_song_or_scene, notes, watched_at, created_at, updated_at")
      .eq("user_id", ctx.authenticatedUserId)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data) && data.length > 0) {
      entries = data.map((r) => ({
        id: String(r.id),
        title: String(r.title),
        kind: r.kind as CinemaMediaKind,
        status: r.status as CinemaEntry["status"],
        rating: r.rating !== null && r.rating !== undefined ? Number(r.rating) : undefined,
        season: r.season !== null && r.season !== undefined ? Number(r.season) : undefined,
        episode: r.episode !== null && r.episode !== undefined ? Number(r.episode) : undefined,
        favoriteSongOrScene: r.favorite_song_or_scene ? String(r.favorite_song_or_scene) : undefined,
        notes: String(r.notes || ""),
        watchedAt: r.watched_at ? String(r.watched_at) : undefined,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at),
      }));
      source = "supabase";
    }
  }

  // Nunca reemplazar registros locales con respuestas remotas vacías
  if (entries.length === 0 && Array.isArray(ctx.localSnapshot?.cinemaEntries) && ctx.localSnapshot!.cinemaEntries.length > 0) {
    entries = ctx.localSnapshot!.cinemaEntries;
    source = "local_device_snapshot";
    limitationNote = "Catálogo leído desde el navegador local (local_snapshot); sincroniza con Cine para verlo en otros dispositivos.";
  }

  const movies = entries.filter((e) => e.kind === "movie");
  const series = entries.filter((e) => e.kind === "series");
  const musicals = entries.filter((e) => e.kind === "musical");

  const watching = entries.filter((e) => e.status === "watching");
  const watchlist = entries.filter((e) => e.status === "watchlist");
  // Distinción explícita: una obra favorita con watchedAt conserva su historial de visionado
  const watched = entries.filter((e) => e.status === "watched" || Boolean(e.watchedAt));
  const favorites = entries.filter((e) => e.status === "favorite");

  const lastWatchedMovie = sortCinemaDesc(
    movies.filter((m) => m.status === "watched" || Boolean(m.watchedAt)),
    "watchedAt"
  )[0] || null;
  const lastWatchedMusical = sortCinemaDesc(
    musicals.filter((m) => m.status === "watched" || Boolean(m.watchedAt)),
    "watchedAt"
  )[0] || null;
  const lastAddedEntry = sortCinemaDesc(entries, "createdAt")[0] || null;
  const lastUpdatedSeries = sortCinemaDesc(series, "updatedAt")[0] || null;
  const topRated = [...entries]
    .filter((e) => typeof e.rating === "number" && e.rating > 0)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyActivityCount = entries.filter(
    (e) => (Date.parse(e.watchedAt || e.updatedAt || "") || 0) >= sevenDaysAgo
  ).length;

  return {
    source,
    entries,
    movies,
    series,
    musicals,
    watching,
    watchlist,
    watched,
    favorites,
    lastWatchedMovie,
    lastWatchedMusical,
    lastAddedEntry,
    lastUpdatedSeries,
    topRated,
    weeklyActivityCount,
    limitationNote,
  };
}

export function recommendFromWatchlist(
  collection: CinemaCollectionSnapshot,
  preferredKind?: CinemaMediaKind
): { basis: "watchlist" | "history" | "general_fallback"; message: string } {
  const pool = preferredKind
    ? collection.watchlist.filter((e) => e.kind === preferredKind)
    : collection.watchlist;

  if (pool.length > 0) {
    const pick = pool[0];
    const kindLabel = pick.kind === "musical" ? "musical" : pick.kind === "series" ? "serie" : "película";
    return {
      basis: "watchlist",
      message:
        `🎬 **[Basada en tu watchlist]** Para hoy te propongo ver **"${pick.title}"** (${kindLabel}, en tu lista de pendientes). ` +
        `Nota: está marcada como pendiente (aún no vista) y no afirmo disponibilidad en plataformas de streaming sin verificación externa.`,
    };
  }

  if (collection.favorites.length > 0) {
    const fav = collection.favorites[0];
    return {
      basis: "history",
      message:
        `⭐ **[Basada en tu historial]** Tu watchlist ${preferredKind ? `de ${preferredKind}s ` : ""}está vacía, pero tienes como favorita **"${fav.title}"**` +
        (fav.favoriteSongOrScene ? ` (escena/canción favorita: "${fav.favoriteSongOrScene}")` : "") +
        ". Podrías hacer un re-visionado o agregar nuevos títulos pendientes.",
    };
  }

  return {
    basis: "general_fallback",
    message:
      "🍿 **[Sugerencia general — sin historial registrado]** Todavía no tienes obras en tu Cine Boutique. " +
      "Agrega 1 o 2 películas, series o musicales a tu Cartelera para darte recomendaciones basadas en tus gustos reales.",
  };
}

export function proposeMovieNight(
  collection: CinemaCollectionSnapshot,
  preferredKind?: CinemaMediaKind
): string {
  const rec = recommendFromWatchlist(collection, preferredKind);
  const label = preferredKind === "musical" ? "Noche de Musicales" : "Noche de Cine";
  return `🕯️ **${label} preparada por Nora:**\n${rec.message}\n• Al terminar, puedes registrar tu valoración (1–5) y tu escena o canción favorita en el Diario Cultural.`;
}

export async function listCinemaResources(resCtx: ResourceQueryContext) {
  return listBuildingResources(resCtx, "cine", "oakhaven.specialist.cine.nora");
}

export async function readCinemaReview(resCtx: ResourceQueryContext, resourceId: string) {
  return getResourceExtractedText(resCtx, resourceId, "oakhaven.specialist.cine.nora");
}

export function proposeCinemaReview(entry: CinemaEntry, draftText?: string): SpecialistProposal {
  const kindLabel = entry.kind === "musical" ? "Musical" : entry.kind === "series" ? "Serie" : "Película";
  const content =
    draftText && draftText.trim().length > 0
      ? draftText.trim()
      : `# Reseña Cultural — ${entry.title}\n- Tipo: ${kindLabel}\n- Valoración registrada: ${entry.rating ? `${entry.rating}/5` : "sin calificar"}\n${entry.favoriteSongOrScene ? `- Escena/Canción favorita: ${entry.favoriteSongOrScene}\n` : ""}\n## Reflexión personal\n(Edita tus impresiones antes o después de guardar.)`;

  return {
    id: `prop-cine-review-${Date.now()}`,
    idempotencyKey: makeIdempotencyKey("cine-review", [entry.id, entry.title.toLowerCase()]),
    buildingId: "cine",
    specialistName: "Nora",
    actionType: "add_cinema_review",
    title: `Guardar reseña cultural de "${entry.title}"`,
    summary: "Se guardará en tu Cartelera Personal (`building_resources`) al confirmar. Nunca altera GP ni XP.",
    payload: {
      buildingId: "cine",
      resourceType: "review",
      projectId: entry.id,
      title: `Reseña: ${entry.title}`,
      filename: `resena-${entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 28)}.md`,
      mimeType: "text/markdown",
      rawTextContent: content,
    },
    requiresConfirmation: true,
  };
}

// ============================================================================
// SILAS — GUARDIÁN FINANCIERO PRIVADO (`banco_oakhaven`, SOLO LECTURA)
// ============================================================================

export interface VerifiedMovementItem {
  id: string;
  date: string;
  type: "Ingreso" | "Gasto";
  category: string;
  amountCop: number; // entero exacto en COP
  currency: "COP" | "USD" | string;
  description: string;
  provenance: FinancialProvenance;
}

export interface VerifiedFinancialSummary {
  provenance: FinancialProvenance;
  periodDays: number;
  currency: "COP";
  nonCopCount: number;
  verifiedCount: number;
  excludedDemoCount: number;
  totalIncomeCop: number;
  totalExpenseCop: number;
  netCashflowCop: number;
  breakdownByCategory: Array<{ category: string; totalCop: number; count: number }>;
  potentialDuplicates: Array<{ date: string; amountCop: number; description: string; occurrences: number }>;
  latestMovementDate: string | null;
  isStale: boolean;
  limitationNote?: string;
}

export async function getVerifiedFinancialMovements(
  ctx: MayorToolContext,
  periodDays = 15
): Promise<VerifiedFinancialSummary> {
  const safeDays = Math.min(90, Math.max(1, Math.floor(periodDays)));
  const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const verified: VerifiedMovementItem[] = [];
  let excludedDemoCount = 0;
  let nonCopCount = 0;
  let provenance: FinancialProvenance = "local_unverified";

  if (ctx.isSupabaseConfigured && ctx.db) {
    const { data, error } = await ctx.db
      .from("financial_transactions")
      .select("id, type, category, amount_cop, merchant_or_concept, created_at")
      .eq("user_id", ctx.authenticatedUserId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data)) {
      provenance = "authenticated_db";
      for (const row of data) {
        const amt = Math.round(Number(row.amount_cop) || 0);
        if (amt <= 0) continue;
        const ts = Date.parse(String(row.created_at || "")) || 0;
        if (ts < cutoffMs) continue;
        verified.push({
          id: String(row.id),
          date: String(row.created_at || ""),
          type: String(row.type || "").toLowerCase() === "income" ? "Ingreso" : "Gasto",
          category: String(row.category || "general"),
          amountCop: amt,
          currency: "COP",
          description: maskFinancialIdentifiers(String(row.merchant_or_concept || "Movimiento")),
          provenance: "authenticated_db",
        });
      }
    }
  } else {
    const rawMovs = (ctx.store.financialMovements || []) as Array<
      (typeof ctx.store.financialMovements)[number] & {
        currency?: string;
        provenance?: FinancialProvenance;
        isDemo?: boolean;
      }
    >;
    for (const m of rawMovs) {
      if (isDemoFinancialMovement(m)) {
        excludedDemoCount += 1;
        continue;
      }
      const curr = String(m.currency || "COP").toUpperCase();
      if (curr !== "COP") {
        nonCopCount += 1;
        continue; // Nunca mezclar monedas sin tasa verificable y fechada
      }
      const ts = Date.parse(m.created_at || m.fecha || "") || 0;
      if (ts > 0 && ts < cutoffMs) continue;
      const amt = Math.round(Number(m.monto) || 0);
      if (amt <= 0) continue;
      verified.push({
        id: m.id,
        date: m.created_at || m.fecha || "",
        type: m.tipo === "Ingreso" ? "Ingreso" : "Gasto",
        category: m.categoria || "general",
        amountCop: amt,
        currency: "COP",
        description: maskFinancialIdentifiers(m.descripcion || "Movimiento"),
        provenance: m.provenance || "local_unverified",
      });
    }
  }

  let totalIncomeCop = 0;
  let totalExpenseCop = 0;
  const catMap = new Map<string, { totalCop: number; count: number }>();
  const dupMap = new Map<string, { date: string; amountCop: number; description: string; occurrences: number }>();

  for (const m of verified) {
    if (m.type === "Ingreso") {
      totalIncomeCop += m.amountCop;
    } else {
      totalExpenseCop += m.amountCop;
      const prev = catMap.get(m.category) || { totalCop: 0, count: 0 };
      catMap.set(m.category, { totalCop: prev.totalCop + m.amountCop, count: prev.count + 1 });

      const dayKey = `${m.date.slice(0, 10)}|${m.amountCop}|${m.description.toLowerCase().slice(0, 30)}`;
      const dupPrev = dupMap.get(dayKey);
      if (dupPrev) {
        dupPrev.occurrences += 1;
      } else {
        dupMap.set(dayKey, { date: m.date.slice(0, 10), amountCop: m.amountCop, description: m.description, occurrences: 1 });
      }
    }
  }

  const breakdownByCategory = Array.from(catMap.entries())
    .map(([category, v]) => ({ category, totalCop: v.totalCop, count: v.count }))
    .sort((a, b) => b.totalCop - a.totalCop);

  const potentialDuplicates = Array.from(dupMap.values()).filter((d) => d.occurrences >= 2);
  const sortedDates = verified
    .map((v) => v.date)
    .filter(Boolean)
    .sort((a, b) => (Date.parse(b) || 0) - (Date.parse(a) || 0));
  const latestMovementDate = sortedDates[0] || null;
  const isStale = latestMovementDate
    ? Date.now() - (Date.parse(latestMovementDate) || 0) > 14 * 24 * 60 * 60 * 1000
    : true;

  let limitationNote: string | undefined;
  if (verified.length === 0 && excludedDemoCount > 0) {
    limitationNote =
      `Se excluyeron ${excludedDemoCount} movimientos de ejemplo/caso de estudio (` +
      "demo_template). No tienes movimientos reales verificados en este periodo.";
  } else if (nonCopCount > 0) {
    limitationNote = `Se excluyeron ${nonCopCount} movimiento(s) en moneda distinta a COP para no mezclar divisas sin tasa verificable.`;
  }

  return {
    provenance,
    periodDays: safeDays,
    currency: "COP",
    nonCopCount,
    verifiedCount: verified.length,
    excludedDemoCount,
    totalIncomeCop,
    totalExpenseCop,
    netCashflowCop: totalIncomeCop - totalExpenseCop,
    breakdownByCategory,
    potentialDuplicates,
    latestMovementDate,
    isStale,
    limitationNote,
  };
}

export async function getRecordedObligations(ctx: MayorToolContext) {
  const fixedCosts = (ctx.store.fixedCosts || []).map((c, idx) => ({
    id: c.id || `fc-${idx}`,
    name: c.name,
    amountCop: Math.round(Number(c.amount) || 0),
    dueDay: null as number | null,
    paidStatus: "sin_evidencia_de_pago_automatico",
  }));

  const debts = (ctx.store.bosses || [])
    .filter((b) => b.status !== "defeated")
    .map((b) => ({
      id: b.id,
      name: b.name,
      currentBalanceCop: Math.round(Number(b.current_hp) || 0),
      minMonthlyPaymentCop: Math.round(Number(b.min_monthly_payment_cop) || 0),
      cutoffDay: b.cutoff_day ?? null,
    }));

  const totalFixedCop = fixedCosts.reduce((s, c) => s + c.amountCop, 0);
  const totalMinDebtCop = debts.reduce((s, d) => s + d.minMonthlyPaymentCop, 0);

  return {
    provenance: ctx.isSupabaseConfigured ? ("authenticated_db" as const) : ("local_unverified" as const),
    fixedCostsCount: fixedCosts.length,
    activeDebtsCount: debts.length,
    totalFixedObligationsCop: totalFixedCop,
    totalMinDebtPaymentsCop: totalMinDebtCop,
    totalMonthlyObligationsCop: totalFixedCop + totalMinDebtCop,
    fixedCosts: fixedCosts.slice(0, 15),
    debts: debts.slice(0, 10),
  };
}

export function simulateBudgetScenario(params: {
  monthlySavingCop: number;
  months: number;
  currentNetCashflowCop: number;
}) {
  const saving = Math.max(0, Math.round(params.monthlySavingCop));
  const months = Math.min(60, Math.max(1, Math.floor(params.months)));
  const projectedSavedCop = saving * months;
  const remainingCashflowCop = Math.round(params.currentNetCashflowCop) - saving;

  return {
    provenance: "simulation" as const,
    persisted: false as const,
    currency: "COP" as const,
    monthlySavingCop: saving,
    months,
    projectedSavedCop,
    remainingCashflowCop,
    disclaimer:
      "ESCENARIO HIPOTÉTICO (simulación de solo lectura sobre copia de datos; no modifica saldos, obligaciones ni GP/XP).",
  };
}

export function simulateDebtPaymentImpact(params: {
  debtName: string;
  currentBalanceCop: number;
  extraPaymentCop: number;
}) {
  const balance = Math.max(0, Math.round(params.currentBalanceCop));
  const extra = Math.max(0, Math.round(params.extraPaymentCop));
  const projectedBalanceCop = Math.max(0, balance - extra);
  const reductionPercent = balance > 0 ? Math.round(((balance - projectedBalanceCop) / balance) * 100) : 0;

  return {
    provenance: "simulation" as const,
    persisted: false as const,
    currency: "COP" as const,
    debtName: params.debtName,
    currentBalanceCop: balance,
    hypotheticalExtraPaymentCop: extra,
    projectedBalanceCop,
    reductionPercent,
    disclaimer:
      "ESCENARIO HIPOTÉTICO (no ejecuta ningún pago real ni modifica la deuda registrada).",
  };
}

export function explainGpVsCop(): string {
  return (
    "🪙 **Diferencia estricta entre GP y COP:**\n" +
    "• **COP (Pesos Colombianos):** tu dinero real en el mundo físico. Silas solo lo analiza en modo lectura y jamás mueve fondos.\n" +
    "• **GP (Gold Pieces):** monedas de recompensa del juego en OakHaven. **No existe conversión automática COP ↔ GP** ni equivalencia monetaria."
  );
}
