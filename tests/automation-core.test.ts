import test from "node:test";
import assert from "node:assert/strict";
import {
  AutomationEventBus,
  AutomationTaskQueue,
  AutomationRuleEngine,
  HumanApprovalGateway,
  SystemAuditLogger,
  CircadianScheduler,
  type SystemEvent,
} from "../src/lib/automation/index.ts";

test("Automation Core 1: EventBus pub/sub, asincronía e historial desacoplado", async () => {
  const bus = new AutomationEventBus();
  const received: string[] = [];

  const unsubscribe = bus.on("SKILL_SESSION_COMPLETED", async (event) => {
    received.push(`handler1:${event.payload.domain}`);
  });

  bus.on("SKILL_SESSION_COMPLETED", async (event) => {
    received.push(`handler2:${event.payload.domain}`);
  });

  const event1: SystemEvent = {
    id: "evt_1",
    type: "SKILL_SESSION_COMPLETED",
    userId: "usr_test",
    timestamp: new Date().toISOString(),
    source: "user",
    payload: { domain: "gardening", minutes: 30 },
  };

  await bus.emit(event1);

  assert.equal(received.length, 2);
  assert.ok(received.includes("handler1:gardening"));
  assert.ok(received.includes("handler2:gardening"));

  // Verificar historial
  const history = bus.getRecentHistory();
  assert.equal(history.length, 1);
  assert.equal(history[0].id, "evt_1");

  // Probar desuscripción
  unsubscribe();
  received.length = 0;
  await bus.emit(event1);
  assert.equal(received.length, 1);
  assert.equal(received[0], "handler2:gardening");
});

test("Automation Core 2: TaskQueue con Idempotencia estricta, Reintentos y Dead-Letter", async () => {
  const queue = new AutomationTaskQueue();
  let executionCount = 0;

  queue.registerWorker("life_analyst", async (task) => {
    executionCount++;
    if (task.event.payload.shouldFail) {
      throw new Error("Simulated worker error");
    }
    return { analyzed: true };
  });

  const event: SystemEvent = {
    id: "evt_task_1",
    type: "LIFE_EVENT_CAPTURED",
    userId: "usr_test",
    timestamp: new Date().toISOString(),
    source: "shortcut",
    payload: { text: "Práctica de 15 minutos en Cubo 3x3" },
  };

  // 1. Encolar tarea inicial
  const firstEnqueue = queue.enqueue({
    userId: "usr_test",
    idempotencyKey: "idem_key_unique_123",
    event,
    targetAgent: "life_analyst",
    maxRetries: 2,
  });

  assert.equal(firstEnqueue.isDuplicate, false);
  assert.equal(firstEnqueue.task.status, "pending");

  // 2. Intento de encolar duplicado con la MISMA clave de idempotencia
  const duplicateEnqueue = queue.enqueue({
    userId: "usr_test",
    idempotencyKey: "idem_key_unique_123",
    event,
    targetAgent: "life_analyst",
  });

  assert.equal(duplicateEnqueue.isDuplicate, true);
  assert.equal(duplicateEnqueue.task.id, firstEnqueue.task.id);

  // 3. Procesar la tarea exitosamente
  const processed = await queue.processTask(firstEnqueue.task.id);
  assert.equal(processed.status, "completed");
  assert.equal(executionCount, 1);
  assert.deepEqual(processed.result, { analyzed: true });

  // 4. Probar reintentos y dead-letter en fallas repetidas
  const failingEvent: SystemEvent = {
    ...event,
    id: "evt_fail_1",
    payload: { shouldFail: true },
  };

  const failingEnqueue = queue.enqueue({
    userId: "usr_test",
    idempotencyKey: "idem_fail_456",
    event: failingEvent,
    targetAgent: "life_analyst",
    maxRetries: 2,
  });

  // Reintento 1
  const attempt1 = await queue.processTask(failingEnqueue.task.id);
  assert.equal(attempt1.status, "pending");
  assert.equal(attempt1.retries, 1);

  // Reintento 2 (alcanza maxRetries -> dead_letter)
  const attempt2 = await queue.processTask(failingEnqueue.task.id);
  assert.equal(attempt2.status, "dead_letter");
  assert.equal(attempt2.retries, 2);
  assert.ok(attempt2.error?.includes("Simulated worker error"));
});

test("Automation Core 3: RuleEngine e Invariantes de Seguridad y Protección Financiera", () => {
  // 1. Bloqueo de inyección arbitraria de saldo
  const hackAttempt = AutomationRuleEngine.validateProposedAction({
    category: "financial",
    actionName: "direct_balance_injection",
    payload: { amountCop: 500000 },
  });
  assert.equal(hackAttempt.isValid, false);
  assert.equal(hackAttempt.violationCode, "UNAUTHORIZED_BALANCE_INJECTION");

  // 2. Bloqueo de perdón de deuda sin pago verificado
  const fakeForgiveness = AutomationRuleEngine.validateProposedAction({
    category: "debt",
    actionName: "reduce_boss_hp",
    payload: { amountCop: 200000, verifiedPaymentTransactionId: null },
  });
  assert.equal(fakeForgiveness.isValid, false);
  assert.equal(fakeForgiveness.violationCode, "UNVERIFIED_DEBT_REDUCTION");

  // 3. Quests dinámicas con recompensa > 4,000 GP requieren aprobación humana
  const highRewardQuest = AutomationRuleEngine.validateProposedAction({
    category: "quest_override",
    actionName: "generate_dynamic_quest",
    payload: { reward_gp: 6500 },
  });
  assert.equal(highRewardQuest.isValid, true);
  assert.equal(highRewardQuest.requiresApproval, true);

  // 4. Ajustes presupuestales >= $20,000 COP requieren aprobación humana obligatoria
  const budgetShift = AutomationRuleEngine.validateProposedAction({
    category: "financial_rebalance",
    actionName: "reallocate_category_budget",
    payload: { amountCop: 45000 },
  });
  assert.equal(budgetShift.isValid, true);
  assert.equal(budgetShift.requiresApproval, true);

  // 5. Ajuste menor seguro no requiere aprobación
  const smallBudgetShift = AutomationRuleEngine.validateProposedAction({
    category: "financial_rebalance",
    actionName: "reallocate_category_budget",
    payload: { amountCop: 10000 },
  });
  assert.equal(smallBudgetShift.isValid, true);
  assert.equal(smallBudgetShift.requiresApproval, false);

  // 6. Violación de descanso circadiano (< 6.5h)
  const badSleepShift = AutomationRuleEngine.validateProposedAction({
    category: "schedule_shift",
    actionName: "reorganize_sleep_window",
    payload: { proposedSleepHours: 4.5 },
  });
  assert.equal(badSleepShift.isValid, false);
  assert.equal(badSleepShift.violationCode, "CIRCADIAN_HEALTH_VIOLATION");
});

