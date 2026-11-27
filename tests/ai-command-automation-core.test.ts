import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildControlledSharedContext,
  cancelCommandTask,
  createInitialCommandCenterState,
  enqueueCommandTask,
  getRegisteredAgentCatalog,
  resolveCommandApproval,
  routePersonalCommandRequest,
} from "../src/lib/ai/command-center-core.ts";
import {
  DEFAULT_PERSONAL_AUTOMATION_RULES,
  createInitialAutomationState,
  deserializeAutomationState,
  runAutomationCycle,
  serializeAutomationState,
  type AutomationContextSnapshot,
} from "../src/lib/automation/personal-automation-core.ts";
import { OakHavenInternalEventBus } from "../src/lib/events/oakhaven-event-bus.ts";

describe("OAKHAVEN FASES 4-8 — AI Command Center, 10 Automatizaciones, EventBus y Seguridad", () => {
  const richCtx: AutomationContextSnapshot = {
    dateBucket: "2026-11-26",
    abandonedProjects: [{ id: "p1", name: "Manta vieja", daysSinceUpdate: 20 }],
    pendingCreativeProjects: [{ id: "k1", name: "Cupido" }],
    overdueTasks: [{ id: "t1", title: "Enviar informe", daysOverdue: 2 }],
    personalGoals: [{ id: "g1", title: "Leer 12 libros", progressPct: 25 }],
    plannedMinutesToday: 210,
    capacityMinutesToday: 150,
    studyMinutesToday: 0,
    budgetSpentRatioPct: 90,
    consecutiveWorkDays: 6,
    isWeeklyReviewDay: true,
  };

  test("1. Registro de agentes reutiliza especialistas existentes sin duplicarlos ni permitir mutar COP/GP", () => {
    const catalog = getRegisteredAgentCatalog();
    assert.ok(catalog.length >= 5);
    assert.ok(catalog.every((a) => a.canMutateRealMoneyOrGp === false));
    assert.ok(catalog.some((a) => a.residentId === "clara"));
    assert.ok(catalog.some((a) => a.residentId === "silas"));
    assert.ok(catalog.some((a) => a.residentId === "rowan"));
  });

  test("2. Contexto compartido aísla estrictamente dinero real COP solo para Silas", () => {
    const claraCtx = buildControlledSharedContext("clara", {
      activeProjectsCount: 6,
      pendingTasksCount: 3,
      streakDays: 14,
      availableRealMoneyCop: 1500000,
    });
    assert.equal(claraCtx.financialDataVisible, false);
    assert.equal(claraCtx.availableRealMoneyCop, undefined);

    const silasCtx = buildControlledSharedContext("silas", {
      activeProjectsCount: 6,
      pendingTasksCount: 3,
      streakDays: 14,
      availableRealMoneyCop: 1500000,
    });
    assert.equal(silasCtx.financialDataVisible, true);
    assert.equal(silasCtx.availableRealMoneyCop, 1500000);
  });

  test("3. Enrutamiento determinista, aprobaciones humanas y registro de decisiones", () => {
    const rClara = routePersonalCommandRequest("Ayúdame a leer un patrón de Filet Crochet de Priscilla");
    assert.equal(rClara.agent.residentId, "clara");
    assert.equal(rClara.requiresApproval, false);

    const rSilas = routePersonalCommandRequest("Revisa mi presupuesto en COP");
    assert.equal(rSilas.agent.residentId, "silas");
    assert.equal(rSilas.requiresApproval, true);

    let state = createInitialCommandCenterState(1000);
    const enq = enqueueCommandTask(state, { prompt: "Reprogramar tareas de hoy", deterministic: true });
    state = enq.nextState;
    assert.equal(enq.task.status, "pending_approval");
    assert.equal(state.tokensUsedToday, 0);

    state = resolveCommandApproval(state, enq.task.id, "approve");
    assert.equal(state.tasks[0].status, "completed");
    assert.equal(state.decisionLog.length, 1);
    assert.equal(state.decisionLog[0].decision, "approved");
  });

  test("4. Cancelación manual de ejecuciones pendientes y rechazo seguro de tareas ya completadas", () => {
    let state = createInitialCommandCenterState(2000);
    const pending = enqueueCommandTask(state, { prompt: "Eliminar borrador viejo", deterministic: true });
    state = cancelCommandTask(pending.nextState, pending.task.id);
    assert.equal(state.tasks[0].status, "cancelled");
    assert.equal(state.decisionLog[0].decision, "cancelled");

    const done = enqueueCommandTask(state, { prompt: "Resumen de lectura", deterministic: true });
    const afterTryCancel = cancelCommandTask(done.nextState, done.task.id);
    assert.equal(afterTryCancel.tasks[0].status, "completed");
  });

  test("5. Presupuesto diario de tokens bloquea excesos y registra fallo en errorLog", () => {
    const state = createInitialCommandCenterState(1000);
    const over = enqueueCommandTask(state, {
      prompt: "Análisis profundo",
      deterministic: false,
      estimatedTokens: 1500,
    });
    assert.equal(over.task.status, "failed");
    assert.equal(over.nextState.errorLog.length, 1);
    assert.equal(over.nextState.tokensUsedToday, 0);
  });

  test("6. Automation Core implementa las 10 reglas personales y todas corren en modo simulación sin efectos", () => {
    assert.equal(DEFAULT_PERSONAL_AUTOMATION_RULES.length, 10);
    const state = createInitialAutomationState();
    const sim = runAutomationCycle(state, richCtx, { simulate: true });
    assert.equal(sim.records.length, 10);
    assert.ok(sim.records.every((r) => r.status === "simulated"));
    assert.equal(sim.nextState.executedKeys.length, 0);
  });

  test("7. Idempotencia diaria, aprobación obligatoria en reglas sensibles y límite por ciclo", () => {
    let state = createInitialAutomationState();
    const run1 = runAutomationCycle(state, richCtx, { simulate: false, maxExecutionsPerCycle: 10 });
    state = run1.nextState;
    assert.ok(run1.records.some((r) => r.ruleId === "rule_budget_drift" && r.status === "pending_approval"));
    assert.ok(run1.records.some((r) => r.ruleId === "rule_overdue_tasks" && r.status === "pending_approval"));
    assert.ok(run1.records.some((r) => r.ruleId === "rule_daily_summary" && r.status === "executed"));

    // Replay mismo día: todas omitidas por idempotencia
    const run2 = runAutomationCycle(state, richCtx, { simulate: false });
    assert.ok(run2.records.every((r) => r.status === "skipped_duplicate"));

    // Límite por ciclo
    const capped = runAutomationCycle(createInitialAutomationState(), richCtx, {
      simulate: true,
      maxExecutionsPerCycle: 3,
    });
    assert.equal(capped.records.filter((r) => r.status === "simulated").length, 3);
    assert.equal(capped.records.filter((r) => r.status === "blocked_rate_limit").length, 7);
  });

  test("8. Prevención de ciclos infinitos (maxChainDepth) e interruptor de emergencia global", () => {
    const state = createInitialAutomationState();
    const loopRes = runAutomationCycle(state, richCtx, { chainDepth: 4, maxChainDepth: 3 });
    assert.equal(loopRes.records[0].status, "blocked_loop_guard");

    const stopRes = runAutomationCycle({ ...state, emergencyStop: true }, richCtx);
    assert.equal(stopRes.records[0].status, "blocked_emergency");
  });

  test("9. Persistencia serializable de cola de automatizaciones y recuperación segura ante JSON corrupto", () => {
    const run1 = runAutomationCycle(createInitialAutomationState(), richCtx, { simulate: false });
    const raw = serializeAutomationState(run1.nextState);
    const restored = deserializeAutomationState(raw);
    assert.equal(restored.executedKeys.length, run1.nextState.executedKeys.length);
    assert.equal(restored.history.length, run1.nextState.history.length);

    const corrupt = deserializeAutomationState("{not-valid-json");
    assert.equal(corrupt.schemaVersion, 1);
    assert.equal(corrupt.executedKeys.length, 0);
  });

  test("10. EventBus interno evita duplicación de recompensas y /cozy integra Command Center + Ctrl+K", () => {
    const bus = new OakHavenInternalEventBus();
    const first = bus.dispatch({
      eventId: "evt_crochet_1",
      type: "crochet_session_completed",
      occurredAt: "2026-11-26T16:00:00Z",
      sourceModule: "atelier",
      payload: { projectId: "k1" },
    });
    assert.equal(first.accepted, true);
    assert.equal(first.mutatedGpOrXp, false);
    assert.equal(first.mutatedRealMoneyCop, false);

    const dup = bus.dispatch({
      eventId: "evt_crochet_1",
      type: "crochet_session_completed",
      occurredAt: "2026-11-26T16:00:05Z",
      sourceModule: "atelier",
      payload: { projectId: "k1" },
    });
    assert.equal(dup.duplicate, true);
    assert.equal(dup.accepted, false);

    const cozySrc = fs.readFileSync(
      new URL("../src/components/cozy-rpg-dashboard.tsx", import.meta.url),
      "utf8"
    );
    assert.match(cozySrc, /AiCommandAutomationPanel/);
    assert.match(cozySrc, /CozyCommandPalette/);
  });
});
