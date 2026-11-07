import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RPGEngineMemoryStore } from "./demo-store";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";

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
  };
}

export function applyPersistedCollectionsToStore(
  store: RPGEngineMemoryStore,
  payload: Partial<PersistedCollectionsPayload> | null | undefined
): void {
  if (!payload || typeof payload !== "object") return;
  if (
    Array.isArray(payload.readingBooks) &&
    payload.readingBooks.length > 0
  ) {
    store.readingBooks = payload.readingBooks;
  }
  if (Array.isArray(payload.rubikCubes) && payload.rubikCubes.length > 0) {
    store.rubikCubes = payload.rubikCubes;
  }
  if (
    Array.isArray(payload.knittingProjects) &&
    payload.knittingProjects.length > 0
  ) {
    store.knittingProjects = payload.knittingProjects;
  }
  if (
    Array.isArray(payload.trialCheckpoints) &&
    payload.trialCheckpoints.length > 0
  ) {
    store.trialCheckpoints = payload.trialCheckpoints;
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
    if (typeof parsed.wallet_gp === "number") {
      store.wallet_gp = parsed.wallet_gp;
    }
    if (typeof parsed.vault_remaining_gp === "number") {
      store.vault_remaining_gp = parsed.vault_remaining_gp;
    }
    if (typeof parsed.current_xp === "number") {
      store.current_xp = parsed.current_xp;
    }
    if (typeof parsed.player_level === "number") {
      store.player_level = parsed.player_level;
    }
    if (typeof parsed.current_streak_days === "number") {
      store.current_streak_days = parsed.current_streak_days;
    }
    return true;
  } catch {
    return false;
  }
}

export async function persistUserCollectionsState(params: {
  userId: string;
  store: RPGEngineMemoryStore;
  db?: SupabaseClient | null;
}): Promise<void> {
  const { userId, store, db } = params;
  const payload = serializeStoreCollections(store);

  // 1. Persistencia instantánea en disco local (.data/user-stores/{userId}.json)
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      safeFilePath(userId),
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
  } catch {
    // En entornos serverless read-only (ej. Vercel Lambda), continúa hacia Supabase
  }

  // 2. Persistencia en Supabase (profiles.collections_state JSONB)
  const client = supabaseAdmin || db;
  if (isSupabaseConfigured && client) {
    try {
      await client
        .from("profiles")
        .update({
          collections_state: payload,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch {
      // Si la columna collections_state aún no fue migrada, no interrumpe la petición
    }
  }
}
