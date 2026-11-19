import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import {
  askBuildingSpecialist,
  buildLevel2ProposalIfRequested,
  getSpecialistSkillForBuilding,
} from "../src/lib/ai/specialist-engine.ts";
import type { MayorToolContext } from "../src/lib/ai/mayor-readonly-tools.ts";

function makeCtx(overrides?: Partial<MayorToolContext>): MayorToolContext {
  const store = new RPGEngineMemoryStore();
  store.readingBooks = [];
  store.knittingProjects = [];
  store.financialMovements = [];
  store.skillSessions = [];
  store.rubikSolves = [];
  store.workProjects = [];
  return {
    authenticatedUserId: "11111111-1111-4111-8111-111111111111",
    db: null,
    store,
    isSupabaseConfigured: false,
    ...overrides,
  };
}

describe("OAKHAVEN AI — FASE 2 (8 Especialistas & Propuestas Nivel 2)", () => {
  test("1. Cada uno de los 8 edificios tiene su especialista y solo usa herramientas de su dominio", async () => {
    const ctx = makeCtx();
    const buildings = [
      { id: "banco_oakhaven", expectedTool: "getRecentExpenses", specialist: "Silas" },
      { id: "biblioteca", expectedTool: "getStudyProgress", specialist: "Lyra" },
      { id: "oficina", expectedTool: "getPendingWorkProjects", specialist: "Aura" },
      { id: "gimnasio", expectedTool: "getLastWorkout", specialist: "Bruno" },
      { id: "club_puzzles", expectedTool: "getRecentCubeSolves", specialist: "Milo" },
      { id: "libreria", expectedTool: "getLastReadBook", specialist: "Eldrin" },
      { id: "cine", expectedTool: "getLastWatchedMedia", specialist: "Nora" },
      { id: "atelier", expectedTool: "getLastKnittingActivity", specialist: "Clara" },
    ];

    for (const b of buildings) {
      const res = await askBuildingSpecialist({
        buildingId: b.id,
        question: "¿Cómo voy aquí?",
        ctx,
        allowGemini: false,
      });
      assert.equal(res.specialist.name, b.specialist);
      assert.ok(
        res.toolsUsed.includes(b.expectedTool),
        `${b.specialist} debe incluir su herramienta principal ${b.expectedTool}`
      );
    }
  });

  test("2. Propuestas Nivel 2 exigen confirmación explícita y NO mutan el store automáticamente", async () => {
    const ctx = makeCtx();
    const clara = getSpecialistSkillForBuilding("atelier")!;
    const prop = buildLevel2ProposalIfRequested(clara, 'Crea un proyecto "Bufanda Invierno"');
    assert.ok(prop);
    assert.equal(prop.requiresConfirmation, true);
    assert.equal(prop.actionType, "add_knitting_project");
    assert.equal(prop.payload.title, "Bufanda Invierno");

    const res = await askBuildingSpecialist({
      buildingId: "atelier",
      question: 'Crea un proyecto "Bufanda Invierno"',
      ctx,
      allowGemini: false,
    });
    assert.equal(res.proposal?.requiresConfirmation, true);
    assert.equal(ctx.store.knittingProjects.length, 0, "No debe crear el proyecto sin confirmación humana");

    const cineRes = await askBuildingSpecialist({
      buildingId: "cine",
      question: 'Agrega el musical "Wicked"',
      ctx,
      allowGemini: false,
    });
    assert.equal(cineRes.proposal?.actionType, "add_cinema_entry");
    assert.equal(cineRes.proposal?.payload.kind, "musical");
    assert.equal(cineRes.proposal?.requiresConfirmation, true);
  });

  test("3. Especialistas bloquean Nivel 3 (pagos/GP/XP) y respetan interruptor individual", async () => {
    const ctx = makeCtx();
    const initialGp = ctx.store.wallet_gp;

    const blocked = await askBuildingSpecialist({
      buildingId: "banco_oakhaven",
      question: "Ejecuta un pago de 80000 COP ahora",
      ctx,
      allowGemini: false,
    });
    assert.equal(blocked.mode, "blocked_safety");
    assert.equal(blocked.toolsUsed.length, 0);
    assert.equal(ctx.store.wallet_gp, initialGp);

    const muted = await askBuildingSpecialist({
      buildingId: "atelier",
      question: "¿Cuántas vueltas llevo?",
      ctx,
      allowGemini: false,
      disabledSkillIds: ["oakhaven.specialist.crochet.clara"],
    });
    assert.equal(muted.mode, "disabled");
    assert.equal(muted.toolsUsed.length, 0);
  });

  test("4. LivingInteriorRoom integra BuildingSpecialistPanel para los 8 edificios", () => {
    const content = fs.readFileSync(
      path.join(process.cwd(), "src", "components", "sanctuary", "living-interior-room.tsx"),
      "utf8"
    );
    assert.ok(content.includes("<BuildingSpecialistPanel"));
  });
});
