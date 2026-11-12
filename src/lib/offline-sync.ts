// Utilidad de sincronización offline, registro de Service Worker y respuesta háptica PWA

import { safeLocalStorage } from "./storage-safe.ts";

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

export function getOfflineQueueKey(userId?: string): string {
  if (!userId || userId === "anonymous") return OFFLINE_QUEUE_KEY;
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${OFFLINE_QUEUE_KEY}_${cleanId}`;
}

export function queueOfflineAction(
  action: Omit<OfflineAction, "id" | "timestamp">,
  userId?: string
): void {
  try {
    const ownerId = userId || (action as { userId?: string }).userId;
    const key = getOfflineQueueKey(ownerId);
    const raw = safeLocalStorage.getItem(key);
    const queue: OfflineAction[] = raw ? JSON.parse(raw) : [];

    const actionId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `offline-${Date.now()}`;

    // Garantizar que cada acción tenga una clave de idempotencia persistente durante reintentos
    const bodyPayload = { ...(action.body || {}) };
    const stableIdempotencyKey =
      (bodyPayload.idempotency_key as string) ||
      (action as { idempotency_key?: string }).idempotency_key ||
      `offline-idem-${actionId}`;
    bodyPayload.idempotency_key = stableIdempotencyKey;

    const item: OfflineAction = {
      ...action,
      body: bodyPayload,
      id: actionId,
      userId: ownerId,
      idempotency_key: stableIdempotencyKey,
      timestamp: new Date().toISOString(),
    };

    queue.push(item);
    safeLocalStorage.setItem(key, JSON.stringify(queue));

    // Si se especificó ownerId, mantener sincronizado el índice global para retrocompatibilidad
    if (ownerId) {
      try {
        const globalRaw = safeLocalStorage.getItem(OFFLINE_QUEUE_KEY);
        const globalQueue: OfflineAction[] = globalRaw ? JSON.parse(globalRaw) : [];
        globalQueue.push(item);
        safeLocalStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(globalQueue));
      } catch {}
    }

    triggerHaptic("warning");
  } catch (e) {
    console.error("Error guardando acción offline:", e);
  }
}

export function getOfflineQueue(userId?: string): OfflineAction[] {
  try {
    const key = getOfflineQueueKey(userId);
    const raw = safeLocalStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function processOfflineQueue(
  userIdOrOnSynced?: string | ((count: number) => void),
  maybeOnSynced?: (count: number) => void
): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;

  const userId = typeof userIdOrOnSynced === "string" ? userIdOrOnSynced : undefined;
  const onSynced = typeof userIdOrOnSynced === "function" ? userIdOrOnSynced : maybeOnSynced;

  const key = getOfflineQueueKey(userId);
  const queue = getOfflineQueue(userId);
  if (queue.length === 0) return 0;

  let successful = 0;
  const remaining: OfflineAction[] = [];

  for (const act of queue) {
    // Si la acción pertenecía a un usuario diferente, conservarla sin procesar bajo la sesión equivocada
    if (userId && act.userId && act.userId !== userId) {
      remaining.push(act);
      continue;
    }

    try {
      const res = await fetch(act.url, {
        method: act.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(act.body),
      });

      // Si el Service Worker devuelve 503 o un falso 200 con { offline: true }, NO descartar la acción
      if (res.ok && res.status !== 503) {
        let isFakeOfflineResponse = false;
        try {
          const clone = res.clone();
          const data = await clone.json().catch(() => null);
          if (data && data.offline === true) {
            isFakeOfflineResponse = true;
          }
        } catch {}

        if (isFakeOfflineResponse) {
          remaining.push(act);
        } else {
          successful++;
        }
      } else {
        remaining.push(act);
      }
    } catch {
      remaining.push(act);
    }
  }

  try {
    safeLocalStorage.setItem(key, JSON.stringify(remaining));
    if (userId) {
      // Sincronizar también la cola legacy global
      const globalQueue = getOfflineQueue().filter(
        (a) => a.userId !== userId || remaining.some((r) => r.id === a.id)
      );
      safeLocalStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(globalQueue));
    }
  } catch (e) {
    console.warn("Error actualizando cola offline:", e);
  }

  if (successful > 0) {
    triggerHaptic("success");
    if (onSynced) onSynced(successful);
  }
  return successful;
}
