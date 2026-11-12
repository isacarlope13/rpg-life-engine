import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RPGEngineMemoryStore } from "./demo-store.ts";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase.ts";

const DATA_DIR = path.join(process.cwd(), ".data", "user-stores");

export interface PersistedCollectionsPayload {
  updated_at: string;
  billing_period: string;
  monthly_income_cop: number;
  fixed_costs_budget_cop: number;
  fixed_costs_spent_cop: number;
  variable_ops_budget_cop: number;
  variable_ops_spent_cop: number;
  vault_cap_gp: number;
  vault_remaining_gp: number;
  wallet_gp: number;
  total_penalty_gp: number;
  player_level: number;
  current_xp: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  readingBooks: RPGEngineMemoryStore["readingBooks"];
  rubikCubes: RPGEngineMemoryStore["rubikCubes"];
  knittingProjects: RPGEngineMemoryStore["knittingProjects"];
  trialCheckpoints: RPGEngineMemoryStore["trialCheckpoints"];
  bosses: RPGEngineMemoryStore["bosses"];
  workProjects?: RPGEngineMemoryStore["workProjects"];
  spacedCards?: RPGEngineMemoryStore["spacedCards"];
  unlockedPerks?: RPGEngineMemoryStore["unlockedPerks"];
  dailySchedule?: RPGEngineMemoryStore["dailySchedule"];
  wishlist?: RPGEngineMemoryStore["wishlist"];
}

