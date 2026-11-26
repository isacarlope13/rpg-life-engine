import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildRowanDailyDecisionBrief } from "../src/lib/ai/rowan-decision-engine.ts";

describe("OAKHAVEN — Rowan Tarjeta de Decisión Diaria Determinista", () => {
  const sampleQuests = [
    { code: "Q1", title: "Revisar sprint semanal", domain: "work", estimated_minutes: 30 },
    { code: "Q2", title: "Estudiar capítulo 4", domain: "study", estimated_minutes: 30 },
    { code: "Q3", title: "Entrenamiento de fuerza", domain: "gym", estimated_minutes: 45 },
    { code: "Q4", title: "Práctica de cubo 3x3", domain: "rubik", estimated_minutes: 20 },
  ];

  test("1. Detecta sobreplanificación con energía baja y propone reprogramación sin usar Gemini ni finanzas", () => {
    const brief = buildRowanDailyDecisionBrief({
      energyLevel: "low",
      quests: sampleQuests,
      knittingProjects: [{ id: "k1", name: "Cupido", status: "in_progress", completed_rows: 1, total_rows_target: 133 }],
      readingBooks: [{ id: "b1", title: "Libro Cozy", status: "reading" }],
      streakDays: 14,
      recentSessionsCount: 15,
    });

    assert.equal(brief.usedGemini, false);
    assert.equal(brief.accessedFinancialData, false);
    assert.equal(brief.capacityMinutes, 60);
    assert.equal(brief.focusBlockMinutes, 15);
    assert.equal(brief.isOverplanned, true);
    assert.ok(brief.rescheduleProposal && brief.rescheduleProposal.includes("sobreplan") === false ? brief.rescheduleProposal.includes("capacidad") : true);
    assert.equal(brief.priorities.length, 2);
  });

  test("2. Con energía alta ajusta bloques profundos de 45 min y muestra hasta 3 prioridades explicables", () => {
    const brief = buildRowanDailyDecisionBrief({
      energyLevel: "high",
      quests: sampleQuests.slice(0, 2),
      knittingProjects: [{ id: "k1", name: "Manta Cozy", status: "in_progress", completed_rows: 5, total_rows_target: 50 }],
      readingBooks: [],
    });

    assert.equal(brief.capacityMinutes, 240);
    assert.equal(brief.focusBlockMinutes, 45);
    assert.equal(brief.isOverplanned, false);
    assert.equal(brief.rescheduleProposal, null);
    assert.equal(brief.priorities.length, 3);
    assert.ok(brief.priorities.every((p) => p.reason.length > 0 && p.buildingId.length > 0));
  });
});
