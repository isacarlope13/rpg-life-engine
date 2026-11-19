import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  computeBackoffMs,
  enqueueOfflineSyncItem,
  isForbiddenFinancialOrSecretKey,
  reconcileSyncRecords,
  resolveSyncConflict,
  safeParseOfflineQueue,
  type SyncRecordEnvelope,
} from "../src/lib/sync/universal-sync-engine.ts";
import {
  listLocalSyncedRecords,
  upsertLocalSyncedRecord,
} from "../src/lib/sync/local-sync-memory.ts";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import { askMayorRowan } from "../src/lib/ai/mayor-rowan-engine.ts";
import { askBuildingSpecialist } from "../src/lib/ai/specialist-engine.ts";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("OAKHAVEN FASE 8 — Data Continuity & Multi-Device Sync", () => {
  test("1. Primer inicio de sesión, exclusión de demos y preservación ante respuesta remota vacía", () => {
    const localSets: SyncRecordEnvelope[] = [
      {
        clientId: "demo-set-1",
        ownerId: USER_A,
        domain: "gym_sets",
        version: 1,
        updatedAt: "2026-11-19T10:00:00Z",
        isDemo: true,
        dataOrigin: "demo_template",
        payload: { exerciseName: "Sentadilla Goblet", reps: 10, weightKg: 16, completed: false },
      },
      {
        clientId: "gym-real-1",
        ownerId: USER_A,
        domain: "gym_sets",
        version: 1,
        updatedAt: "2026-11-19T11:00:00Z",
        dataOrigin: "real_local",
        payload: { exerciseName: "Press de Banca", reps: 8, weightKg: 24, rpe: 8, completed: true },
      },
    ];

    // Remoto vacío NO sobrescribe datos locales reales; excluye demo-set-1
    const res = reconcileSyncRecords({
      authenticatedUserId: USER_A,
      localOwnerId: USER_A,
      localRecords: localSets,
      remoteRecords: [],
      isOnline: true,
    });
    assert.equal(res.excludedDemoCount, 1);
    assert.equal(res.merged.length, 1);
    assert.equal(res.toPush.length, 1);
    assert.equal(res.toPush[0].clientId, "gym-real-1");
    assert.equal(res.status, "PENDIENTE_DE_SINCRONIZAR");

    // Sin conexión -> SIN_CONEXION preservando todo local
    const offlineRes = reconcileSyncRecords({
      authenticatedUserId: USER_A,
      localOwnerId: USER_A,
      localRecords: localSets,
      remoteRecords: [],
      isOnline: false,
    });
    assert.equal(offlineRes.status, "SIN_CONEXION");
    assert.equal(offlineRes.merged.length, 1);
  });

  test("2. Dos dispositivos simulados, edición concurrente -> conflicto explícito y resolución guiada (keep_local, keep_remote, keep_both)", () => {
    const device1: SyncRecordEnvelope = {
      clientId: "work-proj-1",
      ownerId: USER_A,
      domain: "work_projects",
      version: 2,
      updatedAt: "2026-11-19T12:00:00Z",
      dataOrigin: "real_local",
      payload: { name: "OakHaven Sync v1", status: "active" },
    };
    const device2Remote: SyncRecordEnvelope = {
      clientId: "work-proj-1",
      ownerId: USER_A,
      domain: "work_projects",
      version: 2,
      updatedAt: "2026-11-19T12:05:00Z",
      dataOrigin: "real_synced",
      payload: { name: "OakHaven Sync v2 (otro dispositivo)", status: "active" },
    };

    const rec = reconcileSyncRecords({
      authenticatedUserId: USER_A,
      localOwnerId: USER_A,
      localRecords: [device1],
      remoteRecords: [device2Remote],
      isOnline: true,
    });
    assert.equal(rec.conflicts.length, 1);
    assert.equal(rec.status, "CONFLICTO_REQUIERE_REVISION");

    const keepLocal = resolveSyncConflict(rec.conflicts[0], "keep_local");
    assert.equal(keepLocal.length, 1);
    assert.equal(keepLocal[0].version, 3);
    assert.equal(keepLocal[0].payload.name, "OakHaven Sync v1");

    const keepRemote = resolveSyncConflict(rec.conflicts[0], "keep_remote");
    assert.equal(keepRemote[0].payload.name, "OakHaven Sync v2 (otro dispositivo)");

    const keepBoth = resolveSyncConflict(rec.conflicts[0], "keep_both");
    assert.equal(keepBoth.length, 2);
    assert.notEqual(keepBoth[0].clientId, keepBoth[1].clientId);
  });

  test("3. Cola offline idempotente, backoff exponencial, datos corruptos, aislamiento multiusuario y bloqueo financiero/secretos", () => {
    // Aislamiento estricto entre cuentas en el mismo navegador
    assert.throws(() =>
      reconcileSyncRecords({
        authenticatedUserId: USER_A,
        localOwnerId: USER_B,
        localRecords: [],
        remoteRecords: [],
      })
    );

    // Bloqueo de secretos y documentos financieros sensibles en sincronización automática
    assert.equal(isForbiddenFinancialOrSecretKey("bank_statement_nov.pdf"), true);
    assert.equal(isForbiddenFinancialOrSecretKey("SUPABASE_SERVICE_ROLE_KEY"), true);
    assert.equal(isForbiddenFinancialOrSecretKey("oakhaven_gym_sets_v1"), false);

    // Datos corruptos en localStorage no rompen la app
    assert.deepEqual(safeParseOfflineQueue("{json-corrupto", USER_A), []);

    // Idempotencia de cola offline (evita duplicados por doble envío o reintento)
    const rec: SyncRecordEnvelope = {
      clientId: "gym-set-99",
      ownerId: USER_A,
      domain: "gym_sets",
      version: 1,
      updatedAt: "2026-11-19T12:00:00Z",
      payload: { exerciseName: "Remo", reps: 10, weightKg: 20, completed: true },
    };
    const q1 = enqueueOfflineSyncItem([], { ownerId: USER_A, domain: "gym_sets", record: rec });
    const q2 = enqueueOfflineSyncItem(q1, { ownerId: USER_A, domain: "gym_sets", record: rec });
    assert.equal(q1.length, 1);
    assert.equal(q2.length, 1, "Reenvío idéntico no debe duplicar la cola");

    assert.equal(computeBackoffMs(0), 1000);
    assert.equal(computeBackoffMs(2), 4000);
    assert.equal(computeBackoffMs(10), 30000);

    // Almacén local aislado por usuario y sin duplicar series
    const u1 = upsertLocalSyncedRecord(USER_A, "gym_sets", rec);
    assert.equal(u1.ok, true);
    const u1Retry = upsertLocalSyncedRecord(USER_A, "gym_sets", rec);
    assert.equal(u1Retry.ok, true);
    assert.equal(listLocalSyncedRecords(USER_A, "gym_sets").length, 1);
    assert.equal(listLocalSyncedRecords(USER_B, "gym_sets").length, 0);

    // Prueba CAS atómica: 2 dispositivos intentan actualizar simultáneamente desde v1 -> v2
    const devA = upsertLocalSyncedRecord(USER_A, "gym_sets", {
      ...rec,
      expectedVersion: 1,
      payload: { exerciseName: "Remo", reps: 12, weightKg: 22, completed: true },
    });
    assert.equal(devA.ok, true);
    if (devA.ok) assert.equal(devA.record.version, 2);

    const devBStale = upsertLocalSyncedRecord(USER_A, "gym_sets", {
      ...rec,
      expectedVersion: 1, // versión obsoleta: Dispositivo A ya avanzó a v2
      payload: { exerciseName: "Remo", reps: 8, weightKg: 24, completed: true },
    });
    assert.equal(devBStale.ok, false, "Segundo dispositivo con versión obsoleta debe recibir conflicto CAS");
    if (!devBStale.ok) assert.equal(devBStale.conflict.version, 2);
  });

  test("4. Integridad GP/XP/COP y no regresión de los 9 personajes (8 especialistas + Rowan)", async () => {
    const store = new RPGEngineMemoryStore();
    const gpBefore = store.wallet_gp;
    const xpBefore = store.current_xp;
    const solvesBefore = store.rubikSolves.length;
    const ctx = {
      authenticatedUserId: USER_A,
      db: null,
      store,
      isSupabaseConfigured: false,
    };

    const rowan = await askMayorRowan({ question: "Mi día", ctx, allowGemini: false });
    assert.equal(rowan.mode, "deterministic_grounded");

    for (const bId of [
      "banco_oakhaven",
      "biblioteca",
      "oficina",
      "gimnasio",
      "club_puzzles",
      "libreria",
      "cine",
      "atelier",
    ]) {
      const r = await askBuildingSpecialist({
        buildingId: bId,
        question: "Estado actual",
        ctx,
        allowGemini: false,
      });
      assert.equal(r.specialist.buildingId, bId);
    }

    assert.equal(store.wallet_gp, gpBefore);
    assert.equal(store.current_xp, xpBefore);
    assert.equal(store.rubikSolves.length, solvesBefore);
  });
});
