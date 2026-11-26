import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  createInitialCommandCenterState,
  enqueueCommandTask,
  getRegisteredAgentCatalog,
  resolveCommandApproval,
  routePersonalCommandRequest,
} from "../src/lib/ai/command-center-core.ts";
import {
  createInitialAutomationState,
  runAutomationCycle,
  type AutomationContextSnapshot,
} from "../src/lib/automation/personal-automation-core.ts";

describe("OAKHAVEN P2 — AI Command Center & Automation Core", () => {
  test("1. Command Center integra especialistas existentes, enruta deterministamente y exige aprobación humana", () => {
    const catalog = getRegisteredAgentCatalog();
    assert.ok(catalog.length >= 5);
    assert.ok(catalog.some((a) => a.residentId === "clara"));
    assert.ok(catalog.some((a) => a.residentId === "rowan"));

    const r1 = routePersonalCommandRequest("Ayúdame a leer un patrón de Filet Crochet de Priscilla");
    assert.equal(r1.agent.residentId, "clara");
    assert.equal(r1.requiresApproval, false);

    const r2 = routePersonalCommandRequest("Revisa mi presupuesto en COP");
    assert.equal(r2.agent.residentId, "silas");
    assert.equal(r2.requiresApproval, true);

    let state = createInitialCommandCenterState(1000);
    const enq = enqueueCommandTask(state, { prompt: "Reprogramar tareas de hoy", deterministic: true });
    state = enq.nextState;
    assert.equal(enq.task.status, "pending_approval");
    assert.equal(state.tokensUsedToday, 0);

    state = resolveCommandApproval(state, enq.task.id, "approve");
    assert.equal(state.tasks[0].status, "completed");

    // Control de presupuesto de tokens
    const over = enqueueCommandTask(state, { prompt: "Análisis profundo", deterministic: false, estimatedTokens: 1500 });
    assert.equal(over.task.status, "failed");
    assert.equal(over.nextState.errorLog.length, 1);
  });

  test("2. Automation Core soporta simulación, idempotencia, aprobación e interruptor de emergencia", () => {
    const ctx: AutomationContextSnapshot = {
      dateBucket: "2026-11-26",
      abandonedProjects: [{ id: "p1", name: "Manta vieja", daysSinceUpdate: 20 }],
      pendingCreativeProjects: [{ id: "k1", name: "Cupido" }],
      plannedMinutesToday: 210,
      capacityMinutesToday: 150,
      studyMinutesToday: 0,
      budgetSpentRatioPct: 90,
    };

    let state = createInitialAutomationState();
    // Simulación (dry-run) no registra llaves de idempotencia definitivas
    const sim = runAutomationCycle(state, ctx, { simulate: true });
    assert.equal(sim.records.length, 6);
    assert.ok(sim.records.every((r) => r.status === "simulated"));
    assert.equal(sim.nextState.executedKeys.length, 0);

    // Ejecución real: reglas sensibles quedan pending_approval
    const run1 = runAutomationCycle(state, ctx, { simulate: false });
    state = run1.nextState;
    assert.ok(run1.records.some((r) => r.ruleId === "rule_budget_drift" && r.status === "pending_approval"));
    assert.ok(run1.records.some((r) => r.ruleId === "rule_daily_summary" && r.status === "executed"));

    // Idempotencia: segunda ejecución el mismo día omite duplicados
    const run2 = runAutomationCycle(state, ctx, { simulate: false });
    assert.ok(run2.records.every((r) => r.status === "skipped_duplicate"));

    // Interruptor de emergencia detiene cualquier ciclo
    const stopped = runAutomationCycle({ ...state, emergencyStop: true }, ctx, { simulate: false });
    assert.equal(stopped.records.length, 1);
    assert.equal(stopped.records[0].status, "blocked_emergency");
  });
});
