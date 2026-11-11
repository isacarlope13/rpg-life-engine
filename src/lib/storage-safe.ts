/**
 * RPG Life-Engine — Safe Storage Utility
 * Protege contra SecurityError, QuotaExceededError y restricciones estrictas de WebKit / Safari iOS
 * (Navegación privada, bloqueo de cookies de terceros, WebViews embebidas).
 * Provee memoria volátil de respaldo transparente para evitar caídas de hidratación y render.
 */

const memoryFallback = new Map<string, string>();

function isStorageAvailable(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    const testKey = "__rpg_storage_probe__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (typeof window !== "undefined") {
      try {
        if (isStorageAvailable()) {
          const val = window.localStorage.getItem(key);
          if (val !== null) return val;
        }
      } catch (e) {
        // Safari iOS Private Browsing / SecurityError: fallback a memoria
        if (process.env.NODE_ENV === "development") {
          console.warn(`[safeLocalStorage] Error leyendo "${key}", usando fallback:`, e);
        }
      }
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem(key: string, value: string): boolean {
    memoryFallback.set(key, value);
    if (typeof window !== "undefined") {
      try {
        if (isStorageAvailable()) {
          window.localStorage.setItem(key, value);
          return true;
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`[safeLocalStorage] Error escribiendo "${key}", guardado en memoria:`, e);
        }
      }
      return false;
    }
    return true;
  },

  removeItem(key: string): void {
    memoryFallback.delete(key);
    if (typeof window !== "undefined") {
      try {
        if (isStorageAvailable()) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Ignorar fallo de borrado en storage restringido
      }
    }
  },

  clear(): void {
    memoryFallback.clear();
    if (typeof window !== "undefined") {
      try {
        if (isStorageAvailable()) {
          window.localStorage.clear();
        }
      } catch {
        // Ignorar
      }
    }
  },
};

/**
 * Función auxiliar para parsear JSON de forma segura desde storage o memoria
 */
export function safeStorageGetJson<T>(key: string, fallback: T): T {
  const raw = safeLocalStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
