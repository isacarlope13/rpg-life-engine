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
}

const OFFLINE_QUEUE_KEY = "rpg_offline_queue_v1";

export function queueOfflineAction(action: Omit<OfflineAction, "id" | "timestamp">): void {
  try {
    const raw = safeLocalStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAction[] = raw ? JSON.parse(raw) : [];
    const item: OfflineAction = {
      ...action,
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `offline-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    queue.push(item);
    safeLocalStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    triggerHaptic("warning");
  } catch (e) {
    console.error("Error guardando acción offline:", e);
  }
}

export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = safeLocalStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function processOfflineQueue(
  onSynced?: (count: number) => void
): Promise<number> {
  if (typeof window === "undefined" || !navigator.onLine) return 0;
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let successful = 0;
  const remaining: OfflineAction[] = [];

  for (const act of queue) {
    try {
      const res = await fetch(act.url, {
        method: act.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(act.body),
      });
      if (res.ok) {
        successful++;
      } else {
        remaining.push(act);
      }
    } catch {
      remaining.push(act);
    }
  }

  try {
    safeLocalStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    console.warn("Error actualizando cola offline:", e);
  }

  if (successful > 0) {
    triggerHaptic("success");
    if (onSynced) onSynced(successful);
  }
  return successful;
}
