import type { RPGEngineMemoryStore } from "./demo-store.ts";
import type { SkillSessionRecord } from "../types/rpg.ts";
import { isOfflineOwner } from "./offline-owner.ts";
import { isLiveTimerDomain } from "./sanctuary/live-timer.ts";

type Receipt = ReturnType<RPGEngineMemoryStore["logSkillSession"]>;
export interface PersistedSkillSessionState {
  version: 1;
  ownerId: string;
  sessions: SkillSessionRecord[];
  receipts: [string, Receipt][];
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

function session(value: unknown): value is SkillSessionRecord {
  return object(value) && typeof value.id === "string" && !!value.id && isLiveTimerDomain(value.domain) &&
    typeof value.title === "string" && typeof value.details === "string" &&
    finite(value.duration_minutes) && finite(value.gp_earned) && finite(value.xp_earned) &&
    typeof value.timestamp === "string" && Number.isFinite(Date.parse(value.timestamp));
}
function receipt(value: unknown, sessions: Map<string, SkillSessionRecord>): value is [string, Receipt] {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string" ||
    !value[0].startsWith("skill_session:") || value[0].length <= "skill_session:".length || !object(value[1])) return false;
  const result = value[1];
  if (!session(result.session) || !object(result.reward_impact)) return false;
  const saved = sessions.get(result.session.id);
  const reward = result.reward_impact;
  return !!saved && saved.domain === result.session.domain && saved.gp_earned === result.session.gp_earned &&
    saved.xp_earned === result.session.xp_earned && finite(reward.transferred_gp) &&
    reward.transferred_gp === saved.gp_earned && finite(reward.streak_multiplier_applied) &&
    finite(reward.streak_days) && finite(reward.amortized_overdrawn_gp) && reward.idempotent_replay === true &&
    ["shield_earned", "vault_capped", "leveled_up", "curse_lifted"].every(key => typeof reward[key] === "boolean");
}

/** This is a recovered application cache, never authorization or a database transaction receipt. */
export function serializeSkillSessionState(store: RPGEngineMemoryStore, ownerId?: string): PersistedSkillSessionState | undefined {
  if (!isOfflineOwner(ownerId)) return undefined;
  const sessions = store.skillSessions.filter(session);
  const byId = new Map(sessions.map(item => [item.id, item]));
  const receipts = [...store.processedIdempotencyKeys.entries()].filter(entry => receipt(entry, byId)) as [string, Receipt][];
  // Detach all mutable references and retain zero-GP capped outcomes exactly.
  return JSON.parse(JSON.stringify({ version: 1, ownerId, sessions, receipts }));
}

export function applySkillSessionState(store: RPGEngineMemoryStore, value: unknown, expectedOwnerId?: string): boolean {
  if (!isOfflineOwner(expectedOwnerId) || !object(value) || value.version !== 1 || value.ownerId !== expectedOwnerId ||
    !Array.isArray(value.sessions) || !value.sessions.every(session) || !Array.isArray(value.receipts)) return false;
  const byId = new Map(value.sessions.map(item => [item.id, item]));
  if (byId.size !== value.sessions.length || !value.receipts.every(entry => receipt(entry, byId))) return false;
  const keys = value.receipts.map(entry => entry[0]);
  if (new Set(keys).size !== keys.length) return false;
  const restored = JSON.parse(JSON.stringify(value)) as PersistedSkillSessionState;
  store.skillSessions = restored.sessions;
  for (const [key, result] of restored.receipts) store.processedIdempotencyKeys.set(key, result);
  return true;
}
