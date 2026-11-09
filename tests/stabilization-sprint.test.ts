import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_VERSION } from "../src/lib/version.ts";
import { getAppBaseUrl } from "../src/lib/app-url.ts";
import {
  AutomationEventBus,
  AutomationTaskQueue,
  SystemAuditLogger,
  buildHabitIdempotencyKey,
  calculateStreakMultiplier,
  clearHabitWorkflowIdempotencyCache,
  executeHabitCompletedWorkflow,
  registerHabitCompletedWorkflow,
  type SystemEvent,
  type HabitCompletedPayload,
} from "../src/lib/automation/index.ts";

test("Sprint Estabilización 1: Consistencia de Versionado Centralizado", () => {
  assert.equal(SYSTEM_VERSION.version, "3.5.0");
  assert.equal(SYSTEM_VERSION.apiVersion, "v3.5");
  assert.equal(SYSTEM_VERSION.releaseTag, "v3.5.0-autonomous-core");
  assert.ok(SYSTEM_VERSION.buildDate.startsWith("2026"));

  // Base URL en producción
  const envObj = process.env as Record<string, string | undefined>;
  const prevEnv = envObj.NODE_ENV;
  envObj.NODE_ENV = "production";
  const prodUrl = getAppBaseUrl();
  assert.notEqual(prodUrl, "http://localhost:3000");
  assert.ok(prodUrl.startsWith("https://"));
  envObj.NODE_ENV = prevEnv;
});

test("Sprint Estabilización 2: Claves de Idempotencia y Funciones Criptográficas", () => {
  const key1 = buildHabitIdempotencyKey("usr_1", "meditation", "2026-11-09");
  const key2 = buildHabitIdempotencyKey("usr_1", "meditation", "2026-11-09");
  const keyDiffDate = buildHabitIdempotencyKey("usr_1", "meditation", "2026-11-10");
  const keyDiffUser = buildHabitIdempotencyKey("usr_2", "meditation", "2026-11-09");

  assert.equal(key1, key2);
  assert.equal(key1.length, 64); // SHA-256 hex length
  assert.notEqual(key1, keyDiffDate);
  assert.notEqual(key1, keyDiffUser);
});

test("Sprint Estabilización 3: Multiplicadores de Racha Deterministas", () => {
  assert.equal(calculateStreakMultiplier(1), 1.0);
  assert.equal(calculateStreakMultiplier(6), 1.0);
  assert.equal(calculateStreakMultiplier(7), 1.1);
  assert.equal(calculateStreakMultiplier(13), 1.1);
  assert.equal(calculateStreakMultiplier(14), 1.25);
  assert.equal(calculateStreakMultiplier(29), 1.25);
  assert.equal(calculateStreakMultiplier(30), 1.5);
  assert.equal(calculateStreakMultiplier(100), 1.5);
});

test("Sprint Estabilización 4: Workflow HABIT_COMPLETED cálculo de recompensas y escudo", () => {
  clearHabitWorkflowIdempotencyCache();
  const auditLogger = new SystemAuditLogger();

  const payload: HabitCompletedPayload = {
    userId: "usr_isaac",
    habitId: "read_philosophy",
    habitName: "Lectura Filosófica",
    date: "2026-11-09",
    baseGp: 100,
    baseXp: 50,
    currentStreak: 6, // Llegará a 7 días -> otorga Aegis Shield
    walletGp: 500,
    vaultRemainingGp: 1000,
    totalXp: 200,
    aegisShields: 0,
    activeBossHp: 5000,
  };

  const result = executeHabitCompletedWorkflow(payload, auditLogger);

  assert.equal(result.success, true);
  assert.equal(result.isDuplicate, false);
  assert.equal(result.newStreakDays, 7);
  assert.equal(result.streakMultiplier, 1.1);
  assert.equal(result.xpAwarded, 55); // 50 * 1.1
  assert.equal(result.gpAwarded, 110); // 100 * 1.1
  assert.equal(result.aegisShieldAwarded, true); // Hito 7 días
  assert.equal(result.newAegisShields, 1);
  assert.equal(result.newWalletGp, 610); // 500 + 110
  assert.equal(result.newVaultGp, 890); // 1000 - 110 (conservación de fondos)
  assert.equal(result.newTotalXp, 255); // 200 + 55
  assert.ok(result.bossDamageDealt > 0);
  assert.equal(result.newBossHp, 5000 - result.bossDamageDealt);

  // Verificar auditoría criptográfica
  const logs = auditLogger.getRecentLogs("usr_isaac");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actionName, "HABIT_COMPLETED_REWARDS_AWARDED");
  assert.ok(logs[0].securityHash.length === 64);
});

