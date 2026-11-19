// Utilidad de sincronización offline, registro de Service Worker y respuesta háptica PWA

import { safeLocalStorage } from "./storage-safe.ts";
import { isOfflineOwner, OFFLINE_OWNER_HEADER } from "./offline-owner.ts";
import { shortcutAcknowledgement } from "./shortcut-acknowledgement.ts";

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error";

export function triggerHaptic(type: HapticType = "light"): void {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  try {
    switch (type) {
      case "light":
        navigator.vibrate(15);
        break;
      case "medium":
        navigator.vibrate(30);
        break;
      case "heavy":
        navigator.vibrate(60);
        break;
      case "success":
        navigator.vibrate([20, 40, 20]);
        break;
      case "warning":
        navigator.vibrate([40, 60, 40]);
        break;
      case "error":
        navigator.vibrate([60, 40, 60, 40, 80]);
        break;
    }
  } catch {
    // Si el navegador bloquea vibraciones por permisos, ignorar silenciosamente
  }
}

export function registerServiceWorker(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // SW registrado exitosamente
        if (process.env.NODE_ENV === "development") {
          console.log("PWA Service Worker listo con scope:", reg.scope);
        }
      })
      .catch((err) => {
        console.warn("Fallo al registrar Service Worker:", err);
      });
  });
}

export interface OfflineAction {
  id: string;
  url: string;
  method: string;
  body: Record<string, unknown>;
  timestamp: string;
  description: string;
  userId?: string;
  idempotency_key?: string;
}

const OFFLINE_QUEUE_KEY = "rpg_offline_queue_v1";


/** Legacy data is retained, never adopted by the current login. */
export function getOfflineQueueKey(userId?: string): string {
  if (!isOfflineOwner(userId)) return OFFLINE_QUEUE_KEY;
  return OFFLINE_QUEUE_KEY + "_" + encodeURIComponent(userId);
}

function readQueue(userId: string): OfflineAction[] | null {
  try {
    const raw = safeLocalStorage.getItem(getOfflineQueueKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as OfflineAction[] : null;
  } catch { return null; }
}

function ownedAction(value: unknown, owner: string): value is OfflineAction {
  if (!value || typeof value !== "object") return false;
  const item = value as OfflineAction;
  return item.userId === owner && typeof item.id === "string" &&
    typeof item.url === "string" && typeof item.method === "string" &&
    !!item.body && typeof item.body === "object" && !Array.isArray(item.body) &&
    typeof item.idempotency_key === "string" && item.idempotency_key.length > 0 &&
    item.body.idempotency_key === item.idempotency_key;
}

export function queueOfflineAction(action: Omit<OfflineAction, "id" | "timestamp">, userId?: string): boolean {
  const owner = userId ?? action.userId;
  if (!isOfflineOwner(owner) || (action.userId !== undefined && action.userId !== owner)) return false;
  try {
    const queue = readQueue(owner);
    if (!queue) return false; // Preserve corrupt storage for recovery.
    const id = crypto.randomUUID();
    const idempotencyKey = action.body.idempotency_key || action.idempotency_key || "offline-idem-" + id;
    if (typeof idempotencyKey !== "string") return false;
    const item: OfflineAction = { ...action, id, userId: owner,
      idempotency_key: idempotencyKey,
      body: { ...action.body, idempotency_key: idempotencyKey }, timestamp: new Date().toISOString() };
    safeLocalStorage.setItem(getOfflineQueueKey(owner), JSON.stringify([...queue, item]));
    triggerHaptic("warning");
    return true; // May be volatile when native storage is unavailable (existing safe storage policy).
  } catch { return false; }
}

export function getOfflineQueue(userId?: string): OfflineAction[] {
  return isOfflineOwner(userId) ? (readQueue(userId) ?? []).filter(item => ownedAction(item, userId)) : [];
}

const syncing = new Map<string, Promise<number>>();
export function processOfflineQueue(
  userIdOrOnSynced?: string | ((count: number) => void),
  onSynced?: (count: number) => void,
): Promise<number> {
  if (!isOfflineOwner(userIdOrOnSynced) || typeof window === "undefined" || !navigator.onLine) return Promise.resolve(0);
  const owner = userIdOrOnSynced;
  const existing = syncing.get(owner);
  if (existing) return existing;
  const task = replay(owner, onSynced).finally(() => { syncing.delete(owner); });
  syncing.set(owner, task);
  return task;
}

async function replay(owner: string, onSynced?: (count: number) => void): Promise<number> {
  const acknowledged = new Set<string>();
  for (const item of getOfflineQueue(owner)) {
    // Restrict replay to same-origin endpoints that enforce the authenticated owner header.
    if (!["/api/shortcuts/skill-session", "/api/shortcuts/habit-log", "/api/shortcuts/quick-expense"].includes(item.url) || item.method !== "POST") continue;
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: { "Content-Type": "application/json", [OFFLINE_OWNER_HEADER]: owner },
        body: JSON.stringify(item.body),
      });
      if (res.status === 401 || res.status === 409) break;
      if (!res.ok) continue;
      const data = await res.clone().json().catch(() => null);
      if (!shortcutAcknowledgement(item.url, data)) continue;
      acknowledged.add(item.id);
    } catch { /* Keep the exact action and idempotency key for retry. */ }
  }
  if (acknowledged.size) {
    // Read again: preserve commands appended while a request was in flight and unknown legacy rows.
    const latest = readQueue(owner);
    if (!latest) return 0;
    safeLocalStorage.setItem(getOfflineQueueKey(owner), JSON.stringify(latest.filter(item =>
      !ownedAction(item, owner) || !acknowledged.has(item.id))));
    triggerHaptic("success");
    onSynced?.(acknowledged.size);
  }
  return acknowledged.size;
}
