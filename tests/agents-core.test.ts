import test from "node:test";
import assert from "node:assert/strict";
import {
  AutomationEventBus,
  AutomationTaskQueue,
  HumanApprovalGateway,
  SystemAuditLogger,
} from "../src/lib/automation/index.ts";
import {
  SystemGuardian,
  LifeCaptureAgent,
  AutonomousLifeManager,
} from "../src/lib/agents/index.ts";

test("Agents Core 1: SystemGuardian matriz de permisos de mínimo privilegio", async () => {
  const approvalGateway = new HumanApprovalGateway();
  const auditLogger = new SystemAuditLogger();
  const guardian = new SystemGuardian(approvalGateway, auditLogger);

  // 1. Life Analyst (solo lectura) intenta mutar finanzas -> RECHAZADO
  const analystMutation = await guardian.interceptAndEnforce(
    {
      agentCode: "life_analyst",
      userId: "usr_1",
      category: "financial_rebalance",
      actionName: "reallocate_funds",
      rationale: "Optimización no autorizada",
      payload: { amountCop: 10000 },
    },
    async () => ({ mutated: true })
  );

  assert.equal(analystMutation.executed, false);
  assert.equal(analystMutation.violationCode, "UNAUTHORIZED_AGENT_CATEGORY");
  assert.ok(analystMutation.reason?.includes("no tiene autorización"));

  // 2. Intento de inyección arbitraria de saldo -> RECHAZO DE INVARIANTE
  const hackAttempt = await guardian.interceptAndEnforce(
    {
      agentCode: "smart_expense",
      userId: "usr_1",
      category: "financial_rebalance",
      actionName: "direct_balance_injection",
      rationale: "Dinero inventado",
      payload: { amountCop: 50000 },
    },
    async () => ({ injected: true })
  );

  assert.equal(hackAttempt.executed, false);
  assert.equal(hackAttempt.violationCode, "UNAUTHORIZED_BALANCE_INJECTION");

  // 3. Acción financiera grande (>= $20.000 COP) -> REQUIERE APROBACIÓN HUMANA (HITL)
  const largeShift = await guardian.interceptAndEnforce(
    {
      agentCode: "smart_expense",
      userId: "usr_1",
      category: "financial_rebalance",
      actionName: "reallocate_category_budget",
      rationale: "Mover fondos a Bóveda",
      payload: { amountCop: 35000 },
    },
    async () => ({ transferred: true })
  );

  assert.equal(largeShift.executed, false);
  assert.equal(largeShift.requiresApproval, true);
  assert.ok(largeShift.approvalRequest);
  assert.equal(largeShift.approvalRequest.status, "pending");

  // 4. Acción autorizada y segura (< $20.000 COP) -> EJECUCIÓN AUTÓNOMA
  let executedLocally = false;
  const safeShift = await guardian.interceptAndEnforce(
    {
      agentCode: "smart_expense",
      userId: "usr_1",
      category: "financial_rebalance",
      actionName: "reallocate_category_budget",
      rationale: "Ajuste menor",
      payload: { amountCop: 12000 },
    },
    async () => {
      executedLocally = true;
      return { success: true, newBalance: 12000 };
    }
  );

  assert.equal(safeShift.executed, true);
  assert.equal(safeShift.requiresApproval, false);
  assert.equal(executedLocally, true);
  assert.deepEqual(safeShift.result, { success: true, newBalance: 12000 });

  // 5. Verificar que se registraron los logs de auditoría
  const auditLogs = auditLogger.getRecentLogs("usr_1");
  assert.ok(auditLogs.length >= 4, "Debe registrar cada intercepción en la auditoría");
});