test("Automation Core 4: HumanApprovalGateway y Ciclo de Vida de Aprobaciones", () => {
  const gateway = new HumanApprovalGateway();

  const req = gateway.createRequest({
    userId: "usr_test",
    agentSource: "economic_intelligence",
    actionCategory: "financial_rebalance",
    title: "Transferir $30.000 COP de Operativos a Bóveda de Ahorro",
    summaryRationale: "Se detectó superávit semanal en gastos de ocio.",
    diffPayload: {
      current: { vault_gp: 300000, variable_ops: 120000 },
      proposed: { vault_gp: 330000, variable_ops: 90000 },
    },
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  });

  assert.equal(req.status, "pending");
  assert.equal(gateway.getPendingRequests("usr_test").length, 1);

  // Resolver como aprobada
  const resolved = gateway.resolveRequest(req.id, "approved", "user");
  assert.equal(resolved.status, "approved");
  assert.equal(resolved.resolvedBy, "user");
  assert.equal(gateway.getPendingRequests("usr_test").length, 0);

  // Error al intentar resolver dos veces
  assert.throws(() => {
    gateway.resolveRequest(req.id, "rejected", "user");
  }, /ya fue resuelta previamente/);
});

test("Automation Core 5: SystemAuditLogger con Hash Criptográfico SHA-256", () => {
  const logger = new SystemAuditLogger();

  const log1 = logger.logAction({
    userId: "usr_test",
    actorType: "agent",
    actorId: "system_guardian",
    actionName: "enforce_invariant",
    resourceAffected: "player_treasury",
    previousState: { wallet_gp: 5000 },
    newState: { wallet_gp: 5000 },
  });

  assert.ok(log1.securityHash.length === 64, "Debe ser un hash SHA-256 de 64 caracteres hex");
  assert.equal(log1.actionName, "enforce_invariant");

  const recent = logger.getRecentLogs("usr_test");
  assert.equal(recent.length, 1);
  assert.equal(recent[0].id, log1.id);
});

test("Automation Core 6: CircadianScheduler, Fases Biológicas, Riesgo de Racha y Enrage Timers", async () => {
  const bus = new AutomationEventBus();
  const scheduler = new CircadianScheduler(bus);
  const emittedTypes: string[] = [];

  bus.on("CIRCADIAN_PHASE_CHANGED", async (e) => {
    emittedTypes.push(e.type);
  });
  bus.on("STREAK_AT_RISK", async (e) => {
    emittedTypes.push(e.type);
  });
  bus.on("BOSS_ENRAGE_WARNING", async (e) => {
    emittedTypes.push(e.type);
  });

  // Test de fases biológicas deterministas
  assert.equal(scheduler.getCircadianPhase("07:00", "06:00", "08:00", "17:30", "22:30"), "morning_window");
  assert.equal(scheduler.getCircadianPhase("10:00", "06:00", "08:00", "17:30", "22:30"), "work_window");
  assert.equal(scheduler.getCircadianPhase("19:00", "06:00", "08:00", "17:30", "22:30"), "evening_sanctuary");
  assert.equal(scheduler.getCircadianPhase("22:15", "06:00", "08:00", "17:30", "22:30"), "sleep_prep");

  // Simulación a las 21:00 (Noche, racha de 5 días sin hábitos aún hoy, y un jefe con vencimiento en 24h)
  const simDate = new Date("2026-11-09T21:00:00.000Z");
  const enrageDueDate = new Date("2026-11-10T21:00:00.000Z").toISOString(); // en 24h

  const events = await scheduler.evaluateCircadianCycle({
    userId: "usr_test",
    now: simDate,
    currentTimeStr: "21:00",
    wakeUpTime: "06:00",
    sleepTime: "22:30",
    workStartHour: "08:00",
    workEndHour: "17:30",
    streakDays: 5,
    habitsCompletedToday: false,
    bossesEnrageDueDates: [
      { bossId: "boss_nu", bossName: "Gólem NuBank", dueDate: enrageDueDate },
    ],
  });

  assert.equal(events.length, 3);
  assert.ok(emittedTypes.includes("CIRCADIAN_PHASE_CHANGED"));
  assert.ok(emittedTypes.includes("STREAK_AT_RISK"));
  assert.ok(emittedTypes.includes("BOSS_ENRAGE_WARNING"));
});