test("Sprint Estabilización 5: Control de Idempotencia y Prevención de Duplicados", () => {
  clearHabitWorkflowIdempotencyCache();
  const auditLogger = new SystemAuditLogger();

  const payload: HabitCompletedPayload = {
    userId: "usr_isaac",
    habitId: "morning_workout",
    habitName: "Entrenamiento Matutino",
    date: "2026-11-09",
    baseGp: 100,
    baseXp: 50,
    currentStreak: 3,
    walletGp: 1000,
    vaultRemainingGp: 5000,
    totalXp: 1000,
  };

  const firstExecution = executeHabitCompletedWorkflow(payload, auditLogger);
  assert.equal(firstExecution.isDuplicate, false);
  assert.equal(firstExecution.newWalletGp, 1100);

  // Re-ejecutar el mismo evento (simulando doble clic o reintento de webhook)
  const duplicateExecution = executeHabitCompletedWorkflow(payload, auditLogger);
  assert.equal(duplicateExecution.isDuplicate, true);
  assert.equal(duplicateExecution.idempotencyKey, firstExecution.idempotencyKey);
  // Los valores retornados deben ser consistentes y no re-multiplicarse
  assert.equal(duplicateExecution.newWalletGp, 1100);

  // Solo debe haber 1 registro de auditoría creado
  const logs = auditLogger.getRecentLogs("usr_isaac");
  assert.equal(logs.length, 1);
});

test("Sprint Estabilización 6: Invariante Financiera — Bóveda Agotada no crea GP ficticio", () => {
  clearHabitWorkflowIdempotencyCache();
  const auditLogger = new SystemAuditLogger();

  const payload: HabitCompletedPayload = {
    userId: "usr_isaac",
    habitId: "late_review",
    habitName: "Revisión Nocturna",
    date: "2026-11-09",
    baseGp: 200,
    baseXp: 50,
    currentStreak: 0,
    walletGp: 300,
    vaultRemainingGp: 50, // Solo quedan 50 GP en la bóveda
    totalXp: 100,
  };

  const result = executeHabitCompletedWorkflow(payload, auditLogger);
  assert.equal(result.gpAwarded, 50); // Se restringe al disponible en bóveda
  assert.equal(result.newWalletGp, 350); // 300 + 50
  assert.equal(result.newVaultGp, 0); // Bóveda en 0, sin saldos negativos
});

test("Sprint Estabilización 7: Aislamiento entre Usuarios Multi-tenant", () => {
  clearHabitWorkflowIdempotencyCache();
  const auditLogger = new SystemAuditLogger();

  const userA: HabitCompletedPayload = {
    userId: "usr_alice",
    habitId: "reading",
    habitName: "Lectura",
    date: "2026-11-09",
    baseGp: 100,
    currentStreak: 2,
    walletGp: 100,
    vaultRemainingGp: 1000,
    totalXp: 100,
  };

  const userB: HabitCompletedPayload = {
    userId: "usr_bob",
    habitId: "reading",
    habitName: "Lectura",
    date: "2026-11-09",
    baseGp: 100,
    currentStreak: 13, // Llegará a 14 -> 1.25x
    walletGp: 500,
    vaultRemainingGp: 2000,
    totalXp: 1500,
  };

  const resA = executeHabitCompletedWorkflow(userA, auditLogger);
  const resB = executeHabitCompletedWorkflow(userB, auditLogger);

  assert.equal(resA.isDuplicate, false);
  assert.equal(resB.isDuplicate, false);
  assert.notEqual(resA.idempotencyKey, resB.idempotencyKey);
  assert.equal(resA.streakMultiplier, 1.0);
  assert.equal(resB.streakMultiplier, 1.25);
  assert.equal(resA.newStreakDays, 3);
  assert.equal(resB.newStreakDays, 14);

  // Auditoría separada por usuario
  assert.equal(auditLogger.getRecentLogs("usr_alice").length, 1);
  assert.equal(auditLogger.getRecentLogs("usr_bob").length, 1);
});

test("Sprint Estabilización 8: EventBus con Eventos Canónicos y Suscripción de Workflow", async () => {
  clearHabitWorkflowIdempotencyCache();
  const bus = new AutomationEventBus();
  const auditLogger = new SystemAuditLogger();

  // Suscribir workflow canónico
  const unsubscribe = registerHabitCompletedWorkflow(bus, auditLogger);

  const event: SystemEvent<HabitCompletedPayload> = {
    id: "evt_habit_1",
    type: "HABIT_COMPLETED",
    userId: "usr_carol",
    timestamp: new Date().toISOString(),
    source: "shortcut",
    payload: {
      userId: "usr_carol",
      habitId: "rubik_solve",
      habitName: "Práctica de Cubo Rubik",
      date: "2026-11-09",
      baseGp: 80,
      baseXp: 40,
      currentStreak: 5,
      walletGp: 200,
      vaultRemainingGp: 600,
      totalXp: 300,
    },
  };

  await bus.emit(event);

  const logs = auditLogger.getRecentLogs("usr_carol");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].newState?.habitName, "Práctica de Cubo Rubik");

  unsubscribe();
});
