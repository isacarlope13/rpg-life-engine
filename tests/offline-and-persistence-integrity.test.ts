import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  queueOfflineAction,
  getOfflineQueue,
  processOfflineQueue,
  getOfflineQueueKey,
} from "../src/lib/offline-sync.ts";
import { safeLocalStorage } from "../src/lib/storage-safe.ts";
import {
  applyPersistedCollectionsToStore,
  serializeStoreCollections,
  persistUserCollectionsState,
} from "../src/lib/persistence-sync.ts";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";

test("Integridad P0.1: La sincronización offline conserva acciones si el servidor responde 503 o offline:true", async () => {
  const testUserId = "usr_test_offline_resilience";
  const queueKey = getOfflineQueueKey(testUserId);
  safeLocalStorage.removeItem(queueKey);

  queueOfflineAction(
    {
      url: "https://mock.local/api/shortcuts/habit-log",
      method: "POST",
      body: { quest_code: "READING_15", requested_gp: 3000 },
      description: "Lectura offline simulada",
    },
    testUserId
  );

  const initialQueue = getOfflineQueue(testUserId);
  assert.equal(initialQueue.length, 1, "La acción debe estar encolada");
  assert.ok(initialQueue[0].idempotency_key, "Debe tener clave de idempotencia asignada");

  // Simular fetch global que devuelve 503 (como el Service Worker al fallar la red)
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ offline: true, message: "Sin conexión" }), {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const synced = await processOfflineQueue(testUserId);
    assert.equal(synced, 0, "No debe registrar falsos éxitos cuando el servidor o SW retorna 503");

    const remainingQueue = getOfflineQueue(testUserId);
    assert.equal(remainingQueue.length, 1, "La acción debe conservarse intacta en la cola");
    assert.equal(remainingQueue[0].description, "Lectura offline simulada");
  } finally {
    globalThis.fetch = originalFetch;
    safeLocalStorage.removeItem(queueKey);
  }
});

test("Integridad P0.2: Aislamiento estricto multi-tenant de colas offline", async () => {
  const userA = "usr_alice_offline";
  const userB = "usr_bob_offline";

  safeLocalStorage.removeItem(getOfflineQueueKey(userA));
  safeLocalStorage.removeItem(getOfflineQueueKey(userB));

  queueOfflineAction(
    {
      url: "https://mock.local/api/shortcuts/habit-log",
      method: "POST",
      body: { quest_code: "HABIT_A" },
      description: "Acción de Alice",
    },
    userA
  );

  const queueA = getOfflineQueue(userA);
  const queueB = getOfflineQueue(userB);

  assert.equal(queueA.length, 1, "Alice debe tener su acción");
  assert.equal(queueA[0].description, "Acción de Alice");
  assert.equal(queueB.length, 0, "Bob NO debe ver ni procesar las acciones de Alice");

  safeLocalStorage.removeItem(getOfflineQueueKey(userA));
  safeLocalStorage.removeItem(getOfflineQueueKey(userB));
});

test("Integridad P1.1: applyPersistedCollectionsToStore restaura fielmente colecciones vacías, bosses y finanzas", () => {
  const store = new RPGEngineMemoryStore();

  // El store inicial tiene libros y cubos predeterminados
  assert.ok(store.readingBooks.length > 0, "Inicialmente tiene libros");

  // Aplicar un snapshot donde el usuario explícitamente vació sus libros, agregó un boss y cambió finanzas
  applyPersistedCollectionsToStore(store, {
    readingBooks: [], // Debe vaciarse fielmente, no ignorarse por length === 0
    bosses: [
      {
        id: "boss_custom_card",
        name: "Tarjeta de Crédito Secreta",
        max_hp: 2000000,
        current_hp: 1500000,
        interest_rate_ea: 0.35,
        min_monthly_payment_cop: 100000,
        paid_this_month_cop: 0,
        priority_order: 1,
        status: "active",
        daily_interest_dot_gp: 50,
      },
    ],
    monthly_income_cop: 7500000,
    wallet_gp: 8888,
    vault_remaining_gp: 33333,
    current_streak_days: 14,
    streak_multiplier: 1.5,
  });

  assert.equal(store.readingBooks.length, 0, "La colección vacía [] debe restaurarse fielmente");
  assert.equal(store.bosses.length, 1, "Los bosses deben restaurarse en el store");
  assert.equal(store.bosses[0].name, "Tarjeta de Crédito Secreta");
  assert.equal(store.monthly_income_cop, 7500000, "Los ingresos deben restaurarse fielmente");
  assert.equal(store.wallet_gp, 8888, "Billetera GP restaurada fielmente");
  assert.equal(store.vault_remaining_gp, 33333, "Bóveda GP restaurada fielmente");
  assert.equal(store.current_streak_days, 14, "Racha de días restaurada fielmente");
  assert.equal(store.streak_multiplier, 1.5, "Multiplicador restaurado fielmente");
});

test("Integridad P1.2: persistUserCollectionsState realiza escritura atómica y reporta estado explícito", async () => {
  const testUser = "usr_atomic_disk_test";
  const store = new RPGEngineMemoryStore();
  store.wallet_gp = 99999;

  const result = await persistUserCollectionsState({
    userId: testUser,
    store,
    db: null,
  });

  assert.equal(result.success, true, "La persistencia atómica debe ser exitosa");
  assert.equal(result.diskSaved, true, "Debe haber guardado en disco");

  const dataDir = path.join(process.cwd(), ".data", "user-stores");
  const filePath = path.join(dataDir, `${testUser}.json`);
  assert.ok(fs.existsSync(filePath), "El archivo JSON final debe existir");

  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  assert.equal(parsed.wallet_gp, 99999, "Los datos guardados atómicamente deben coincidir");

  // Limpiar archivo de prueba
  try {
    fs.unlinkSync(filePath);
  } catch {}
});
