import { test } from "node:test";
import assert from "node:assert/strict";
import { safeLocalStorage, safeStorageGetJson } from "../src/lib/storage-safe.ts";
import { queueOfflineAction, getOfflineQueue, processOfflineQueue } from "../src/lib/offline-sync.ts";

test("Safari iOS 1: safeLocalStorage opera de forma transparente en memoria si window no existe", () => {
  safeLocalStorage.setItem("test_key", "test_val");
  assert.equal(safeLocalStorage.getItem("test_key"), "test_val");
  safeLocalStorage.removeItem("test_key");
  assert.equal(safeLocalStorage.getItem("test_key"), null);
});

test("Safari iOS 2: safeLocalStorage maneja SecurityError (Safari iOS Navegación Privada) sin colapso", () => {
  // Configurar mock global de window y localStorage que simule SecurityError de Safari iOS
  const originalWindow = globalThis.window;
  (globalThis as any).window = {
    localStorage: {
      getItem: () => {
        const err = new Error("The operation is insecure.");
        err.name = "SecurityError";
        throw err;
      },
      setItem: () => {
        const err = new Error("The operation is insecure.");
        err.name = "SecurityError";
        throw err;
      },
      removeItem: () => {
        const err = new Error("The operation is insecure.");
        err.name = "SecurityError";
        throw err;
      },
      clear: () => {
        const err = new Error("The operation is insecure.");
        err.name = "SecurityError";
        throw err;
      },
    },
  };

  assert.doesNotThrow(() => {
    safeLocalStorage.setItem("safari_private_pref", "autumn");
  }, "No debe lanzar excepción al escribir en Safari Privado");

  const val = safeLocalStorage.getItem("safari_private_pref");
  assert.equal(val, "autumn", "Debe leer el valor almacenado en el buffer de memoria volátil");

  safeLocalStorage.removeItem("safari_private_pref");
  assert.equal(safeLocalStorage.getItem("safari_private_pref"), null, "Debe removerlo correctamente");

  (globalThis as any).window = originalWindow;
});

test("Safari iOS 3: safeLocalStorage maneja QuotaExceededError en Safari iOS sin colapsar", () => {
  const originalWindow = globalThis.window;
  (globalThis as any).window = {
    localStorage: {
      getItem: () => null,
      setItem: () => {
        const err = new Error("Quota exceeded.");
        err.name = "QuotaExceededError";
        throw err;
      },
      removeItem: () => {},
      clear: () => {},
    },
  };

  assert.doesNotThrow(() => {
    const res = safeLocalStorage.setItem("heavy_key", "data");
    assert.equal(res, false, "Debe retornar false al fallar localStorage nativo");
  });

  assert.equal(safeLocalStorage.getItem("heavy_key"), "data", "Debe permanecer disponible en fallback volátil");

  (globalThis as any).window = originalWindow;
});

test("Safari iOS 4: safeStorageGetJson recupera objetos estructurados y tolera fallos de formato", () => {
  safeLocalStorage.setItem("valid_json", JSON.stringify({ theme: "rain", vol: 40 }));
  const parsed = safeStorageGetJson("valid_json", { theme: "sunny", vol: 20 });
  assert.deepEqual(parsed, { theme: "rain", vol: 40 });

  safeLocalStorage.setItem("corrupted_json", "NOT_A_VALID_JSON{{{");
  const fallback = safeStorageGetJson("corrupted_json", { theme: "sunny", vol: 20 });
  assert.deepEqual(fallback, { theme: "sunny", vol: 20 });
});

test("Safari iOS 5: queueOfflineAction y getOfflineQueue operan resilientemente", () => {
  queueOfflineAction({
    url: "/api/shortcuts/skill-session",
    method: "POST",
    body: { action: "quick_test" },
    description: "Prueba resiliente Safari iOS",
  });

  const queue = getOfflineQueue();
  assert.equal(Array.isArray(queue), true, "getOfflineQueue debe retornar un array");
  assert.ok(queue.length >= 1, "Debe contener al menos una acción");
  assert.equal(queue[queue.length - 1].description, "Prueba resiliente Safari iOS");
});