test("Agents Core 2: LifeCaptureAgent ingesta y normalización de lenguaje natural", async () => {
  const bus = new AutomationEventBus();
  const captureAgent = new LifeCaptureAgent(bus);
  const emittedEvents: string[] = [];

  bus.on("EXPENSE_RECORDED", async (e) => {
    emittedEvents.push(`expense:${e.payload.amountCop}:${e.payload.category}`);
  });
  bus.on("SKILL_SESSION_COMPLETED", async (e) => {
    emittedEvents.push(`skill:${e.payload.domain}`);
  });
  bus.on("LIFE_EVENT_CAPTURED", async (e) => {
    emittedEvents.push(`note:${e.payload.intent}`);
  });

  // 1. Gasto en lenguaje natural
  const res1 = await captureAgent.ingestAndDispatch({
    userId: "usr_1",
    rawText: "Gasté $18.500 en almuerzo con amigos",
    source: "siri",
  });
  assert.equal(res1.normalized.intent, "expense");
  assert.equal(res1.normalized.data.amountCop, 18500);
  assert.equal(res1.normalized.data.category, "alimentacion");

  // 2. Solve de Rubik WCA
  const res2 = await captureAgent.ingestAndDispatch({
    userId: "usr_1",
    rawText: "cubo 3x3 en 13.45s",
    source: "ios_shortcut",
  });
  assert.equal(res2.normalized.domain, "rubik");
  assert.equal(res2.normalized.data.seconds, 13.45);

  // 3. Lectura profunda
  const res3 = await captureAgent.ingestAndDispatch({
    userId: "usr_1",
    rawText: "Leí 30 páginas de Hábitos Atómicos",
  });
  assert.equal(res3.normalized.domain, "reading");
  assert.equal(res3.normalized.data.pagesRead, 30);

  // 4. Santuario: Jardinería
  const res4 = await captureAgent.ingestAndDispatch({
    userId: "usr_1",
    rawText: "Hice jardinería y podé las plantas 30 minutos",
  });
  assert.equal(res4.normalized.domain, "gardening");

  // 5. Reflexión de Journaling
  const res5 = await captureAgent.ingestAndDispatch({
    userId: "usr_1",
    rawText: "Reflexión: Necesito priorizar la ventana matutina",
  });
  assert.equal(res5.normalized.intent, "reflection");

  assert.equal(emittedEvents.length, 5);
  assert.ok(emittedEvents.includes("expense:18500:alimentacion"));
  assert.ok(emittedEvents.includes("skill:rubik"));
  assert.ok(emittedEvents.includes("skill:reading"));
  assert.ok(emittedEvents.includes("skill:gardening"));
  assert.ok(emittedEvents.includes("note:reflection"));
});

test("Agents Core 3: AutonomousLifeManager enrutamiento multiagente y estado del consejo", async () => {
  const bus = new AutomationEventBus();
  const queue = new AutomationTaskQueue();
  const guardian = new SystemGuardian();
  const alm = new AutonomousLifeManager(bus, queue, guardian);

  // Emitir evento de gasto
  await bus.emit({
    id: "evt_test_exp",
    type: "EXPENSE_RECORDED",
    userId: "usr_1",
    timestamp: new Date().toISOString(),
    source: "shortcut",
    payload: { amountCop: 25000, category: "transporte" },
  });

  // El orquestador debió encolar tareas para 'smart_expense' y 'life_analyst'
  const tasks = queue.getAllTasks("usr_1");
  assert.equal(tasks.length, 2);
  const targetAgents = tasks.map((t) => t.targetAgent);
  assert.ok(targetAgents.includes("smart_expense"));
  assert.ok(targetAgents.includes("life_analyst"));

  // Verificar estado del Consejo de Agentes (11 agentes registrados)
  const council = alm.getCouncilStatus("usr_1");
  assert.equal(council.totalAgents, 11);
  assert.equal(council.agents.length, 11);
  assert.equal(council.systemHealth, "optimal");
  assert.equal(council.activeTasksCount, 2);

  // Validar nombres y roles
  const guardianState = council.agents.find((a) => a.code === "system_guardian");
  assert.ok(guardianState);
  assert.equal(guardianState.name, "System Guardian");
  assert.equal(guardianState.permissions.canMutateState, true);

  const analystState = council.agents.find((a) => a.code === "life_analyst");
  assert.ok(analystState);
  assert.equal(analystState.permissions.canMutateState, false);
});
