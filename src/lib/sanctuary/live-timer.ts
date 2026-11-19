import type { SkillDomain } from "../../types/rpg.ts";
import { isOfflineOwner } from "../offline-owner.ts";
import type { SessionStorage } from "./session-storage.ts";

export interface OwnedLiveTimer {
  readonly operationId?: string;
  readonly ownerId: string;
  readonly domain: SkillDomain | null;
  readonly seconds: number;
  readonly paused: boolean;
  readonly lastTimestamp: number;
}

const domains: Record<SkillDomain, true> = {
  rubik: true, reading: true, knitting: true, study: true, work: true, gaming: true,
  sports: true, journaling: true, gardening: true, drawing: true, ceramics: true,
  hiking: true, cooking: true, general: true,
};
export function isLiveTimerDomain(value: unknown): value is SkillDomain {
  return typeof value === "string" && Object.hasOwn(domains, value);
}
export function liveTimerKey(owner?: string): string | null {
  return isOfflineOwner(owner) ? `rpg_live_timer_state_v2_${encodeURIComponent(owner)}` : null;
}

export function advanceLiveTimer(timer: OwnedLiveTimer, now: number): OwnedLiveTimer {
  const delta = timer.domain && !timer.paused ? Math.max(0, Math.floor((now - timer.lastTimestamp) / 1000)) : 0;
  return { ...timer, seconds: timer.seconds + delta, lastTimestamp: now };
}

export function loadLiveTimer(storage: SessionStorage, owner?: string, now = Date.now()): OwnedLiveTimer | null {
  const key = liveTimerKey(owner);
  if (!key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const timer = value as OwnedLiveTimer;
    if (timer.ownerId !== owner || (timer.domain !== null && !isLiveTimerDomain(timer.domain)) ||
      typeof timer.paused !== "boolean" || !Number.isSafeInteger(timer.seconds) || timer.seconds < 0 ||
      !Number.isFinite(timer.lastTimestamp) || timer.lastTimestamp < 0) return null;
    return advanceLiveTimer({ ...timer, operationId: typeof timer.operationId === "string" && timer.operationId ? timer.operationId : `live-${crypto.randomUUID()}` }, now);
  } catch { return null; }
}

export function saveLiveTimer(storage: SessionStorage, owner: string | undefined, timer: OwnedLiveTimer): boolean {
  const key = liveTimerKey(owner);
  if (!key || timer.ownerId !== owner) return false;
  try { return storage.setItem(key, JSON.stringify(timer)) !== false; }
  catch { return false; }
}