function safeFilePath(userId: string): string {
  const cleanId = (userId || "default").replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${cleanId}.json`);
}

export function serializeStoreCollections(
  store: RPGEngineMemoryStore
): PersistedCollectionsPayload {
  return {
    updated_at: new Date().toISOString(),
    billing_period: store.billing_period,
    monthly_income_cop: store.monthly_income_cop,
    fixed_costs_budget_cop: store.fixed_costs_budget_cop,
    fixed_costs_spent_cop: store.fixed_costs_spent_cop,
    variable_ops_budget_cop: store.variable_ops_budget_cop,
    variable_ops_spent_cop: store.variable_ops_spent_cop,
    vault_cap_gp: store.vault_cap_gp,
    vault_remaining_gp: store.vault_remaining_gp,
    wallet_gp: store.wallet_gp,
    total_penalty_gp: store.total_penalty_gp,
    player_level: store.player_level,
    current_xp: store.current_xp,
    current_streak_days: store.current_streak_days,
    streak_multiplier: store.streak_multiplier,
    aegis_shields: store.aegis_shields,
    readingBooks: store.readingBooks,
    rubikCubes: store.rubikCubes,
    knittingProjects: store.knittingProjects,
    trialCheckpoints: store.trialCheckpoints,
    bosses: store.bosses,
    workProjects: store.workProjects,
    spacedCards: store.spacedCards,
    unlockedPerks: store.unlockedPerks,
    dailySchedule: store.dailySchedule,
    wishlist: store.wishlist,
  };
}

export function applyPersistedCollectionsToStore(
  store: RPGEngineMemoryStore,
  payload: Partial<PersistedCollectionsPayload> | null | undefined
): void {
  if (!payload || typeof payload !== "object") return;

  // 1. Restauración fiel de colecciones (incluso si están vacías [])
  if (Array.isArray(payload.readingBooks)) {
    store.readingBooks = payload.readingBooks;
  }
  if (Array.isArray(payload.rubikCubes)) {
    store.rubikCubes = payload.rubikCubes;
  }
  if (Array.isArray(payload.knittingProjects)) {
    store.knittingProjects = payload.knittingProjects;
  }
  if (Array.isArray(payload.trialCheckpoints)) {
    store.trialCheckpoints = payload.trialCheckpoints;
  }
  if (Array.isArray(payload.workProjects)) {
    store.workProjects = payload.workProjects;
  }
  if (Array.isArray(payload.spacedCards)) {
    store.spacedCards = payload.spacedCards;
  }
  if (Array.isArray(payload.unlockedPerks)) {
    store.unlockedPerks = payload.unlockedPerks;
  }
  if (Array.isArray(payload.bosses)) {
    store.bosses = payload.bosses;
  }
  if (payload.dailySchedule && typeof payload.dailySchedule === "object") {
    store.dailySchedule = { ...store.dailySchedule, ...payload.dailySchedule };
  }
  if (Array.isArray(payload.wishlist)) {
    store.wishlist = payload.wishlist;
  }

  // 2. Restauración fiel de variables financieras y RPG
  if (typeof payload.monthly_income_cop === "number" && Number.isFinite(payload.monthly_income_cop)) {
    store.monthly_income_cop = payload.monthly_income_cop;
  }
  if (typeof payload.fixed_costs_budget_cop === "number" && Number.isFinite(payload.fixed_costs_budget_cop)) {
    store.fixed_costs_budget_cop = payload.fixed_costs_budget_cop;
  }
  if (typeof payload.fixed_costs_spent_cop === "number" && Number.isFinite(payload.fixed_costs_spent_cop)) {
    store.fixed_costs_spent_cop = payload.fixed_costs_spent_cop;
  }
  if (typeof payload.variable_ops_budget_cop === "number" && Number.isFinite(payload.variable_ops_budget_cop)) {
    store.variable_ops_budget_cop = payload.variable_ops_budget_cop;
  }
  if (typeof payload.variable_ops_spent_cop === "number" && Number.isFinite(payload.variable_ops_spent_cop)) {
    store.variable_ops_spent_cop = payload.variable_ops_spent_cop;
  }
  if (typeof payload.vault_cap_gp === "number" && Number.isFinite(payload.vault_cap_gp)) {
    store.vault_cap_gp = payload.vault_cap_gp;
  }
  if (typeof payload.vault_remaining_gp === "number" && Number.isFinite(payload.vault_remaining_gp)) {
    store.vault_remaining_gp = payload.vault_remaining_gp;
  }
  if (typeof payload.wallet_gp === "number" && Number.isFinite(payload.wallet_gp)) {
    store.wallet_gp = payload.wallet_gp;
  }
  if (typeof payload.total_penalty_gp === "number" && Number.isFinite(payload.total_penalty_gp)) {
    store.total_penalty_gp = payload.total_penalty_gp;
  }
  if (typeof payload.player_level === "number" && Number.isFinite(payload.player_level)) {
    store.player_level = payload.player_level;
  }
  if (typeof payload.current_xp === "number" && Number.isFinite(payload.current_xp)) {
    store.current_xp = payload.current_xp;
  }
  if (typeof payload.current_streak_days === "number" && Number.isFinite(payload.current_streak_days)) {
    store.current_streak_days = payload.current_streak_days;
  }
  if (typeof payload.streak_multiplier === "number" && Number.isFinite(payload.streak_multiplier)) {
    store.streak_multiplier = payload.streak_multiplier;
  }
  if (typeof payload.aegis_shields === "number" && Number.isFinite(payload.aegis_shields)) {
    store.aegis_shields = payload.aegis_shields;
  }
  if (typeof payload.billing_period === "string" && payload.billing_period.trim()) {
    store.billing_period = payload.billing_period;
  }
}

export function hydrateStoreFromLocalDisk(
  userId: string,
  store: RPGEngineMemoryStore
): boolean {
  try {
    const file = safeFilePath(userId);
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PersistedCollectionsPayload>;
    applyPersistedCollectionsToStore(store, parsed);
    return true;
  } catch {
    return false;
  }
}

export async function persistUserCollectionsState(params: {
  userId: string;
  store: RPGEngineMemoryStore;
  db?: SupabaseClient | null;
}): Promise<{ success: boolean; diskSaved: boolean; dbSaved: boolean; error?: string }> {
  const { userId, store, db } = params;
  const payload = serializeStoreCollections(store);
  let diskSaved = false;
  let dbSaved = false;
  let lastError: string | undefined;

  // 1. Persistencia atómica en disco local (.data/user-stores/{userId}.json)
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const targetFile = safeFilePath(userId);
    const tmpFile = `${targetFile}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), "utf-8");
    fs.renameSync(tmpFile, targetFile);
    diskSaved = true;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    // En entornos serverless read-only (ej. Vercel Lambda), continúa hacia Supabase
  }

  // 2. Persistencia en Supabase (profiles.collections_state JSONB)
  const client = supabaseAdmin || db;
  if (isSupabaseConfigured && client) {
    try {
      const { error: updateError } = await client
        .from("profiles")
        .update({
          collections_state: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        lastError = updateError.message;
      } else {
        dbSaved = true;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  const overallSuccess = diskSaved || dbSaved;
  return {
    success: overallSuccess,
    diskSaved,
    dbSaved,
    error: overallSuccess ? undefined : lastError,
  };
}
