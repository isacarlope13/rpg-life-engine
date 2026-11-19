import type { SupabaseClient } from "@supabase/supabase-js";
import type { RPGEngineMemoryStore } from "./demo-store.ts";
import { applySkillSessionState } from "./skill-session-state.ts";

const recovered = new WeakMap<RPGEngineMemoryStore, { ownerId: string; ready: Promise<boolean> }>();

/** Recover only session history/cache, not balances, before the first session command of a process. */
export function recoverSkillSessionStateFromProfile(db: SupabaseClient, ownerId: string, store: RPGEngineMemoryStore): Promise<boolean> {
  const previous = recovered.get(store);
  if (previous) {
    if (previous.ownerId !== ownerId) return Promise.reject(Error("El store no corresponde al propietario de recuperación"));
    return previous.ready;
  }
  const load = async () => {
    const { data, error } = await db.from("profiles").select("id, collections_state").eq("id", ownerId).maybeSingle();
    if (error || !data || data.id !== ownerId) throw Error("No se pudo verificar la recuperación de sesiones");
    const state = data.collections_state?.skillSessionState;
    if (state === undefined || state === null) return false; // Legacy profile: no invented receipts.
    if (!applySkillSessionState(store, state, ownerId)) throw Error("El historial persistido requiere recuperación; no se registró otra actividad");
    return true;
  };
  const ready = load().catch(error => { recovered.delete(store); throw error; });
  recovered.set(store, { ownerId, ready });
  return ready;
}
