import { isOfflineOwner } from "../offline-owner.ts";
import { hydrateUniversalSession, type UniversalSessionRecord } from "./universal-session-engine.ts";

export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
}

export function sessionStorageKeys(owner?: string): Readonly<{ active: string; history: string }> | null {
  if (!isOfflineOwner(owner)) return null;
  const suffix = encodeURIComponent(owner);
  return { active: `rpg_universal_session_v5_${suffix}`, history: `rpg_universal_sessions_history_v5_${suffix}` };
}

export function loadOwnedSession(storage: SessionStorage, owner?: string, now = Date.now()): UniversalSessionRecord | null {
  const keys = sessionStorageKeys(owner);
  if (!keys) return null;
  try { return hydrateUniversalSession(storage.getItem(keys.active), owner, now); }
  catch { return null; }
}

export function saveOwnedSession(storage: SessionStorage, owner: string | undefined, session: UniversalSessionRecord | null): boolean {
  const keys = sessionStorageKeys(owner);
  if (!keys || (session && session.userId !== owner)) return false;
  try { return storage.setItem(keys.active, JSON.stringify(session)) !== false; }
  catch { return false; }
}

function historyRecord(value: unknown, owner: string): value is UniversalSessionRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as UniversalSessionRecord;
  return item.userId === owner && typeof item.sessionId === "string" && typeof item.idempotencyKey === "string" &&
    typeof item.domain === "string" && typeof item.startedAt === "string" && item.status === "completed";
}

export function loadOwnedHistory(storage: SessionStorage, owner?: string): UniversalSessionRecord[] {
  const keys = sessionStorageKeys(owner);
  if (!keys || !owner) return [];
  try {
    const value: unknown = JSON.parse(storage.getItem(keys.history) ?? "[]");
    return Array.isArray(value) ? value.filter(item => historyRecord(item, owner)) : [];
  } catch { return []; }
}

export function appendOwnedHistory(storage: SessionStorage, owner: string | undefined, session: UniversalSessionRecord): boolean {
  const keys = sessionStorageKeys(owner);
  if (!keys || !owner || !historyRecord(session, owner)) return false;
  try {
    const rows: unknown = JSON.parse(storage.getItem(keys.history) ?? "[]");
    if (!Array.isArray(rows)) return false; // Keep corrupt data intact for recovery.
    // Preserve unknown rows; only deduplicate the confirmed session of this owner.
    const next = [session, ...rows.filter(row => !historyRecord(row, owner) || row.sessionId !== session.sessionId)];
    return storage.setItem(keys.history, JSON.stringify(next)) !== false;
  } catch { return false; }
}
